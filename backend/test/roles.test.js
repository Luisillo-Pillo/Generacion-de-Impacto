// Rol moderador (S6): lee y gestiona mensajes sin ver datos de contacto; nada más.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { PNG, startServer } from './helpers.js';

let t;
let admin;
let mod;
let modMemberId;

const conDatos = { type: 'propuesta', anonymous: false, name: 'Luis Pérez', degree: 'Licenciatura en Primaria', semester: '3', phone: '5512345678', consent: true, subject: 'Una idea', body: 'Mensaje con datos completos' };
const anonimo = { type: 'queja', anonymous: true, subject: 'Baños', body: 'Mensaje anónimo de prueba' };

before(async () => {
  t = await startServer();
  await t.createAdmin();
  admin = await t.login();
  await t.call('PUT', '/settings/degrees', { token: admin, body: { value: ['Licenciatura en Primaria'] } });
  const res = await t.call('POST', '/members', { token: admin, body: { name: 'Mora Moderadora', email: 'mod@test.com', password: 'clave-de-moderadora-1', access: 'moderador' } });
  assert.equal(res.status, 201, res.text);
  assert.equal(res.json.access, 'moderador');
  modMemberId = res.json._id;
  mod = await t.login('mod@test.com', 'clave-de-moderadora-1');
  await t.call('POST', '/messages', { body: conDatos });
  await t.call('POST', '/messages', { body: anonimo });
});
after(() => t.stop());

test('el rol por defecto de un integrante nuevo es administrador', async () => {
  const res = await t.call('POST', '/members', { token: admin, body: { name: 'Otro Admin', email: 'otro@test.com', password: 'clave-de-otro-admin-1' } });
  assert.equal(res.json.access, 'admin');
  assert.equal((await t.models.User.findOne({ email: 'otro@test.com' })).role, 'admin');
  await t.call('DELETE', `/members/${res.json._id}`, { token: admin });
});

test('el moderador ve los mensajes pero sin nombre, teléfono, licenciatura, semestre ni grupo', async () => {
  const lista = (await t.call('GET', '/messages', { token: mod })).json;
  assert.equal(lista.length, 2);
  const conContacto = lista.find((m) => !m.anonymous);
  for (const campo of ['name', 'degree', 'semester', 'group', 'phone']) assert.ok(!(campo in conContacto), `se filtró ${campo}`);
  assert.equal(conContacto.hasContact, true);
  assert.equal(conContacto.subject, 'Una idea');
  assert.equal(lista.find((m) => m.anonymous).hasContact, false);
  assert.ok(!JSON.stringify(lista).includes('5512345678') && !JSON.stringify(lista).includes('Luis'));

  const delAdmin = (await t.call('GET', '/messages', { token: admin })).json.find((m) => !m.anonymous);
  assert.equal(delAdmin.phone, '5512345678');
  assert.equal(delAdmin.name, 'Luis Pérez');
});

test('el moderador puede cambiar estado y revisión (sin ver los datos en la respuesta)', async () => {
  const msg = (await t.call('GET', '/messages', { token: mod })).json.find((m) => !m.anonymous);
  const res = await t.call('PATCH', `/messages/${msg._id}`, { token: mod, body: { review: 'en_proceso', status: 'leido' } });
  assert.equal(res.status, 200);
  assert.equal(res.json.review, 'en_proceso');
  assert.ok(!('phone' in res.json) && !('name' in res.json));
  const log = (await t.call('GET', '/audit', { token: admin })).json.items;
  assert.ok(log.some((e) => e.action === 'mensaje.actualizar' && e.userName === 'Mora Moderadora'), 'queda en la bitácora con su nombre');
});

test('el moderador no puede eliminar, ver ni vaciar la papelera, ni tocar el resto del sitio', async () => {
  const msg = (await t.call('GET', '/messages', { token: mod })).json[0];
  const prohibido = [
    ['DELETE', `/messages/${msg._id}`], ['GET', '/messages?trash=1'], ['POST', `/messages/${msg._id}/restore`], ['DELETE', `/messages/${msg._id}/permanent`],
    ['GET', '/audit'], ['GET', '/members/all'], ['POST', '/members'], ['GET', '/news/all'], ['POST', '/news'], ['POST', '/proposals'], ['PUT', '/settings/degrees'], ['POST', '/files'],
  ];
  for (const [method, path] of prohibido) assert.equal((await t.call(method, path, { token: mod, body: method === 'GET' ? undefined : {} })).status, 403, `${method} ${path}`);
  assert.equal(await t.models.Message.countDocuments({ deletedAt: { $ne: null } }), 0, 'no se eliminó nada');
});

test('las imágenes privadas del buzón las ven administradores y moderadores, nadie más', async () => {
  const form = t.messageForm(anonimo, [{ data: PNG, type: 'image/png', name: 'a.png' }]);
  assert.equal((await t.call('POST', '/messages', { form })).status, 201);
  const id = (await t.call('GET', '/messages', { token: mod })).json.find((m) => m.images.length).images[0];
  assert.equal((await t.call('GET', `/files/${id}`, { token: mod })).status, 200);
  assert.equal((await t.call('GET', `/files/${id}`, { token: admin })).status, 200);
  assert.equal((await t.call('GET', `/files/${id}`)).status, 401);
  // Una cuenta sin rol de personal tampoco
  await t.models.User.create({ name: 'Sin rol', email: 'sin@test.com', passwordHash: await bcrypt.hash('clave-sin-rol-1234', 4), role: 'user' });
  const token = (await t.call('POST', '/auth/login', { body: { email: 'sin@test.com', password: 'clave-sin-rol-1234' } })).json.token;
  assert.equal((await t.call('GET', `/files/${id}`, { token })).status, 403);
  assert.equal((await t.call('GET', '/messages', { token })).status, 403);
});

test('cambiar el rol: se puede ascender a un moderador y degradar a otro admin, pero siempre queda un administrador', async () => {
  const lista = (await t.call('GET', '/members/all', { token: admin })).json;
  const yo = lista.find((m) => m.email === 'ana@test.com');
  const edit = (m, access) => t.call('PUT', `/members/${m._id}`, { token: admin, body: { name: m.name, access } });

  // Ni uno mismo ni el último administrador pueden dejar de serlo
  assert.equal((await edit(yo, 'moderador')).status, 400);
  assert.equal((await t.models.User.findOne({ email: 'ana@test.com' })).role, 'admin');

  // Ascender a la moderadora: ya ve todo
  const subida = await edit({ _id: modMemberId, name: 'Mora Moderadora' }, 'admin');
  assert.equal(subida.status, 200);
  assert.equal(subida.json.access, 'admin');
  const vistoPorElla = (await t.call('GET', '/messages', { token: mod })).json.find((m) => !m.anonymous);
  assert.equal(vistoPorElla.phone, '5512345678', 'el rol se lee de la base en cada petición: surte efecto de inmediato');

  // Ahora que hay dos administradores, uno puede degradar al otro (no a sí mismo)
  const baja = await edit({ _id: modMemberId, name: 'Mora Moderadora' }, 'moderador');
  assert.equal(baja.status, 200);
  assert.equal((await t.call('GET', '/messages', { token: mod })).json.find((m) => !m.anonymous).phone, undefined);
  const log = (await t.call('GET', '/audit', { token: admin })).json.items;
  assert.ok(log.some((e) => /ahora es moderador/.test(e.summary)));
});

test('el rol inválido se rechaza', async () => {
  const res = await t.call('POST', '/members', { token: admin, body: { name: 'X Y', email: 'x@test.com', password: 'clave-larga-de-x-1', access: 'superadmin' } });
  assert.equal(res.status, 400);
});
