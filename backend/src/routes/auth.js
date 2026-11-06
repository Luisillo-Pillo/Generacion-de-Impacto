import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User, Member } from '../models.js';
import { signToken, publicUser, requireAuth } from '../auth.js';
import { BCRYPT_COST, hashPassword, needsRehash, passwordSchema } from '../passwords.js';
import { hit, peek, reset, retryAfter } from '../rateLimit.js';
import { audit } from '../audit.js';

// No hay registro público: las cuentas se crean al dar de alta a un integrante de la planilla
// (panel → Equipo) o con `npm run create-admin` para el primer administrador.
const router = Router();

async function session(user) {
  const member = await Member.findOne({ user: user._id }).select('-user');
  return { user: publicUser(user), member };
}

// Freno a la fuerza bruta, guardado en MongoDB (sobrevive a reinicios): 5 intentos fallidos por correo en 15 minutos.
// Se limita por cuenta y no por IP: la comunidad comparte red (misma IP) y un límite por IP bloquearía a todos.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS_EMAIL = 5;

// Hash de relleno: si el correo no existe se compara igual, para que el tiempo de respuesta no delate qué correos tienen cuenta.
const DUMMY_HASH = bcrypt.hashSync('relleno-sin-uso', BCRYPT_COST);

router.post('/login', async (req, res) => {
  const { email, password } = z
    .object({ email: z.string().trim().toLowerCase(), password: z.string() })
    .parse(req.body);
  const byEmail = await peek('login-email', email);
  if (byEmail.count >= MAX_FAILS_EMAIL) {
    res.set('Retry-After', String(retryAfter(byEmail.resetAt)));
    return res.status(429).json({ error: 'Demasiados intentos fallidos. Inténtalo de nuevo en unos minutos.' });
  }
  const user = await User.findOne({ email });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    const { count } = await hit('login-email', email, WINDOW_MS);
    // Se deja constancia una sola vez, cuando se alcanza el límite.
    if (count === MAX_FAILS_EMAIL) await audit(null, 'login.bloqueado', 'cuenta', user?._id, `Acceso bloqueado temporalmente para ${email}: demasiados intentos fallidos`);
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  }
  await reset('login-email', email);
  // Las contraseñas guardadas con un costo menor se actualizan aquí, que es el único momento en que se conocen.
  if (needsRehash(user.passwordHash)) {
    user.passwordHash = await hashPassword(password);
    await user.save();
  }
  res.json({ token: signToken(user), ...(await session(user)) });
});

router.get('/me', requireAuth, async (req, res) => res.json(await session(req.user)));

router.patch('/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = z
    .object({ currentPassword: z.string(), newPassword: passwordSchema('Captura la contraseña nueva') })
    .parse(req.body);
  if (!(await bcrypt.compare(currentPassword, req.user.passwordHash))) {
    return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
  }
  req.user.passwordHash = await hashPassword(newPassword);
  req.user.tokenVersion = (req.user.tokenVersion ?? 0) + 1; // cierra las sesiones abiertas en otros dispositivos
  await req.user.save();
  await audit(req, 'auth.contrasena', 'usuario', req.user._id, 'Cambió su contraseña');
  res.json({ ok: true, token: signToken(req.user) }); // este dispositivo sigue con sesión
});

// Cierra la sesión en todos los dispositivos menos en el actual (que recibe un token nuevo).
router.post('/logout-all', requireAuth, async (req, res) => {
  req.user.tokenVersion = (req.user.tokenVersion ?? 0) + 1;
  await req.user.save();
  await audit(req, 'auth.cerrar_todas', 'usuario', req.user._id, 'Cerró sesión en todos los dispositivos');
  res.json({ ok: true, token: signToken(req.user) });
});

export default router;
