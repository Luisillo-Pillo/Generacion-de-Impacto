import { sanitizeMessage } from './monitoring.js';

// Aviso por correo de mensajes nuevos del buzón, para enterarse aunque el panel esté cerrado.
//
// - Se manda por la API HTTPS de Resend (Render gratis bloquea SMTP) con `fetch`: sin dependencias nuevas.
// - Sin RESEND_API_KEY y NOTIFY_EMAIL_TO no hace nada (y las pruebas nunca tocan un servicio real: reemplazan `mail.send`).
// - El mensaje YA está guardado cuando se llama aquí: un fallo del correo solo se anota en el registro del servidor y nunca le
//   afecta a quien escribió ni al panel.
// - PRIVACIDAD: el correo lleva solo el tipo y la urgencia y el enlace al panel; nunca el asunto, el texto ni datos de nadie
//   (el texto puede traer datos personales y los anónimos no deben poder identificarse por correo).
// - Ráfagas: el primer mensaje avisa al instante; los que lleguen en los 5 minutos siguientes se juntan en un solo correo de
//   resumen (solo agrupa lo que se te manda; el buzón no limita los envíos de nadie). Es en memoria: un reinicio del servidor
//   durante esos minutos pierde el resumen pendiente, no los mensajes.

const WINDOW_DEFAULT_MS = 5 * 60 * 1000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TYPE = { queja: ['queja', 'quejas'], propuesta: ['propuesta', 'propuestas'], pregunta: ['pregunta', 'preguntas'], problema: ['problema', 'problemas'] };
const URGENCY = { baja: 'baja', media: 'media', alta: 'alta', urgente: 'urgente' };

function config() {
  const key = process.env.RESEND_API_KEY?.trim();
  const to = (process.env.NOTIFY_EMAIL_TO || '').split(',').map((e) => e.trim()).filter((e) => EMAIL.test(e));
  if (!key || !to.length) return null;
  const site = (process.env.SITE_URL || (process.env.CORS_ORIGIN || '').split(',')[0] || '').trim().replace(/\/$/, '');
  const windowMs = process.env.NOTIFY_WINDOW_MS !== undefined && Number.isFinite(Number(process.env.NOTIFY_WINDOW_MS)) ? Number(process.env.NOTIFY_WINDOW_MS) : WINDOW_DEFAULT_MS;
  return {
    key,
    to,
    // Sin dominio propio, Resend solo permite este remitente de pruebas y solo entrega a la cuenta de Resend (ver README)
    from: process.env.MAIL_FROM?.trim() || 'Buzón Generación de Impacto <onboarding@resend.dev>',
    link: site ? `${site}/admin/mensajes` : '',
    windowMs,
  };
}

async function sendWithResend({ key, from, to, subject, text }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, text }),
    signal: AbortSignal.timeout(10 * 1000),
  });
  if (!res.ok) {
    const detail = await res.json().then((d) => d?.message).catch(() => '');
    throw new Error(`Resend respondió ${res.status}${detail ? `: ${detail}` : ''}`);
  }
}

// Las pruebas reemplazan `mail.send` por un registro en memoria
export const mail = { send: sendWithResend };

const count = (items, pick) => {
  const totals = new Map();
  for (const item of items) totals.set(pick(item), (totals.get(pick(item)) ?? 0) + 1);
  return totals;
};

// Arma el asunto y el texto (solo tipo y urgencia, nunca contenido)
export function compose(batch, link) {
  const privacy = 'Por privacidad, este aviso no incluye el contenido del mensaje ni datos de quien lo escribió.';
  const open = link ? `Ábrelo en el panel: ${link}` : 'Ábrelo en el panel de administración (Mensajes).';
  if (batch.length === 1) {
    const [{ type, urgency }] = batch;
    const label = TYPE[type]?.[0] ?? 'mensaje';
    return {
      subject: `Nuevo mensaje en el buzón · ${label} · urgencia ${URGENCY[urgency] ?? 'media'}`,
      text: `Llegó un mensaje nuevo al buzón de Generación de Impacto.\n\nTipo: ${label}\nUrgencia: ${URGENCY[urgency] ?? 'media'}\n\n${open}\n\n${privacy}\n`,
    };
  }
  const byType = [...count(batch, (m) => m.type)].map(([t, n]) => `${n} ${TYPE[t]?.[n === 1 ? 0 : 1] ?? 'mensajes'}`).join(', ');
  const byUrgency = [...count(batch, (m) => m.urgency)].map(([u, n]) => `${n} ${URGENCY[u] ?? 'media'}`).join(', ');
  return {
    subject: `${batch.length} mensajes nuevos en el buzón`,
    text: `Llegaron ${batch.length} mensajes nuevos al buzón de Generación de Impacto.\n\nPor tipo: ${byType}\nPor urgencia: ${byUrgency}\n\n${open}\n\n${privacy}\n`,
  };
}

let pending = [];
let timer = null;
let lastSentAt = 0;

async function deliver(batch, cfg) {
  try {
    await mail.send({ ...cfg, ...compose(batch, cfg.link) });
  } catch (err) {
    // Solo el tipo de fallo (sin correos ni valores): quien escribió no se entera y el mensaje ya está guardado
    console.error(JSON.stringify({ level: 'warn', time: new Date().toISOString(), event: 'aviso-correo', message: sanitizeMessage(err?.message) }));
  }
}

function flush(cfg) {
  const batch = pending;
  pending = [];
  timer = null;
  lastSentAt = Date.now();
  if (batch.length) deliver(batch, cfg); // sin await: nunca retrasa ninguna petición
}

// Se llama con el mensaje ya guardado. Nunca lanza ni espera al correo.
export function notifyNewMessage(msg) {
  try {
    const cfg = config();
    if (!cfg) return;
    pending.push({ type: msg.type, urgency: msg.urgency || 'media' });
    if (timer) return; // ya hay un resumen programado: este se suma
    const wait = Math.max(0, lastSentAt + cfg.windowMs - Date.now());
    if (wait === 0) {
      flush(cfg);
    } else {
      timer = setTimeout(() => flush(cfg), wait);
      timer.unref();
    }
  } catch (err) {
    console.error(JSON.stringify({ level: 'warn', time: new Date().toISOString(), event: 'aviso-correo', message: sanitizeMessage(err?.message) }));
  }
}

// Solo para pruebas: deja el estado como recién arrancado
export function resetNotifications() {
  clearTimeout(timer);
  pending = [];
  timer = null;
  lastSentAt = 0;
}
