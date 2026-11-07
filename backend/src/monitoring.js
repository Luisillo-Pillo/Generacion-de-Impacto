import * as Sentry from '@sentry/node';

// Monitoreo de errores (Sentry, capa gratuita) CON PRIVACIDAD: este sitio guarda mensajes y datos personales, así que a un
// tercero nunca debe viajar contenido de mensajes, cuerpos de petición, cabeceras, IP ni nombres. Solo se envía el tipo de
// error, su pila de llamadas (rutas de nuestro código, sin variables) y un id de petición para rastrearlo en los registros.
// Sin la variable SENTRY_DSN no se envía nada a nadie.

// Los mensajes de error de Mongo/Mongoose pueden incluir valores (p. ej. «dup key: { email: "x@y.com" }»): se quitan los
// textos entre comillas, los objetos entre llaves, los correos y los números largos.
export function sanitizeMessage(text) {
  return String(text ?? '')
    .replace(/(["'`])(?:(?!\1)[^\n])*\1/g, '$1…$1')
    .replace(/\{[^}]*\}/g, '{…}')
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[correo]')
    .replace(/\d{6,}/g, '[número]')
    .slice(0, 300);
}

// Último filtro antes de enviar un evento: borra todo lo que no sea el error en sí
export function scrubEvent(event) {
  delete event.request; // URL con consulta, cabeceras, cookies, cuerpo
  delete event.user; // IP, correo, id
  delete event.extra;
  delete event.breadcrumbs;
  delete event.server_name; // nombre del equipo
  event.contexts = { runtime: event.contexts?.runtime };
  if (event.message) event.message = sanitizeMessage(event.message);
  for (const ex of event.exception?.values ?? []) {
    ex.value = sanitizeMessage(ex.value);
    for (const frame of ex.stacktrace?.frames ?? []) delete frame.vars; // variables locales
  }
  return event;
}

let enabled = false;

export function initMonitoring(env = process.env) {
  if (!env.SENTRY_DSN) return false;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT || 'production',
    sendDefaultPii: false,
    tracesSampleRate: 0,
    maxBreadcrumbs: 0,
    beforeBreadcrumb: () => null,
    beforeSend: scrubEvent,
  });
  enabled = true;
  return true;
}

// Reporta un error inesperado (500). Con el id de petición se encuentra el mismo error en los registros de Render.
export function reportError(err, requestId) {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    scope.setTag('request_id', requestId);
    Sentry.captureException(err);
  });
}

export const flushMonitoring = (ms = 2000) => (enabled ? Sentry.flush(ms) : Promise.resolve(true));
