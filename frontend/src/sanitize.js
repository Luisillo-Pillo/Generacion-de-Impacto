// Filtro de privacidad para los reportes de error del navegador (Sentry). Este sitio recibe mensajes y datos personales:
// a un tercero solo debe viajar el tipo de error y su pila, nunca lo que la persona escribió, su URL con consulta, sus
// cabeceras ni su IP. Mismo criterio que backend/src/monitoring.js. Sin dependencias para poder probarlo en Node.
// Se exporta para que la prueba de monitoreo compruebe que aplica el mismo criterio que el del servidor
export function sanitizeMessage(text) {
  return String(text ?? '')
    .replace(/(["'`])(?:(?!\1)[^\n])*\1/g, '$1…$1')
    .replace(/\{[^}]*\}/g, '{…}')
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[correo]')
    .replace(/\d{6,}/g, '[número]')
    .slice(0, 300);
}

export function scrubEvent(event) {
  delete event.request; // URL con consulta, cabeceras y agente de usuario
  delete event.user;
  delete event.extra;
  delete event.breadcrumbs; // clics y textos de la página
  delete event.server_name;
  event.contexts = { runtime: event.contexts?.runtime };
  if (event.message) event.message = sanitizeMessage(event.message);
  for (const ex of event.exception?.values ?? []) {
    ex.value = sanitizeMessage(ex.value);
    for (const frame of ex.stacktrace?.frames ?? []) delete frame.vars;
  }
  return event;
}
