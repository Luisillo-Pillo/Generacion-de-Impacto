// Contenido (Fase 5): noticias programadas y con galería, avance de propuestas y orden del equipo.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PNG, startServer } from './helpers.js';

let t;
let token;

const HORA = 60 * 60 * 1000;
const enHoras = (n) => new Date(Date.now() + n * HORA).toISOString();
const noticia = (extra = {}) => ({ title: 'Una noticia', excerpt: 'Resumen', body: 'Cuerpo de la noticia', published: true, ...extra });
const publicas = async () => (await t.call('GET', '/news')).json.map((n) => n.title);
const subir = async () => {
  const form = new FormData();
  form.append('file', new Blob([PNG], { type: 'image/png' }), 'p.png');
  return (await t.call('POST', '/files', { token, form })).json.id;
};
const existe = async (id) => (await t.call('GET', `/files/${id}`)).status === 200;

before(async () => {
  t = await startServer();
  await t.createAdmin();
  token = await t.login();
});
after(() => t.stop());

test('noticias programadas: no se ven hasta que llega su hora, ni en la lista ni por su enlace', async () => {
  const res = await t.call('POST', '/news', { token, body: noticia({ title: 'Programada', publishedAt: enHoras(2) }) });
  assert.equal(res.status, 201);
  assert.ok(!(await publicas()).includes('Programada'));
  assert.equal((await t.call('GET', `/news/${res.json.slug}`)).status, 404);
  assert.ok((await t.call('GET', '/news/all', { token })).json.some((n) => n.title === 'Programada'), 'el panel sí la ve');

  // Llega la hora: la noticia simplemente aparece, sin ningún proceso programado
  await t.models.News.updateOne({ _id: res.json._id }, { publishedAt: new Date(Date.now() - 1000) });
  assert.ok((await publicas()).includes('Programada'));
  assert.equal((await t.call('GET', `/news/${res.json.slug}`)).status, 200);
});

test('una noticia publicada sin fecha (de antes) sigue visible, y una en borrador nunca', async () => {
  await t.models.News.collection.insertOne({ title: 'De antes', slug: 'de-antes', body: 'x', published: true, createdAt: new Date(), updatedAt: new Date() });
  assert.ok((await publicas()).includes('De antes'));
  await t.call('POST', '/news', { token, body: noticia({ title: 'Borrador', published: false, publishedAt: enHoras(-5) }) });
  assert.ok(!(await publicas()).includes('Borrador'));
});

test('despublicar y volver a publicar conserva la fecha original; elegir una fecha la cambia', async () => {
  const n = (await t.call('POST', '/news', { token, body: noticia({ title: 'Con fecha', publishedAt: enHoras(-48) }) })).json;
  const original = new Date(n.publishedAt).getTime();
  assert.ok(Math.abs(original - (Date.now() - 48 * HORA)) < 5000);

  await t.call('PUT', `/news/${n._id}`, { token, body: noticia({ title: 'Con fecha', published: false }) });
  const vuelta = (await t.call('PUT', `/news/${n._id}`, { token, body: noticia({ title: 'Con fecha', published: true }) })).json;
  assert.equal(new Date(vuelta.publishedAt).getTime(), original, 'no se reescribió');

  const nueva = enHoras(-1);
  const cambiada = (await t.call('PUT', `/news/${n._id}`, { token, body: noticia({ title: 'Con fecha', publishedAt: nueva }) })).json;
  assert.equal(new Date(cambiada.publishedAt).getTime(), new Date(nueva).getTime());

  assert.equal((await t.call('POST', '/news', { token, body: noticia({ publishedAt: 'ayer por la tarde' }) })).status, 400);
});

test('noticias sin fecha elegida se publican ahora', async () => {
  const antes = Date.now();
  const n = (await t.call('POST', '/news', { token, body: noticia({ title: 'Ahora mismo' }) })).json;
  assert.ok(new Date(n.publishedAt).getTime() >= antes - 1000);
  assert.ok((await publicas()).includes('Ahora mismo'));
});

test('galería: hasta 6 imágenes, se borran las que se quitan y todas al eliminar la noticia', async () => {
  const [a, b, c] = [await subir(), await subir(), await subir()];
  const n = (await t.call('POST', '/news', { token, body: noticia({ title: 'Con galería', gallery: [a, b, c] }) })).json;
  assert.deepEqual(n.gallery, [a, b, c]);
  assert.equal((await t.call('GET', `/news/${n.slug}`)).json.gallery.length, 3, 'el detalle público la incluye');
  assert.ok(!('gallery' in (await t.call('GET', '/news')).json.find((x) => x.title === 'Con galería')), 'la lista no la trae');

  await t.call('PUT', `/news/${n._id}`, { token, body: noticia({ title: 'Con galería', gallery: [a, c] }) });
  assert.ok(await existe(a) && await existe(c));
  assert.ok(!(await existe(b)), 'la imagen quitada se borró');

  await t.call('DELETE', `/news/${n._id}`, { token });
  assert.ok(!(await existe(a)) && !(await existe(c)));

  const siete = Array.from({ length: 7 }, () => '000000000000000000000001');
  assert.equal((await t.call('POST', '/news', { token, body: noticia({ gallery: siete }) })).status, 400);
  assert.equal((await t.call('POST', '/news', { token, body: noticia({ gallery: ['no-es-id'] }) })).status, 400);
});

test('propuestas: el avance es planeada por defecto, admite en marcha y cumplida con una nota, y rechaza otros valores', async () => {
  const base = { number: 31, title: 'Una propuesta', objective: 'Un objetivo claro' };
  const sin = (await t.call('POST', '/proposals', { token, body: base })).json;
  assert.equal(sin.progress, 'planeada');
  assert.equal(sin.progressNote, '');

  const hecha = await t.call('PUT', `/proposals/${sin._id}`, { token, body: { ...base, progress: 'en_marcha', progressNote: 'Ya hay equipo y fecha' } });
  assert.equal(hecha.json.progress, 'en_marcha');
  assert.equal((await t.call('GET', '/proposals')).json.find((p) => p.number === 31).progressNote, 'Ya hay equipo y fecha');

  assert.equal((await t.call('PUT', `/proposals/${sin._id}`, { token, body: { ...base, progress: 'terminada' } })).status, 400);
  assert.equal((await t.call('PUT', `/proposals/${sin._id}`, { token, body: { ...base, progressNote: 'x'.repeat(201) } })).status, 400);
});

test('las propuestas anteriores (sin avance guardado) se muestran como planeadas', async () => {
  await t.models.Proposal.collection.insertOne({ number: 32, title: 'Vieja', objective: 'Objetivo de antes', published: true });
  const vieja = (await t.call('GET', '/proposals')).json.find((p) => p.number === 32);
  assert.equal(vieja.progress, 'planeada');
});

test('equipo: reordenar asigna el orden de una vez; exige administrador y ids válidos y sin repetir', async () => {
  const crear = async (name) => (await t.call('POST', '/members', { token, body: { name, email: `${name.toLowerCase().replace(' ', '')}@test.com`, password: `clave-de-${name.length}-largos-1` } })).json._id;
  const [x, y, z] = [await crear('Persona Uno'), await crear('Persona Dos'), await crear('Persona Tres')];
  const nombres = async () => (await t.call('GET', '/members')).json.filter((m) => m.name.startsWith('Persona')).map((m) => m.name);

  const res = await t.call('PUT', '/members/order', { token, body: { ids: [z, x, y] } });
  assert.equal(res.status, 200);
  assert.deepEqual(await nombres(), ['Persona Tres', 'Persona Uno', 'Persona Dos']);
  const ordenes = res.json.filter((m) => m.name.startsWith('Persona')).map((m) => m.order);
  assert.deepEqual(ordenes, [0, 1, 2], 'la respuesta ya viene en el orden nuevo');

  await t.call('PUT', '/members/order', { token, body: { ids: [y, z, x] } });
  assert.deepEqual(await nombres(), ['Persona Dos', 'Persona Tres', 'Persona Uno']);

  assert.equal((await t.call('PUT', '/members/order', { body: { ids: [x] } })).status, 401);
  assert.equal((await t.call('PUT', '/members/order', { token, body: { ids: ['malo'] } })).status, 400);
  assert.equal((await t.call('PUT', '/members/order', { token, body: { ids: [x, x] } })).status, 400);
  assert.equal((await t.call('PUT', '/members/order', { token, body: { ids: [] } })).status, 400);
  const log = JSON.stringify((await t.call('GET', '/audit', { token })).json.items);
  assert.ok(log.includes('integrante.reordenar'));
});
