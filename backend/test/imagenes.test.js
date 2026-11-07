// Imágenes (S2 y F7b): limpieza con sharp, privacidad de las de los mensajes, versiones reducidas y migraciones.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import sharp from 'sharp';
import mongoose from 'mongoose';
import { PNG, startServer } from './helpers.js';

let t;
let token;

const archivos = () => t.models.Message.db.db.collection('files.files');
const anonimo = (extra = {}) => ({ type: 'queja', anonymous: true, subject: 'Baños', body: 'Mensaje anónimo de prueba', ...extra });
const color = { r: 200, g: 0, b: 0 };
const foto = (width, height, ops = (s) => s) => ops(sharp({ create: { width, height, channels: 3, background: color } }).jpeg()).toBuffer();

// Envía un mensaje con las imágenes dadas y devuelve los ids guardados
async function enviar(...imagenes) {
  const form = t.messageForm(anonimo(), imagenes.map((data, i) => ({ data, type: 'image/jpeg', name: `f${i}.jpg` })));
  const res = await t.call('POST', '/messages', { form });
  assert.equal(res.status, 201, res.text);
  const lista = (await t.call('GET', '/messages', { token })).json;
  return lista.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0].images;
}

// Sube una imagen pública (como las de noticias) y devuelve su id
async function subirPublica(data, type = 'image/jpeg', name = 'p.jpg') {
  const form = new FormData();
  form.append('file', new Blob([data], { type }), name);
  const res = await t.call('POST', '/files', { token, form });
  assert.equal(res.status, 201, res.text);
  return res.json.id;
}

before(async () => {
  t = await startServer();
  await t.createAdmin();
  token = await t.login();
});
after(() => t.stop());

test('al subirla se quitan los metadatos (GPS, cámara) y se endereza según su orientación', async () => {
  const conGps = await foto(300, 200, (s) => s.withExif({ IFD0: { Make: 'CamaraDePrueba' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '20/1 30/1 0/1' } }));
  assert.ok((await sharp(conGps).metadata()).exif, 'la foto de prueba sí trae EXIF');
  const [id] = await enviar(conGps);
  const guardada = (await t.call('GET', `/files/${id}`, { token })).buffer;
  const meta = await sharp(guardada).metadata();
  assert.equal(meta.exif, undefined, 'sin EXIF');
  assert.ok(!guardada.includes(Buffer.from('CamaraDePrueba')));
  assert.equal(meta.format, 'jpeg');

  // Orientación 6 = la foto se tomó girada 90°: el archivo guardado ya queda derecho (alto en lugar de ancho)
  const girada = await foto(300, 200, (s) => s.withMetadata({ orientation: 6 }));
  const [id2] = await enviar(girada);
  const meta2 = await sharp((await t.call('GET', `/files/${id2}`, { token })).buffer).metadata();
  assert.deepEqual([meta2.width, meta2.height, meta2.orientation], [200, 300, undefined]);
});

test('lo que no es una imagen real se rechaza aunque tenga la firma o el tipo de una', async () => {
  const intento = (data) => t.call('POST', '/messages', { form: t.messageForm(anonimo(), [{ data, type: 'image/png', name: 'x.png' }]) });
  const truncada = PNG.subarray(0, PNG.length - 20); // firma correcta, datos incompletos
  assert.equal((await intento(truncada)).status, 400);
  assert.equal((await intento(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('basura')]))).status, 400);
  assert.equal((await intento(Buffer.from('GIF89a<script>alert(1)</script>'))).status, 400);
});

test('una "bomba de descompresión" (miles de millones de píxeles declarados) se rechaza', async () => {
  // PNG de 1×1 al que se le cambian las dimensiones declaradas a 60000 × 60000 y se recalcula el CRC del encabezado
  const bomba = Buffer.from(PNG);
  bomba.writeUInt32BE(60000, 16);
  bomba.writeUInt32BE(60000, 20);
  bomba.writeUInt32BE(zlib.crc32(bomba.subarray(12, 29)), 29);
  const antes = await archivos().countDocuments();
  const res = await t.call('POST', '/messages', { form: t.messageForm(anonimo(), [{ data: bomba, type: 'image/png', name: 'b.png' }]) });
  assert.equal(res.status, 400);
  assert.equal(await archivos().countDocuments(), antes, 'no se guardó nada');
});

test('una foto enorme se reduce a 4000 px por lado como máximo', async () => {
  const [id] = await enviar(await foto(5000, 1000));
  const meta = await sharp((await t.call('GET', `/files/${id}`, { token })).buffer).metadata();
  assert.deepEqual([meta.width, meta.height], [4000, 800]);
});

test('un GIF animado se conserva animado', async () => {
  const cuadro = (c) => sharp({ create: { width: 20, height: 20, channels: 3, background: c } }).png().toBuffer();
  const gif = await sharp([await cuadro('#f00'), await cuadro('#00f')], { join: { animated: true } }).gif().toBuffer();
  assert.equal((await sharp(gif, { animated: true }).metadata()).pages, 2);
  const form = t.messageForm(anonimo(), [{ data: gif, type: 'image/gif', name: 'a.gif' }]);
  assert.equal((await t.call('POST', '/messages', { form })).status, 201);
  const lista = (await t.call('GET', '/messages', { token })).json;
  const id = lista.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0].images[0];
  const res = await t.call('GET', `/files/${id}`, { token });
  assert.equal(res.headers.get('content-type'), 'image/gif');
  assert.equal((await sharp(res.buffer, { animated: true }).metadata()).pages, 2);
});

test('las imágenes de los mensajes son privadas: sin sesión de administrador no se ven', async () => {
  const [id] = await enviar(await foto(100, 100));
  const sin = await t.call('GET', `/files/${id}`);
  assert.equal(sin.status, 401);
  assert.equal((await t.call('GET', `/files/${id}`, { token: 'token-falso' })).status, 401);
  const con = await t.call('GET', `/files/${id}`, { token });
  assert.equal(con.status, 200);
  assert.equal(con.headers.get('cache-control'), 'private, no-store');
  assert.equal(con.headers.get('content-type'), 'image/jpeg');
  assert.equal((await t.call('GET', `/files/${id}?w=640`)).status, 401, 'tampoco por la versión reducida');
});

test('las imágenes públicas (noticias, propuestas, equipo) siguen viéndose sin sesión y se cachean', async () => {
  const id = await subirPublica(await foto(100, 100));
  const res = await t.call('GET', `/files/${id}`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('cache-control'), /public.*immutable/);
});

test('versiones reducidas: se sirven con ?w=, solo con anchos permitidos, y se borran con la imagen', async () => {
  const antes = await archivos().countDocuments();
  const id = await subirPublica(await foto(2000, 1000));
  assert.equal(await archivos().countDocuments(), antes + 3, 'original + 640 + 1280');

  const original = await sharp((await t.call('GET', `/files/${id}`)).buffer).metadata();
  assert.equal(original.width, 2000);
  for (const w of [640, 1280]) {
    const res = await t.call('GET', `/files/${id}?w=${w}`);
    assert.equal(res.headers.get('content-type'), 'image/webp');
    assert.equal((await sharp(res.buffer).metadata()).width, w);
    assert.match(res.headers.get('cache-control'), /immutable/);
  }
  for (const w of ['999', 'abc', '99999', '']) {
    assert.equal((await t.call('GET', `/files/${id}?w=${w}`)).headers.get('content-type'), 'image/jpeg', `w=${w} → original`);
  }

  assert.equal((await t.call('DELETE', `/files/${id}`, { token })).status, 204);
  assert.equal(await archivos().countDocuments(), antes, 'también se borraron las versiones');
});

test('no se generan versiones más grandes que la imagen original', async () => {
  const antes = await archivos().countDocuments();
  await subirPublica(await foto(500, 300));
  assert.equal(await archivos().countDocuments(), antes + 1, 'solo el original (500 px < 640 px)');
  const id = await subirPublica(await foto(900, 500));
  assert.equal(await archivos().countDocuments(), antes + 3, 'de 900 px solo sale la de 640 (más el original)');
  assert.equal((await t.call('GET', `/files/${id}?w=1280`)).headers.get('content-type'), 'image/jpeg', 'sin la de 1280 se sirve el original');
});

test('las versiones reducidas de una imagen privada también son privadas', async () => {
  const [id] = await enviar(await foto(1800, 900));
  assert.equal((await t.call('GET', `/files/${id}?w=1280`)).status, 401);
  const res = await t.call('GET', `/files/${id}?w=1280`, { token });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/webp');
  const variante = Object.values((await archivos().findOne({ _id: new mongoose.Types.ObjectId(id) })).metadata.variants)[0];
  assert.equal((await t.call('GET', `/files/${variante}`)).status, 401, 'ni directo por el id de la versión');
});

test('migraciones: marcan como privadas las imágenes de mensajes y crean versiones; correrlas otra vez no cambia nada', async () => {
  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'files' });
  // Archivos "de antes": sin metadata.private ni metadata.variants
  const legado = async (data, nombre) => {
    const stream = bucket.openUploadStream(nombre, { metadata: { contentType: 'image/jpeg' } });
    stream.end(data);
    await new Promise((resolve) => stream.on('finish', resolve));
    return stream.id;
  };
  const deMensaje = await legado(await foto(1500, 700), 'm.jpg');
  const publica = await legado(await foto(1500, 700), 'p.jpg');
  const rota = await legado(Buffer.from('esto no es una imagen'), 'rota.jpg');
  await t.models.Message.create({ type: 'queja', anonymous: true, subject: 'Antiguo', body: 'Mensaje de antes', images: [deMensaje] });

  assert.equal((await t.call('GET', `/files/${deMensaje}`)).status, 200, 'antes de migrar era pública');

  const { run: privadas } = await import('../src/migrations/001-private-message-images.js');
  const { run: miniaturas } = await import('../src/migrations/002-thumbnails.js');
  assert.match(await privadas(), /^1 imagen/);
  assert.equal((await t.call('GET', `/files/${deMensaje}`)).status, 401);
  assert.equal((await t.call('GET', `/files/${publica}`)).status, 200, 'las públicas no se tocan');

  await miniaturas();
  const variantes = async (id) => (await archivos().findOne({ _id: id })).metadata.variants;
  assert.equal(Object.keys(await variantes(deMensaje)).length, 2);
  assert.equal(Object.keys(await variantes(publica)).length, 2);
  assert.deepEqual(await variantes(rota), {}, 'la que no se pudo procesar queda marcada y se sigue sirviendo igual');
  assert.equal((await t.call('GET', `/files/${deMensaje}?w=640`)).status, 401, 'las versiones heredan la privacidad');
  assert.equal((await t.call('GET', `/files/${publica}?w=640`)).headers.get('content-type'), 'image/webp');

  // Idempotentes
  const total = await archivos().countDocuments();
  assert.match(await privadas(), /^0 imagen/);
  assert.match(await miniaturas(), /^0 imagen/);
  assert.equal(await archivos().countDocuments(), total);
});
