import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Member, User } from '../models.js';
import { adminOnly, requireAuth, panelUserOnly, isOnline } from '../auth.js';
import { deleteFile } from '../db.js';
import { objectId } from '../validators.js';
import { hashPassword, passwordSchema } from '../passwords.js';
import { audit } from '../audit.js';
import { loadSettings } from '../settings.js';

// Cada integrante de la planilla tiene una cuenta de acceso con un rol (ver la tabla de permisos en auth.js): Moderador (`admin`,
// puede todo) o Miembro (por defecto). Solo el Moderador da de alta, edita a otros, cambia roles y orden y elimina; cada quien
// edita su propia ficha y todos ven correos, nombres y roles (nunca contraseñas).
const router = Router();

const base = {
  name: z.string().trim().min(2, 'Escribe el nombre').max(100),
  role: z.string().trim().max(100).optional().default(''),
  degree: z.string().trim().max(120).optional().default(''),
  semester: z.string().trim().max(20).optional().default(''),
  group: z.string().trim().max(20).optional().default(''),
  photo: objectId,
  order: z.number().int().optional().default(0),
};
const ACCESS = ['admin', 'miembro']; // admin = «Moderador» (todo), miembro = «Miembro»
// El mensaje personalizado solo aplica cuando el campo falta; otros errores de tipo usan el de zod.
const missing = (message) => ({ error: (issue) => (issue.input === undefined ? message : undefined) });

const email = z.string(missing('Captura el correo del integrante')).trim().toLowerCase().email('Correo no válido');
const password = passwordSchema('Captura una contraseña para el integrante');
const blankToUndefined = (schema) => z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

const createSchema = z.object({ ...base, email, password, access: z.enum(ACCESS).optional().default('miembro') });
// Al editar, correo y contraseña son opcionales: solo se cambian si se envían.
const updateSchema = z.object({ ...base, email: blankToUndefined(email), password: blankToUndefined(password), access: z.enum(ACCESS).optional() });

// El grupo solo aplica en las licenciaturas con varios grupos (Ajustes → groupDegrees); en las demás no se guarda, igual que en el buzón
async function withoutInapplicableGroup(data) {
  if (!data.group) return data;
  const { groupDegrees } = await loadSettings();
  return groupDegrees.includes(data.degree) ? data : { ...data, group: '' };
}

// `lastSeenAt` (última conexión) y `online` (¿conectado ahora?) solo se incluyen para el Moderador; `lastSeenAt` es `null` si la
// cuenta aún no ha entrado desde que existe el dato
const toAdminJson = (member, user, { withLastSeen = true } = {}) => ({
  ...member.toObject(),
  user: undefined,
  email: user?.email || '',
  access: user?.role === 'admin' ? 'admin' : 'miembro',
  ...(withLastSeen && { lastSeenAt: user?.lastSeenAt ?? null, online: isOnline(user) }),
});

router.get('/', async (_req, res) => {
  res.json(await Member.find().sort({ order: 1, createdAt: 1 }).select('-user'));
});

// Directorio del panel: nombre, cargo, licenciatura, semestre, grupo, foto, correo y rol de cada integrante, para el Miembro y el Moderador.
// Nunca contraseñas. Solo el Moderador recibe además la última conexión (`lastSeenAt`) y si está conectado ahora (`online`).
router.get('/all', panelUserOnly, async (req, res) => {
  const members = await Member.find().sort({ order: 1, createdAt: 1 }).populate('user', 'email role lastSeenAt onlineUntil');
  const withLastSeen = req.user.role === 'admin';
  res.json(members.map((m) => toAdminJson(m, m.user, { withLastSeen })));
});

// Cada persona edita su propia información (nombre, cargo, licenciatura, semestre, grupo y foto). El correo, el rol de acceso y el orden
// los cambia solo el Moderador, y la contraseña cada quien en su perfil. Va antes de `/:id`.
router.put('/me', requireAuth, async (req, res) => {
  const { name, role, degree, semester, group, photo } = await withoutInapplicableGroup(
    z.object({ name: base.name, role: base.role, degree: base.degree, semester: base.semester, group: base.group, photo: base.photo }).parse(req.body)
  );
  const member = await Member.findOne({ user: req.user._id });
  if (!member) return res.status(404).json({ error: 'Tu cuenta no tiene ficha de integrante' });
  const newPhoto = photo || undefined;
  if (member.photo && String(member.photo) !== String(newPhoto)) await deleteFile(member.photo);
  Object.assign(member, { name, role, degree, semester, group, photo: newPhoto });
  await member.save();
  req.user.name = name;
  await req.user.save();
  await audit(req, 'integrante.editar', 'integrante', member._id, 'Actualizó su propia información');
  res.json({ user: { id: String(req.user._id), name: req.user.name, email: req.user.email, role: req.user.role }, member: await Member.findById(member._id).select('-user') });
});

// Reordena el equipo: recibe los ids en el orden nuevo y asigna 0, 1, 2… de una sola vez.
// Va antes de `/:id` para que "order" no se tome por un id.
router.put('/order', adminOnly, async (req, res) => {
  const { ids } = z.object({ ids: z.array(z.string().refine((v) => mongoose.isValidObjectId(v), 'Id inválido')).min(1).max(200) }).parse(req.body);
  if (new Set(ids).size !== ids.length) return res.status(400).json({ error: 'Hay integrantes repetidos' });
  await Member.bulkWrite(ids.map((id, index) => ({ updateOne: { filter: { _id: id }, update: { $set: { order: index } } } })));
  await audit(req, 'integrante.reordenar', 'integrante', undefined, 'Cambió el orden del equipo');
  res.json(await Member.find().sort({ order: 1, createdAt: 1 }).select('-user'));
});

router.post('/', adminOnly, async (req, res) => {
  const { email: mail, password: pass, access, ...parsed } = createSchema.parse(req.body);
  const data = await withoutInapplicableGroup(parsed);
  if (await User.exists({ email: mail })) {
    return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });
  }
  const user = await User.create({
    name: data.name,
    email: mail,
    passwordHash: await hashPassword(pass),
    role: access,
  });
  try {
    const member = await Member.create({ ...data, photo: data.photo || undefined, user: user._id });
    await audit(req, 'integrante.crear', 'integrante', member._id, `Dio de alta a ${data.name}${access === 'moderador' ? ' como moderador' : ''}`);
    res.status(201).json(toAdminJson(member, user));
  } catch (err) {
    await User.findByIdAndDelete(user._id); // no dejar una cuenta huérfana
    throw err;
  }
});

router.put('/:id', adminOnly, async (req, res) => {
  const { email: mail, password: pass, access, ...parsed } = updateSchema.parse(req.body);
  const data = await withoutInapplicableGroup(parsed);
  const member = await Member.findById(req.params.id);
  if (!member) return res.status(404).json({ error: 'Integrante no encontrado' });

  let user = member.user ? await User.findById(member.user) : null;
  if (mail && mail !== user?.email && (await User.exists({ email: mail }))) {
    return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });
  }
  if (user) {
    user.name = data.name;
    if (mail) user.email = mail;
    if (pass) {
      user.passwordHash = await hashPassword(pass);
      user.tokenVersion = (user.tokenVersion ?? 0) + 1; // la persona tendrá que entrar de nuevo con la contraseña nueva
    }
  } else {
    if (!mail || !pass) return res.status(400).json({ error: 'Captura correo y contraseña para darle acceso' });
    user = new User({ name: data.name, email: mail, passwordHash: await hashPassword(pass) });
  }
  // Sin `access` el rol no cambia (y una cuenta nueva sin rol es Miembro): nunca se asciende por omisión
  const newRole = access ?? (user.role === 'admin' ? 'admin' : 'miembro');
  if (user.role === 'admin' && newRole !== 'admin') {
    // Siempre debe quedar al menos un Moderador, y nadie se quita el acceso a sí mismo
    if (String(user._id) === String(req.user._id)) return res.status(400).json({ error: 'No puedes quitarte tu propio rol de Moderador' });
    if ((await User.countDocuments({ role: 'admin', _id: { $ne: user._id } })) === 0) {
      return res.status(400).json({ error: 'Debe quedar al menos un Moderador' });
    }
  }
  const changedRole = user.role !== newRole && !user.isNew;
  user.role = newRole;
  await user.save();

  const newPhoto = data.photo || undefined;
  if (member.photo && String(member.photo) !== String(newPhoto)) await deleteFile(member.photo);
  Object.assign(member, { ...data, photo: newPhoto, user: user._id });
  await member.save();
  await audit(req, 'integrante.editar', 'integrante', member._id, `Editó a ${data.name}${pass ? ' (cambió su contraseña)' : ''}${changedRole ? ` (ahora es ${newRole})` : ''}`);
  res.json(toAdminJson(member, user));
});

router.delete('/:id', adminOnly, async (req, res) => {
  const member = await Member.findById(req.params.id);
  if (!member) return res.status(204).end();
  // Quitar a alguien de la planilla le retira el acceso. Como quien borra es admin y no puede
  // borrarse a sí mismo, siempre queda al menos un Moderador.
  if (member.user) {
    if (String(member.user) === String(req.user._id)) {
      return res.status(400).json({ error: 'No puedes eliminar tu propio perfil de integrante' });
    }
    await User.findByIdAndDelete(member.user);
  }
  await member.deleteOne();
  await deleteFile(member.photo);
  await audit(req, 'integrante.eliminar', 'integrante', member._id, `Eliminó a ${member.name} y su cuenta`);
  res.status(204).end();
});

export default router;
