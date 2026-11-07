import { Message } from './models.js';
import { deleteFile } from './db.js';
import { audit } from './audit.js';

const DAY_MS = 24 * 60 * 60 * 1000;
export const TRASH_DAYS = 30;

// Meses que se conservan los mensajes ya resueltos (archivados, completados o rechazados). Sin definir (o 0) no se borra
// nada por antigüedad: la decisión de cuánto conservarlos es del cliente. Ver «Retención» en el README.
export const retentionMonths = () => Math.max(0, Number(process.env.RETENTION_MONTHS) || 0);

async function remove(msg) {
  await Promise.all(msg.images.map(deleteFile));
  await msg.deleteOne();
}

// Borra de verdad (con sus imágenes) los mensajes que llevan más de 30 días en la papelera. Devuelve cuántos eran.
// Con `dryRun` solo cuenta, sin borrar.
export async function purgeTrash(days = TRASH_DAYS, { dryRun = false } = {}) {
  const old = await Message.find({ deletedAt: { $lt: new Date(Date.now() - days * DAY_MS) } });
  if (!dryRun) for (const msg of old) await remove(msg);
  return old.length;
}

// Borra los mensajes resueltos (estado archivado, o revisión completada/rechazada) cuya última actualización tiene más
// de `months` meses. Los pendientes y en proceso no se tocan nunca. Con `months` en 0 no hace nada.
export async function purgeResolved(months = retentionMonths(), { dryRun = false } = {}) {
  if (!months) return 0;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const old = await Message.find({
    deletedAt: null,
    updatedAt: { $lt: cutoff },
    $or: [{ status: 'archivado' }, { review: { $in: ['completado', 'rechazado'] } }],
  });
  if (!dryRun) {
    for (const msg of old) {
      await remove(msg);
      await audit(null, 'mensaje.purgar', 'mensaje', msg._id, `Se borró un mensaje resuelto con más de ${months} meses (retención)`);
    }
  }
  return old.length;
}

// Tareas periódicas de la API: al arrancar (Render duerme el servicio, así que cada arranque cuenta) y cada 6 horas.
export function startMaintenance() {
  const run = async () => {
    try {
      await purgeTrash();
      await purgeResolved();
    } catch (err) {
      console.error('Falló la limpieza periódica:', err.message);
    }
  };
  run();
  setInterval(run, 6 * 60 * 60 * 1000).unref();
}
