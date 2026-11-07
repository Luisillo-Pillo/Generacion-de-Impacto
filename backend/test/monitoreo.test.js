// Monitoreo (Q3): id de petición, registros estructurados sin datos y filtro de privacidad antes de enviar a Sentry.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.js';
import { sanitizeMessage, scrubEvent, initMonitoring, reportError } from '../src/monitoring.js';
import * as navegador from '../../frontend/src/sanitize.js';

let t;
let token;

before(async () => {
  t = await startServer();
  await t.createAdmin();
  token = await t.login();
});
after(() => t.stop());

test('toda respuesta lleva un X-Request-Id distinto, también las de error', async () => {
  const a = await t.call('GET', '/health');
  const b = await t.call('GET', '/health');
  const noExiste = await t.call('GET', '/no-existe');
  const ids = [a, b, noExiste].map((r) => r.headers.get('x-request-id'));
  assert.ok(ids.every((id) => /^[0-9a-f-]{36}$/.test(id)));
  assert.equal(new Set(ids).size, 3);
});

test('CORS deja leer el id de petición al sitio', async () => {
  const res = await fetch(`${t.base}/health`, { headers: { Origin: 'http://localhost:5173' } });
  assert.match(res.headers.get('access-control-expose-headers'), /X-Request-Id/i);
});

test('un error interno responde 500 con el id, registra una línea JSON y no filtra datos ni trazas', async () => {
  const { Message } = t.models;
  const original = Message.countDocuments;
  const lineas = [];
  const consola = console.error;
  Message.countDocuments = async () => {
    throw new Error('E11000 duplicate key error collection: gi.users index: email_1 dup key: { email: "luis@correo.com" } tel 5512345678 "texto privado del mensaje"');
  };
  console.error = (...args) => lineas.push(args.join(' '));
  let res;
  try {
    res = await t.call('GET', '/messages/stats?secreto=contenido-en-la-consulta', { token });
  } finally {
    Message.countDocuments = original;
    console.error = consola;
  }

  assert.equal(res.status, 500);
  assert.equal(res.json.error, 'Error interno del servidor');
  assert.equal(res.json.requestId, res.headers.get('x-request-id'));
  assert.ok(!/at .*\.js|luis@correo|5512345678|texto privado/.test(res.text), 'la respuesta no filtra nada');

  assert.equal(lineas.length, 1, 'una sola línea por error');
  const registro = JSON.parse(lineas[0]);
  assert.equal(registro.level, 'error');
  assert.equal(registro.requestId, res.json.requestId);
  assert.equal(registro.method, 'GET');
  assert.match(registro.path, /\/messages\/stats$/);
  assert.ok(!registro.path.includes('?'), 'sin la consulta');
  assert.equal(registro.error, 'Error');
  assert.ok(Array.isArray(registro.stack) && registro.stack.length > 0);
  assert.ok(!/luis@correo|5512345678|texto privado|contenido-en-la-consulta|Bearer|token/i.test(lineas[0]), 'el registro no lleva datos, consulta ni credenciales');
});

test('sanitizeMessage quita valores entre comillas, objetos, correos y números largos', () => {
  const limpio = sanitizeMessage('dup key: { email: "ana@test.com", phone: 5512345678 } en \'mensaje privado\' y `otro` contacto luis@correo.com tel 5512345678');
  assert.ok(!/ana@test|luis@correo|5512345678|mensaje privado|otro/.test(limpio), limpio);
  assert.ok(limpio.includes('dup key') && limpio.includes('{…}'));
  assert.equal(sanitizeMessage(undefined), '');
  assert.equal(sanitizeMessage('x'.repeat(1000)).length, 300);
});

test('scrubEvent borra petición, usuario, extras, rastros, nombre del equipo, variables locales y valores del mensaje', () => {
  const evento = scrubEvent({
    request: { url: 'https://api/x?codigo=GI-AAAAA-BBBBB', headers: { authorization: 'Bearer secreto' }, data: { body: 'texto del mensaje' } },
    user: { ip_address: '1.2.3.4', email: 'ana@test.com' },
    extra: { mensaje: 'texto privado' },
    breadcrumbs: [{ message: 'algo' }],
    server_name: 'equipo-de-luis',
    contexts: { runtime: { name: 'node' }, device: { name: 'x' }, culture: { locale: 'es' } },
    message: 'falló con "dato" de luis@correo.com',
    exception: { values: [{ type: 'Error', value: 'dup key { a: 1 } "valor"', stacktrace: { frames: [{ filename: 'app.js', lineno: 3, vars: { body: 'texto del mensaje' } }] } }] },
  });
  assert.equal(JSON.stringify(Object.keys(evento).sort()), JSON.stringify(['contexts', 'exception', 'message']));
  assert.deepEqual(evento.contexts, { runtime: { name: 'node' } });
  assert.ok(!JSON.stringify(evento).includes('luis') && !JSON.stringify(evento).includes('texto'));
  assert.deepEqual(evento.exception.values[0].stacktrace.frames, [{ filename: 'app.js', lineno: 3 }]);
});

test('sin SENTRY_DSN no se activa ni se envía nada', () => {
  assert.equal(initMonitoring({}), false);
  assert.doesNotThrow(() => reportError(new Error('x'), 'id'));
});

test('el filtro del navegador aplica el mismo criterio de privacidad que el del servidor', () => {
  const mensaje = 'falló con "texto del mensaje" de luis@correo.com tel 5512345678 { a: 1 }';
  assert.equal(navegador.sanitizeMessage(mensaje), sanitizeMessage(mensaje));
  const evento = navegador.scrubEvent({
    request: { url: 'https://sitio/seguimiento?codigo=GI-AAAAA-BBBBB', headers: { 'User-Agent': 'x' } }, user: { email: 'a@b.com' }, breadcrumbs: [{ message: 'clic en "Enviar"' }],
    extra: { x: 1 }, contexts: { runtime: { name: 'chrome' }, device: { model: 'x' } }, exception: { values: [{ value: mensaje, stacktrace: { frames: [{ filename: 'a.js', vars: { x: 1 } }] } }] },
  });
  assert.deepEqual(Object.keys(evento).sort(), ['contexts', 'exception']);
  assert.ok(!/luis|5512345678|texto del mensaje|GI-AAAAA/.test(JSON.stringify(evento)));
  assert.deepEqual(evento.exception.values[0].stacktrace.frames, [{ filename: 'a.js' }]);
});

