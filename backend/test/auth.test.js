import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { startServer } from './helpers.js';

let t;
let token;

before(async () => {
  t = await startServer();
  await t.createAdmin();
  token = await t.login();
});
after(() => t.stop());

test('no existe registro público ni gestión de usuarios', async () => {
  const register = await t.call('POST', '/auth/register', { body: { name: 'X', email: 'x@t.com', password: 'password123' } });
  assert.equal(register.status, 404);
  assert.equal((await t.call('GET', '/auth/users')).status, 404);
});

test('login correcto devuelve token, usuario administrador y ficha', async () => {
  const res = await t.call('POST', '/auth/login', { body: { email: 'ANA@test.com ', password: 'password123' } });
  assert.equal(res.status, 200);
  assert.equal(res.json.user.role, 'admin');
  assert.equal(res.json.member.name, 'Ana Prueba');
  assert.equal(res.json.user.passwordHash, undefined);
});

test('login con contraseña o correo incorrectos da el mismo 401 genérico', async () => {
  const badPass = await t.call('POST', '/auth/login', { body: { email: 'ana@test.com', password: 'mala' } });
  const badUser = await t.call('POST', '/auth/login', { body: { email: 'nadie@test.com', password: 'password123' } });
  assert.equal(badPass.status, 401);
  assert.equal(badUser.status, 401);
  assert.equal(badPass.json.error, badUser.json.error);
});

test('/me exige sesión y devuelve usuario y ficha', async () => {
  assert.equal((await t.call('GET', '/auth/me')).status, 401);
  const me = await t.call('GET', '/auth/me', { token });
  assert.equal(me.status, 200);
  assert.equal(me.json.member.name, 'Ana Prueba');
});

test('las rutas de administrador rechazan peticiones sin sesión', async () => {
  const rutas = [['GET', '/messages'], ['GET', '/news/all'], ['GET', '/proposals/all'], ['GET', '/members/all'],
    ['PUT', '/settings/social'], ['POST', '/files'], ['POST', '/news'], ['DELETE', '/members/abc']];
  for (const [method, path] of rutas) assert.equal((await t.call(method, path)).status, 401, `${method} ${path}`);
});

test('un token con firma falsa, sin firma (alg none) o de otra clave se rechaza', async () => {
  const me = (await t.call('GET', '/auth/me', { token })).json.user;
  const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: me.id })).toString('base64url')}.`;
  const otraClave = jwt.sign({ sub: me.id }, 'otra-clave-distinta-de-la-del-servidor');
  assert.equal((await t.call('GET', '/auth/me', { token: none })).status, 401);
  assert.equal((await t.call('GET', '/auth/me', { token: otraClave })).status, 401);
  assert.equal((await t.call('GET', '/auth/me', { token: 'basura' })).status, 401);
});

test('un token expirado se rechaza', async () => {
  const me = (await t.call('GET', '/auth/me', { token })).json.user;
  const expirado = jwt.sign({ sub: me.id }, process.env.JWT_SECRET, { expiresIn: -10 });
  assert.equal((await t.call('GET', '/auth/me', { token: expirado })).status, 401);
});

test('cambiar la contraseña valida la actual y el largo mínimo', async () => {
  const body = (currentPassword, newPassword) => ({ currentPassword, newPassword });
  assert.equal((await t.call('PATCH', '/auth/password', { token, body: body('incorrecta', 'nueva-clave-1') })).status, 400);
  assert.equal((await t.call('PATCH', '/auth/password', { token, body: body('password123', 'corta') })).status, 400);
  assert.equal((await t.call('PATCH', '/auth/password', { token, body: body('password123', 'nueva-clave-1') })).status, 200);
  const viejo = await t.call('POST', '/auth/login', { body: { email: 'ana@test.com', password: 'password123' } });
  const nuevo = await t.call('POST', '/auth/login', { body: { email: 'ana@test.com', password: 'nueva-clave-1' } });
  assert.equal(viejo.status, 401);
  assert.equal(nuevo.status, 200);
});
