import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User, Member } from '../models.js';
import { signToken, publicUser, requireAuth } from '../auth.js';

// No hay registro público: las cuentas se crean al dar de alta a un integrante de la planilla
// (panel → Equipo) o con `npm run create-admin` para el primer administrador.
const router = Router();

async function session(user) {
  const member = await Member.findOne({ user: user._id }).select('-user');
  return { user: publicUser(user), member };
}

router.post('/login', async (req, res) => {
  const { email, password } = z
    .object({ email: z.string().trim().toLowerCase(), password: z.string() })
    .parse(req.body);
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  }
  res.json({ token: signToken(user), ...(await session(user)) });
});

router.get('/me', requireAuth, async (req, res) => res.json(await session(req.user)));

router.patch('/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = z
    .object({
      currentPassword: z.string(),
      newPassword: z.string().min(8, 'La contraseña nueva debe tener al menos 8 caracteres').max(100),
    })
    .parse(req.body);
  if (!(await bcrypt.compare(currentPassword, req.user.passwordHash))) {
    return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
  }
  req.user.passwordHash = await bcrypt.hash(newPassword, 10);
  await req.user.save();
  res.json({ ok: true });
});

export default router;
