// Contraseñas (S9) y sesiones (S5): política, re-hash, versión de sesión y renovación del token.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { startServer } from './helpers.js';

let t;

before(async () => {
  t = await startServer();
  await t.createAdmin('Ana Prueba', 'ana@test.com', 'clave-de-prueba-1');
});
after(() => t.stop());

const me = (token) => t.call('GET', '/auth/me', { token });
const login = (email, password) => t.call('POST', '/auth/login', { body: { email, password } });
const cambiar = (token, currentPassword, newPassword) => t.call('PATCH', '/auth/password', { token, body: { currentPassword, newPassword } });

test('la contraseña nueva exige 10 caracteres y rechaza las comunes', async () => {
  const token = await t.login('ana@test.com', 'clave-de-prueba-1');
  const corta = await cambiar(token, 'clave-de-prueba-1', 'abc12345');
  assert.equal(corta.status, 400);
  assert.match(corta.json.error, /al menos 10 caracteres/);
  const nueve = await cambiar(token, 'clave-de-prueba-1', 'abcdefgh9');
  assert.equal(nueve.status, 400);
  for (const comun of ['1234567890', 'Password123', 'contraseña123', 'GeneracionDeImpacto', 'zzzzzzzzzzzz']) {
    const res = await cambiar(token, 'clave-de-prueba-1', comun);
    assert.equal(res.status, 400, comun);
    assert.match(res.json.error, /muy común/);
  }
  // La contraseña no cambió
  assert.equal((await login('ana@test.com', 'clave-de-prueba-1')).status, 200);
});

test('una cuenta con contraseña anterior de 8 caracteres sigue entrando', async () => {
  await t.createAdmin('Corta Antigua', 'corta@test.com', 'abcd1234');
  assert.equal((await login('corta@test.com', 'abcd1234')).status, 200);
});

test('al iniciar sesión, un hash de costo bajo se actualiza al costo 12', async () => {
  await t.createAdmin('Hash Viejo', 'viejo@test.com', 'clave-vieja-123'); // el ayudante usa costo 4
  const antes = await t.models.User.findOne({ email: 'viejo@test.com' });
  assert.equal(bcrypt.getRounds(antes.passwordHash), 4);

  assert.equal((await login('viejo@test.com', 'clave-vieja-123')).status, 200);
  const despues = await t.models.User.findOne({ email: 'viejo@test.com' });
  assert.equal(bcrypt.getRounds(despues.passwordHash), 12);
  assert.equal((await login('viejo@test.com', 'clave-vieja-123')).status, 200, 'la contraseña sigue siendo la misma');
  assert.equal((await login('viejo@test.com', 'incorrecta-123')).status, 401);
});

test('las contraseñas nuevas se guardan con costo 12', async () => {
  const token = await t.login('ana@test.com', 'clave-de-prueba-1');
  assert.equal((await cambiar(token, 'clave-de-prueba-1', 'clave-de-prueba-1')).status, 200);
  const user = await t.models.User.findOne({ email: 'ana@test.com' });
  assert.equal(bcrypt.getRounds(user.passwordHash), 12);
});

test('cambiar la contraseña cierra las demás sesiones pero conserva la actual', async () => {
  await t.createAdmin('Dos Equipos', 'dos@test.com', 'clave-dos-equipos');
  const compu = await t.login('dos@test.com', 'clave-dos-equipos');
  const celular = await t.login('dos@test.com', 'clave-dos-equipos');
  assert.equal((await me(compu)).status, 200);
  assert.equal((await me(celular)).status, 200);

  const res = await cambiar(compu, 'clave-dos-equipos', 'otra-clave-segura-1');
  assert.equal(res.status, 200);
  assert.ok(res.json.token, 'devuelve un token nuevo para este dispositivo');
  assert.equal((await me(celular)).status, 401, 'el celular pierde la sesión');
  assert.equal((await me(compu)).status, 401, 'el token anterior ya no vale');
  assert.equal((await me(res.json.token)).status, 200, 'el token nuevo sí');
});

test('cerrar sesión en todos los dispositivos deja solo el actual', async () => {
  await t.createAdmin('Tres Equipos', 'tres@test.com', 'clave-tres-equipos');
  const a = await t.login('tres@test.com', 'clave-tres-equipos');
  const b = await t.login('tres@test.com', 'clave-tres-equipos');
  assert.equal((await t.call('POST', '/auth/logout-all')).status, 401);
  const res = await t.call('POST', '/auth/logout-all', { token: a });
  assert.equal(res.status, 200);
  assert.equal((await me(b)).status, 401);
  assert.equal((await me(a)).status, 401);
  assert.equal((await me(res.json.token)).status, 200);
});

test('cambiar la contraseña de un integrante desde el panel cierra sus sesiones', async () => {
  const admin = await t.login('ana@test.com', 'clave-de-prueba-1');
  const creado = await t.call('POST', '/members', { token: admin, body: { name: 'Integrante', email: 'integrante@test.com', password: 'clave-integrante-1' } });
  assert.equal(creado.status, 201);
  const suToken = await t.login('integrante@test.com', 'clave-integrante-1');
  assert.equal((await me(suToken)).status, 200);
  const edit = await t.call('PUT', `/members/${creado.json._id}`, { token: admin, body: { name: 'Integrante', password: 'clave-integrante-2' } });
  assert.equal(edit.status, 200);
  assert.equal((await me(suToken)).status, 401);
  assert.equal((await login('integrante@test.com', 'clave-integrante-2')).status, 200);
});

test('el token dura 12 horas', async () => {
  const token = await t.login('ana@test.com', 'clave-de-prueba-1');
  const { iat, exp } = jwt.decode(token);
  assert.equal(exp - iat, 12 * 3600);
});

test('pasada la mitad de su vida, el token se renueva en una cabecera; antes, no', async () => {
  const user = await t.models.User.findOne({ email: 'ana@test.com' });
  const conEdad = (horas, extra = {}) =>
    jwt.sign({ sub: String(user._id), v: user.tokenVersion ?? 0, iat: Math.floor(Date.now() / 1000) - horas * 3600, ...extra }, process.env.JWT_SECRET, { expiresIn: '12h' });

  const reciente = await me(conEdad(1));
  assert.equal(reciente.status, 200);
  assert.equal(reciente.headers.get('x-renewed-token'), null);

  const viejo = await me(conEdad(7));
  assert.equal(viejo.status, 200);
  const renovado = viejo.headers.get('x-renewed-token');
  assert.ok(renovado, 'trae un token nuevo');
  const { iat, exp } = jwt.decode(renovado);
  assert.equal(exp - iat, 12 * 3600);
  assert.equal((await me(renovado)).status, 200);
  assert.equal((await me(renovado)).headers.get('x-renewed-token'), null, 'el renovado es reciente: no se vuelve a renovar');

  assert.equal((await me(conEdad(13))).status, 401, 'pasadas 12 horas expira');
});

test('un token anterior al cambio (sin campo de versión) sigue valiendo hasta que se cambie la contraseña', async () => {
  const { user } = await t.createAdmin('Sesión Antigua', 'antigua@test.com', 'clave-antigua-123');
  const sinVersion = jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '1h' });
  assert.equal((await me(sinVersion)).status, 200);
  await t.models.User.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } });
  assert.equal((await me(sinVersion)).status, 401);
});

test('CORS deja leer la cabecera del token renovado al sitio permitido', async () => {
  const token = await t.login('ana@test.com', 'clave-de-prueba-1');
  const res = await t.call('GET', '/auth/me', { token, headers: { Origin: 'http://localhost:5173' } });
  assert.match(res.headers.get('access-control-expose-headers') ?? '', /X-Renewed-Token/i);
});
