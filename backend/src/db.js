import mongoose from 'mongoose';

let bucket;

export async function connectDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Falta la variable de entorno MONGODB_URI');
  await mongoose.connect(uri);
  bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'files' });
  console.log('MongoDB conectado');
}

export function getBucket() {
  if (!bucket) throw new Error('GridFS no inicializado');
  return bucket;
}

// Borra un archivo de GridFS junto con sus versiones reducidas; si ya no existe, no pasa nada.
export async function deleteFile(id) {
  if (!id) return;
  try {
    const _id = new mongoose.Types.ObjectId(String(id));
    const [file] = await getBucket().find({ _id }).toArray();
    for (const variant of Object.values(file?.metadata?.variants ?? {})) await getBucket().delete(variant).catch(() => {});
    await getBucket().delete(_id);
  } catch {
    /* ya no existía */
  }
}
