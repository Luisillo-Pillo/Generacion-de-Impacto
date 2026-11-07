// Limpieza manual o programada (GitHub Action `purge.yml`): vacía la papelera vieja y aplica la retención de mensajes
// resueltos. Con --dry-run solo cuenta lo que borraría, sin tocar nada.
// Uso: npm run purge -w backend [-- --dry-run]   (usa MONGODB_URI y RETENTION_MONTHS)
import mongoose from 'mongoose';
import { connectDb } from './db.js';
import { purgeTrash, purgeResolved, retentionMonths, TRASH_DAYS } from './maintenance.js';

const dryRun = process.argv.includes('--dry-run');
await connectDb();
try {
  const verbo = dryRun ? 'se borrarían' : 'se borraron';
  console.log(`Papelera con más de ${TRASH_DAYS} días: ${verbo} ${await purgeTrash(TRASH_DAYS, { dryRun })} mensaje(s)`);
  const months = retentionMonths();
  console.log(months ? `Mensajes resueltos con más de ${months} meses: ${verbo} ${await purgeResolved(months, { dryRun })}` : 'Retención de mensajes resueltos desactivada (RETENTION_MONTHS sin definir)');
} finally {
  await mongoose.disconnect();
}
