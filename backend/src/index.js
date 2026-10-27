import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ZodError } from 'zod';
import { connectDb } from './db.js';
import authRoutes from './routes/auth.js';
import fileRoutes from './routes/files.js';
import messageRoutes from './routes/messages.js';
import contentRoutes from './routes/content.js';

const app = express();

const origins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.set('trust proxy', 1); // Render está detrás de un proxy
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: origins }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api', contentRoutes);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: err.issues[0]?.message || 'Datos inválidos', issues: err.issues });
  }
  if (err?.name === 'MulterError' || err?.message?.startsWith('Solo se permiten')) {
    return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'La imagen excede 5 MB' : err.message });
  }
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const port = process.env.PORT || 4000;
connectDb()
  .then(() => app.listen(port, () => console.log(`API escuchando en el puerto ${port}`)))
  .catch((err) => {
    console.error('No se pudo iniciar la API:', err.message);
    process.exit(1);
  });
