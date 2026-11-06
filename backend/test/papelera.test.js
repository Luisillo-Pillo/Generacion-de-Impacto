// Papelera de mensajes y bitácora de acciones (S7).
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PNG, startServer } from './helpers.js';
import { purgeTrash } from '../src/maintenance.js';

let t;
let token;

const anonimo = (extra = {}) => ({ type: 'queja', anonymous: true, subject: 'Asunto reservado', body: 'SECRETO-XYZ texto del mensaje', ...extra });
const lista = async (query = '') => (await t.call('GET', `/messages${query}`, { token })).json;
const bitacora = async (query = '') => (await t.call('GET', `/audit${query}`, { token })).json;
const archivos = () => t.models.Message.db.db.collection('files.files').countDocuments();

before(async () => {
  t = await startServer();
  await t.createAdmin();
  token = await t.login();
});
after(() => t.stop());
beforeEach(() => t.models.Message.deleteMany({}));

test('eliminar manda a la papelera: desaparece del listado y se puede restaurar', async () => {
  await t.call('POST', '/messages', { body: anonimo() });
  const [m] = await lista();

  assert.equal((await t.call('DELETE', `/messages/${m._id}`, { token })).status, 204);
  assert.deepEqual(await lista(), []);
  const enPapelera = await lista('?trash=1');
  assert.equal(enPapelera.length, 1);
  assert.ok(enPapelera[0].deletedAt);

  assert.equal((await t.call('PATCH', `/messages/${m._id}`, { token, body: { status: 'leido' } })).status, 404, 'un mensaje en la papelera no se edita');

  const restaurado = await t.call('POST', `/messages/${m._id}/restore`, { token });
  assert.equal(restaurado.status, 200);
  assert.equal(restaurado.json.deletedAt, undefined);
  assert.equal((await lista()).length, 1);
  assert.deepEqual(await lista('?trash=1'), []);
  assert.equal((await t.call('POST', `/messages/${m._id}/restore`, { token })).status, 404, 'ya no está en la papelera');
});

test('la papelera y el borrado definitivo exigen administrador', async () => {
  await t.call('POST', '/messages', { body: anonimo() });
  const [m] = await lista();
  assert.equal((await t.call('POST', `/messages/${m._id}/restore`)).status, 401);
  assert.equal((await t.call('DELETE', `/messages/${m._id}/permanent`)).status, 401);
  assert.equal((await t.call('GET', '/messages?trash=1')).status, 401);
});

test('el borrado definitivo solo aplica a lo que está en la papelera y elimina las imágenes', async () => {
  await t.call('POST', '/messages', { form: t.messageForm(anonimo(), [{ data: PNG, type: 'image/png', name: 'a.png' }]) });
  const [m] = await lista();
  assert.equal((await t.call('DELETE', `/messages/${m._id}/permanent`, { token })).status, 404, 'primero debe estar en la papelera');
  assert.equal((await lista()).length, 1);

  await t.call('DELETE', `/messages/${m._id}`, { token });
  assert.equal(await archivos(), 1, 'la imagen se conserva mientras está en la papelera');
  assert.equal((await t.call('DELETE', `/messages/${m._id}/permanent`, { token })).status, 204);
  assert.equal(await t.models.Message.countDocuments(), 0);
  assert.equal(await archivos(), 0);
});

test('ids con formato inválido dan 404 en las rutas nuevas', async () => {
  assert.equal((await t.call('POST', '/messages/abc/restore', { token })).status, 404);
  assert.equal((await t.call('DELETE', '/messages/abc/permanent', { token })).status, 404);
});

test('purgeTrash borra a los 30 días, con sus imágenes, y no toca lo reciente ni lo que no está en la papelera', async () => {
  const dias = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  for (let i = 0; i < 3; i++) {
    await t.call('POST', '/messages', { form: t.messageForm(anonimo({ subject: `Mensaje ${i}` }), [{ data: PNG, type: 'image/png', name: 'a.png' }]) });
  }
  const todos = await t.models.Message.find().sort({ createdAt: 1 });
  await t.models.Message.updateOne({ _id: todos[0]._id }, { deletedAt: dias(31) }); // vencido
  await t.models.Message.updateOne({ _id: todos[1]._id }, { deletedAt: dias(29) }); // reciente
  // todos[2] sigue activo

  assert.equal(await purgeTrash(), 1);
  assert.equal(await t.models.Message.countDocuments(), 2);
  assert.equal(await t.models.Message.exists({ _id: todos[0]._id }), null);
  assert.equal(await archivos(), 2, 'solo se borró la imagen del vencido');
  assert.equal(await purgeTrash(), 0, 'es idempotente');
});

test('la bitácora exige administrador y registra quién hizo qué, sin copiar el contenido de los mensajes', async () => {
  assert.equal((await t.call('GET', '/audit')).status, 401);
  await t.models.AuditLog.deleteMany({});

  await t.call('POST', '/messages', { body: anonimo() });
  const [m] = await lista();
  await t.call('PATCH', `/messages/${m._id}`, { token, body: { status: 'leido', review: 'en_proceso' } });
  await t.call('DELETE', `/messages/${m._id}`, { token });
  await t.call('POST', `/messages/${m._id}/restore`, { token });
  await t.call('DELETE', `/messages/${m._id}`, { token });
  await t.call('DELETE', `/messages/${m._id}/permanent`, { token });

  const { items, total } = await bitacora();
  assert.equal(total, 5);
  assert.deepEqual(
    items.map((i) => i.action),
    ['mensaje.eliminar', 'mensaje.papelera', 'mensaje.restaurar', 'mensaje.papelera', 'mensaje.actualizar']
  );
  assert.ok(items.every((i) => i.userName === 'Ana Prueba' && i.userId && i.at && i.entityId === m._id));
  const texto = JSON.stringify(items);
  assert.ok(!texto.includes('SECRETO-XYZ'), 'no guarda el texto del mensaje');
  assert.ok(!texto.includes('Asunto reservado'), 'ni su asunto');
});

test('la bitácora registra noticias, propuestas, integrantes, ajustes y cambios de contraseña, sin contraseñas', async () => {
  await t.models.AuditLog.deleteMany({});
  const noticia = await t.call('POST', '/news', { token, body: { title: 'Una noticia', body: 'Texto', published: true } });
  await t.call('PUT', `/news/${noticia.json._id}`, { token, body: { title: 'Una noticia editada', body: 'Texto', published: true } });
  await t.call('DELETE', `/news/${noticia.json._id}`, { token });
  const propuesta = await t.call('POST', '/proposals', { token, body: { number: 7, title: 'Propuesta', objective: 'Objetivo' } });
  await t.call('DELETE', `/proposals/${propuesta.json._id}`, { token });
  await t.call('PUT', '/settings/semesters', { token, body: { value: ['1', '2'] } });
  const integrante = await t.call('POST', '/members', { token, body: { name: 'Nuevo Integrante', email: 'nuevo@test.com', password: 'clave-nuevo-integrante' } });
  await t.call('DELETE', `/members/${integrante.json._id}`, { token });
  const cambio = await t.call('PATCH', '/auth/password', { token, body: { currentPassword: 'password123', newPassword: 'clave-nueva-de-ana-1' } });
  token = cambio.json.token; // el cambio de contraseña invalida el token anterior

  const { items } = await bitacora();
  const acciones = items.map((i) => i.action).sort();
  assert.deepEqual(acciones, [
    'ajustes.editar', 'auth.contrasena', 'integrante.crear', 'integrante.eliminar',
    'noticia.crear', 'noticia.editar', 'noticia.eliminar', 'propuesta.crear', 'propuesta.eliminar',
  ]);
  assert.ok(!JSON.stringify(items).includes('clave-'), 'nunca guarda contraseñas');
});

test('la bitácora se pagina de 50 en 50 y expira al año', async () => {
  await t.models.AuditLog.deleteMany({});
  await t.models.AuditLog.insertMany(Array.from({ length: 120 }, (_, i) => ({ action: 'prueba', summary: `Registro ${i}`, at: new Date(Date.now() - i * 1000) })));
  const p1 = await bitacora();
  assert.equal(p1.items.length, 50);
  assert.equal(p1.total, 120);
  assert.equal(p1.pages, 3);
  assert.equal(p1.items[0].summary, 'Registro 0', 'lo más reciente primero');
  assert.equal((await bitacora('?page=3')).items.length, 20);
  assert.equal((await bitacora('?page=99')).items.length, 0);
  assert.equal((await bitacora('?page=abc')).page, 1);

  const indices = await t.models.AuditLog.collection.indexes();
  assert.ok(indices.some((i) => i.key.at === 1 && i.expireAfterSeconds === 365 * 24 * 60 * 60));
});

test('bloquear una cuenta por intentos fallidos queda en la bitácora', async () => {
  await t.models.AuditLog.deleteMany({});
  for (let i = 0; i < 5; i++) await t.call('POST', '/auth/login', { body: { email: 'ana@test.com', password: `mala${i}` } });
  const { items } = await bitacora();
  assert.equal(items.filter((i) => i.action === 'login.bloqueado').length, 1);
});
