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

test('semestre y grupo del integrante: el grupo solo se guarda en las licenciaturas con varios grupos', async () => {
  await t.call('PUT', '/settings/degrees', { token, body: { value: ['Licenciatura en Primaria', 'Licenciatura en Telesecundaria'] } });
  await t.call('PUT', '/settings/groupDegrees', { token, body: { value: ['Licenciatura en Telesecundaria'] } });

  // Alta: con grupo en una licenciatura que sí lo usa
  const conGrupo = await t.call('POST', '/members', { token, body: integrante({ name: 'Con Grupo', email: 'grupo@test.com', degree: 'Licenciatura en Telesecundaria', semester: '3', group: 'B' }) });
  assert.equal(conGrupo.status, 201, conGrupo.text);
  assert.deepEqual([conGrupo.json.degree, conGrupo.json.semester, conGrupo.json.group], ['Licenciatura en Telesecundaria', '3', 'B']);

  // Alta: el grupo se descarta si la licenciatura no lo usa; el semestre se conserva
  const sinGrupo = await t.call('POST', '/members', { token, body: integrante({ name: 'Sin Grupo', email: 'singrupo@test.com', degree: 'Licenciatura en Primaria', semester: '5', group: 'A' }) });
  assert.equal(sinGrupo.status, 201, sinGrupo.text);
  assert.deepEqual([sinGrupo.json.semester, sinGrupo.json.group], ['5', '']);

  // Ambos son opcionales: sin ellos quedan vacíos
  const vacio = await t.call('POST', '/members', { token, body: integrante({ name: 'Sin Datos', email: 'sindatos@test.com' }) });
  assert.deepEqual([vacio.json.semester, vacio.json.group], ['', '']);

  // Edición por el Moderador: al cambiar a una licenciatura sin grupos, el grupo se borra
  const editado = await t.call('PUT', `/members/${conGrupo.json._id}`, { token, body: { name: 'Con Grupo', degree: 'Licenciatura en Primaria', semester: '4', group: 'B' } });
  assert.equal(editado.status, 200, editado.text);
  assert.deepEqual([editado.json.semester, editado.json.group], ['4', '']);

  // Se pueden pedir de vuelta en la lista pública y en la del panel
  assert.equal((await t.call('GET', '/members')).json.find((m) => m.name === 'Sin Grupo').semester, '5');
  assert.equal((await t.call('GET', '/members/all', { token })).json.find((m) => m.name === 'Sin Grupo').semester, '5');

  // Valores demasiado largos se rechazan
  assert.equal((await t.call('POST', '/members', { token, body: integrante({ name: 'Largo', email: 'largo@test.com', semester: 'x'.repeat(21) }) })).status, 400);
});

test('cada integrante edita su propio semestre y grupo en /members/me, con la misma regla del grupo', async () => {
  const miToken = await t.login('grupo@test.com', 'clave-de-integrante-1');
  const ok = await t.call('PUT', '/members/me', { token: miToken, body: { name: 'Con Grupo', degree: 'Licenciatura en Telesecundaria', semester: '6', group: 'C' } });
  assert.equal(ok.status, 200, ok.text);
  assert.deepEqual([ok.json.member.semester, ok.json.member.group], ['6', 'C']);

  const sinAplicar = await t.call('PUT', '/members/me', { token: miToken, body: { name: 'Con Grupo', degree: 'Licenciatura en Primaria', semester: '6', group: 'C' } });
  assert.deepEqual([sinAplicar.json.member.semester, sinAplicar.json.member.group], ['6', '']);
  assert.equal((await t.call('PUT', '/members/me', { token: miToken, body: { name: 'Con Grupo', group: 'x'.repeat(21) } })).status, 400);
});
