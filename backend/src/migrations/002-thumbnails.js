// Genera las versiones reducidas (WebP de 640 y 1280 px) de las imágenes que se subieron antes de que existieran.
// Se puede ejecutar varias veces: las que ya tienen `metadata.variants` (aunque esté vacío) se saltan. Si una imagen no
// se puede procesar queda con `variants: {}` y se seguirá sirviendo tal cual. Conviene correrla después de la 001.
import mongoose from 'mongoose';
import { getBucket } from '../db.js';
import { cleanImage, makeVariants } from '../uploads.js';

export const name = '002-thumbnails';

async function readFile(id) {
  const chunks = [];
  for await (const chunk of getBucket().openDownloadStream(id)) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export async function run() {
  const files = mongoose.connection.db.collection('files.files');
  const pending = await files.find({ 'metadata.variants': { $exists: false }, 'metadata.variantOf': { $exists: false } }).toArray();
  let created = 0;
  let skipped = 0;
  for (const file of pending) {
    let variants = {};
    try {
      const { buffer, width, animated } = await cleanImage(await readFile(file._id));
      variants = await makeVariants(buffer, { width, animated, isPrivate: file.metadata?.private === true, filename: file.filename });
    } catch {
      skipped++;
    }
    created += Object.keys(variants).length;
    await files.updateOne({ _id: file._id }, { $set: { 'metadata.variants': variants } });
  }
  return `${pending.length} imagen(es) revisada(s), ${created} versión(es) reducida(s) creada(s), ${skipped} sin procesar`;
}
