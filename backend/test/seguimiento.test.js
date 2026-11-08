// Código de seguimiento (F3): quien escribe consulta el estado de su mensaje y la respuesta del equipo, sin revelar identidad.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.js';
import { newCode, normalizeCode, hashCode } from '../src/tracking.js';

let t;
let token;
let mod;

const anonimo = (extra = {}) => ({ type: 'queja', anonymous: true, subject: 'Baños sin agua', body: 'Los baños del edificio B no tienen agua.', ...extra });
const enviar = async (extra) => (await t.call('POST', '/messages', { body: anonimo(extra) })).json.code;
const rastrear = (code) => t.call('POST', '/messages/track', { body: { code } });

before(async () => {
  t = await startServer();
  await t.createAdmin();
  token = await t.login();
  await t.call('POST', '/members', { token, body: { name: 'Mora', role: 'Vocal de eventos', email: 'mod@test.com', password: 'clave-de-moderadora-1', access: 'miembro' } });
  mod = await t.login('mod@test.com', 'clave-de-moderadora-1');
});
after(() => t.stop());

test('el código tiene el formato GI-XXXXX-XXXXX, sin letras ambiguas, y no se repite', () => {
  const codigos = new Set(Array.from({ length: 2000 }, newCode));
  assert.equal(codigos.size, 2000);
  for (const c of codigos) assert.match(c, /^GI-[2-9A-HJ-NP-Z]{5}-[2-9A-HJ-NP-Z]{5}$/);
});

test('se acepta con o sin guiones, en minúsculas y con espacios; lo que no parece código se rechaza', () => {
  const code = newCode();
  const hash = hashCode(code);
  for (const variante of [code.toLowerCase(), code.replaceAll('-', ''), `  ${code}  `, code.replaceAll('-', ' ')]) assert.equal(hashCode(variante), hash, variante);
  for (const mal of ['', 'GI-', 'GI-ABCDE', code.slice(0, -1), `${code}X`, 'GI-0O1I0-0O1I0', null, undefined, 12345]) assert.equal(normalizeCode(mal), null, String(mal));
});

test('al enviar un mensaje se entrega el código, y en la base solo queda su hash', async () => {
  const code = await enviar();
  assert.match(code, /^GI-/);
  const crudo = await t.models.Message.collection.findOne({ subject: 'Baños sin agua' });
  assert.equal(crudo.codeHash, hashCode(code));
  assert.ok(!JSON.stringify(crudo).includes(code) && !JSON.stringify(crudo).includes(normalizeCode(code)), 'el código en claro no está en la base');
  // Ninguna respuesta de la API expone el hash
  const lista = (await t.call('GET', '/messages', { token })).json;
  assert.ok(!JSON.stringify(lista).includes('codeHash') && !JSON.stringify(lista).includes(crudo.codeHash));
});

test('consultar con el código devuelve el estado, sin el texto del mensaje ni datos personales', async () => {
  const code = await enviar({ subject: 'Asunto consultable', body: 'Texto privado que nunca debe salir por aquí' });
  const res = await rastrear(code);
  assert.equal(res.status, 200);
  assert.deepEqual(Object.keys(res.json).sort(), ['createdAt', 'publicReply', 'publicReplyAt', 'publicReplyBy', 'review', 'status', 'subject', 'type', 'updatedAt']);
  assert.equal(res.json.subject, 'Asunto consultable');
  assert.equal(res.json.status, 'nuevo');
  assert.equal(res.json.review, 'pendiente');
  assert.equal(res.json.publicReply, null);
  assert.ok(!res.text.includes('Texto privado'));
  assert.equal((await rastrear(code.toLowerCase().replaceAll('-', ''))).status, 200, 'tolera cómo se escriba');
});

test('también los mensajes con datos personales reciben código, y la consulta no revela esos datos', async () => {
  await t.call('PUT', '/settings/degrees', { token, body: { value: ['Licenciatura en Primaria'] } });
  const res = await t.call('POST', '/messages', {
    body: { type: 'propuesta', anonymous: false, name: 'Luis Pérez', degree: 'Licenciatura en Primaria', semester: '3', phone: '5512345678', consent: true, subject: 'Con datos', body: 'Mensaje con datos completos' },
  });
  const consulta = await rastrear(res.json.code);
  assert.equal(consulta.status, 200);
  assert.ok(!/Luis|5512345678|Primaria/.test(consulta.text));
});

test('un código inventado, mal formado, de otro mensaje o de uno eliminado dan la misma respuesta', async () => {
  const code = await enviar({ subject: 'Para eliminar' });
  const generica = await rastrear(newCode());
  assert.equal(generica.status, 404);
  for (const mal of ['', 'abc', 'GI-00000-00000', '😀', 'x'.repeat(59)]) {
    const r = await rastrear(mal);
    assert.equal(r.status, 404, mal);
    assert.deepEqual(r.json, generica.json, 'mismo mensaje para cualquier código que no exista');
  }
  assert.equal((await t.call('POST', '/messages/track', { body: {} })).status, 400, 'sin código es una petición inválida');

  const msg = await t.models.Message.findOne({ subject: 'Para eliminar' });
  await t.call('DELETE', `/messages/${msg._id}`, { token });
  assert.deepEqual((await rastrear(code)).json, generica.json, 'en la papelera ya no se consulta');
});

test('sin límite de intentos: muchas consultas seguidas, falladas o no, siguen respondiendo', async () => {
  const code = await enviar({ subject: 'Sin límites' });
  for (let i = 0; i < 40; i++) assert.equal((await rastrear(newCode())).status, 404);
  assert.equal((await rastrear(code)).status, 200, 'los intentos fallidos no bloquean a quien tiene su código');
});

test('la respuesta pública del equipo aparece en la consulta; vaciarla la quita; queda en la bitácora sin su texto', async () => {
  const code = await enviar({ subject: 'Con respuesta' });
  const msg = await t.models.Message.findOne({ subject: 'Con respuesta' });
  const res = await t.call('PATCH', `/messages/${msg._id}`, { token: mod, body: { publicReply: '  Ya mandamos a arreglarlos, gracias por avisar.  ', review: 'en_proceso' } });
  assert.equal(res.status, 200);
  assert.equal(res.json.publicReply, 'Ya mandamos a arreglarlos, gracias por avisar.');

  const consulta = (await rastrear(code)).json;
  assert.equal(consulta.publicReply, 'Ya mandamos a arreglarlos, gracias por avisar.');
  assert.ok(consulta.publicReplyAt);
  assert.equal(consulta.review, 'en_proceso');
  assert.deepEqual(consulta.publicReplyBy, { name: 'Mora', role: 'Vocal de eventos' }, 'se indica quién responde (nombre y cargo)');
  assert.ok(!/@test\.com/.test(JSON.stringify(consulta)), 'nunca su correo');
  assert.deepEqual((await t.call('GET', '/messages', { token })).json.find((m) => m._id === String(msg._id)).publicReplyBy, { name: 'Mora', role: 'Vocal de eventos' });

  const log = JSON.stringify((await t.call('GET', '/audit', { token })).json.items);
  assert.ok(log.includes('escribió la respuesta pública') && !log.includes('Ya mandamos'));

  await t.call('PATCH', `/messages/${msg._id}`, { token, body: { publicReply: '' } });
  const quitada = (await rastrear(code)).json;
  assert.equal(quitada.publicReply, null);
  assert.equal(quitada.publicReplyAt, null);
  assert.equal(quitada.publicReplyBy, null);
  assert.equal((await t.call('PATCH', `/messages/${msg._id}`, { token, body: { publicReply: 'x'.repeat(1001) } })).status, 400);
});

test('las notas internas no salen en la consulta pública', async () => {
  const code = await enviar({ subject: 'Con nota' });
  const msg = await t.models.Message.findOne({ subject: 'Con nota' });
  assert.equal((await t.call('POST', `/messages/${msg._id}/notes`, { token, body: { text: 'Nota interna secreta' } })).status, 201);
  assert.ok(!(await rastrear(code)).text.includes('secreta'));
});

test('los mensajes de antes (sin código) siguen funcionando y no se pueden consultar', async () => {
  const viejo = await t.models.Message.collection.insertOne({ type: 'queja', anonymous: true, subject: 'Antiguo', body: 'Mensaje de antes del código', status: 'nuevo', createdAt: new Date() });
  assert.ok(viejo.insertedId);
  assert.equal((await t.call('GET', '/messages', { token })).json.some((m) => m.subject === 'Antiguo'), true);
});

test('un envío descartado por el campo trampa también devuelve un código de apariencia normal (que no existe)', async () => {
  const res = await t.call('POST', '/messages', { body: anonimo({ website: 'spam' }) });
  assert.equal(res.status, 201);
  assert.match(res.json.code, /^GI-/);
  assert.equal((await rastrear(res.json.code)).status, 404);
});
