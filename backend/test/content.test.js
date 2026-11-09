import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PNG, startServer } from './helpers.js';

let t;
let token;

before(async () => {
  t = await startServer();
  await t.createAdmin();
  token = await t.login();
});
after(() => t.stop());

const noticia = (extra = {}) => ({ title: 'Noticia de prueba', body: 'Cuerpo de la noticia', published: true, ...extra });
const propuesta = (extra = {}) => ({ number: 1, title: 'Propuesta uno', objective: 'Objetivo de la propuesta', ...extra });

test('noticias: crear, leer por slug, slug único y borradores ocultos', async () => {
  const a = await t.call('POST', '/news', { token, body: noticia() });
  const b = await t.call('POST', '/news', { token, body: noticia() });
  assert.equal(a.status, 201);
  assert.equal(a.json.slug, 'noticia-de-prueba');
  assert.equal(b.json.slug, 'noticia-de-prueba-2');
  assert.equal(a.json.author, 'Ana Prueba');

  assert.equal((await t.call('GET', `/news/${a.json.slug}`)).status, 200);
  assert.equal((await t.call('GET', '/news/no-existe')).status, 404);

  // la lista pública no incluye el cuerpo; la de administración sí
  const publica = await t.call('GET', '/news');
  assert.ok(publica.json.every((n) => !('body' in n)));
  assert.ok((await t.call('GET', '/news/all', { token })).json.every((n) => 'body' in n));

  // un borrador no es público
  const borrador = await t.call('PUT', `/news/${a.json._id}`, { token, body: noticia({ published: false }) });
  assert.equal(borrador.status, 200);
  assert.equal((await t.call('GET', `/news/${a.json.slug}`)).status, 404);
  assert.ok(!(await t.call('GET', '/news')).json.some((n) => n._id === a.json._id));
});

test('noticias: validaciones y permisos', async () => {
  assert.equal((await t.call('POST', '/news', { body: noticia() })).status, 401);
  assert.equal((await t.call('POST', '/news', { token, body: noticia({ title: 'ab' }) })).status, 400);
  assert.equal((await t.call('POST', '/news', { token, body: noticia({ body: '' }) })).status, 400);
  assert.equal((await t.call('POST', '/news', { token, body: noticia({ coverImage: 'no-es-un-id' }) })).status, 400);
});

test('noticias: al cambiar o quitar la portada se borra el archivo anterior, y al eliminar la noticia también', async () => {
  const subir = async () => {
    const form = new FormData();
    form.append('file', new Blob([PNG], { type: 'image/png' }), 'p.png');
    return (await t.call('POST', '/files', { token, form })).json.id;
  };
  const existe = async (id) => (await t.call('GET', `/files/${id}`)).status === 200;

  const primera = await subir();
  const n = await t.call('POST', '/news', { token, body: noticia({ title: 'Con portada', coverImage: primera }) });
  assert.equal(n.status, 201);
  assert.ok(await existe(primera));

  const segunda = await subir();
  await t.call('PUT', `/news/${n.json._id}`, { token, body: noticia({ title: 'Con portada', coverImage: segunda }) });
  assert.ok(!(await existe(primera)), 'la portada vieja debía borrarse');
  assert.ok(await existe(segunda));

  assert.equal((await t.call('DELETE', `/news/${n.json._id}`, { token })).status, 204);
  assert.ok(!(await existe(segunda)), 'la portada debía borrarse con la noticia');
});

test('propuestas: número único, orden y borradores', async () => {
  assert.equal((await t.call('POST', '/proposals', { token, body: propuesta({ number: 2 }) })).status, 201);
  const uno = await t.call('POST', '/proposals', { token, body: propuesta({ number: 1 }) });
  assert.equal(uno.status, 201);
  assert.equal((await t.call('POST', '/proposals', { token, body: propuesta({ number: 1 }) })).status, 409);

  const publicas = (await t.call('GET', '/proposals')).json;
  assert.deepEqual(publicas.map((p) => p.number), [1, 2]);

  assert.equal((await t.call('PUT', `/proposals/${uno.json._id}`, { token, body: propuesta({ number: 2 }) })).status, 409);
  assert.equal((await t.call('PUT', `/proposals/${uno.json._id}`, { token, body: propuesta({ published: false }) })).status, 200);
  assert.deepEqual((await t.call('GET', '/proposals')).json.map((p) => p.number), [2]);
  assert.equal((await t.call('GET', '/proposals/all', { token })).json.length, 2);

  assert.equal((await t.call('POST', '/proposals', { body: propuesta({ number: 5 }) })).status, 401);
  assert.equal((await t.call('POST', '/proposals', { token, body: propuesta({ number: 0 }) })).status, 400);
  assert.equal((await t.call('POST', '/proposals', { token, body: propuesta({ number: 100 }) })).status, 400);
  assert.equal((await t.call('POST', '/proposals', { token, body: propuesta({ number: 7, objective: 'x'.repeat(601) }) })).status, 400);
});

test('ids con formato inválido en la URL dan 404 (no 500)', async () => {
  const casos = [
    ['PUT', '/news/abc', noticia()], ['DELETE', '/news/abc'], ['PUT', '/proposals/abc', propuesta()], ['DELETE', '/proposals/abc'],
    ['PUT', '/members/abc', { name: 'Nombre' }], ['DELETE', '/members/abc'], ['PATCH', '/messages/abc', { status: 'leido' }], ['DELETE', '/messages/abc'],
  ];
  for (const [method, path, body] of casos) {
    const res = await t.call(method, path, { token, body });
    assert.equal(res.status, 404, `${method} ${path} → ${res.status}`);
  }
});

test('ajustes: valores por defecto, lectura pública y validación', async () => {
  const inicial = (await t.call('GET', '/settings')).json;
  assert.ok(inicial.degrees.length > 0 && inicial.semesters.length === 8);
  assert.equal((await t.call('PUT', '/settings/degrees', { body: { value: ['X'] } })).status, 401);
  assert.equal((await t.call('PUT', '/settings/inexistente', { token, body: { value: [] } })).status, 404);
  assert.equal((await t.call('PUT', '/settings/social', { token })).status, 400, 'sin cuerpo');
  assert.equal((await t.call('PUT', '/settings/degrees', { token, body: { value: ['', 'A'] } })).status, 400, 'elemento vacío');
  assert.equal((await t.call('PUT', '/settings/degrees', { token, body: { value: 'no es lista' } })).status, 400);
  // Las licenciaturas y los semestres no pueden quedar vacíos (el buzón no tendría qué ofrecer); los grupos sí
  const sinLicenciaturas = await t.call('PUT', '/settings/degrees', { token, body: { value: [] } });
  assert.equal(sinLicenciaturas.status, 400);
  assert.match(sinLicenciaturas.json.error, /al menos una licenciatura/);
  assert.equal((await t.call('PUT', '/settings/semesters', { token, body: { value: [] } })).status, 400);
  assert.equal((await t.call('PUT', '/settings/groups', { token, body: { value: [] } })).status, 200);
  await t.call('PUT', '/settings/groups', { token, body: { value: ['A', 'B', 'C', 'D'] } });
});

test('ajustes: las redes solo aceptan enlaces http(s) y el correo debe ser válido', async () => {
  const social = (extra) => ({ token, body: { value: { instagram: '', email: '', ...extra } } });
  assert.equal((await t.call('PUT', '/settings/social', social({ instagram: 'javascript:alert(1)' }))).status, 400);
  assert.equal((await t.call('PUT', '/settings/social', social({ instagram: '@usuario' }))).status, 400);
  assert.equal((await t.call('PUT', '/settings/social', social({ instagram: 'data:text/html,<script>' }))).status, 400);
  assert.equal((await t.call('PUT', '/settings/social', social({ email: 'no-es-correo' }))).status, 400);
  const ok = await t.call('PUT', '/settings/social', social({ instagram: 'https://instagram.com/gi', email: 'Contacto@Test.com' }));
  assert.equal(ok.status, 200);
  assert.equal(ok.json.value.email, 'contacto@test.com');
  assert.equal((await t.call('GET', '/settings')).json.social.instagram, 'https://instagram.com/gi');

  // Facebook y TikTok ya no existen: se ignoran al guardar y, si quedaron guardados de antes, no se devuelven
  const viejo = await t.call('PUT', '/settings/social', social({ facebook: 'https://facebook.com/gi', tiktok: 'https://tiktok.com/@gi' }));
  assert.equal(viejo.status, 200);
  assert.deepEqual(Object.keys(viejo.json.value).sort(), ['email', 'instagram']);
  await t.models.Setting.updateOne({ key: 'social' }, { value: { instagram: 'https://instagram.com/gi', facebook: 'https://facebook.com/gi', tiktok: 'https://tiktok.com/@gi', email: '' } });
  assert.deepEqual((await t.call('GET', '/settings')).json.social, { instagram: 'https://instagram.com/gi', email: '' });
});

test('ajustes: groupDegrees se deduce de las licenciaturas con "telesecundaria" hasta que se guarde', async () => {
  await t.call('PUT', '/settings/degrees', { token, body: { value: ['Licenciatura en Primaria', 'Licenciatura en Telesecundaria'] } });
  assert.deepEqual((await t.call('GET', '/settings')).json.groupDegrees, ['Licenciatura en Telesecundaria']);
  await t.call('PUT', '/settings/groupDegrees', { token, body: { value: ['Licenciatura en Primaria'] } });
  assert.deepEqual((await t.call('GET', '/settings')).json.groupDegrees, ['Licenciatura en Primaria']);
});

test('archivos: subir exige administrador y solo acepta imágenes reales', async () => {
  const form = (data, type, name) => {
    const f = new FormData();
    f.append('file', new Blob([data], { type }), name);
    return f;
  };
  assert.equal((await t.call('POST', '/files', { form: form(PNG, 'image/png', 'a.png') })).status, 401);
  const ok = await t.call('POST', '/files', { token, form: form(PNG, 'image/png', 'a.png') });
  assert.equal(ok.status, 201);
  assert.equal((await t.call('GET', `/files/${ok.json.id}`)).headers.get('content-type'), 'image/png');
  assert.equal((await t.call('POST', '/files', { token, form: form(Buffer.from('<svg/>'), 'image/svg+xml', 'a.svg') })).status, 400);
  assert.equal((await t.call('POST', '/files', { token, form: form(Buffer.from('no soy png'), 'image/png', 'a.png') })).status, 400);
  assert.equal((await t.call('POST', '/files', { token })).status, 400, 'sin archivo');
  assert.equal((await t.call('DELETE', `/files/${ok.json.id}`)).status, 401);
  assert.equal((await t.call('DELETE', `/files/${ok.json.id}`, { token })).status, 204);
  assert.equal((await t.call('GET', `/files/${ok.json.id}`)).status, 404);
});
