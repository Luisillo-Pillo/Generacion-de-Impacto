import { Router } from 'express';
import mongoose from 'mongoose';
import { getBucket, deleteFile } from '../db.js';
import { adminOnly, requireAuth, requireStaff } from '../auth.js';
import { imageUpload, saveImage, ogImage, VARIANT_WIDTHS } from '../uploads.js';

const router = Router();

router.post('/', adminOnly, imageUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Falta el archivo' });
  const id = await saveImage(req.file);
  res.status(201).json({ id: String(id), url: `/api/files/${id}` });
});

// Busca el archivo. Si es privado (imágenes de los mensajes del buzón) exige sesión de administrador o moderador; las imágenes de
// noticias, propuestas y equipo son públicas.
async function loadFile(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).end();
  const [file] = await getBucket().find({ _id: new mongoose.Types.ObjectId(req.params.id) }).toArray();
  if (!file) return res.status(404).end();
  req.fileDoc = file;
  if (!file.metadata?.private) return next();
  requireAuth(req, res, (err) => (err ? next(err) : requireStaff(req, res, next)));
}

async function readAll(id) {
  const chunks = [];
  for await (const chunk of getBucket().openDownloadStream(id)) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// `?og=1` sirve la imagen en JPEG de 1200 × 630 para la vista previa al compartir (solo imágenes públicas).
// `?w=640` (o 1280) sirve la versión reducida en WebP si existe; sin parámetro, o si no hay versión, la original.
router.get('/:id', loadFile, async (req, res) => {
  let file = req.fileDoc;
  if (req.query.og !== undefined && !file.metadata?.private) {
    try {
      const jpg = await ogImage(await readAll(file._id));
      res.set({ 'Content-Type': 'image/jpeg', 'Content-Length': jpg.length, 'Cache-Control': 'public, max-age=31536000, immutable', 'Cross-Origin-Resource-Policy': 'cross-origin' });
      return res.send(jpg);
    } catch {
      /* no se pudo procesar: se sirve la imagen normal */
    }
  }
  const w = Number(req.query.w);
  const variantId = VARIANT_WIDTHS.includes(w) ? file.metadata?.variants?.[w] : null;
  if (variantId) file = (await getBucket().find({ _id: variantId }).toArray())[0] ?? file;
  res.set({
    'Content-Type': file.metadata?.contentType || 'application/octet-stream',
    'Content-Length': file.length,
    // Las públicas se pueden cachear sin riesgo: el id nunca cambia su contenido. Las privadas no se guardan en ninguna caché.
    'Cache-Control': file.metadata?.private ? 'private, no-store' : 'public, max-age=31536000, immutable',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  // Si el archivo se borra a media descarga el stream falla: sin este manejador el proceso se caería.
  getBucket().openDownloadStream(file._id).on('error', () => res.destroy()).pipe(res);
});

router.delete('/:id', adminOnly, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).end();
  await deleteFile(req.params.id);
  res.status(204).end();
});

export default router;
