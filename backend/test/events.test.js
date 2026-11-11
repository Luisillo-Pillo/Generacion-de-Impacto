// Eventos en vivo del panel (SSE): avisos sin contenido, permisos, presencia, cierre de canales y tope por cuenta.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startServer } from './helpers.js';

let t;
let token; // Moderador
let tokenMiembro;
const streams = [];

before(async () => {
  t = await startServer();
  await t.createAdmin();
  token = await t.login();
  const alta = await t.call('POST', '/members', { token, body: { name: 'Beto Miembro', role: 'Vocal', email: 'beto@test.com', password: 'clave-de-integrante-1' } });
  assert.equal(alta.status, 201, alta.text);
});
after(async () => {
  for (const s of streams) s.close();
  await t.stop();
});

// Abre el canal de eventos con la sesión dada y va juntando los temas que llegan (y el texto crudo, para revisar que no filtre nada)
async function abrir(tk) {
  const ctrl = new AbortController();
  const res = await fetch(`${t.base}/events`, { headers: { Authorization: `Bearer ${tk}` }, signal: ctrl.signal });
  const s = { res, topics: [], raw: '', ended: false, close: () => ctrl.abort() };
  streams.push(s);
  if (res.status !== 200) return s;
  (async () => {
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for await (const chunk of res.body) {
        const text = decoder.decode(chunk, { stream: true });
        s.raw += text;
        buffer += text;
        let i;
        while ((i = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, i);
          buffer = buffer.slice(i + 2);
          const m = block.match(/^data: (.*)$/m);
          if (m) s.topics.push(JSON.parse(m[1]).topic);
        }
      }
    } catch {
      /* cerrada */
    }
    s.ended = true;
  })();
  // Ya está suscrita cuando llega el saludo inicial
  await esperar(() => s.raw.includes(': conectado'));
  return s;
}
async function esperar(cond, ms = 4000) {
  const inicio = Date.now();
  while (!cond()) {
    if (Date.now() - inicio > ms) throw new Error('se agotó la espera');
    await new Promise((r) => setTimeout(r, 15));
  }
}
const pausa = (ms = 200) => new Promise((r) => setTimeout(r, ms));

test('el canal exige sesión del panel y responde como flujo de eventos sin guardarse en caché', async () => {
  assert.equal((await t.call('GET', '/events')).status, 401);
  assert.equal((await t.call('GET', '/events', { token: 'invalido' })).status, 401);
  const s = await abrir(token);
  assert.equal(s.res.status, 200);
  assert.match(s.res.headers.get('content-type'), /^text\/event-stream/);
  assert.match(s.res.headers.get('cache-control'), /no-cache/);
  assert.match(s.raw, /retry: 5000/);
  s.close();
});

test('un mensaje del buzón, su respuesta y su eliminación avisan a los paneles abiertos, sin contenido', async () => {
  tokenMiembro = await t.login('beto@test.com', 'clave-de-integrante-1');
  const admin = await abrir(token);
  const miembro = await abrir(tokenMiembro);

  const envio = await t.call('POST', '/messages', {
    body: { type: 'queja', anonymous: true, subject: 'Asunto secreto del mensaje', body: 'Texto secreto del mensaje de prueba' },
  });
  assert.equal(envio.status, 201, envio.text);
  await esperar(() => admin.topics.includes('messages') && miembro.topics.includes('messages'));

  const id = (await t.call('GET', '/messages', { token })).json[0]._id;
  const antes = admin.topics.length;
  assert.equal((await t.call('PATCH', `/messages/${id}`, { token: tokenMiembro, body: { publicReply: 'Respuesta secreta del equipo' } })).status, 200);
  await esperar(() => admin.topics.length > antes);
  assert.equal((await t.call('POST', `/messages/${id}/notes`, { token: tokenMiembro, body: { text: 'Nota secreta' } })).status, 201);
  assert.equal((await t.call('DELETE', `/messages/${id}`, { token })).status, 204);
  assert.equal((await t.call('POST', `/messages/${id}/restore`, { token })).status, 200);
  await esperar(() => admin.topics.length >= antes + 4);
  assert.ok(admin.topics.every((x) => x === 'messages'));

  // Nada del contenido viaja en el aviso: solo el tema
  for (const secreto of ['secreto', 'Asunto', id]) assert.ok(!admin.raw.includes(secreto) && !miembro.raw.includes(secreto), `no debe filtrar «${secreto}»`);
  admin.close();
  miembro.close();
});

test('un envío descartado por el campo trampa o inválido no avisa a nadie', async () => {
  const s = await abrir(token);
  const bot = await t.call('POST', '/messages', { body: { type: 'queja', anonymous: true, subject: 'Spam spam', body: 'Mensaje de un bot de prueba', website: 'http://spam.example' } });
  assert.equal(bot.status, 201);
  assert.equal((await t.call('POST', '/messages', { body: { type: 'queja', anonymous: true, subject: 'x', body: 'corto' } })).status, 400);
  await pausa();
  assert.deepEqual(s.topics, []);
  s.close();
});

test('noticias, propuestas y equipo avisan con su propio tema', async () => {
  const s = await abrir(tokenMiembro);
  const noticia = await t.call('POST', '/news', { token: tokenMiembro, body: { title: 'Noticia en vivo', body: 'Cuerpo de la noticia', published: true } });
  assert.equal(noticia.status, 201, noticia.text);
  await esperar(() => s.topics.includes('news'));
  assert.equal((await t.call('PATCH', `/news/${noticia.json._id}/state`, { token: tokenMiembro, body: { published: false } })).status, 200);
  assert.equal((await t.call('DELETE', `/news/${noticia.json._id}`, { token })).status, 204);

  const propuesta = await t.call('POST', '/proposals', { token: tokenMiembro, body: { number: 7, title: 'Propuesta en vivo', objective: 'Objetivo de la propuesta' } });
  assert.equal(propuesta.status, 201, propuesta.text);
  await esperar(() => s.topics.includes('proposals'));
  assert.equal((await t.call('PATCH', `/proposals/${propuesta.json._id}/state`, { token: tokenMiembro, body: { progress: 'en_marcha' } })).status, 200);

  const miembro = await t.call('POST', '/members', { token, body: { name: 'Carla Nueva', role: 'Vocal', email: 'carla@test.com', password: 'clave-de-integrante-2' } });
  assert.equal(miembro.status, 201, miembro.text);
  await esperar(() => s.topics.includes('team'));
  assert.equal((await t.call('PUT', '/members/me', { token: tokenMiembro, body: { name: 'Beto Miembro', role: 'Secretario' } })).status, 200);
  assert.equal((await t.call('DELETE', `/members/${miembro.json._id}`, { token })).status, 204);
  await esperar(() => s.topics.filter((x) => x === 'team').length >= 3);
  assert.ok(s.topics.every((x) => ['news', 'proposals', 'team'].includes(x)), 'solo temas conocidos, sin presencia (es del Moderador)');
  s.close();
});

test('presencia: solo el Moderador recibe el aviso y solo cuando cambia el estado (los latidos normales no avisan)', async () => {
  const admin = await abrir(token);
  const miembro = await abrir(tokenMiembro);
  const antesAdmin = admin.topics.filter((x) => x === 'presence').length;

  // Beto ya había entrado (login previo); su latido no cambia nada
  await t.call('POST', '/auth/ping', { token: tokenMiembro });
  await pausa();
  assert.equal(admin.topics.filter((x) => x === 'presence').length, antesAdmin, 'un latido con la cuenta ya conectada no avisa');

  // Se desconecta: aviso inmediato; vuelve a conectarse con un latido: otro aviso
  await t.call('POST', '/auth/offline', { token: tokenMiembro });
  await esperar(() => admin.topics.filter((x) => x === 'presence').length === antesAdmin + 1);
  await t.call('POST', '/auth/ping', { token: tokenMiembro });
  await esperar(() => admin.topics.filter((x) => x === 'presence').length === antesAdmin + 2);

  assert.ok(!miembro.topics.includes('presence'), 'el Miembro nunca recibe avisos de presencia');
  assert.ok(!miembro.raw.includes('presence'));
  admin.close();
  miembro.close();
});

test('cambiar el rol o la contraseña de una cuenta cierra sus canales abiertos', async () => {
  const miembro = await abrir(tokenMiembro);
  const lista = (await t.call('GET', '/members/all', { token })).json;
  const beto = lista.find((m) => m.email === 'beto@test.com');

  // El Moderador le cambia el rol: su canal se cierra (al reconectar se valida de nuevo)
  assert.equal((await t.call('PUT', `/members/${beto._id}`, { token, body: { name: 'Beto Miembro', access: 'admin' } })).status, 200);
  await esperar(() => miembro.ended);
  assert.equal((await t.call('PUT', `/members/${beto._id}`, { token, body: { name: 'Beto Miembro', access: 'miembro' } })).status, 200);

  // La propia persona cambia su contraseña: se cierran sus canales y el token viejo ya no entra
  const otro = await abrir(tokenMiembro);
  const cambio = await t.call('PATCH', '/auth/password', { token: tokenMiembro, body: { currentPassword: 'clave-de-integrante-1', newPassword: 'clave-nueva-integrante-9' } });
  assert.equal(cambio.status, 200, cambio.text);
  await esperar(() => otro.ended);
  assert.equal((await t.call('GET', '/events', { token: tokenMiembro })).status, 401, 'con el token anterior ya no se puede abrir');
  const nuevo = await abrir(cambio.json.token);
  assert.equal(nuevo.res.status, 200, 'con el token nuevo sí');
  tokenMiembro = cambio.json.token;

  // Eliminar a la persona también corta su canal
  const bye = await t.call('POST', '/members', { token, body: { name: 'Dani Baja', email: 'dani@test.com', password: 'clave-de-integrante-3' } });
  const tokenDani = await t.login('dani@test.com', 'clave-de-integrante-3');
  const canalDani = await abrir(tokenDani);
  assert.equal((await t.call('DELETE', `/members/${bye.json._id}`, { token })).status, 204);
  await esperar(() => canalDani.ended);
  nuevo.close();
});

test('el tope es por cuenta, no por IP: al pasar de 8 canales se cierra el más antiguo y otras cuentas no se ven afectadas', async () => {
  const primero = await abrir(token);
  const otraCuenta = await abrir(tokenMiembro);
  const resto = [];
  for (let i = 0; i < 8; i++) resto.push(await abrir(token));
  await esperar(() => primero.ended);
  assert.ok(resto.every((s) => !s.ended), 'los 8 más recientes siguen abiertos');
  assert.equal(otraCuenta.ended, false, 'la otra cuenta (misma IP) no se ve afectada');
  for (const s of [...resto, otraCuenta]) s.close();
});

// GET con cabeceras propias sin que `fetch` agregue `Cache-Control: no-cache` al revalidar (un navegador no lo hace al refrescar solo)
const pedir = (ruta, headers = {}) => new Promise((resolve, reject) => {
  http.get(t.base + ruta, { headers }, (res) => {
    const partes = [];
    res.on('data', (c) => partes.push(c));
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, length: Buffer.concat(partes).length }));
  }).on('error', reject);
});

test('las listas públicas revalidan con ETag: sin cambios responden 304 sin cuerpo (el refresco ligero sale casi gratis)', async () => {
  for (const ruta of ['/news', '/proposals', '/members']) {
    const primera = await pedir(ruta);
    assert.equal(primera.status, 200);
    assert.ok(primera.headers.etag, `${ruta} lleva ETag`);
    const igual = await pedir(ruta, { 'If-None-Match': primera.headers.etag });
    assert.equal(igual.status, 304, `${ruta} sin cambios responde 304`);
    assert.equal(igual.length, 0);
  }
});
