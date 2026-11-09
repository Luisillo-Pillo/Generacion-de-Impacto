import { createHash } from 'node:crypto';
import mongoose from 'mongoose';

// Limitador de intentos guardado en MongoDB: sobrevive a reinicios (Render duerme y reinicia el servicio) y funciona
// igual con varias instancias. Cada documento es una ventana de tiempo para una llave; el índice TTL lo borra solo.
// La llave se guarda con hash, así la base no conserva IPs ni correos en claro.
const rateLimitSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});
export const RateLimit = mongoose.model('RateLimit', rateLimitSchema);

const hashKey = (scope, id) => createHash('sha256').update(`${scope}:${id}`).digest('hex');

// Suma un intento a la llave y devuelve cuántos lleva en la ventana vigente. Es atómico (una sola operación en la
// base): si la ventana venció o no existe, abre una nueva con cuenta 1.
export async function hit(scope, id, windowMs) {
  const key = hashKey(scope, id);
  const now = new Date();
  const fresh = new Date(now.getTime() + windowMs);
  const update = [
    {
      $set: {
        count: { $cond: [{ $gt: ['$expiresAt', now] }, { $add: [{ $ifNull: ['$count', 0] }, 1] }, 1] },
        expiresAt: { $cond: [{ $gt: ['$expiresAt', now] }, '$expiresAt', fresh] },
      },
    },
  ];
  for (let attempt = 0; ; attempt++) {
    try {
      const doc = await RateLimit.findOneAndUpdate({ key }, update, {
        upsert: true,
        new: true,
        updatePipeline: true,
      });
      return { count: doc.count, resetAt: doc.expiresAt };
    } catch (err) {
      // Dos peticiones simultáneas pueden intentar crear la misma llave: la segunda reintenta y ya encuentra la primera.
      if (err?.code === 11000 && attempt < 2) continue;
      throw err;
    }
  }
}

// Cuántos intentos lleva la llave en la ventana vigente, sin sumar uno.
export async function peek(scope, id) {
  const doc = await RateLimit.findOne({ key: hashKey(scope, id) });
  if (!doc || doc.expiresAt <= new Date()) return { count: 0, resetAt: null };
  return { count: doc.count, resetAt: doc.expiresAt };
}

export async function reset(scope, id) {
  await RateLimit.deleteOne({ key: hashKey(scope, id) });
}

// Segundos que faltan para que se libere la llave (para la cabecera Retry-After).
export const retryAfter = (resetAt) => Math.max(1, Math.ceil((new Date(resetAt).getTime() - Date.now()) / 1000));
