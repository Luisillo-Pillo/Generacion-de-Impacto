import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models.js';
import { signToken, publicUser, requireAuth, adminOnly } from '../auth.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Escribe tu nombre').max(80),
  email: z.string().trim().toLowerCase().email('Correo no válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(100),
});

router.post('/register', async (req, res) => {
  const data = registerSchema.parse(req.body);
  if (await User.exists({ email: data.email })) {
    return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });
  }
  // La primera cuenta registrada en el sistema es administradora.
  const isFirst = (await User.estimatedDocumentCount()) === 0;
  const user = await User.create({
    name: data.name,
    email: data.email,
    passwordHash: await bcrypt.hash(data.password, 10),
    role: isFirst ? 'admin' : 'user',
  });
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const { email, password } = z
    .object({ email: z.string().trim().toLowerCase(), password: z.string() })
    .parse(req.body);
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

// --- Gestión de roles (solo admin) ---
router.get('/users', adminOnly, async (_req, res) => {
  const users = await User.find().sort({ createdAt: 1 });
  res.json(users.map(publicUser));
});

router.patch('/users/:id/role', adminOnly, async (req, res) => {
  const { role } = z.object({ role: z.enum(['admin', 'user']) }).parse(req.body);
  const target = await User.findById(req.params.id);
  if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (target.role === 'admin' && role === 'user' && (await User.countDocuments({ role: 'admin' })) <= 1) {
    return res.status(400).json({ error: 'Debe quedar al menos un administrador' });
  }
  target.role = role;
  await target.save();
  res.json(publicUser(target));
});

export default router;
