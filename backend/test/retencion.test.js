// Retención (S3): la papelera vieja y los mensajes resueltos antiguos se borran con sus imágenes; lo pendiente, nunca.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PNG, startServer } from './helpers.js';

let t;
let maintenance;

const archivos = () => t.models.Message.db.db.collection('files.files').countDocuments();
const meses = (n) => new Date(Date.now() - n * 31 * 24 * 60 * 60 * 1000);

before(async () => {
  t = await startServer();
  maintenance = await import('../src/maintenance.js');
});
after(() => t.stop());

// Crea un mensaje con una imagen real y fuerza su fecha de actualización (Mongoose la pisa, por eso va directo a la colección)
async function crear(campos, antiguedadMeses) {
  const form = t.messageForm({ type: 'queja', anonymous: true, subject: campos.subject, body: 'Mensaje de prueba de retención' }, [{ data: PNG, type: 'image/png', name: 'a.png' }]);
  assert.equal((await t.call('POST', '/messages', { form })).status, 201);
  const msg = await t.models.Message.findOne({ subject: campos.subject });
  await t.models.Message.collection.updateOne({ _id: msg._id }, { $set: { ...campos.set, updatedAt: meses(antiguedadMeses) } });
  return msg._id;
}
const existe = (id) => t.models.Message.exists({ _id: id });

test('sin RETENTION_MONTHS no se borra nada por antigüedad', async () => {
  delete process.env.RETENTION_MONTHS;
  const id = await crear({ subject: 'Archivado viejo', set: { status: 'archivado' } }, 40);
  assert.equal(maintenance.retentionMonths(), 0);
  assert.equal(await maintenance.purgeResolved(), 0);
  assert.ok(await existe(id));
});

test('con retención: borra los resueltos antiguos (con imágenes) y respeta los pendientes y los recientes', async () => {
  const archivado = await crear({ subject: 'Archivado', set: { status: 'archivado' } }, 14);
  const completado = await crear({ subject: 'Completado', set: { review: 'completado' } }, 13);
  const rechazado = await crear({ subject: 'Rechazado', set: { review: 'rechazado' } }, 13);
  const pendiente = await crear({ subject: 'Pendiente viejo', set: { status: 'leido', review: 'pendiente' } }, 30);
  const enProceso = await crear({ subject: 'En proceso viejo', set: { review: 'en_proceso' } }, 30);
  const reciente = await crear({ subject: 'Archivado reciente', set: { status: 'archivado' } }, 2);
  const archivosAntes = await archivos();

  process.env.RETENTION_MONTHS = '12';
  assert.equal(await maintenance.purgeResolved(undefined, { dryRun: true }), 4, 'incluye el "Archivado viejo" de la prueba anterior');
  assert.equal(await t.models.Message.countDocuments(), 7, 'dry-run no borra');

  assert.equal(await maintenance.purgeResolved(), 4);
  for (const id of [archivado, completado, rechazado]) assert.ok(!(await existe(id)));
  for (const id of [pendiente, enProceso, reciente]) assert.ok(await existe(id), 'lo pendiente y lo reciente no se toca');
  assert.equal(await archivos(), archivosAntes - 4, 'sus imágenes también se borraron');

  const log = await t.models.AuditLog.find({ action: 'mensaje.purgar' });
  assert.equal(log.length, 4);
  assert.ok(!JSON.stringify(log).includes('Archivado'), 'la bitácora no guarda el contenido');
  delete process.env.RETENTION_MONTHS;
});

test('la papelera con más de 30 días se vacía y --dry-run solo cuenta', async () => {
  const vieja = await crear({ subject: 'En papelera vieja', set: { deletedAt: meses(2) } }, 2);
  const nueva = await crear({ subject: 'En papelera nueva', set: { deletedAt: new Date() } }, 0);
  assert.equal(await maintenance.purgeTrash(30, { dryRun: true }), 1);
  assert.ok(await existe(vieja));
  assert.equal(await maintenance.purgeTrash(), 1);
  assert.ok(!(await existe(vieja)));
  assert.ok(await existe(nueva));
});
