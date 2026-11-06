import { Message } from './models.js';
import { deleteFile } from './db.js';

const DAY_MS = 24 * 60 * 60 * 1000;
export const TRASH_DAYS = 30;

// Borra de verdad (con sus imágenes) los mensajes que llevan más de 30 días en la papelera. Devuelve cuántos eran.
export async function purgeTrash(days = TRASH_DAYS) {
  const old = await Message.find({ deletedAt: { $lt: new Date(Date.now() - days * DAY_MS) } });
  for (const msg of old) {
    await Promise.all(msg.images.map(deleteFile));
    await msg.deleteOne();
  }
  return old.length;
}

// Tareas periódicas de la API: al arrancar (Render duerme el servicio, así que cada arranque cuenta) y cada 6 horas.
export function startMaintenance() {
  const run = () => purgeTrash().catch((err) => console.error('Falló la limpieza de la papelera:', err.message));
  run();
  setInterval(run, 6 * 60 * 60 * 1000).unref();
}
