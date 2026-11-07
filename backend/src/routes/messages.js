import { Router } from 'express';
import { z } from 'zod';
import { Message, MESSAGE_TYPES, MESSAGE_STATUS, MESSAGE_REVIEW } from '../models.js';
import { adminOnly, staffOnly } from '../auth.js';
import { deleteFile } from '../db.js';
import { imageUpload, saveImage } from '../uploads.js';
import { loadSettings } from '../settings.js';
import { audit } from '../audit.js';

const router = Router();

const MAX_IMAGES = 3;
const MAX_TOTAL_BYTES = 12 * 1024 * 1024; // tope de todas las imágenes juntas en un envío
const MIN_FILL_MS = 3000; // una persona no escribe asunto y mensaje en menos de 3 segundos
// El buzón no limita envíos (ni por IP ni en total): la comunidad comparte red y el cliente no quiere ningún tope.

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
    // Los datos personales solo se guardan si la persona aceptó el aviso de privacidad (se guarda cuándo, en `consentAt`)
    consent: z.literal(true, { error: 'Acepta el aviso de privacidad para enviar tus datos' }),
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
  // Señales de bot: un campo oculto que las personas no ven (`website`) y un formulario enviado demasiado rápido
  // (`fillMs`: milisegundos desde que se mostró). Se responde "éxito" y se descarta, para no darle pistas al bot.
  const fillMs = Number(req.body?.fillMs);
  if ((typeof req.body?.website === 'string' && req.body.website.trim() !== '') || (Number.isFinite(fillMs) && fillMs < MIN_FILL_MS)) {
    return res.status(201).json({ ok: true });
  }
  const totalBytes = (req.files ?? []).reduce((sum, f) => sum + f.size, 0);
  if (totalBytes > MAX_TOTAL_BYTES) return res.status(413).json({ error: 'Las imágenes juntas deben pesar máximo 12 MB' });
  const body = {
    ...req.body,
    anonymous: req.body?.anonymous === true || req.body?.anonymous === 'true',
    consent: req.body?.consent === true || req.body?.consent === 'true',
  };
  const data = createSchema.parse(body);
  delete data.consent; // solo sirve para validar: lo que se guarda es la fecha (`consentAt`)
  if (!data.anonymous) {
    data.consentAt = new Date();
    const { groupDegrees } = await loadSettings();
    if (!groupDegrees.includes(data.degree)) delete data.group; // no aplica: no se guarda
    else if (!data.group) return res.status(400).json({ error: 'Selecciona tu grupo' });
  }
  const images = [];
  try {
    for (const file of req.files ?? []) images.push(await saveImage(file, { isPrivate: true }));
    await Message.create({ ...data, images });
  } catch (err) {
    await Promise.all(images.map(deleteFile));
    throw err;
  }
  res.status(201).json({ ok: true });
});

// Un moderador no ve quién escribió: los datos de contacto se quitan de la respuesta (solo se indica que los hay).
const CONTACT_FIELDS = ['name', 'degree', 'semester', 'group', 'phone'];
function forRole(msg, role) {
  const json = msg.toObject ? msg.toObject() : msg;
  if (role === 'admin') return json;
  const out = { ...json, hasContact: !json.anonymous };
  for (const field of CONTACT_FIELDS) delete out[field];
  return out;
}

router.get('/', staffOnly, async (req, res) => {
  const { status, type, review } = req.query;
  const trash = req.query.trash === '1';
  if (trash && req.user.role !== 'admin') return res.status(403).json({ error: 'Se requiere rol de administrador' });
  // `deletedAt: null` también cubre los mensajes anteriores a la papelera, que no tienen el campo
  const filter = { deletedAt: trash ? { $ne: null } : null };
  if (MESSAGE_STATUS.includes(status)) filter.status = status;
  if (MESSAGE_TYPES.includes(type)) filter.type = type;
  // Los mensajes anteriores a este campo no lo tienen: cuentan como pendientes
  if (review === 'pendiente') filter.review = { $in: ['pendiente', null] };
  else if (MESSAGE_REVIEW.includes(review)) filter.review = review;
  const items = await Message.find(filter).sort(trash ? { deletedAt: -1 } : { createdAt: -1 }).limit(500);
  res.json(items.map((m) => forRole(m, req.user.role)));
});

router.patch('/:id', staffOnly, async (req, res) => {
  const changes = z
    .object({ status: z.enum(MESSAGE_STATUS), review: z.enum(MESSAGE_REVIEW) })
    .partial()
    .refine((c) => Object.keys(c).length > 0, 'Indica el estado o la revisión')
    .parse(req.body);
  const msg = await Message.findOneAndUpdate({ _id: req.params.id, deletedAt: null }, changes, { new: true });
  if (!msg) return res.status(404).json({ error: 'Mensaje no encontrado' });
  const detail = Object.entries(changes).map(([k, v]) => `${k === 'status' ? 'estado' : 'revisión'}: ${v}`).join(', ');
  await audit(req, 'mensaje.actualizar', 'mensaje', msg._id, `Cambió ${detail}`);
  res.json(forRole(msg, req.user.role));
});

// Eliminar manda el mensaje a la papelera; a los 30 días se borra de verdad (ver maintenance.js).
router.delete('/:id', adminOnly, async (req, res) => {
  const msg = await Message.findOneAndUpdate({ _id: req.params.id, deletedAt: null }, { deletedAt: new Date() });
  if (msg) await audit(req, 'mensaje.papelera', 'mensaje', msg._id, 'Envió un mensaje a la papelera');
  res.status(204).end();
});

router.post('/:id/restore', adminOnly, async (req, res) => {
  const msg = await Message.findOneAndUpdate({ _id: req.params.id, deletedAt: { $ne: null } }, { $unset: { deletedAt: 1 } }, { new: true });
  if (!msg) return res.status(404).json({ error: 'El mensaje no está en la papelera' });
  await audit(req, 'mensaje.restaurar', 'mensaje', msg._id, 'Restauró un mensaje de la papelera');
  res.json(msg);
});

// Borrado definitivo: solo desde la papelera.
router.delete('/:id/permanent', adminOnly, async (req, res) => {
  const msg = await Message.findOneAndDelete({ _id: req.params.id, deletedAt: { $ne: null } });
  if (!msg) return res.status(404).json({ error: 'El mensaje no está en la papelera' });
  await Promise.all(msg.images.map(deleteFile));
  await audit(req, 'mensaje.eliminar', 'mensaje', msg._id, 'Eliminó definitivamente un mensaje');
  res.status(204).end();
});

export default router;
