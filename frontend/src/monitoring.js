import * as Sentry from '@sentry/react';
import { scrubEvent } from './sanitize.js';

// Monitoreo de errores del navegador (Sentry). Se descarga solo si VITE_SENTRY_DSN está definida (ver main.jsx), así que sin
// ella no pesa ni envía nada. Sin sesión de usuario, sin rastros de clics, sin repeticiones de pantalla y con el filtro de
// privacidad de sanitize.js antes de enviar cada evento.
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  sendDefaultPii: false,
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  maxBreadcrumbs: 0,
  beforeBreadcrumb: () => null,
  beforeSend: scrubEvent,
});

export const report = (error) => Sentry.captureException(error);
