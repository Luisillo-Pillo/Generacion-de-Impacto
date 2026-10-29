import multer from 'multer';
import { Readable } from 'node:stream';
import { getBucket } from './db.js';

// SVG se excluye a propósito: puede contener scripts.
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (_req, file, cb) =>
    ALLOWED.includes(file.mimetype) ? cb(null, true) : cb(new Error('Solo se permiten imágenes JPG, PNG, WEBP o GIF')),
});

// El tipo que declara el navegador es manipulable: se comprueba también la firma real del archivo.
export function hasImageSignature(buf) {
  const starts = (...bytes) => bytes.every((b, i) => buf[i] === b);
  return (
    starts(0xff, 0xd8, 0xff) || // JPEG
    starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a) || // PNG
    starts(0x47, 0x49, 0x46, 0x38) || // GIF
    (starts(0x52, 0x49, 0x46, 0x46) && buf.subarray(8, 12).toString('ascii') === 'WEBP') // WEBP
  );
}

// Guarda un archivo de multer en GridFS y devuelve su ObjectId.
export async function saveImage(file) {
  if (!hasImageSignature(file.buffer)) throw new Error('Solo se permiten imágenes JPG, PNG, WEBP o GIF');
  const stream = getBucket().openUploadStream(file.originalname, { metadata: { contentType: file.mimetype } });
  await new Promise((resolve, reject) => {
    Readable.from(file.buffer).pipe(stream).on('finish', resolve).on('error', reject);
  });
  return stream.id;
}
