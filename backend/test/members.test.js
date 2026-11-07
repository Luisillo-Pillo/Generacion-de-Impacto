import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.js';

let t;
let token;
let admin;

before(async () => {
  t = await startServer();
  admin = await t.createAdmin();
  token = await t.login();
});
after(() => t.stop());

const integrante = (extra = {}) => ({ name: 'Beto Prueba', role: 'Tesorería', email: 'beto@test.com', password: 'clave-de-integrante-1', ...extra });

test('dar de alta a un integrante crea su cuenta (Miembro por defecto)', async () => {
  assert.equal((await t.call('POST', '/members', { body: integrante() })).status, 401);
  const res = await t.call('POST', '/members', { token, body: integrante() });
  assert.equal(res.status, 201);
  assert.equal(res.json.email, 'beto@test.com');
  assert.equal(res.json.user, undefined);

  const login = await t.call('POST', '/auth/login', { body: { email: 'beto@test.com', password: 'clave-de-integrante-1' } });
  assert.equal(login.status, 200);
  assert.equal(login.json.user.role, 'miembro');
});

test('correo y contraseña son obligatorios, con mínimo de 10 caracteres, sin contraseñas comunes y correo único sin importar mayúsculas', async () => {
  assert.equal((await t.call('POST', '/members', { token, body: integrante({ email: undefined }) })).status, 400);
  assert.equal((await t.call('POST', '/members', { token, body: integrante({ password: undefined }) })).status, 400);
  assert.equal((await t.call('POST', '/members', { token, body: integrante({ email: 'otro@test.com', password: 'corta' }) })).status, 400);
  const ocho = await t.call('POST', '/members', { token, body: integrante({ email: 'otro@test.com', password: '12345678' }) });
  assert.equal(ocho.status, 400);
  assert.match(ocho.json.error, /al menos 10 caracteres/);
  const comun = await t.call('POST', '/members', { token, body: integrante({ email: 'otro@test.com', password: 'Contraseña123' }) });
  assert.equal(comun.status, 400);
  assert.match(comun.json.error, /muy común/);
  assert.equal((await t.call('POST', '/members', { token, body: integrante({ email: 'otro@test.com', password: 'aaaaaaaaaaaa' }) })).status, 400);
  assert.equal((await t.call('POST', '/members', { token, body: integrante({ email: 'no-es-correo' }) })).status, 400);
  assert.equal((await t.call('POST', '/members', { token, body: integrante({ email: 'BETO@test.com', name: 'Otro Beto' }) })).status, 409);
  assert.equal((await t.models.User.countDocuments({ email: 'otro@test.com' })), 0, 'no deben quedar cuentas huérfanas');
});

test('la API pública del equipo no expone cuentas ni correos', async () => {
  const publico = await t.call('GET', '/members');
  assert.equal(publico.status, 200);
  assert.ok(publico.json.length >= 1);
  assert.ok(publico.json.every((m) => !('user' in m) && !('email' in m)));
  assert.ok(!publico.text.includes('beto@test.com'));
  assert.equal((await t.call('GET', '/members/all')).status, 401);
  const todos = await t.call('GET', '/members/all', { token });
  assert.ok(todos.json.some((m) => m.email === 'beto@test.com'));
});

test('editar: cambiar correo y contraseña, y rechazar un correo repetido', async () => {
  const beto = (await t.call('GET', '/members/all', { token })).json.find((m) => m.email === 'beto@test.com');
  const put = (body) => t.call('PUT', `/members/${beto._id}`, { token, body });

  assert.equal((await put({ name: 'Beto Editado', email: admin.email })).status, 409);
  const sinCambiarClave = await put({ name: 'Beto Editado', role: 'Presidencia', email: '', password: '' });
  assert.equal(sinCambiarClave.status, 200);
  assert.equal(sinCambiarClave.json.email, 'beto@test.com');
  assert.equal((await t.call('POST', '/auth/login', { body: { email: 'beto@test.com', password: 'clave-de-integrante-1' } })).status, 200);

  assert.equal((await put({ name: 'Beto Editado', email: 'beto2@test.com', password: 'nueva-clave-1' })).status, 200);
  assert.equal((await t.call('POST', '/auth/login', { body: { email: 'beto2@test.com', password: 'nueva-clave-1' } })).status, 200);
  assert.equal((await t.call('POST', '/auth/login', { body: { email: 'beto@test.com', password: 'clave-de-integrante-1' } })).status, 401);
  assert.equal((await put({ name: 'Beto Editado', password: 'corta' })).status, 400);
});

test('eliminar a un integrante le retira el acceso al instante', async () => {
  const creado = await t.call('POST', '/members', { token, body: integrante({ name: 'Para Borrar', email: 'borrar@test.com' }) });
  const suToken = await t.login('borrar@test.com', 'clave-de-integrante-1');
  assert.equal((await t.call('GET', '/auth/me', { token: suToken })).status, 200);

  assert.equal((await t.call('DELETE', `/members/${creado.json._id}`, { token })).status, 204);
  assert.equal((await t.call('GET', '/auth/me', { token: suToken })).status, 401);
  assert.equal(await t.models.User.countDocuments({ email: 'borrar@test.com' }), 0);
});

test('nadie puede eliminar su propia ficha: siempre queda un administrador', async () => {
  const yo = (await t.call('GET', '/auth/me', { token })).json.member;
  const res = await t.call('DELETE', `/members/${yo._id}`, { token });
  assert.equal(res.status, 400);
  assert.equal((await t.call('GET', '/auth/me', { token })).status, 200);
});
