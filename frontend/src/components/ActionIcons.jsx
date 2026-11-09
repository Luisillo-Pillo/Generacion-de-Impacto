// Iconos de línea del panel: botones de acción (editar, eliminar y buscar) y datos de las tarjetas del equipo (cargo, correo, estudios y conexión). Van ocultos para lectores de pantalla: cada
// botón lleva su propio nombre (aria-label) y texto emergente (title).
const props = { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const IconPencil = () => (
  <svg {...props}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

export const IconSearch = () => (
  <svg {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const IconInbox = () => (
  <svg {...props}>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1Z" />
  </svg>
);

export const IconCheck = () => (
  <svg {...props}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const IconTrash = () => (
  <svg {...props}>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
);

// Datos de las tarjetas del equipo
export const IconBadge = () => (
  <svg {...props}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="11" r="2.2" />
    <path d="M5.8 16.5a3.4 3.4 0 0 1 6.4 0" />
    <path d="M14.5 9.5H18" />
    <path d="M14.5 13H18" />
  </svg>
);

export const IconMail = () => (
  <svg {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </svg>
);

export const IconCap = () => (
  <svg {...props}>
    <path d="m2 9 10-5 10 5-10 5Z" />
    <path d="M6 11.2V16c0 1.2 2.7 2.5 6 2.5s6-1.3 6-2.5v-4.8" />
    <path d="M22 9v5" />
  </svg>
);

export const IconClock = () => (
  <svg {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
