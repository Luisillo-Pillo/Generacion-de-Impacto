import DecorItem, { decorClass, decorStyle } from './DecorItem.jsx';
import './MailboxDecor.css';

// Decoración de los costados de la página «Buzón» (el formulario es angosto y en pantallas anchas quedan márgenes vacíos).
// Mezcla los adornos de la página del equipo (estrellas, cruces, líneas de marcador, retazos) con piezas del tema del buzón:
// aviones de papel, burbujas de «¿?» y «¡!», y sobres. Todo es decorativo: va oculto para los lectores de pantalla, no recibe
// clics y solo aparece cuando los costados son lo bastante anchos (consultas de contenedor en MailboxDecor.css), así que nunca
// toca el formulario. Datos fijos (no aleatorios) para que la página se dibuje igual en cada visita.
// Campos de cada adorno: ver DecorItem.jsx (top es el % del alto de la página).
const ITEMS = [
  // ≥ 1000 px: adornos pequeños pegados a los bordes
  { k: 'star', side: 'l', top: 10, o: 20, s: 22 },
  { k: 'plus', side: 'l', top: 26, o: 52, s: 16, r: 10, d: -3 },
  { k: 'squig', side: 'l', top: 40, o: 12, s: 62 },
  { k: 'dots', side: 'l', top: 62, o: 6, s: 52, r: -6 },
  { k: 'star', side: 'l', top: 78, o: 34, s: 16, color: 'black', d: -1.5 },
  { k: 'plus', side: 'l', top: 90, o: 14, s: 18, r: -12, d: -6 },
  { k: 'star', side: 'r', top: 8, o: 44, s: 16, color: 'black', d: -0.8 },
  { k: 'squig', side: 'r', top: 22, o: 10, s: 62 },
  { k: 'plus', side: 'r', top: 46, o: 18, s: 16, r: -8, d: -2 },
  { k: 'star', side: 'r', top: 58, o: 28, s: 24, d: -2.2 },
  { k: 'dots', side: 'r', top: 76, o: 6, s: 50, r: 6 },
  { k: 'squig', side: 'r', top: 92, o: 16, s: 56 },
  // ≥ 1200 px: piezas grandes del tema del buzón
  { k: 'bubble', side: 'l', top: 18, o: '4%', wide: true, r: -8, mark: '¿?' },
  { k: 'env', side: 'l', top: 51, o: '5%', wide: true, r: 8 },
  { k: 'tag', side: 'l', top: 71, o: '2%', wide: true, r: -4, label: 'Tu opinión cuenta' },
  { k: 'plane', side: 'r', top: 14, o: '3%', wide: true, r: -6 },
  { k: 'tag', side: 'r', top: 37, o: '2%', wide: true, r: 5, label: '¡Escríbenos!' },
  { k: 'bubble', side: 'r', top: 64, o: '5%', wide: true, r: 7, mark: '!', dark: true },
  { k: 'plane', side: 'r', top: 86, o: '5%', wide: true, r: 8, small: true, d: -3.5 },
];

// Papelitos que suben despacio por los costados (como los del inicio y los del equipo)
const BITS = [
  { x: 2, s: 13, t: 40, d: -6, dx: 30, r: 260 }, { x: 6, s: 9, t: 52, d: -30, dx: -20, r: -220, paper: true },
  { x: 4, s: 11, t: 46, d: -22, dx: 22, r: 200, paper: true }, { x: 8, s: 14, t: 38, d: -14, dx: -26, r: -280 },
  { x: 92, s: 12, t: 44, d: -4, dx: -30, r: -260 }, { x: 96, s: 10, t: 54, d: -34, dx: 24, r: 240, paper: true },
  { x: 94, s: 14, t: 42, d: -18, dx: -22, r: -300 }, { x: 98, s: 9, t: 50, d: -26, dx: 20, r: 220, paper: true },
];

const SHAPE = { fill: '#fff', stroke: '#121212', strokeWidth: 2.6, strokeLinejoin: 'round', strokeLinecap: 'round' };

function Piece(item) {
  const { k, mark, dark, small } = item;
  const style = decorStyle({ ...item, s: item.s ?? (k === 'plane' ? (small ? 70 : 104) : k === 'bubble' ? 78 : 88) });
  const cls = `${decorClass(item)}${dark ? ' dark' : ''}${small ? ' small' : ''}`;
  if (k === 'plane') {
    // Avión de papel con su estela punteada (la estela «se dibuja» al animarse)
    return (
      <svg className={cls} style={style} viewBox="0 0 100 52" focusable="false">
        <path className="trail" pathLength="1" d="M2 48C22 50 30 30 46 30" />
        <path d="M96 6 46 28l15 6z" {...SHAPE} />
        <path d="M96 6 61 34l7 14z" {...SHAPE} fill="#e8dccb" />
        <path d="M61 34 68 48l-6-7z" fill="#d4141c" stroke="#121212" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    );
  }
  if (k === 'bubble') {
    return (
      <svg className={cls} style={style} viewBox="0 0 76 64" focusable="false">
        <path d="M10 4h56a8 8 0 0 1 8 8v26a8 8 0 0 1-8 8H40L24 60V46H10a8 8 0 0 1-8-8V12a8 8 0 0 1 8-8z" />
        <text x="38" y="35" textAnchor="middle">{mark}</text>
      </svg>
    );
  }
  if (k === 'env') {
    return (
      <svg className={cls} style={style} viewBox="0 0 80 56" focusable="false">
        <rect x="3" y="6" width="74" height="46" rx="5" {...SHAPE} />
        <path d="M5 10 40 34 75 10" {...SHAPE} fill="none" />
        <circle cx="40" cy="34" r="6" fill="#d4141c" stroke="#121212" strokeWidth="2.2" />
      </svg>
    );
  }
  return <DecorItem {...item} />;
}

export default function MailboxDecor() {
  return (
    <div className="mailbox-decor" aria-hidden="true">
      <div className="mailbox-ambient">
        {BITS.map((b) => (
          <span
            key={b.x}
            className={`bit${b.paper ? ' paper' : ''}`}
            style={{ '--x': `${b.x}%`, '--s': `${b.s}px`, '--t': `${b.t}s`, '--d': `${b.d}s`, '--dx': `${b.dx}px`, '--r': `${b.r}deg` }}
          />
        ))}
      </div>
      {ITEMS.map((item, i) => <Piece key={i} {...item} />)}
    </div>
  );
}
