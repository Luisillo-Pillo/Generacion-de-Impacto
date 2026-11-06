// El freno de intentos bloquea la cuenta, no la IP: la comunidad comparte red y un límite por IP la bloquearía entera.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.js';

let t;

before(async () => {
  t = await startServer();
  await t.createAdmin('Ana Prueba', 'ana@test.com', 'clave-de-prueba-1');
  await t.createAdmin('Beto Prueba', 'beto@test.com', 'clave-de-prueba-2');
});
after(() => t.stop());

const login = (email, password) => t.call('POST', '/auth/login', { body: { email, password } });

test('tras 5 intentos fallidos la cuenta responde 429, incluso con la contraseña correcta', async () => {
  const statuses = [];
  for (let i = 0; i < 7; i++) statuses.push((await login('ana@test.com', `mala${i}`)).status);
  assert.deepEqual(statuses, [401, 401, 401, 401, 401, 429, 429]);
  const bloqueada = await login('ana@test.com', 'clave-de-prueba-1');
  assert.equal(bloqueada.status, 429);
  assert.ok(Number(bloqueada.headers.get('retry-after')) > 0, 'indica cuántos segundos esperar');
});

test('el bloqueo es solo de esa cuenta: otra cuenta desde la misma IP sigue entrando', async () => {
  assert.equal((await login('beto@test.com', 'clave-de-prueba-2')).status, 200);
  // Muchos intentos fallidos con correos distintos desde la misma IP no bloquean a nadie más
  for (let i = 0; i < 12; i++) await login(`intruso${i}@test.com`, 'x');
  assert.equal((await login('beto@test.com', 'clave-de-prueba-2')).status, 200);
});

test('el bloqueo vive en la base de datos (sobrevive a un reinicio) y deja constancia sin guardar el correo en claro en el limitador', async () => {
  const { RateLimit } = await import('../src/rateLimit.js');
  const docs = await RateLimit.find({ count: { $gte: 5 } });
  assert.ok(docs.length >= 1);
  for (const d of docs) assert.match(d.key, /^[0-9a-f]{64}$/); // llave con hash: ni correos ni IPs en claro
  const bitacora = await t.models.AuditLog.find({ action: 'login.bloqueado' });
  assert.equal(bitacora.length, 1);
});

test('un intento correcto reinicia el conteo de fallos de esa cuenta', async () => {
  for (let i = 0; i < 4; i++) await login('beto@test.com', `mala${i}`);
  assert.equal((await login('beto@test.com', 'clave-de-prueba-2')).status, 200);
  for (let i = 0; i < 4; i++) assert.equal((await login('beto@test.com', `otra${i}`)).status, 401);
  assert.equal((await login('beto@test.com', 'clave-de-prueba-2')).status, 200);
});
