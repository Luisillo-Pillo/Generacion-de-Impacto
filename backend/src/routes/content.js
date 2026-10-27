import { Router } from 'express';
import { z } from 'zod';
import { News, Proposal, Setting, DEFAULT_SETTINGS } from '../models.js';
import { adminOnly } from '../auth.js';
import { deleteFile } from '../db.js';
import { objectId } from '../validators.js';

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
  published: z.boolean().optional().default(false),
});

router.get('/news', async (_req, res) => {
  res.json(await News.find({ published: true }).sort({ publishedAt: -1 }).select('-body'));
});

router.get('/news/all', adminOnly, async (_req, res) => {
  res.json(await News.find().sort({ createdAt: -1 }));
});

router.get('/news/:slug', async (req, res) => {
  const item = await News.findOne({ slug: req.params.slug, published: true });
  if (!item) return res.status(404).json({ error: 'Noticia no encontrada' });
  res.json(item);
});

router.post('/news', adminOnly, async (req, res) => {
  const data = newsSchema.parse(req.body);
  const item = await News.create({
    ...data,
    coverImage: data.coverImage || undefined,
    slug: await uniqueSlug(data.title),
    publishedAt: data.published ? new Date() : undefined,
    author: req.user.name,
  });
  res.status(201).json(item);
});

router.put('/news/:id', adminOnly, async (req, res) => {
  const data = newsSchema.parse(req.body);
  const item = await News.findById(req.params.id);
  if (!item) return res.status(404).json({ error: 'Noticia no encontrada' });
  const newCover = data.coverImage || undefined;
  if (item.coverImage && String(item.coverImage) !== String(newCover)) await deleteFile(item.coverImage);
  if (item.title !== data.title) item.slug = await uniqueSlug(data.title, item._id);
  if (data.published && !item.published) item.publishedAt = new Date();
  Object.assign(item, { ...data, coverImage: newCover });
  await item.save();
  res.json(item);
});

router.delete('/news/:id', adminOnly, async (req, res) => {
  const item = await News.findByIdAndDelete(req.params.id);
  if (item) await deleteFile(item.coverImage);
  res.status(204).end();
});

// ---------------- Propuestas ----------------
const proposalSchema = z.object({
  number: z.number().int().min(1).max(99),
  title: z.string().trim().min(3).max(160),
  objective: z.string().trim().min(3).max(600),
  image: objectId,
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
  res.status(201).json(await Proposal.create({ ...data, image: data.image || undefined }));
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
  res.json(item);
});

router.delete('/proposals/:id', adminOnly, async (req, res) => {
  const item = await Proposal.findByIdAndDelete(req.params.id);
  if (item) await deleteFile(item.image);
  res.status(204).end();
});

// ---------------- Ajustes (licenciaturas, grupos, redes) ----------------
const list = z.array(z.string().trim().min(1).max(120)).max(50);
const settingSchemas = {
  degrees: list,
  groups: list,
  semesters: list,
  social: z.object({
    instagram: z.string().trim().max(200).default(''),
    facebook: z.string().trim().max(200).default(''),
    tiktok: z.string().trim().max(200).default(''),
    email: z.string().trim().max(200).default(''),
  }),
};

router.get('/settings', async (_req, res) => {
  const rows = await Setting.find();
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in settingSchemas) out[r.key] = r.value;
  res.json(out);
});

router.put('/settings/:key', adminOnly, async (req, res) => {
  const schema = settingSchemas[req.params.key];
  if (!schema) return res.status(404).json({ error: 'Ajuste desconocido' });
  const value = schema.parse(req.body.value);
  await Setting.findOneAndUpdate({ key: req.params.key }, { value }, { upsert: true });
  res.json({ key: req.params.key, value });
});

export default router;
