// Iconografía del buzón. Cada pieza tiene un significado en la página:
//  - iconos de línea: anonimato (candado), adjuntar imágenes (clip) y enviar (avión de papel)
//  - pegatina del sobre: el mensaje que se deposita en el buzón (junto al título)
//  - sello de palomita: confirmación de que el mensaje se recibió
// Todo va oculto para lectores de pantalla: el texto de cada elemento ya dice lo mismo.

const RED = '#d4141c';
const INK = '#121212';
const ROUND = { strokeLinecap: 'round', strokeLinejoin: 'round' };

function Icon({ children }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
}

// Candado: anonimato (no se guardan datos)
export const IconLock = () => (
  <Icon>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Icon>
);

// Adjuntar imágenes: clip
export const IconClip = () => (
  <Icon>
    <path d="m21 11.5-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.6 8.6a1.8 1.8 0 0 1-2.5-2.5l7.9-7.9" />
  </Icon>
);

// Enviar: avión de papel
export const IconSend = () => (
  <Icon>
    <path d="M22 2 11 13" />
    <path d="M22 2l-7 20-4-9-9-4 20-7z" />
  </Icon>
);

// Sobre con flecha entrando al buzón, junto al título
export function EnvelopeSticker() {
  return (
    <svg className="sticker envelope" viewBox="0 0 170 130" aria-hidden="true">
      <g transform="rotate(-7 60 52)" {...ROUND}>
        <rect x="8" y="12" width="104" height="70" rx="9" fill="#fff" stroke={INK} strokeWidth="6" />
        <path d="M14 22 L60 58 L106 22" fill="none" stroke={INK} strokeWidth="6" />
      </g>
      <path d="M62 100 C86 120 124 114 138 84" fill="none" stroke={RED} strokeWidth="6" {...ROUND} />
      <path d="M124 82 L139 82 L142 98" fill="none" stroke={RED} strokeWidth="6" {...ROUND} />
    </svg>
  );
}

// Sello de confirmación: el mensaje se recibió
export function CheckStamp() {
  return (
    <svg className="sticker check" viewBox="0 0 140 140" aria-hidden="true">
      <circle cx="70" cy="70" r="54" fill="#fff" stroke={INK} strokeWidth="7" />
      <circle cx="70" cy="70" r="40" fill="none" stroke={RED} strokeWidth="4" strokeDasharray="4 8" {...ROUND} />
      <path d="M46 72 L63 89 L96 52" fill="none" stroke={RED} strokeWidth="13" {...ROUND} />
    </svg>
  );
}
