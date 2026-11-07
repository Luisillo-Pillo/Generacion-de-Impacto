import multer from 'multer';
import sharp from 'sharp';
import { Readable } from 'node:stream';
import { getBucket } from './db.js';

// SVG se excluye a propósito: puede contener scripts.
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const NOT_AN_IMAGE = 'Solo se permiten imágenes JPG, PNG, WEBP o GIF';

// Contra "bombas de descompresión" (un archivo diminuto que al decodificarse ocupa gigabytes): se rechaza lo que supere
// los 100 megapíxeles y lo demás se reduce a un máximo de 4000 px por lado. Una foto de teléfono (12–50 MP) entra bien.
const MAX_INPUT_PIXELS = 100_000_000;
const MAX_SIDE = 4000;
// Anchos de las versiones reducidas (WebP) que se generan junto a cada imagen: GET /api/files/:id?w=640
export const VARIANT_WIDTHS = [640, 1280];

// El servidor gratuito tiene poca memoria: sin caché de libvips y un hilo a la vez.
sharp.cache(false);
sharp.concurrency(1);

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (_req, file, cb) => (ALLOWED.includes(file.mimetype) ? cb(null, true) : cb(new Error(NOT_AN_IMAGE))),
});

const FORMATS = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
const open = (buf) => sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS, animated: true });

// Decodifica la imagen COMPLETA y la vuelve a escribir: así se descarta todo lo que no sea una imagen real (el tipo que
// declara el navegador es manipulable), se quitan los metadatos (EXIF: ubicación GPS, modelo de cámara, fecha…) y se
// aplica la rotación que indicaba EXIF. El formato de salida es el real de la imagen (el GIF y el WebP animados se
// conservan animados). Devuelve { buffer, contentType, width, height, animated }.
export async function cleanImage(input) {
  try {
    const { format, pages = 1 } = await open(input).metadata();
    const contentType = FORMATS[format];
    if (!contentType) throw new Error(NOT_AN_IMAGE);
    const animated = pages > 1;
    let img = open(input);
    if (!animated) img = img.rotate(); // sin metadatos de orientación no hace nada; con ellos, endereza la foto
    img = img.resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true });
    if (format === 'jpeg') img = img.jpeg({ quality: 90 });
    else if (format === 'png') img = img.png({ compressionLevel: 9 });
    else if (format === 'webp') img = img.webp({ quality: 90 });
    else img = img.gif();
    const { data, info } = await img.toBuffer({ resolveWithObject: true }); // aquí falla si el archivo está dañado
    return { buffer: data, contentType, width: info.width, height: info.pageHeight ?? info.height, animated };
  } catch {
    throw new Error(NOT_AN_IMAGE);
  }
}

function upload(filename, buffer, metadata) {
  const stream = getBucket().openUploadStream(filename, { metadata });
  return new Promise((resolve, reject) => {
    Readable.from(buffer).pipe(stream).on('finish', () => resolve(stream.id)).on('error', reject);
  });
}

// Genera y guarda las versiones reducidas (solo de los anchos menores que el original, y no de imágenes animadas).
// Devuelve { 640: id, 1280: id } (vacío si no hacen falta). `isPrivate` se hereda para que no se puedan ver sin sesión.
export async function makeVariants(buffer, { width, animated, isPrivate = false, filename = 'imagen' }) {
  const variants = {};
  if (animated) return variants;
  try {
    for (const w of VARIANT_WIDTHS.filter((v) => v < width)) {
      const small = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).rotate().resize({ width: w }).webp({ quality: 80 }).toBuffer();
      variants[w] = await upload(`${w}-${filename}`, small, { contentType: 'image/webp', variantOf: true, width: w, private: isPrivate });
    }
  } catch (err) {
    await Promise.all(Object.values(variants).map((id) => getBucket().delete(id).catch(() => {})));
    throw err;
  }
  return variants;
}

// Limpia un archivo de multer, lo guarda en GridFS (con sus versiones reducidas) y devuelve su ObjectId.
// `isPrivate`: solo los administradores con sesión pueden verlo (imágenes de los mensajes del buzón).
export async function saveImage(file, { isPrivate = false } = {}) {
  const { buffer, contentType, width, animated } = await cleanImage(file.buffer);
  const variants = await makeVariants(buffer, { width, animated, isPrivate, filename: file.originalname });
  try {
    return await upload(file.originalname, buffer, { contentType, width, private: isPrivate, variants });
  } catch (err) {
    await Promise.all(Object.values(variants).map((id) => getBucket().delete(id).catch(() => {})));
    throw err;
  }
}
