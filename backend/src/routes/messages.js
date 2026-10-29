import { Router } from 'express';
import { z } from 'zod';
import { Message, MESSAGE_TYPES, MESSAGE_STATUS, MESSAGE_REVIEW } from '../models.js';
import { adminOnly } from '../auth.js';
import { deleteFile } from '../db.js';
import { imageUpload, saveImage } from '../uploads.js';
import { loadSettings } from '../settings.js';

const router = Router();

const MAX_IMAGES = 3;

const base = {
  type: z.enum(MESSAGE_TYPES),
  subject: z.string().trim().min(3, 'Escribe un asunto').max(140),
  body: z.string().trim().min(10, 'El mensaje es muy corto').max(4000),
};

// Anónimo: no se aceptan ni guardan datos personales. Identificado: todos los datos son obligatorios.
const createSchema = z.discriminatedUnion('anonymous', [
  z.object({ ...base, anonymous: z.literal(true) }),
  z.object({
    ...base,
    anonymous: z.literal(false),
    name: z.string().trim().min(2, 'Escribe tu nombre').max(120),
    degree: z.string().trim().min(1, 'Selecciona tu licenciatura').max(120),
    semester: z.string().trim().min(1, 'Selecciona tu semestre').max(20),
    // Solo las licenciaturas con varios grupos piden grupo; se valida contra los ajustes al crear el mensaje
    group: z.string().trim().max(20).optional(),
    // Se acepta "000 000 0000" (con espacios o guiones) y se guarda solo con los 10 dígitos
    phone: z
      .string({ error: 'Escribe tu teléfono a 10 dígitos' })
      .transform((v) => v.replace(/[\s-]/g, ''))
      .pipe(z.string().regex(/^\d{10}$/, 'El teléfono debe tener 10 dígitos')),
  }),
]);

// Multipart: los campos de texto y hasta 3 imágenes (campo "images") llegan en una sola petición, así no quedan
// archivos huérfanos si el mensaje no es válido. También se acepta JSON sin imágenes.
router.post('/', imageUpload.array('images', MAX_IMAGES), async (req, res) => {
  const body = { ...req.body, anonymous: req.body?.anonymous === true || req.body?.anonymous === 'true' };
  const data = createSchema.parse(body);
  if (!data.anonymous) {
    const { groupDegrees } = await loadSettings();
    if (!groupDegrees.includes(data.degree)) delete data.group; // no aplica: no se guarda
    else if (!data.group) return res.status(400).json({ error: 'Selecciona tu grupo' });
  }
  const images = [];
  try {
    for (const file of req.files ?? []) images.push(await saveImage(file));
    await Message.create({ ...data, images });
  } catch (err) {
    await Promise.all(images.map(deleteFile));
    throw err;
  }
  res.status(201).json({ ok: true });
});

router.get('/', adminOnly, async (req, res) => {
  const { status, type, review } = req.query;
  const filter = {};
  if (MESSAGE_STATUS.includes(status)) filter.status = status;
  if (MESSAGE_TYPES.includes(type)) filter.type = type;
  // Los mensajes anteriores a este campo no lo tienen: cuentan como pendientes
  if (review === 'pendiente') filter.review = { $in: ['pendiente', null] };
  else if (MESSAGE_REVIEW.includes(review)) filter.review = review;
  res.json(await Message.find(filter).sort({ createdAt: -1 }).limit(500));
});

router.patch('/:id', adminOnly, async (req, res) => {
  const changes = z
    .object({ status: z.enum(MESSAGE_STATUS), review: z.enum(MESSAGE_REVIEW) })
    .partial()
    .refine((c) => Object.keys(c).length > 0, 'Indica el estado o la revisión')
    .parse(req.body);
  const msg = await Message.findByIdAndUpdate(req.params.id, changes, { new: true });
  if (!msg) return res.status(404).json({ error: 'Mensaje no encontrado' });
  res.json(msg);
});

router.delete('/:id', adminOnly, async (req, res) => {
  const msg = await Message.findByIdAndDelete(req.params.id);
  await Promise.all((msg?.images ?? []).map(deleteFile));
  res.status(204).end();
});

export default router;
