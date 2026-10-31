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

// Freno a la fuerza bruta: tras 10 intentos fallidos desde una misma IP en 15 minutos se bloquea el acceso un rato.
// Va en memoria (la API corre en una sola instancia); al reiniciar el servidor se reinicia el conteo.
const MAX_FAILS = 10;
const WINDOW_MS = 15 * 60 * 1000;
const fails = new Map(); // ip → { count, until }

function blocked(ip) {
  const entry = fails.get(ip);
  return !!entry && Date.now() <= entry.until && entry.count >= MAX_FAILS;
}

function registerFail(ip) {
  const now = Date.now();
  const entry = fails.get(ip);
  if (entry && now <= entry.until) {
    entry.count++;
    return;
  }
  for (const [key, e] of fails) if (now > e.until) fails.delete(key); // limpia los vencidos para que no crezca
  fails.set(ip, { count: 1, until: now + WINDOW_MS });
}

// Hash de relleno: si el correo no existe se compara igual, para que el tiempo de respuesta no delate qué correos tienen cuenta.
const DUMMY_HASH = bcrypt.hashSync('relleno-sin-uso', 10);

router.post('/login', async (req, res) => {
  const { email, password } = z
    .object({ email: z.string().trim().toLowerCase(), password: z.string() })
    .parse(req.body);
  if (blocked(req.ip)) {
    return res.status(429).json({ error: 'Demasiados intentos fallidos. Inténtalo de nuevo en unos minutos.' });
  }
  const user = await User.findOne({ email });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    registerFail(req.ip);
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  }
  fails.delete(req.ip);
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
