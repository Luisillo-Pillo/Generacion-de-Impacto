import { Router } from 'express';
import { z } from 'zod';
import { News, Proposal, Setting, PROPOSAL_PROGRESS } from '../models.js';
import { adminOnly } from '../auth.js';
import { deleteFile } from '../db.js';
import { loadSettings } from '../settings.js';
import { objectId } from '../validators.js';
import { audit } from '../audit.js';
import mongoose from 'mongoose';

const router = Router();

const slugify = (text) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'noticia';

async function uniqueSlug(title, ignoreId) {
  const base = slugify(title);
  let slug = base;
  for (let i = 2; await News.exists({ slug, _id: { $ne: ignoreId } }); i++) slug = `${base}-${i}`;
  return slug;
}

// ---------------- Noticias ----------------
const newsSchema = z.object({
  title: z.string().trim().min(3).max(160),
  excerpt: z.string().trim().max(300).optional().default(''),
  body: z.string().trim().min(1).max(20000),
  coverImage: objectId,
  gallery: z.array(z.string().refine((v) => mongoose.isValidObjectId(v), 'Id inválido')).max(6, 'La galería admite hasta 6 imágenes').optional().default([]),
  published: z.boolean().optional().default(false),
  // Fecha y hora de publicación (ISO). Futura = programada. Vacía: ahora (o la que ya tenía)
  publishedAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Fecha de publicación inválida').nullable().optional(),
});

// Las consultas públicas solo ven lo publicado cuya hora ya llegó (las anteriores a este campo, sin fecha, también)
const visibleNow = () => ({ published: true, $or: [{ publishedAt: { $lte: new Date() } }, { publishedAt: null }] });

// Quita del almacén las imágenes que ya no se usan (con sus versiones reducidas)
const dropFiles = (ids) => Promise.all(ids.map(deleteFile));

router.get('/news', async (_req, res) => {
  res.json(await News.find(visibleNow()).sort({ publishedAt: -1 }).select('-body -gallery'));
});

router.get('/news/all', adminOnly, async (_req, res) => {
  res.json(await News.find().sort({ createdAt: -1 }));
});

router.get('/news/:slug', async (req, res) => {
  const item = await News.findOne({ slug: req.params.slug, ...visibleNow() });
  if (!item) return res.status(404).json({ error: 'Noticia no encontrada' });
  res.json(item);
});

router.post('/news', adminOnly, async (req, res) => {
  const data = newsSchema.parse(req.body);
  const item = await News.create({
    ...data,
    coverImage: data.coverImage || undefined,
    slug: await uniqueSlug(data.title),
    publishedAt: data.published ? (data.publishedAt ? new Date(data.publishedAt) : new Date()) : undefined,
    author: req.user.name,
  });
  await audit(req, 'noticia.crear', 'noticia', item._id, `Creó la noticia «${item.title}»`);
  res.status(201).json(item);
});

router.put('/news/:id', adminOnly, async (req, res) => {
  const data = newsSchema.parse(req.body);
  const item = await News.findById(req.params.id);
  if (!item) return res.status(404).json({ error: 'Noticia no encontrada' });
  const newCover = data.coverImage || undefined;
  if (item.coverImage && String(item.coverImage) !== String(newCover)) await deleteFile(item.coverImage);
  if (item.title !== data.title) item.slug = await uniqueSlug(data.title, item._id);
  // La fecha de publicación solo cambia si se elige una; despublicar y volver a publicar no la reescribe
  const { publishedAt, ...rest } = data;
  if (data.published) {
    if (publishedAt) item.publishedAt = new Date(publishedAt);
    else if (!item.publishedAt) item.publishedAt = new Date();
  }
  await dropFiles((item.gallery ?? []).filter((id) => !data.gallery.includes(String(id))));
  Object.assign(item, { ...rest, coverImage: newCover });
  await item.save();
  await audit(req, 'noticia.editar', 'noticia', item._id, `Editó la noticia «${item.title}»`);
  res.json(item);
});

router.delete('/news/:id', adminOnly, async (req, res) => {
  const item = await News.findByIdAndDelete(req.params.id);
  if (item) {
    await dropFiles([item.coverImage, ...(item.gallery ?? [])]);
    await audit(req, 'noticia.eliminar', 'noticia', item._id, `Eliminó la noticia «${item.title}»`);
  }
  res.status(204).end();
});

// ---------------- Propuestas ----------------
const proposalSchema = z.object({
  number: z.number().int().min(1).max(99),
  title: z.string().trim().min(3).max(160),
  objective: z.string().trim().min(3).max(600),
  image: objectId,
  progress: z.enum(PROPOSAL_PROGRESS).optional().default('planeada'),
  progressNote: z.string().trim().max(200).optional().default(''),
  published: z.boolean().optional().default(true),
});

router.get('/proposals', async (_req, res) => {
  res.json(await Proposal.find({ published: true }).sort({ number: 1 }));
});

router.get('/proposals/all', adminOnly, async (_req, res) => {
  res.json(await Proposal.find().sort({ number: 1 }));
});

router.post('/proposals', adminOnly, async (req, res) => {
  const data = proposalSchema.parse(req.body);
  if (await Proposal.exists({ number: data.number })) {
    return res.status(409).json({ error: `Ya existe la propuesta #${data.number}` });
  }
  const item = await Proposal.create({ ...data, image: data.image || undefined });
  await audit(req, 'propuesta.crear', 'propuesta', item._id, `Creó la propuesta #${item.number}`);
  res.status(201).json(item);
});

router.put('/proposals/:id', adminOnly, async (req, res) => {
  const data = proposalSchema.parse(req.body);
  if (await Proposal.exists({ number: data.number, _id: { $ne: req.params.id } })) {
    return res.status(409).json({ error: `Ya existe la propuesta #${data.number}` });
  }
  const item = await Proposal.findById(req.params.id);
  if (!item) return res.status(404).json({ error: 'Propuesta no encontrada' });
  const newImage = data.image || undefined;
  if (item.image && String(item.image) !== String(newImage)) await deleteFile(item.image);
  Object.assign(item, { ...data, image: newImage });
  await item.save();
  await audit(req, 'propuesta.editar', 'propuesta', item._id, `Editó la propuesta #${item.number}`);
  res.json(item);
});

router.delete('/proposals/:id', adminOnly, async (req, res) => {
  const item = await Proposal.findByIdAndDelete(req.params.id);
  if (item) {
    await deleteFile(item.image);
    await audit(req, 'propuesta.eliminar', 'propuesta', item._id, `Eliminó la propuesta #${item.number}`);
  }
  res.status(204).end();
});

// ---------------- Ajustes (licenciaturas, grupos, redes) ----------------
const list = z.array(z.string().trim().min(1).max(120)).max(50);
// Las redes se muestran como enlaces: solo http(s), nunca `javascript:` u otros esquemas.
const url = z
  .string()
  .trim()
  .max(200)
  .refine((v) => v === '' || /^https?:\/\/[^\s]+$/i.test(v), 'Las redes deben ser un enlace que empiece con http:// o https://')
  .default('');
const settingSchemas = {
  degrees: list,
  groups: list,
  groupDegrees: list,
  semesters: list,
  social: z.object({
    instagram: url,
    email: z.union([z.literal(''), z.string().trim().toLowerCase().max(200).email('Correo de contacto no válido')]).default(''),
  }),
};

router.get('/settings', async (_req, res) => {
  res.json(await loadSettings());
});

router.put('/settings/:key', adminOnly, async (req, res) => {
  const schema = settingSchemas[req.params.key];
  if (!schema) return res.status(404).json({ error: 'Ajuste desconocido' });
  const value = schema.parse(req.body?.value);
  await Setting.findOneAndUpdate({ key: req.params.key }, { value }, { upsert: true });
  await audit(req, 'ajustes.editar', 'ajuste', req.params.key, `Cambió el ajuste «${req.params.key}»`);
  res.json({ key: req.params.key, value });
});

export default router;
