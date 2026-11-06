// Va en su propio archivo (y por tanto en su propio proceso): el freno de intentos bloquea la IP de las pruebas.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.js';

let t;

before(async () => {
  t = await startServer();
  await t.createAdmin();
});
after(() => t.stop());

test('tras 10 intentos fallidos el login responde 429, incluso con la contraseña correcta', async () => {
  const statuses = [];
  for (let i = 0; i < 12; i++) {
    const res = await t.call('POST', '/auth/login', { body: { email: 'ana@test.com', password: `mala${i}` } });
    statuses.push(res.status);
  }
  assert.deepEqual(statuses, [...Array(10).fill(401), 429, 429]);
  const correcta = await t.call('POST', '/auth/login', { body: { email: 'ana@test.com', password: 'password123' } });
  assert.equal(correcta.status, 429);
});
