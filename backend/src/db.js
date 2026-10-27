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
