import { Router } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { Readable } from 'node:stream';
import { getBucket } from '../db.js';
import { adminOnly } from '../auth.js';

const router = Router();

// SVG se excluye a propósito: puede contener scripts.
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    ALLOWED.includes(file.mimetype) ? cb(null, true) : cb(new Error('Solo se permiten imágenes JPG, PNG, WEBP o GIF')),
});

router.post('/', adminOnly, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Falta el archivo' });
  const stream = getBucket().openUploadStream(req.file.originalname, {
    metadata: { contentType: req.file.mimetype },
  });
  await new Promise((resolve, reject) => {
    Readable.from(req.file.buffer).pipe(stream).on('finish', resolve).on('error', reject);
  });
  res.status(201).json({ id: String(stream.id), url: `/api/files/${stream.id}` });
});

router.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).end();
  const _id = new mongoose.Types.ObjectId(req.params.id);
  const [file] = await getBucket().find({ _id }).toArray();
  if (!file) return res.status(404).end();
  res.set({
    'Content-Type': file.metadata?.contentType || 'application/octet-stream',
    'Content-Length': file.length,
    // El id nunca cambia su contenido, así que se puede cachear sin riesgo.
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  getBucket().openDownloadStream(_id).pipe(res);
});

router.delete('/:id', adminOnly, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).end();
  try {
    await getBucket().delete(new mongoose.Types.ObjectId(req.params.id));
  } catch {
    /* ya no existía */
  }
  res.status(204).end();
});

export default router;
