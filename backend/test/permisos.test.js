// Roles del sitio: solo dos. Miembro y Moderador (guardado como `admin`, puede todo). Comprueba la tabla de backend/src/auth.js.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { PNG, startServer } from './helpers.js';

let t;
let mod; // token del Moderador (admin)
let mem; // token del Miembro
let memId;
let modId;

const conDatos = { type: 'propuesta', anonymous: false, name: 'Luis Pérez', degree: 'Licenciatura en Primaria', semester: '3', phone: '5512345678', consent: true, subject: 'Una idea', body: 'Mensaje con datos completos' };
const status = async (token, method, path, body) => (await t.call(method, path, { token, body })).status;

before(async () => {
  t = await startServer();
  await t.createAdmin();
  mod = await t.login();
  await t.call('PUT', '/settings/degrees', { token: mod, body: { value: ['Licenciatura en Primaria'] } });
  const res = await t.call('POST', '/members', { token: mod, body: { name: 'Beto Miembro', role: 'Vocal', email: 'beto@test.com', password: 'clave-de-beto-1234', access: 'miembro' } });
  assert.equal(res.status, 201, res.text);
  memId = res.json._id;
  mem = await t.login('beto@test.com', 'clave-de-beto-1234');
  modId = (await t.call('GET', '/members/all', { token: mod })).json.find((m) => m.email === 'ana@test.com')._id;
  await t.call('POST', '/messages', { body: conDatos });
  const form = t.messageForm({ type: 'queja', anonymous: true, subject: 'Con imagen', body: 'Mensaje anónimo con imagen' }, [{ data: PNG, type: 'image/png', name: 'a.png' }]);
  await t.call('POST', '/messages', { form });
  await t.call('POST', '/news', { token: mod, body: { title: 'Borrador del moderador', body: 'Texto', published: false } });
  await t.call('POST', '/proposals', { token: mod, body: { number: 40, title: 'Propuesta del moderador', objective: 'Objetivo', published: false } });
});
after(() => t.stop());

test('un integrante nuevo es Miembro por defecto; el Moderador elige el rol y solo existen esos dos', async () => {
  const res = await t.call('POST', '/members', { token: mod, body: { name: 'Sin rol elegido', email: 'sinrol@test.com', password: 'clave-sin-rol-elegido-1' } });
  assert.equal(res.json.access, 'miembro');
  assert.equal((await t.models.User.findOne({ email: 'sinrol@test.com' })).role, 'miembro');
  const otro = await t.call('POST', '/members', { token: mod, body: { name: 'Otro Moderador', email: 'otro@test.com', password: 'clave-otro-moderador-1', access: 'admin' } });
  assert.equal(otro.json.access, 'admin');
  assert.equal((await t.models.User.findOne({ email: 'otro@test.com' })).role, 'admin');
  for (const viejo of ['presidente', 'moderador', 'tecnico', 'superusuario']) {
    assert.equal(await status(mod, 'POST', '/members', { name: 'No Existe', email: `${viejo}@test.com`, password: 'clave-larga-de-prueba-1', access: viejo }), 400, viejo);
  }
});

test('Miembro: lee mensajes con datos de contacto, cambia estado y revisión, responde, deja notas y exporta a CSV', async () => {
  const lista = (await t.call('GET', '/messages', { token: mem })).json;
  const msg = lista.find((m) => !m.anonymous);
  assert.deepEqual([msg.name, msg.phone, msg.degree], ['Luis Pérez', '5512345678', 'Licenciatura en Primaria']);
  assert.equal((await t.call('GET', '/messages?page=1', { token: mem })).status, 200);
  assert.equal((await t.call('GET', '/messages/stats', { token: mem })).status, 200);
  const img = lista.find((m) => m.images.length).images[0];
  assert.equal((await t.call('GET', `/files/${img}`, { token: mem })).status, 200, 'las imágenes privadas');

  assert.equal(await status(mem, 'PATCH', `/messages/${msg._id}`, { status: 'leido', review: 'en_proceso' }), 200);
  const resp = await t.call('PATCH', `/messages/${msg._id}`, { token: mem, body: { publicReply: 'Ya lo estamos revisando.' } });
  assert.equal(resp.status, 200);
  assert.deepEqual(resp.json.publicReplyBy, { name: 'Beto Miembro', role: 'Vocal' }, 'queda quién respondió');
  assert.equal(await status(mem, 'POST', `/messages/${msg._id}/notes`, { text: 'Nota de un miembro' }), 201);

  const csv = await t.call('GET', '/messages/export', { token: mem });
  assert.equal(csv.status, 200);
  assert.match(csv.text, /5512345678/);
});

test('Miembro: no ve la papelera ni puede eliminar, restaurar ni borrar definitivamente mensajes', async () => {
  const msg = (await t.call('GET', '/messages', { token: mem })).json[0];
  for (const [method, path] of [['GET', '/messages?trash=1'], ['DELETE', `/messages/${msg._id}`], ['POST', `/messages/${msg._id}/restore`], ['DELETE', `/messages/${msg._id}/permanent`]]) {
    assert.equal(await status(mem, method, path), 403, `${method} ${path}`);
  }
  assert.equal((await t.models.Message.findById(msg._id)).deletedAt, undefined);
});

test('Miembro: ve noticias y propuestas (con borradores), las publica nuevas y cambia su estado, pero no edita lo ya publicado ni lo elimina', async () => {
  assert.ok((await t.call('GET', '/news/all', { token: mem })).json.some((n) => n.title === 'Borrador del moderador'));
  assert.ok((await t.call('GET', '/proposals/all', { token: mem })).json.some((p) => p.number === 40));

  // Publicar algo nuevo (con su portada subida por él mismo)
  const form = new FormData();
  form.append('file', new Blob([PNG], { type: 'image/png' }), 'p.png');
  const cover = await t.call('POST', '/files', { token: mem, form });
  assert.equal(cover.status, 201);
  const noticia = await t.call('POST', '/news', { token: mem, body: { title: 'Noticia de un miembro', body: 'Texto', coverImage: cover.json.id, published: true } });
  assert.equal(noticia.status, 201);
  assert.equal(noticia.json.author, 'Beto Miembro');
  assert.ok((await t.call('GET', '/news')).json.some((n) => n.title === 'Noticia de un miembro'));
  const propuesta = await t.call('POST', '/proposals', { token: mem, body: { number: 41, title: 'Propuesta de un miembro', objective: 'Objetivo' } });
  assert.equal(propuesta.status, 201);

  // Cambiar el estado
  const borrador = (await t.call('GET', '/news/all', { token: mem })).json.find((n) => n.title === 'Borrador del moderador');
  const publicada = await t.call('PATCH', `/news/${borrador._id}/state`, { token: mem, body: { published: true } });
  assert.equal(publicada.json.published, true);
  assert.ok(publicada.json.publishedAt);
  assert.ok((await t.call('GET', '/news')).json.some((n) => n.title === 'Borrador del moderador'));
  assert.equal((await t.call('PATCH', `/news/${borrador._id}/state`, { token: mem, body: { published: false } })).json.published, false);
  assert.equal(await status(mem, 'PATCH', `/news/${borrador._id}/state`, { published: 'sí' }), 400);

  const oculta = (await t.call('GET', '/proposals/all', { token: mem })).json.find((p) => p.number === 40);
  const estado = await t.call('PATCH', `/proposals/${oculta._id}/state`, { token: mem, body: { progress: 'en_marcha', progressNote: 'Ya hay fecha', published: true } });
  assert.deepEqual([estado.json.progress, estado.json.progressNote, estado.json.published], ['en_marcha', 'Ya hay fecha', true]);
  assert.equal(await status(mem, 'PATCH', `/proposals/${oculta._id}/state`, {}), 400);
  assert.equal(await status(mem, 'PATCH', `/proposals/${oculta._id}/state`, { progress: 'terminada' }), 400);
  assert.equal((await t.models.Proposal.findById(oculta._id)).title, 'Propuesta del moderador', 'el estado no toca el contenido');

  // Lo demás es del Moderador
  const id = borrador._id;
  assert.equal(await status(mem, 'PUT', `/news/${id}`, { title: 'Cambiado', body: 'x' }), 403);
  assert.equal(await status(mem, 'DELETE', `/news/${id}`), 403);
  assert.equal(await status(mem, 'PUT', `/proposals/${oculta._id}`, { number: 40, title: 'Cambiada', objective: 'x' }), 403);
  assert.equal(await status(mem, 'DELETE', `/proposals/${oculta._id}`), 403);
  assert.equal(await status(mem, 'DELETE', `/files/${cover.json.id}`), 403);
});

test('Miembro: ve correos, nombres y roles del equipo (nunca contraseñas) y edita solo su propia información', async () => {
  const directorio = (await t.call('GET', '/members/all', { token: mem })).json;
  const ana = directorio.find((m) => m.email === 'ana@test.com');
  assert.deepEqual([ana.name, ana.access], ['Ana Prueba', 'admin']);
  assert.equal(directorio.find((m) => m.email === 'beto@test.com').access, 'miembro');
  assert.ok(!/passwordHash|password|\$2[aby]\$/.test(JSON.stringify(directorio)), 'ni contraseñas ni hashes');
  assert.ok(!directorio.some((m) => 'user' in m));
  assert.equal((await t.call('GET', '/members/all')).status, 401);

  const ordenAntes = (await t.models.Member.findById(memId)).order;
  const res = await t.call('PUT', '/members/me', { token: mem, body: { name: 'Beto Renombrado', role: 'Secretario', degree: 'Licenciatura en Primaria', email: 'hack@test.com', access: 'admin', order: 99 } });
  assert.equal(res.status, 200, res.text);
  const usuario = await t.models.User.findOne({ email: 'beto@test.com' });
  assert.deepEqual([usuario.name, usuario.role], ['Beto Renombrado', 'miembro'], 'ni el correo ni el rol cambian');
  assert.ok(!(await t.models.User.exists({ email: 'hack@test.com' })));
  assert.equal((await t.models.Member.findById(memId)).order, ordenAntes, 'el orden tampoco');
  assert.equal((await t.models.Member.findById(modId)).name, 'Ana Prueba', 'la ficha de otra persona no cambia');

  // A los demás no los toca, ni siquiera a sí mismo por la vía de administración
  for (const [method, path, body] of [
    ['PUT', `/members/${modId}`, { name: 'Ana Cambiada' }], ['PUT', `/members/${memId}`, { name: 'Beto Renombrado', access: 'admin' }], ['PUT', '/members/order', { ids: [memId, modId] }],
    ['POST', '/members', { name: 'No No', email: 'no@test.com', password: 'clave-no-no-1234' }], ['DELETE', `/members/${modId}`], ['DELETE', `/members/${memId}`],
  ]) assert.equal(await status(mem, method, path, body), 403, `${method} ${path}`);
  assert.equal((await t.models.User.findOne({ email: 'beto@test.com' })).role, 'miembro');
});

test('Miembro: no accede a los ajustes ni a la bitácora', async () => {
  assert.equal(await status(mem, 'PUT', '/settings/groups', { value: ['A'] }), 403);
  assert.equal(await status(mem, 'GET', '/audit'), 403);
  assert.equal((await t.call('GET', '/settings')).status, 200, 'leerlos es público (alimentan el buzón)');
});

test('Moderador: puede todo', async () => {
  for (const [method, path] of [['GET', '/messages'], ['GET', '/messages?trash=1'], ['GET', '/messages/stats'], ['GET', '/messages/export'], ['GET', '/audit'], ['GET', '/members/all'], ['GET', '/news/all'], ['GET', '/proposals/all']]) {
    assert.equal(await status(mod, method, path), 200, `${method} ${path}`);
  }
  assert.equal(await status(mod, 'PUT', '/settings/groups', { value: ['A', 'B'] }), 200);
  const n = (await t.call('POST', '/news', { token: mod, body: { title: 'Para editar', body: 'x', published: false } })).json;
  assert.equal(await status(mod, 'PUT', `/news/${n._id}`, { title: 'Editada', body: 'y' }), 200);
  assert.equal(await status(mod, 'DELETE', `/news/${n._id}`), 204);
  const msg = (await t.call('GET', '/messages', { token: mod })).json[0];
  assert.equal(await status(mod, 'DELETE', `/messages/${msg._id}`), 204);
  assert.equal((await t.call('GET', '/messages?trash=1', { token: mod })).json.length, 1);
  assert.equal(await status(mod, 'POST', `/messages/${msg._id}/restore`), 200);
  assert.equal(await status(mod, 'PUT', `/members/${memId}`, { name: 'Beto Renombrado', access: 'miembro' }), 200);
  assert.equal(await status(mod, 'PUT', '/members/order', { ids: [memId, modId] }), 200);
});

test('el Moderador cambia el rol de cualquiera, pero siempre queda al menos uno y nadie se quita el suyo', async () => {
  const edit = (id, name, access) => t.call('PUT', `/members/${id}`, { token: mod, body: { name, access } });
  assert.equal((await edit(memId, 'Beto Renombrado', 'admin')).json.access, 'admin');
  assert.equal(await status(mem, 'GET', '/audit'), 200, 'el rol se lee de la base en cada petición: ya puede todo');
  assert.equal((await edit(memId, 'Beto Renombrado', 'miembro')).json.access, 'miembro');
  assert.equal(await status(mem, 'GET', '/audit'), 403);
  assert.equal((await edit(modId, 'Ana Prueba', 'miembro')).status, 400, 'nadie se quita su propio rol de Moderador');
  assert.equal((await t.models.User.findOne({ email: 'ana@test.com' })).role, 'admin');
});

test('los roles que ya no existen cuentan como Miembro de inmediato y la migración 003 los convierte (sin tocar a los Moderadores)', async () => {
  const hash = await bcrypt.hash('clave-vieja-cuenta-1', 4);
  for (const role of ['presidente', 'moderador']) {
    await t.models.User.collection.insertOne({ name: `Viejo ${role}`, email: `${role}@viejo.com`, passwordHash: hash, role, tokenVersion: 0, createdAt: new Date(), updatedAt: new Date() });
  }
  const viejo = await t.login('moderador@viejo.com', 'clave-vieja-cuenta-1');
  // Antes de migrar ya se comportan como Miembro: ven mensajes, pero no la papelera ni la bitácora
  assert.equal(await status(viejo, 'GET', '/messages'), 200);
  assert.equal(await status(viejo, 'GET', '/messages?trash=1'), 403);
  assert.equal(await status(viejo, 'GET', '/audit'), 403);
  assert.equal(await status(viejo, 'DELETE', `/members/${memId}`), 403);

  const { run } = await import('../src/migrations/003-roles.js');
  assert.match(await run(), /^2 cuenta/);
  for (const role of ['presidente', 'moderador']) assert.equal((await t.models.User.findOne({ email: `${role}@viejo.com` })).role, 'miembro');
  assert.equal((await t.models.User.findOne({ email: 'ana@test.com' })).role, 'admin', 'el Moderador (admin) no se toca');
  assert.match(await run(), /^0 cuenta/, 'idempotente');
});
