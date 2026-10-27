import jwt from 'jsonwebtoken';
import { User } from './models.js';

const secret = () => {
  if (!process.env.JWT_SECRET) throw new Error('Falta la variable de entorno JWT_SECRET');
  return process.env.JWT_SECRET;
};

export const signToken = (user) =>
  jwt.sign({ sub: String(user._id) }, secret(), { expiresIn: '7d' });

export const publicUser = (u) => ({ id: String(u._id), name: u.name, email: u.email, role: u.role });

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    const { sub } = jwt.verify(token, secret());
    // El rol se lee de la BD en cada petición: si un admin lo quita, surte efecto de inmediato.
    const user = await User.findById(sub);
    if (!user) return res.status(401).json({ error: 'Sesión inválida' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Se requiere rol de administrador' });
  next();
}

export const adminOnly = [requireAuth, requireAdmin];
