import { Router } from 'express';
import { z } from 'zod';
import { Message, MESSAGE_TYPES, MESSAGE_STATUS, MESSAGE_REVIEW } from '../models.js';
import { adminOnly } from '../auth.js';

const router = Router();

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
    group: z.string().trim().min(1, 'Selecciona tu grupo').max(20),
  }),
]);

router.post('/', async (req, res) => {
  const data = createSchema.parse(req.body);
  await Message.create(data);
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
  await Message.findByIdAndDelete(req.params.id);
  res.status(204).end();
});

export default router;
