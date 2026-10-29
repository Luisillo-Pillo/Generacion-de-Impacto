import { Router } from 'express';
import mongoose from 'mongoose';
import { getBucket } from '../db.js';
import { adminOnly } from '../auth.js';
import { imageUpload, saveImage } from '../uploads.js';

const router = Router();

router.post('/', adminOnly, imageUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Falta el archivo' });
  const id = await saveImage(req.file);
  res.status(201).json({ id: String(id), url: `/api/files/${id}` });
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
