import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PNG, startServer } from './helpers.js';

let t;
let token;

const anonimo = (extra = {}) => ({ type: 'queja', anonymous: true, subject: 'Baños', body: 'Mensaje anónimo de prueba', ...extra });
const conDatos = (extra = {}) => ({
  type: 'propuesta', anonymous: false, name: 'Luis Pérez', degree: 'Licenciatura en Primaria', semester: '3',
  phone: '551 234 5678', subject: 'Una idea', body: 'Mensaje con datos completos', ...extra,
});
const lista = async (query = '') => (await t.call('GET', `/messages${query}`, { token })).json;

before(async () => {
  t = await startServer();
  await t.createAdmin();
  token = await t.login();
  await t.call('PUT', '/settings/degrees', { token, body: { value: ['Licenciatura en Primaria', 'Licenciatura en Telesecundaria'] } });
});
after(() => t.stop());
beforeEach(() => t.models.Message.deleteMany({}));

test('mensaje anónimo: se guarda sin datos personales aunque se envíen', async () => {
  const res = await t.call('POST', '/messages', {
    body: anonimo({ name: 'Intruso', degree: 'X', semester: '1', group: 'A', phone: '5512345678' }),
  });
  assert.equal(res.status, 201);
  const [m] = await lista();
  assert.equal(m.anonymous, true);
  for (const campo of ['name', 'degree', 'semester', 'group', 'phone']) assert.ok(!(campo in m), `se guardó ${campo}`);
});

test('mensaje con datos: guarda el teléfono sin espacios y descarta el grupo fuera de Telesecundaria', async () => {
  const res = await t.call('POST', '/messages', { body: conDatos({ phone: '551-234-5678', group: 'A' }) });
  assert.equal(res.status, 201);
  const [m] = await lista();
  assert.equal(m.name, 'Luis Pérez');
  assert.equal(m.phone, '5512345678');
  assert.ok(!('group' in m));
});

test('en Telesecundaria el grupo es obligatorio y se guarda', async () => {
  const base = conDatos({ degree: 'Licenciatura en Telesecundaria' });
  assert.equal((await t.call('POST', '/messages', { body: base })).status, 400);
  assert.equal((await t.call('POST', '/messages', { body: { ...base, group: 'B' } })).status, 201);
  assert.equal((await lista())[0].group, 'B');
});

test('validaciones: datos incompletos, tipo inválido, mensaje corto y teléfono mal formado', async () => {
  const invalidos = [
    conDatos({ name: undefined }), conDatos({ semester: undefined }), conDatos({ phone: '123' }), conDatos({ phone: 'abcdefghij' }),
    anonimo({ type: 'otro' }), anonimo({ body: 'corto' }), anonimo({ subject: 'ab' }),
  ];
  for (const body of invalidos) assert.equal((await t.call('POST', '/messages', { body })).status, 400, JSON.stringify(body));
  assert.equal((await t.call('POST', '/messages', {})).status, 400, 'sin cuerpo');
  assert.deepEqual(await lista(), []);
});

test('el listado, el cambio de estado y el borrado exigen administrador', async () => {
  await t.call('POST', '/messages', { body: anonimo() });
  const [m] = await lista();
  assert.equal((await t.call('GET', '/messages')).status, 401);
  assert.equal((await t.call('PATCH', `/messages/${m._id}`, { body: { status: 'leido' } })).status, 401);
  assert.equal((await t.call('DELETE', `/messages/${m._id}`)).status, 401);
});

test('estado y revisión: cambiar, validar y filtrar', async () => {
  await t.call('POST', '/messages', { body: anonimo({ subject: 'Primero' }) });
  await t.call('POST', '/messages', { body: conDatos({ subject: 'Segundo', type: 'pregunta' }) });
  const [b, a] = await lista(); // el listado va del más nuevo al más viejo
  const patch = (id, body) => t.call('PATCH', `/messages/${id}`, { token, body });

  assert.equal((await patch(a._id, { status: 'leido' })).json.status, 'leido');
  assert.equal((await patch(a._id, { review: 'en_proceso' })).json.review, 'en_proceso');
  assert.equal((await patch(a._id, { status: 'x' })).status, 400);
  assert.equal((await patch(a._id, { review: 'x' })).status, 400);
  assert.equal((await patch(a._id, {})).status, 400);
  assert.equal((await patch('000000000000000000000000', { status: 'leido' })).status, 404);

  assert.equal((await lista('?status=leido')).length, 1);
  assert.equal((await lista('?status=nuevo'))[0]._id, b._id);
  assert.equal((await lista('?type=pregunta'))[0]._id, b._id);
  assert.equal((await lista('?review=en_proceso'))[0]._id, a._id);
  assert.equal((await lista('?review=pendiente'))[0]._id, b._id);
  assert.equal((await lista('?status=archivado')).length, 0);
});

test('los mensajes sin campo de revisión cuentan como pendientes', async () => {
  const antiguo = await t.models.Message.collection.insertOne({ type: 'queja', anonymous: true, subject: 'Antiguo', body: 'Mensaje de antes', status: 'nuevo', createdAt: new Date() });
  const res = await lista('?review=pendiente');
  assert.ok(res.some((m) => m._id === String(antiguo.insertedId)));
});

test('adjuntos: una imagen PNG real se guarda, se sirve con su tipo y se borra con el mensaje definitivo', async () => {
  const form = t.messageForm(anonimo(), [{ data: PNG, type: 'image/png', name: 'a.png' }]);
  assert.equal((await t.call('POST', '/messages', { form })).status, 201);
  const [m] = await lista();
  assert.equal(m.images.length, 1);

  const img = await t.call('GET', `/files/${m.images[0]}`, { token });
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/png');
  assert.equal(img.headers.get('x-content-type-options'), 'nosniff');

  // Eliminar manda a la papelera (la imagen se conserva); solo el borrado definitivo la elimina
  assert.equal((await t.call('DELETE', `/messages/${m._id}`, { token })).status, 204);
  assert.equal((await t.call('GET', `/files/${m.images[0]}`, { token })).status, 200);
  assert.equal((await t.call('DELETE', `/messages/${m._id}/permanent`, { token })).status, 204);
  assert.equal((await t.call('GET', `/files/${m.images[0]}`, { token })).status, 404);
});

test('adjuntos rechazados: firma falsa, SVG, más de 3 y más de 5 MB; no queda nada guardado', async () => {
  const intento = (images) => t.call('POST', '/messages', { form: t.messageForm(anonimo(), images) });
  const falsa = { data: Buffer.from('<script>alert(1)</script>'), type: 'image/png', name: 'x.png' };
  const svg = { data: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), type: 'image/svg+xml', name: 'x.svg' };
  const png = (i) => ({ data: PNG, type: 'image/png', name: `a${i}.png` });
  const grande = { data: Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 + 10)]), type: 'image/png', name: 'big.png' };

  assert.equal((await intento([falsa])).status, 400, 'firma falsa');
  assert.equal((await intento([svg])).status, 400, 'SVG');
  assert.equal((await intento([png(1), png(2), png(3), png(4)])).status, 400, '4 imágenes');
  assert.equal((await intento([grande])).status, 400, '5 MB');
  assert.equal((await intento([png(1), falsa])).status, 400, 'una buena y una falsa');

  assert.deepEqual(await lista(), []);
  // y ningún archivo huérfano en GridFS
  const huerfanos = await t.models.Message.db.db.collection('files.files').countDocuments();
  assert.equal(huerfanos, 0);
});

test('un id de archivo con formato inválido o inexistente da 404', async () => {
  assert.equal((await t.call('GET', '/files/abc')).status, 404);
  assert.equal((await t.call('GET', '/files/000000000000000000000000')).status, 404);
});
