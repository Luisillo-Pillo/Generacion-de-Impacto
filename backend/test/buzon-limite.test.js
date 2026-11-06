// Freno de emergencia del buzón: tope de envíos por hora de TODO el buzón (no por IP). Va en su propio archivo (y proceso)
// porque fija un tope bajo.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.js';

let t;
let token;

const anonimo = (extra = {}) => ({ type: 'queja', anonymous: true, subject: 'Baños', body: 'Mensaje anónimo de prueba', ...extra });
const enviar = (campos) => t.call('POST', '/messages', { form: t.messageForm(campos) });

before(async () => {
  t = await startServer({ MESSAGE_RATE_LIMIT: '3' });
  await t.createAdmin();
  token = await t.login();
});
after(() => t.stop());

test('superado el tope por hora, el buzón responde 429 con Retry-After, sin tocar el resto de la API', async () => {
  for (let i = 0; i < 3; i++) assert.equal((await enviar(anonimo())).status, 201);
  const res = await enviar(anonimo());
  assert.equal(res.status, 429);
  assert.match(res.json.error, /demasiados mensajes/);
  assert.ok(Number(res.headers.get('retry-after')) > 0);
  assert.equal((await t.call('GET', '/messages', { token })).json.length, 3, 'el envío rechazado no se guardó');

  // El panel y el login no se ven afectados
  assert.equal((await t.call('GET', '/messages', { token })).status, 200);
  assert.equal((await t.call('POST', '/auth/login', { body: { email: 'ana@test.com', password: 'password123' } })).status, 200);
});

test('los envíos descartados por el campo trampa también cuentan para el tope', async () => {
  await t.models.Message.db.collection('ratelimits').deleteMany({});
  assert.equal((await enviar(anonimo({ website: 'spam' }))).status, 201);
  assert.equal((await enviar(anonimo({ website: 'spam' }))).status, 201);
  assert.equal((await enviar(anonimo({ website: 'spam' }))).status, 201);
  assert.equal((await enviar(anonimo())).status, 429);
});

test('un envío con errores de captura no gasta el tope', async () => {
  await t.models.Message.db.collection('ratelimits').deleteMany({});
  for (let i = 0; i < 6; i++) assert.equal((await enviar({ type: 'queja', anonymous: true, subject: 'x', body: 'corto' })).status, 400);
  assert.equal((await enviar(anonimo())).status, 201);
});
