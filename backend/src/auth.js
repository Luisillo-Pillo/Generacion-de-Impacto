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
    req.user = user;
    // Renovación transparente: cuando ya pasó más de la mitad de su vida, se entrega un token nuevo en una cabecera.
    if (Date.now() / 1000 - iat > (TOKEN_HOURS * 3600) / 2) res.set('X-Renewed-Token', signToken(user));
    next();
  } catch {
    res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Esta acción solo la puede hacer un Técnico' });
  next();
}

// Permisos por rol (el panel y la API se rigen por esta tabla):
//
//   rol                 ver todo   editar todo   mensajes (leer)   mensajes (gestionar)   equipo (ver, sin datos críticos)   su propia ficha
//   admin  (Técnico)       sí          sí             sí                  sí                       sí                          sí
//   presidente             sí          no             sí (completos)      no                       sí                          sí
//   miembro                no          no             no                  no                       sí                          sí
//   moderador              no          no             sí (sin contacto)   sí                       no                          sí
//
// `ver todo` = datos de contacto, papelera, bitácora, exportación, borradores y ajustes.
const rolesAllowed = (roles, message = 'No tienes permiso para esto') => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : res.status(403).json({ error: message });

export const requireStaff = rolesAllowed(['admin', 'moderador']); // gestionar mensajes (estado, revisión, notas, respuesta)
export const requireReader = rolesAllowed(['admin', 'presidente', 'moderador']); // leer mensajes e imágenes adjuntas
export const requireViewer = rolesAllowed(['admin', 'presidente']); // ver todo
export const requirePanelUser = rolesAllowed(['admin', 'presidente', 'miembro']); // ver el directorio del equipo

export const adminOnly = [requireAuth, requireAdmin];
export const staffOnly = [requireAuth, requireStaff];
export const readerOnly = [requireAuth, requireReader];
export const viewerOnly = [requireAuth, requireViewer];
export const panelUserOnly = [requireAuth, requirePanelUser];
