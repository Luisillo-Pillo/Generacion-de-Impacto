import express from 'express';
import crypto from 'node:crypto';
import cors from 'cors';
import helmet from 'helmet';
import { ZodError } from 'zod';
import authRoutes from './routes/auth.js';
import fileRoutes from './routes/files.js';
import messageRoutes from './routes/messages.js';
import memberRoutes from './routes/members.js';
import contentRoutes from './routes/content.js';
import auditRoutes from './routes/audit.js';
import { reportError, sanitizeMessage } from './monitoring.js';

// La aplicación Express sin arrancar (ni base de datos ni puerto): así las pruebas pueden montarla por su cuenta.
// `index.js` es quien conecta con MongoDB y la pone a escuchar.
export const app = express();

const origins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

// Solo para staging: acepta las URLs de preview de Vercel, que cambian en cada rama. El `*` equivale a un tramo de
// letras, números y guiones (p. ej. `https://generacion-impacto-*.vercel.app`); no se aceptan expresiones regulares
// libres para que un error de escritura no deje el CORS abierto. En producción no se define.
const originPattern = (() => {
  const raw = (process.env.CORS_ORIGIN_PATTERN || '').trim();
  if (!raw) return null;
  const escaped = raw.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[a-z0-9-]+');
  return new RegExp(`^${escaped}$`, 'i');
})();

const originAllowed = (origin) => origins.includes(origin) || !!originPattern?.test(origin);

app.set('trust proxy', 1); // Render está detrás de un proxy
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
// Sin cabecera Origin (curl, health checks) no hay nada que restringir; con ella, solo los orígenes permitidos.
app.use(
  cors({
    origin: (origin, callback) => callback(null, !origin || originAllowed(origin)),
    exposedHeaders: ['X-Renewed-Token', 'Retry-After', 'X-Request-Id'], // el frontend necesita leerlas
  })
);
// Id de cada petición: va en la cabecera X-Request-Id y en los registros de error, para rastrear un fallo concreto
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.set('X-Request-Id', req.id);
  next();
});
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api', contentRoutes);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Express identifica el manejador de errores por sus 4 parámetros, aunque _next no se use.
app.use((err, req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: err.issues[0]?.message || 'Datos inválidos', issues: err.issues });
  }
  if (err?.name === 'MulterError' || err?.message?.startsWith('Solo se permiten')) {
    const known = {
      LIMIT_FILE_SIZE: 'Cada imagen debe pesar máximo 5 MB',
      LIMIT_FILE_COUNT: 'Puedes adjuntar hasta 3 imágenes',
      LIMIT_UNEXPECTED_FILE: 'Puedes adjuntar hasta 3 imágenes',
    };
    return res.status(400).json({ error: known[err.code] || err.message });
  }
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'La petición es demasiado grande' });
  // Un id con formato inválido en la URL (p. ej. /api/news/abc) no es un fallo del servidor
  if (err?.name === 'CastError') {
    return err.path === '_id' ? res.status(404).json({ error: 'No encontrado' }) : res.status(400).json({ error: 'Datos inválidos' });
  }
  // Registro estructurado (una línea JSON por error). Nunca el cuerpo, la consulta ni las cabeceras de la petición, y el
  // mensaje sin los valores que pudiera traer (ver monitoring.js).
  console.error(JSON.stringify({
    level: 'error', time: new Date().toISOString(), requestId: req.id, method: req.method, path: req.path,
    error: err?.name, message: sanitizeMessage(err?.message), stack: String(err?.stack ?? '').split('\n').slice(1, 9).map((l) => l.trim()),
  }));
  reportError(err, req.id);
  res.status(500).json({ error: 'Error interno del servidor', requestId: req.id });
});
