// Protecciones del buzón sin límite por IP (S8): campo trampa, tiempo mínimo de llenado y tope de bytes.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PNG, startServer } from './helpers.js';

let t;
let token;

const anonimo = (extra = {}) => ({ type: 'queja', anonymous: true, subject: 'Baños', body: 'Mensaje anónimo de prueba', ...extra });
const lista = async () => (await t.call('GET', '/messages', { token })).json;
const enviar = (campos, images = []) => t.call('POST', '/messages', { form: t.messageForm(campos, images) });
const archivos = () => t.models.Message.db.db.collection('files.files').countDocuments();

before(async () => {
  t = await startServer();
  await t.createAdmin();
  token = await t.login();
});
after(() => t.stop());
beforeEach(() => t.models.Message.deleteMany({}));

test('el campo trampa lleno descarta el envío en silencio, respondiendo "éxito"', async () => {
  const res = await enviar(anonimo({ website: 'http://spam.example' }));
  assert.equal(res.status, 201);
  assert.equal(res.json.ok, true);
  assert.match(res.json.code, /^GI-/, 'devuelve un código de apariencia normal para no dar pistas');
  assert.deepEqual(await lista(), []);

  // Con el campo vacío (como lo manda un navegador normal) se guarda
  assert.equal((await enviar(anonimo({ website: '' }))).status, 201);
  assert.equal((await lista()).length, 1);
});

test('un envío con imágenes y campo trampa tampoco guarda archivos', async () => {
  const antes = await archivos();
  const res = await enviar(anonimo({ website: 'x' }), [{ data: PNG, type: 'image/png', name: 'a.png' }]);
  assert.equal(res.status, 201);
  assert.equal(await archivos(), antes);
});

test('un formulario enviado en menos de 3 segundos se descarta; con tiempo normal o sin dato, se guarda', async () => {
  assert.equal((await enviar(anonimo({ fillMs: 800 }))).status, 201);
  assert.deepEqual(await lista(), [], 'demasiado rápido');
  assert.equal((await enviar(anonimo({ fillMs: 15000 }))).status, 201);
  assert.equal((await enviar(anonimo())).status, 201, 'sin el dato (cliente antiguo o curl) se acepta');
  assert.equal((await lista()).length, 2);
});

test('el campo trampa y el tiempo no se guardan en el mensaje', async () => {
  await enviar(anonimo({ fillMs: 9000, website: '' }));
  const [m] = await t.models.Message.find().lean();
  assert.equal(m.website, undefined);
  assert.equal(m.fillMs, undefined);
});

test('las imágenes juntas no pueden pasar de 12 MB (cada una puede ser de hasta 5 MB)', async () => {
  const imagen = (i, mb) => ({ data: Buffer.concat([PNG, Buffer.alloc(Math.round(mb * 1024 * 1024))]), type: 'image/png', name: `g${i}.png` });
  const antes = await archivos();
  const res = await enviar(anonimo(), [imagen(1, 4.6), imagen(2, 4.6), imagen(3, 4.6)]); // ≈ 13.8 MB
  assert.equal(res.status, 413);
  assert.match(res.json.error, /12 MB/);
  assert.deepEqual(await lista(), []);
  assert.equal(await archivos(), antes, 'no queda ningún archivo guardado');

  assert.equal((await enviar(anonimo(), [imagen(1, 4.6), imagen(2, 4.6)])).status, 201, '≈ 9.2 MB sí');
});

test('no hay límite por IP: muchos envíos seguidos desde la misma red se aceptan', async () => {
  for (let i = 0; i < 25; i++) assert.equal((await enviar(anonimo({ subject: `Mensaje ${i}` }))).status, 201, `envío ${i}`);
  assert.equal((await lista()).length, 25);
});
