import { Router } from 'express';
import { z } from 'zod';
import { Member, User } from '../models.js';
import { adminOnly } from '../auth.js';
import { deleteFile } from '../db.js';
import { objectId } from '../validators.js';
import { hashPassword, passwordSchema } from '../passwords.js';
import { audit } from '../audit.js';

// Cada integrante de la planilla tiene una cuenta de acceso y, por serlo, es administrador.
const router = Router();

const base = {
  name: z.string().trim().min(2, 'Escribe el nombre').max(100),
  role: z.string().trim().max(100).optional().default(''),
  degree: z.string().trim().max(120).optional().default(''),
  photo: objectId,
  order: z.number().int().optional().default(0),
};
// El mensaje personalizado solo aplica cuando el campo falta; otros errores de tipo usan el de zod.
const missing = (message) => ({ error: (issue) => (issue.input === undefined ? message : undefined) });

const email = z.string(missing('Captura el correo del integrante')).trim().toLowerCase().email('Correo no válido');
const password = passwordSchema('Captura una contraseña para el integrante');
const blankToUndefined = (schema) => z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

const createSchema = z.object({ ...base, email, password });
// Al editar, correo y contraseña son opcionales: solo se cambian si se envían.
const updateSchema = z.object({ ...base, email: blankToUndefined(email), password: blankToUndefined(password) });

const toAdminJson = (member, user) => ({ ...member.toObject(), user: undefined, email: user?.email || '' });

router.get('/', async (_req, res) => {
  res.json(await Member.find().sort({ order: 1, createdAt: 1 }).select('-user'));
});

router.get('/all', adminOnly, async (_req, res) => {
  const members = await Member.find().sort({ order: 1, createdAt: 1 }).populate('user', 'email');
  res.json(members.map((m) => toAdminJson(m, m.user)));
});

router.post('/', adminOnly, async (req, res) => {
  const { email: mail, password: pass, ...data } = createSchema.parse(req.body);
  if (await User.exists({ email: mail })) {
    return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });
  }
  const user = await User.create({
    name: data.name,
    email: mail,
    passwordHash: await hashPassword(pass),
    role: 'admin',
  });
  try {
    const member = await Member.create({ ...data, photo: data.photo || undefined, user: user._id });
    await audit(req, 'integrante.crear', 'integrante', member._id, `Dio de alta a ${data.name}`);
    res.status(201).json(toAdminJson(member, user));
  } catch (err) {
    await User.findByIdAndDelete(user._id); // no dejar una cuenta huérfana
    throw err;
  }
});

router.put('/:id', adminOnly, async (req, res) => {
  const { email: mail, password: pass, ...data } = updateSchema.parse(req.body);
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
  user.role = 'admin';
  await user.save();

  const newPhoto = data.photo || undefined;
  if (member.photo && String(member.photo) !== String(newPhoto)) await deleteFile(member.photo);
  Object.assign(member, { ...data, photo: newPhoto, user: user._id });
  await member.save();
  await audit(req, 'integrante.editar', 'integrante', member._id, `Editó a ${data.name}${pass ? ' (cambió su contraseña)' : ''}`);
  res.json(toAdminJson(member, user));
});

router.delete('/:id', adminOnly, async (req, res) => {
  const member = await Member.findById(req.params.id);
  if (!member) return res.status(204).end();
  // Quitar a alguien de la planilla le retira el acceso. Como quien borra es admin y no puede
  // borrarse a sí mismo, siempre queda al menos un administrador.
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
