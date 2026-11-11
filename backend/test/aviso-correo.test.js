// Aviso por correo de mensajes nuevos: solo tipo y urgencia (nunca contenido), agrupa ráfagas, un fallo del correo no afecta a
// nadie y nunca se manda nada real (las pruebas reemplazan `mail.send`).
import { test, before, after, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.js';

let t;
let notify;
const original = {};
let sent;

before(async () => {
  t = await startServer();
  notify = await import('../src/notify.js');
  original.send = notify.mail.send;
});
after(() => t.stop());

beforeEach(() => {
  notify.resetNotifications();
  sent = [];
  notify.mail.send = async (mail) => { sent.push(mail); };
  Object.assign(process.env, { RESEND_API_KEY: 'clave-resend-prueba', NOTIFY_EMAIL_TO: 'avisos@test.com', NOTIFY_WINDOW_MS: '0' });
});
afterEach(() => {
  notify.mail.send = original.send;
  for (const name of ['RESEND_API_KEY', 'NOTIFY_EMAIL_TO', 'MAIL_FROM', 'SITE_URL', 'NOTIFY_WINDOW_MS']) delete process.env[name];
  mock.restoreAll();
});

const esperar = async (cond, ms = 3000) => {
  const inicio = Date.now();
  while (!cond()) {
    if (Date.now() - inicio > ms) throw new Error('se agotó la espera');
    await new Promise((r) => setTimeout(r, 15));
  }
};
const pausa = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const anonimo = (extra = {}) => ({ type: 'pregunta', anonymous: true, subject: 'Asunto privado del mensaje', body: 'Texto privado del mensaje de prueba', ...extra });
const enviar = (body) => t.call('POST', '/messages', { body });

test('sin configurar (sin clave o sin destinatarios) no se manda nada y el buzón funciona igual', async () => {
  delete process.env.RESEND_API_KEY;
  assert.equal((await enviar(anonimo())).status, 201);
  process.env.RESEND_API_KEY = 'clave-resend-prueba';
  delete process.env.NOTIFY_EMAIL_TO;
  assert.equal((await enviar(anonimo())).status, 201);
  process.env.NOTIFY_EMAIL_TO = 'esto-no-es-un-correo, tampoco@'; // inválidos: se ignoran
  assert.equal((await enviar(anonimo())).status, 201);
  await pausa();
  assert.deepEqual(sent, []);
});

test('un mensaje nuevo manda un correo con solo el tipo, la urgencia y el enlace al panel', async () => {
  process.env.NOTIFY_EMAIL_TO = 'avisos@test.com, otra@test.com, invalido';
  const res = await enviar(anonimo({ type: 'queja', urgency: 'alta' }));
  assert.equal(res.status, 201);
  await esperar(() => sent.length === 1);
  const [mail] = sent;
  assert.deepEqual(mail.to, ['avisos@test.com', 'otra@test.com'], 'solo los correos válidos');
  assert.match(mail.from, /onboarding@resend\.dev/, 'sin dominio propio usa el remitente de pruebas de Resend');
  assert.match(mail.subject, /Nuevo mensaje en el buzón/);
  assert.match(mail.subject, /queja/);
  assert.match(mail.subject, /urgencia alta/);
  assert.match(mail.text, /Tipo: queja/);
  assert.match(mail.text, /http:\/\/localhost:5173\/admin\/mensajes/, 'enlace al panel (a partir de CORS_ORIGIN)');
  assert.match(mail.text, /no incluye el contenido/);
});

test('el correo nunca lleva el contenido del mensaje ni datos personales de quien lo escribe', async () => {
  const res = await enviar({
    type: 'problema', anonymous: false, consent: true, urgency: 'media',
    name: 'Nombre Secreto Apellido', degree: 'Licenciatura Secreta', semester: '5', phone: '4491234567',
    subject: 'Asunto privado del mensaje', body: 'Texto privado del mensaje de prueba',
  });
  assert.equal(res.status, 201, res.text);
  await esperar(() => sent.length === 1);
  const todo = `${sent[0].subject}\n${sent[0].text}`;
  for (const secreto of ['Secreto', 'Apellido', 'privado', '4491234567', 'Licenciatura', 'clave-resend-prueba']) {
    assert.ok(!todo.includes(secreto), `el correo no debe incluir «${secreto}»`);
  }
});

test('SITE_URL y MAIL_FROM propios se respetan', async () => {
  Object.assign(process.env, { SITE_URL: 'https://mi-sitio.example/', MAIL_FROM: 'Buzón <avisos@mi-dominio.example>' });
  await enviar(anonimo());
  await esperar(() => sent.length === 1);
  assert.equal(sent[0].from, 'Buzón <avisos@mi-dominio.example>');
  assert.match(sent[0].text, /https:\/\/mi-sitio\.example\/admin\/mensajes/);
});

test('las ráfagas se juntan: el primero avisa al instante y los siguientes llegan en un solo resumen', async () => {
  process.env.NOTIFY_WINDOW_MS = '400';
  await enviar(anonimo({ type: 'queja', urgency: 'alta' }));
  await esperar(() => sent.length === 1);
  assert.match(sent[0].subject, /Nuevo mensaje/, 'el primero sale al instante');

  await enviar(anonimo({ type: 'queja' }));
  await enviar(anonimo({ type: 'pregunta', urgency: 'alta' }));
  await enviar(anonimo({ type: 'pregunta', urgency: 'urgente' }));
  await pausa(100);
  assert.equal(sent.length, 1, 'dentro de la ventana no salen más correos');

  await esperar(() => sent.length === 2);
  assert.equal(sent[1].subject, '3 mensajes nuevos en el buzón');
  assert.match(sent[1].text, /Por tipo: 1 queja, 2 preguntas/);
  assert.match(sent[1].text, /Por urgencia: 1 media, 1 alta, 1 urgente/);
  await pausa(500);
  assert.equal(sent.length, 2, 'un solo resumen, sin repetirse');

  // Pasada la ventana, el siguiente vuelve a avisar al instante
  await enviar(anonimo());
  await esperar(() => sent.length === 3);
  assert.match(sent[2].subject, /Nuevo mensaje/);
});

test('si el correo falla, quien escribe no se entera, el mensaje queda guardado y el registro no filtra datos', async () => {
  const registro = mock.method(console, 'error', () => {});
  notify.mail.send = async () => { throw new Error('Resend respondió 403: You can only send testing emails to your own email address (persona@gmail.com).'); };
  const token = await t.login(...(await t.createAdmin('Ana Aviso', 'ana-aviso@test.com', 'password123').then((a) => [a.email, a.password])));
  const antes = (await t.call('GET', '/messages', { token })).json.length;
  const res = await enviar(anonimo());
  assert.equal(res.status, 201, 'quien escribe recibe su código normalmente');
  assert.ok(res.json.code);
  await esperar(() => registro.mock.calls.some((c) => String(c.arguments[0]).includes('aviso-correo')));
  assert.equal((await t.call('GET', '/messages', { token })).json.length, antes + 1, 'el mensaje se guardó');
  const linea = registro.mock.calls.map((c) => String(c.arguments[0])).find((l) => l.includes('aviso-correo'));
  const datos = JSON.parse(linea);
  assert.equal(datos.level, 'warn');
  assert.match(datos.message, /403/);
  assert.ok(!linea.includes('persona@gmail.com') && !linea.includes('clave-resend-prueba'), 'sin correos ni la clave en el registro');
});

test('un envío descartado (campo trampa) o inválido no avisa', async () => {
  assert.equal((await enviar(anonimo({ website: 'http://spam.example' }))).status, 201);
  assert.equal((await enviar({ type: 'queja', anonymous: true, subject: 'x', body: 'corto' })).status, 400);
  await pausa();
  assert.deepEqual(sent, []);
});

test('si el servicio de correo tarda o se cuelga, la respuesta del buzón no espera', async () => {
  notify.mail.send = () => new Promise(() => {}); // nunca responde
  const inicio = Date.now();
  const res = await enviar(anonimo());
  assert.equal(res.status, 201);
  assert.ok(Date.now() - inicio < 2000, 'no espera al correo');
});

test('el envío a Resend usa su API HTTPS con la clave en la cabecera, y un error de Resend llega como mensaje claro', async () => {
  const llamadas = [];
  const fetchReal = globalThis.fetch;
  globalThis.fetch = async (url, opciones) => {
    llamadas.push({ url, opciones });
    return llamadas.length === 1
      ? new Response(JSON.stringify({ id: 'abc' }), { status: 200 })
      : new Response(JSON.stringify({ statusCode: 403, message: 'You can only send testing emails to your own email address.' }), { status: 403 });
  };
  try {
    const datos = { key: 'clave-resend-prueba', from: 'Buzón <onboarding@resend.dev>', to: ['avisos@test.com'], subject: 'Asunto', text: 'Cuerpo' };
    await original.send(datos);
    assert.equal(llamadas[0].url, 'https://api.resend.com/emails');
    assert.equal(llamadas[0].opciones.method, 'POST');
    assert.equal(llamadas[0].opciones.headers.Authorization, 'Bearer clave-resend-prueba');
    assert.deepEqual(JSON.parse(llamadas[0].opciones.body), { from: datos.from, to: datos.to, subject: 'Asunto', text: 'Cuerpo' });
    assert.ok(llamadas[0].opciones.signal, 'con plazo máximo de espera');
    await assert.rejects(original.send(datos), /Resend respondió 403: You can only send testing emails/);
  } finally {
    globalThis.fetch = fetchReal;
  }
});
