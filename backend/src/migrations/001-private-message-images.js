// Marca como privadas las imágenes que ya estaban adjuntas a mensajes del buzón (y sus versiones reducidas), para que
// solo las vean los administradores con sesión. Se puede ejecutar varias veces: solo toca lo que aún no es privado.
import mongoose from 'mongoose';
import { Message } from '../models.js';

export const name = '001-private-message-images';

export async function run() {
  const files = mongoose.connection.db.collection('files.files');
  // Incluye los mensajes de la papelera: todavía conservan sus imágenes
  const messages = await Message.find({ 'images.0': { $exists: true } }, { images: 1 }).lean();
  const ids = [...new Set(messages.flatMap((m) => m.images.map(String)))].map((id) => new mongoose.Types.ObjectId(id));
  let updated = 0;
  for (const _id of ids) {
    const [file] = await files.find({ _id }).toArray();
    if (!file || file.metadata?.private === true) continue;
    const variantIds = Object.values(file.metadata?.variants ?? {});
    await files.updateMany({ _id: { $in: [_id, ...variantIds] } }, { $set: { 'metadata.private': true } });
    updated++;
  }
  return `${updated} imagen(es) marcada(s) como privada(s) de ${ids.length}`;
}
