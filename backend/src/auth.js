import jwt from 'jsonwebtoken';
import { User } from './models.js';

const secret = () => {
  if (!process.env.JWT_SECRET) throw new Error('Falta la variable de entorno JWT_SECRET');
  return process.env.JWT_SECRET;
};

// La sesión dura 12 horas y se renueva sola mientras se usa el panel (ver requireAuth). El campo `v` es la versión de
// sesión de la cuenta: cambiar la contraseña o cerrar sesión en todos los dispositivos la sube y anula los tokens viejos.
const TOKEN_HOURS = 12;
export const signToken = (user) =>
  jwt.sign({ sub: String(user._id), v: user.tokenVersion ?? 0 }, secret(), { expiresIn: `${TOKEN_HOURS}h`, algorithm: 'HS256' });

const LEGACY_ROLES = ['presidente', 'moderador'];

export const publicUser = (u) => ({ id: String(u._id), name: u.name, email: u.email, role: u.role });

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    const { sub, v, iat } = jwt.verify(token, secret(), { algorithms: ['HS256'] });
    // El rol se lee de la BD en cada petición: si un admin lo quita, surte efecto de inmediato.
    const user = await User.findById(sub);
    if (!user || (v ?? 0) !== (user.tokenVersion ?? 0)) return res.status(401).json({ error: 'Sesión inválida' });
    // Valores de rol que ya no existen (presidente, moderador limitado) cuentan como Miembro hasta que corra la migración 003
    if (LEGACY_ROLES.includes(user.role)) user.role = 'miembro';
    req.user = user;
    // Renovación transparente: cuando ya pasó más de la mitad de su vida, se entrega un token nuevo en una cabecera.
    if (Date.now() / 1000 - iat > (TOKEN_HOURS * 3600) / 2) res.set('X-Renewed-Token', signToken(user));
    next();
  } catch {
    res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Esta acción solo la puede hacer un Moderador' });
  next();
}

// Permisos por rol (el panel y la API se rigen por esta tabla). Solo hay dos roles:
//
//   acción                                                         Miembro   Moderador (`admin`)
//   leer mensajes (con datos de contacto), imágenes y contadores     sí          sí
//   cambiar estado y revisión, responder y dejar notas               sí          sí
//   exportar mensajes a CSV                                          sí          sí
//   ver la papelera, restaurar y eliminar mensajes                   no          sí
//   ver noticias y propuestas (con borradores)                       sí          sí
//   publicar noticias y propuestas nuevas y cambiar su estado        sí          sí
//   editar el contenido de lo ya publicado y eliminarlo              no          sí
//   ver correos, nombres y roles del equipo (nunca contraseñas)      sí          sí
//   editar su propia información                                     sí          sí
//   editar a otros, dar de alta, eliminar, cambiar roles y orden     no          sí
//   ajustes del sitio y bitácora                                     no          sí
//
// El Moderador puede todo. Cada rol ve en el panel solo lo suyo (frontend/src/roles.js).
export const requirePanelUser = (req, res, next) =>
  ['admin', 'miembro'].includes(req.user?.role) ? next() : res.status(403).json({ error: 'No tienes permiso para esto' });

export const adminOnly = [requireAuth, requireAdmin];
export const panelUserOnly = [requireAuth, requirePanelUser]; // Miembro o Moderador
