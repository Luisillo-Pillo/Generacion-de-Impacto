import { Router } from 'express';
import { z } from 'zod';
import { Message, MESSAGE_TYPES, MESSAGE_STATUS, MESSAGE_REVIEW, MESSAGE_URGENCY } from '../models.js';
import { adminOnly, staffOnly } from '../auth.js';
import { deleteFile } from '../db.js';
import { imageUpload, saveImage } from '../uploads.js';
import { loadSettings } from '../settings.js';
import { audit } from '../audit.js';
import { newCode, hashCode, normalizeCode } from '../tracking.js';
import { toCsv } from '../csv.js';

const router = Router();

const MAX_IMAGES = 3;
const MAX_TOTAL_BYTES = 12 * 1024 * 1024; // tope de todas las imágenes juntas en un envío
const MIN_FILL_MS = 3000; // una persona no escribe asunto y mensaje en menos de 3 segundos
// El buzón no limita envíos (ni por IP ni en total): la comunidad comparte red y el cliente no quiere ningún tope.

const base = {
  type: z.enum(MESSAGE_TYPES),
  subject: z.string().trim().min(3, 'Escribe un asunto').max(140),
  body: z.string().trim().min(10, 'El mensaje es muy corto').max(4000),
  // Urgencia que le da quien escribe; si no la manda (formulario anterior), media
  urgency: z.enum(MESSAGE_URGENCY, { error: 'Selecciona la urgencia' }).optional().default('media'),
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
// Responde con el código de seguimiento (se muestra una sola vez; en la base solo queda su hash).
router.post('/', imageUpload.array('images', MAX_IMAGES), async (req, res) => {
  // Señales de bot: un campo oculto que las personas no ven (`website`) y un formulario enviado demasiado rápido
  // (`fillMs`: milisegundos desde que se mostró). Se responde "éxito" y se descarta, para no darle pistas al bot
  // (incluso con un código de aspecto real que no corresponde a nada).
  const fillMs = Number(req.body?.fillMs);
  if ((typeof req.body?.website === 'string' && req.body.website.trim() !== '') || (Number.isFinite(fillMs) && fillMs < MIN_FILL_MS)) {
    return res.status(201).json({ ok: true, code: newCode() });
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
  const code = newCode();
  try {
    for (const file of req.files ?? []) images.push(await saveImage(file, { isPrivate: true }));
    await Message.create({ ...data, images, codeHash: hashCode(code) });
  } catch (err) {
    await Promise.all(images.map(deleteFile));
    throw err;
  }
  res.status(201).json({ ok: true, code });
});

// Seguimiento público: con el código se consulta en qué va el mensaje y la respuesta del equipo. Nunca devuelve el
// cuerpo del mensaje ni datos personales. Un código inexistente, mal escrito o de un mensaje eliminado da siempre la
// misma respuesta. Sin límite de intentos (ni por IP): con 50 bits de aleatoriedad adivinar uno no es viable.
router.post('/track', async (req, res) => {
  const { code } = z.object({ code: z.string().max(60) }).parse(req.body ?? {});
  const hash = normalizeCode(code) && hashCode(code);
  const msg = hash && (await Message.findOne({ codeHash: hash, deletedAt: null }));
  if (!msg) return res.status(404).json({ error: 'No encontramos un mensaje con ese código. Revisa que esté completo.' });
  res.json({
    type: msg.type,
    subject: msg.subject,
    status: msg.status,
    review: msg.review || 'pendiente',
    createdAt: msg.createdAt,
    updatedAt: msg.updatedAt,
    publicReply: msg.publicReply || null,
    publicReplyAt: msg.publicReplyAt || null,
  });
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

// Marca de orden de bytes UTF-8: sin ella Excel abre el CSV con los acentos rotos
const BOM = String.fromCharCode(0xfeff);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Filtros comunes del listado y la exportación: estado, tipo, revisión y búsqueda `q` en asunto y texto. La búsqueda usa
// una expresión regular ESCAPADA (nunca lo escrito tal cual) para que nadie pueda inyectar patrones.
function buildFilter(query, { trash = false } = {}) {
  const { status, type, review, urgency, q } = query;
  // `deletedAt: null` también cubre los mensajes anteriores a la papelera, que no tienen el campo
  const filter = { deletedAt: trash ? { $ne: null } : null };
  if (MESSAGE_STATUS.includes(status)) filter.status = status;
  if (MESSAGE_TYPES.includes(type)) filter.type = type;
  // Los mensajes anteriores a este campo no lo tienen: cuentan como pendientes
  if (review === 'pendiente') filter.review = { $in: ['pendiente', null] };
  else if (MESSAGE_REVIEW.includes(review)) filter.review = review;
  // Los mensajes anteriores a este campo no lo tienen: cuentan como urgencia media
  if (urgency === 'media') filter.urgency = { $in: ['media', null] };
  else if (MESSAGE_URGENCY.includes(urgency)) filter.urgency = urgency;
  const text = typeof q === 'string' ? q.trim().slice(0, 100) : '';
  if (text) {
    const rx = new RegExp(escapeRegex(text), 'i');
    filter.$or = [{ subject: rx }, { body: rx }];
  }
  return filter;
}

// Con `?page=` responde { items, total, page, pages } (de `limit` en `limit`, 20 por defecto, máximo 100); sin él, la lista
// completa hasta 500 como antes (compatibilidad con pestañas abiertas con el sitio anterior).
router.get('/', staffOnly, async (req, res) => {
  const trash = req.query.trash === '1';
  if (trash && req.user.role !== 'admin') return res.status(403).json({ error: 'Se requiere rol de administrador' });
  const filter = buildFilter(req.query, { trash });
  const sort = trash ? { deletedAt: -1 } : { createdAt: -1 };
  if (req.query.page === undefined) {
    const items = await Message.find(filter).sort(sort).limit(500);
    return res.json(items.map((m) => forRole(m, req.user.role)));
  }
  const limit = Math.min(100, Math.max(1, Math.floor(Number(req.query.limit)) || 20));
  const total = await Message.countDocuments(filter);
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(req.query.page)) || 1));
  const items = await Message.find(filter).sort(sort).skip((page - 1) * limit).limit(limit);
  res.json({ items: items.map((m) => forRole(m, req.user.role)), total, page, pages });
});

// Contadores para la insignia del panel y el resumen sobre la lista (solo mensajes que no están en la papelera).
router.get('/stats', staffOnly, async (_req, res) => {
  const live = { deletedAt: null };
  const [nuevos, pendientes, total, tipos] = await Promise.all([
    Message.countDocuments({ ...live, status: 'nuevo' }),
    Message.countDocuments({ ...live, review: { $in: ['pendiente', null] }, status: { $ne: 'archivado' } }),
    Message.countDocuments(live),
    Message.aggregate([{ $match: live }, { $group: { _id: '$type', n: { $sum: 1 } } }]),
  ]);
  const porTipo = Object.fromEntries(MESSAGE_TYPES.map((t) => [t, tipos.find((x) => x._id === t)?.n ?? 0]));
  res.json({ nuevos, pendientes, total, porTipo });
});

// Exporta a CSV (UTF-8 con BOM para que Excel respete los acentos) con los mismos filtros del listado. Solo administradores:
// incluye datos personales. Las celdas que Excel interpretaría como fórmula se neutralizan (ver csv.js). Queda en la bitácora.
router.get('/export', adminOnly, async (req, res) => {
  const items = await Message.find(buildFilter(req.query)).sort({ createdAt: -1 }).limit(10000);
  const date = (d) => (d ? new Date(d).toISOString().replace('T', ' ').slice(0, 19) : '');
  const rows = items.map((m) => [
    date(m.createdAt), m.type, m.urgency || 'media', m.anonymous ? 'Sí' : 'No', m.name, m.degree, m.semester, m.group, m.phone, m.subject, m.body,
    m.status, m.review || 'pendiente', m.publicReply, (m.notes ?? []).map((n) => `${n.authorName}: ${n.text}`).join(' | '),
  ]);
  const csv = toCsv(
    ['Fecha (UTC)', 'Tipo', 'Urgencia', 'Anónimo', 'Nombre', 'Licenciatura', 'Semestre', 'Grupo', 'Teléfono', 'Asunto', 'Mensaje', 'Estado', 'Revisión', 'Respuesta pública', 'Notas internas'],
    rows
  );
  await audit(req, 'mensaje.exportar', 'mensaje', undefined, `Exportó ${items.length} mensaje(s) a CSV`);
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="mensajes.csv"', 'Cache-Control': 'no-store' });
  res.send(`${BOM}${csv}`);
});

router.patch('/:id', staffOnly, async (req, res) => {
  const changes = z
    .object({
      status: z.enum(MESSAGE_STATUS),
      review: z.enum(MESSAGE_REVIEW),
      // Respuesta que verá quien escribió al consultar su código; vacía, la quita
      publicReply: z.string().trim().max(1000),
    })
    .partial()
    .refine((c) => Object.keys(c).length > 0, 'Indica el estado, la revisión o la respuesta')
    .parse(req.body);
  const update = { ...changes };
  if (changes.publicReply !== undefined) {
    if (changes.publicReply) update.publicReplyAt = new Date();
    else {
      delete update.publicReply;
      update.$unset = { publicReply: 1, publicReplyAt: 1 };
    }
  }
  const msg = await Message.findOneAndUpdate({ _id: req.params.id, deletedAt: null }, update, { new: true });
  if (!msg) return res.status(404).json({ error: 'Mensaje no encontrado' });
  // Solo el tipo de cambio: nunca el texto de la respuesta
  const detail = Object.entries(changes)
    .map(([k, v]) => (k === 'status' ? `estado: ${v}` : k === 'review' ? `revisión: ${v}` : v ? 'escribió la respuesta pública' : 'quitó la respuesta pública'))
    .join(', ');
  await audit(req, 'mensaje.actualizar', 'mensaje', msg._id, `Cambió ${detail}`);
  res.json(forRole(msg, req.user.role));
});

// Nota interna del equipo: nunca la ve quien escribió.
router.post('/:id/notes', staffOnly, async (req, res) => {
  const { text } = z.object({ text: z.string().trim().min(1, 'Escribe la nota').max(1000) }).parse(req.body);
  const msg = await Message.findOneAndUpdate(
    { _id: req.params.id, deletedAt: null },
    { $push: { notes: { authorName: req.user.name, text, at: new Date() } } },
    { new: true }
  );
  if (!msg) return res.status(404).json({ error: 'Mensaje no encontrado' });
  await audit(req, 'mensaje.nota', 'mensaje', msg._id, 'Agregó una nota interna');
  res.status(201).json(forRole(msg, req.user.role));
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
