// Ejecuta las migraciones de datos, en orden. Todas son idempotentes (se pueden correr varias veces sin dañar nada).
// Uso: npm run migrate -w backend   (usa MONGODB_URI de backend/.env: es la base real, correr solo con visto bueno)
import mongoose from 'mongoose';
import { connectDb } from './db.js';
import * as privateImages from './migrations/001-private-message-images.js';
import * as thumbnails from './migrations/002-thumbnails.js';

await connectDb();
try {
  for (const migration of [privateImages, thumbnails]) console.log(`${migration.name}: ${await migration.run()}`);
} finally {
  await mongoose.disconnect();
}
