// Roles del sitio: Técnico (admin), Presidente, Miembro y Moderador. Comprueba la tabla de permisos de backend/src/auth.js.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PNG, startServer } from './helpers.js';

let t;
const tokens = {};
const ids = {};

const conDatos = { type: 'propuesta', anonymous: false, name: 'Luis Pérez', degree: 'Licenciatura en Primaria', semester: '3', phone: '5512345678', consent: true, subject: 'Una idea', body: 'Mensaje con datos completos' };
const como = (rol, method, path, extra = {}) => t.call(method, path, { token: tokens[rol], ...extra });
const estado = async (rol, method, path, body) => (await como(rol, method, path, { body })).status;

before(async () => {
  t = await startServer();
  await t.createAdmin();
  tokens.admin = await t.login();
  await t.call('PUT', '/settings/degrees', { token: tokens.admin, body: { value: ['Licenciatura en Primaria'] } });
  for (const rol of ['presidente', 'miembro', 'moderador']) {
    const res = await t.call('POST', '/members', { token: tokens.admin, body: { name: `Persona ${rol}`, role: `Cargo de ${rol}`, email: `${rol}@test.com`, password: `clave-de-${rol}-1234`, access: rol } });
    assert.equal(res.status, 201, res.text);
    ids[rol] = res.json._id;
    tokens[rol] = await t.login(`${rol}@test.com`, `clave-de-${rol}-1234`);
  }
  await t.call('POST', '/messages', { body: conDatos });
  const form = t.messageForm({ type: 'queja', anonymous: true, subject: 'Con imagen', body: 'Mensaje anónimo con imagen' }, [{ data: PNG, type: 'image/png', name: 'a.png' }]);
  await t.call('POST', '/messages', { form });
  await t.call('POST', '/news', { token: tokens.admin, body: { title: 'Borrador secreto', body: 'Texto', published: false } });
  await t.call('POST', '/proposals', { token: tokens.admin, body: { number: 40, title: 'Propuesta oculta', objective: 'Objetivo', published: false } });
});
after(() => t.stop());

test('un integrante nuevo es Miembro por defecto (el mínimo de permisos); el Técnico elige el rol', async () => {
  const res = await t.call('POST', '/members', { token: tokens.admin, body: { name: 'Sin rol elegido', email: 'sinrol@test.com', password: 'clave-sin-rol-elegido-1' } });
  assert.equal(res.json.access, 'miembro');
  assert.equal((await t.models.User.findOne({ email: 'sinrol@test.com' })).role, 'miembro');
  for (const rol of ['admin', 'presidente', 'miembro', 'moderador']) {
    const r = await t.call('POST', '/members', { token: tokens.admin, body: { name: `Rol ${rol}`, email: `rol-${rol}@test.com`, password: `clave-rol-${rol}-1234`, access: rol } });
    assert.equal(r.status, 201);
    assert.equal(r.json.access, rol);
    assert.equal((await t.models.User.findOne({ email: `rol-${rol}@test.com` })).role, rol);
  }
  assert.equal(await estado('admin', 'POST', '/members', { name: 'X Y', email: 'x@test.com', password: 'clave-larga-de-x-1', access: 'superusuario' }), 400);
});

test('Técnico: ve y edita todo', async () => {
  for (const [method, path] of [['GET', '/messages'], ['GET', '/messages?trash=1'], ['GET', '/messages/stats'], ['GET', '/messages/export'], ['GET', '/audit'], ['GET', '/members/all'], ['GET', '/news/all'], ['GET', '/proposals/all']]) {
    assert.equal(await estado('admin', method, path), 200, `${method} ${path}`);
  }
  const msg = (await como('admin', 'GET', '/messages')).json.find((m) => !m.anonymous);
  assert.equal(msg.phone, '5512345678');
  assert.equal(await estado('admin', 'PATCH', `/messages/${msg._id}`, { review: 'en_proceso' }), 200);
  assert.equal(await estado('admin', 'PUT', '/settings/groups', { value: ['A', 'B'] }), 200);
});

test('Presidente: ve todo, con los datos de contacto completos, y no puede editar nada', async () => {
  for (const [method, path] of [['GET', '/messages'], ['GET', '/messages?trash=1'], ['GET', '/messages?page=1'], ['GET', '/messages/stats'], ['GET', '/messages/export'], ['GET', '/audit'], ['GET', '/members/all'], ['GET', '/news/all'], ['GET', '/proposals/all'], ['GET', '/settings']]) {
    assert.equal(await estado('presidente', method, path), 200, `${method} ${path}`);
  }
  const lista = (await como('presidente', 'GET', '/messages')).json;
  const msg = lista.find((m) => !m.anonymous);
  assert.deepEqual([msg.name, msg.phone, msg.degree], ['Luis Pérez', '5512345678', 'Licenciatura en Primaria'], 'sin ocultar nada');
  assert.ok((await como('presidente', 'GET', '/news/all')).json.some((n) => n.title === 'Borrador secreto'), 've los borradores');
  assert.ok((await como('presidente', 'GET', '/proposals/all')).json.some((p) => p.number === 40), 've las propuestas ocultas');
  assert.ok((await como('presidente', 'GET', '/members/all')).json.every((m) => m.email !== undefined && m.access), 've correos y roles');
  assert.match((await como('presidente', 'GET', '/messages/export')).text, /5512345678/);

  // Imágenes privadas de los mensajes
  const img = lista.find((m) => m.images.length).images[0];
  assert.equal((await como('presidente', 'GET', `/files/${img}`)).status, 200);

  // Nada de escritura
  const m1 = msg._id;
  const prohibido = [
    ['PATCH', `/messages/${m1}`, { status: 'leido' }], ['POST', `/messages/${m1}/notes`, { text: 'nota' }], ['DELETE', `/messages/${m1}`], ['POST', `/messages/${m1}/restore`], ['DELETE', `/messages/${m1}/permanent`],
    ['POST', '/news', { title: 'No', body: 'No' }], ['PUT', '/news/000000000000000000000001', { title: 'No', body: 'No' }], ['DELETE', '/news/000000000000000000000001'],
    ['POST', '/proposals', { number: 50, title: 'No', objective: 'No' }], ['PUT', '/proposals/000000000000000000000001', { number: 1, title: 'No', objective: 'No' }], ['DELETE', '/proposals/000000000000000000000001'],
    ['PUT', '/settings/degrees', { value: ['X'] }], ['POST', '/files'],
    ['POST', '/members', { name: 'No No', email: 'no@test.com', password: 'clave-no-no-1234' }], ['PUT', `/members/${ids.miembro}`, { name: 'Cambio' }], ['DELETE', `/members/${ids.miembro}`], ['PUT', '/members/order', { ids: [ids.miembro] }],
  ];
  for (const [method, path, body] of prohibido) assert.equal(await estado('presidente', method, path, body), 403, `${method} ${path}`);
  assert.equal((await t.models.Message.findById(m1)).deletedAt, undefined);
});

test('Miembro: ve de los demás solo lo no crítico y no accede a mensajes, bitácora ni borradores', async () => {
  const directorio = (await como('miembro', 'GET', '/members/all')).json;
  assert.ok(directorio.length >= 4);
  for (const m of directorio) {
    assert.deepEqual(Object.keys(m).sort(), ['_id', 'degree', 'name', 'order', 'photo', 'role'].filter((k) => k in m).sort(), 'solo campos no críticos');
    assert.ok(!('email' in m) && !('access' in m) && !('user' in m));
  }
  assert.ok(directorio.some((m) => m.name === 'Persona presidente' && m.role === 'Cargo de presidente'));
  assert.ok(!JSON.stringify(directorio).includes('@test.com'));

  for (const [method, path] of [['GET', '/messages'], ['GET', '/messages/stats'], ['GET', '/messages/export'], ['GET', '/audit'], ['GET', '/news/all'], ['GET', '/proposals/all'], ['GET', '/messages?trash=1']]) {
    assert.equal(await estado('miembro', method, path), 403, `${method} ${path}`);
  }
  const img = (await como('admin', 'GET', '/messages')).json.find((m) => m.images.length).images[0];
  assert.equal((await como('miembro', 'GET', `/files/${img}`)).status, 403, 'tampoco las imágenes privadas');
  assert.equal((await t.call('GET', '/members')).status, 200, 'el listado público del sitio sigue igual');
  assert.equal((await t.call('GET', '/members/all')).status, 401);
});

test('Miembro: edita su propia información (nombre, cargo, licenciatura, foto) pero no correo, rol ni orden', async () => {
  const antes = await t.models.Member.findById(ids.miembro);
  const res = await como('miembro', 'PUT', '/members/me', { body: { name: 'Miembro Renombrado', role: 'Vocal', degree: 'Licenciatura en Primaria', email: 'hack@test.com', access: 'admin', order: 99, user: ids.admin } });
  assert.equal(res.status, 200, res.text);
  assert.equal(res.json.member.name, 'Miembro Renombrado');
  assert.equal(res.json.user.name, 'Miembro Renombrado');
  assert.equal(res.json.user.role, 'miembro');
  assert.ok(!('user' in res.json.member));

  const despues = await t.models.Member.findById(ids.miembro);
  assert.deepEqual([despues.role, despues.degree], ['Vocal', 'Licenciatura en Primaria']);
  assert.equal(despues.order, antes.order, 'el orden no se toca');
  const usuario = await t.models.User.findOne({ email: 'miembro@test.com' });
  assert.deepEqual([usuario.name, usuario.role], ['Miembro Renombrado', 'miembro'], 'ni el rol ni el correo cambian');
  assert.ok(!(await t.models.User.exists({ email: 'hack@test.com' })));

  assert.equal(await estado('miembro', 'PUT', '/members/me', { name: 'x' }), 400, 'nombre demasiado corto');
  assert.equal(await estado('miembro', 'PUT', '/members/me', { name: 'Nombre válido', photo: 'no-es-id' }), 400);
  assert.equal((await t.call('PUT', '/members/me', { body: { name: 'Anónimo' } })).status, 401);
  const log = JSON.stringify((await como('admin', 'GET', '/audit')).json.items);
  assert.ok(log.includes('Actualizó su propia información'));

  // Solo toca la ficha propia: la de otra persona no cambió
  assert.equal((await t.models.Member.findById(ids.presidente)).name, 'Persona presidente');
});

test('Miembro: la foto anterior se borra al cambiarla', async () => {
  const subir = async () => {
    const form = new FormData();
    form.append('file', new Blob([PNG], { type: 'image/png' }), 'p.png');
    return (await como('admin', 'POST', '/files', { form })).json.id;
  };
  const [a, b] = [await subir(), await subir()];
  await como('miembro', 'PUT', '/members/me', { body: { name: 'Miembro Renombrado', photo: a } });
  assert.equal((await t.call('GET', `/files/${a}`)).status, 200);
  await como('miembro', 'PUT', '/members/me', { body: { name: 'Miembro Renombrado', photo: b } });
  assert.equal((await t.call('GET', `/files/${a}`)).status, 404);
  assert.equal((await t.call('GET', `/files/${b}`)).status, 200);
});

test('Miembro y Presidente no pueden dar de alta, editar roles ni cambiar el orden del equipo', async () => {
  for (const rol of ['miembro', 'presidente']) {
    assert.equal(await estado(rol, 'PUT', `/members/${ids.moderador}`, { name: 'Persona moderador', access: 'admin' }), 403, rol);
    assert.equal(await estado(rol, 'PUT', '/members/order', { ids: [ids.moderador, ids.miembro] }), 403, rol);
  }
  assert.equal((await t.models.User.findOne({ email: 'moderador@test.com' })).role, 'moderador');
});

test('Moderador: sigue leyendo y clasificando mensajes sin ver datos de contacto, y nada más', async () => {
  const lista = (await como('moderador', 'GET', '/messages')).json;
  const msg = lista.find((m) => !m.anonymous);
  assert.ok(!('phone' in msg) && !('name' in msg) && msg.hasContact === true);
  assert.equal(await estado('moderador', 'PATCH', `/messages/${msg._id}`, { status: 'leido' }), 200);
  assert.equal(await estado('moderador', 'POST', `/messages/${msg._id}/notes`, { text: 'Nota del moderador' }), 201);
  for (const [method, path] of [['GET', '/messages?trash=1'], ['GET', '/messages/export'], ['GET', '/audit'], ['GET', '/members/all'], ['GET', '/news/all'], ['DELETE', `/messages/${msg._id}`]]) {
    assert.equal(await estado('moderador', method, path), 403, `${method} ${path}`);
  }
});

test('un Técnico puede cambiar a alguien a cualquier rol, pero siempre queda al menos un Técnico', async () => {
  const edit = (id, name, access) => como('admin', 'PUT', `/members/${id}`, { body: { name, access } });
  assert.equal((await edit(ids.miembro, 'Miembro Renombrado', 'presidente')).json.access, 'presidente');
  assert.equal(await estado('miembro', 'GET', '/audit'), 200, 'el rol se lee de la base en cada petición: ya es Presidente');
  assert.equal((await edit(ids.miembro, 'Miembro Renombrado', 'miembro')).json.access, 'miembro');

  const yo = (await como('admin', 'GET', '/members/all')).json.find((m) => m.email === 'ana@test.com');
  assert.equal((await edit(yo._id, yo.name, 'presidente')).status, 400, 'nadie se quita su propio rol de Técnico');
  assert.equal((await t.models.User.findOne({ email: 'ana@test.com' })).role, 'admin');
});
