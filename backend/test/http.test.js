import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.js';

let t;

before(async () => {
  t = await startServer({ CORS_ORIGIN: 'http://localhost:5173, https://sitio.example/', CORS_ORIGIN_PATTERN: 'https://sitio-*.vercel.app' });
});
after(() => t.stop());

const conOrigen = (origin) => t.call('GET', '/health', { headers: { Origin: origin } });

test('health check responde sin necesidad de sesión', async () => {
  const res = await t.call('GET', '/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.json, { ok: true });
});

test('CORS: solo los orígenes configurados (con o sin barra final)', async () => {
  assert.equal((await conOrigen('http://localhost:5173')).headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.equal((await conOrigen('https://sitio.example')).headers.get('access-control-allow-origin'), 'https://sitio.example');
  assert.equal((await conOrigen('https://malo.example')).headers.get('access-control-allow-origin'), null);
  assert.equal((await conOrigen('http://localhost:5174')).headers.get('access-control-allow-origin'), null);
});

test('CORS_ORIGIN_PATTERN acepta las previews con comodín, pero nada que se le parezca', async () => {
  const permitido = 'https://sitio-git-fase-0-luisfer.vercel.app';
  assert.equal((await conOrigen(permitido)).headers.get('access-control-allow-origin'), permitido);
  for (const falso of [
    'https://sitio-.vercel.app', // el comodín exige al menos un carácter
    'https://sitio-x.vercel.app.malo.example', // sufijo añadido
    'https://malo.example/https://sitio-x.vercel.app',
    'http://sitio-x.vercel.app', // otro esquema
    'https://sitio-x.vercelXapp', // el punto es literal
    'https://sitio-a.b.vercel.app', // el comodín no cruza puntos
  ]) assert.equal((await conOrigen(falso)).headers.get('access-control-allow-origin'), null, falso);
});

test('cabeceras de seguridad: helmet activo y sin x-powered-by', async () => {
  const { headers } = await t.call('GET', '/health');
  assert.equal(headers.get('x-content-type-options'), 'nosniff');
  assert.ok(headers.get('strict-transport-security'));
  assert.equal(headers.get('x-powered-by'), null);
  assert.equal(headers.get('cross-origin-resource-policy'), 'cross-origin');
});

test('rutas inexistentes de la API devuelven 404 en JSON', async () => {
  const res = await t.call('GET', '/no-existe');
  assert.equal(res.status, 404);
  assert.ok(res.json.error);
});

test('JSON mal formado da 400 y un cuerpo demasiado grande da 413 (no 500)', async () => {
  const malo = await t.call('POST', '/auth/login', { headers: { 'Content-Type': 'application/json' }, form: '{"email": ' });
  assert.equal(malo.status, 400);
  assert.equal(malo.json.error, 'JSON inválido');
  const grande = await t.call('POST', '/auth/login', { body: { email: 'a@b.com', password: 'x'.repeat(200 * 1024) } });
  assert.equal(grande.status, 413);
});

test('los errores internos no filtran trazas', async () => {
  // Un cuerpo JSON que no es objeto provoca un error de validación, nunca un 500 con detalles
  const res = await t.call('POST', '/auth/login', { body: ['no', 'objeto'] });
  assert.ok(res.status === 400);
  assert.ok(!/at .*\.js/.test(res.text));
});
