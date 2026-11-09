import DecorItem from './DecorItem.jsx';
import './TeamDecor.css';

// Decoración de la página «Equipo» para llenar los costados vacíos del organigrama. Todo es decorativo: va oculto para los
// lectores de pantalla, no recibe clics y solo existe con espacio de sobra (ver las consultas de contenedor en TeamDecor.css).
// Los adornos son datos fijos (no aleatorios) para que la página se dibuje igual en cada visita.
// Campos de cada adorno: ver DecorItem.jsx (top es el % del alto del nivel)
const TIER_ITEMS = {
  1: [
    { k: 'tag', side: 'l', top: 50, o: '3%', wide: true, r: -5, label: 'Presidencia' },
    { k: 'patch', side: 'r', top: 50, o: '3%', wide: true, r: 5 },
    { k: 'star', side: 'l', top: 16, o: 16, s: 24 },
    { k: 'plus', side: 'l', top: 86, o: 58, s: 18, r: 12 },
    { k: 'dots', side: 'l', top: 62, o: 0, s: 54, r: -6 },
    { k: 'squig', side: 'r', top: 88, o: 8, s: 70 },
    { k: 'star', side: 'r', top: 18, o: 40, s: 18, color: 'black', d: -1.3 },
    { k: 'plus', side: 'r', top: 56, o: 4, s: 16, r: -10, d: -3 },
  ],
  2: [
    { k: 'patch', side: 'l', top: 50, o: '1.5%', wide: true, r: -4 },
    { k: 'tag', side: 'r', top: 50, o: '1.5%', wide: true, r: 4, label: 'Vicepresidencia y tesorería' },
    { k: 'star', side: 'r', top: 14, o: 18, s: 22, d: -0.6 },
    { k: 'squig', side: 'l', top: 12, o: 8, s: 70 },
    { k: 'plus', side: 'l', top: 84, o: 40, s: 18, r: 20, d: -4 },
    { k: 'dots', side: 'r', top: 72, o: 0, s: 52, r: 6 },
    { k: 'star', side: 'l', top: 58, o: 6, s: 16, color: 'black', d: -2 },
  ],
  3: [
    { k: 'star', side: 'l', top: 12, o: 14, s: 22 },
    { k: 'plus', side: 'l', top: 48, o: 6, s: 16, r: 8, d: -2 },
    { k: 'squig', side: 'l', top: 86, o: 6, s: 62 },
    { k: 'plus', side: 'r', top: 14, o: 12, s: 18, r: -14 },
    { k: 'star', side: 'r', top: 50, o: 12, s: 20, color: 'black', d: -1.6 },
    { k: 'dots', side: 'r', top: 84, o: 0, s: 50, r: 5 },
  ],
};

// Papelitos que suben despacio por los costados (como los del inicio): x en % del ancho, tamaño, duración, retraso, deriva, giro
const BITS = [
  { x: 2, s: 13, t: 30, d: -4, dx: 30, r: 260 }, { x: 6, s: 9, t: 38, d: -22, dx: -20, r: -220, paper: true },
  { x: 10, s: 15, t: 34, d: -12, dx: 36, r: 300 }, { x: 14, s: 10, t: 42, d: -30, dx: -26, r: -260, paper: true },
  { x: 4, s: 11, t: 36, d: -18, dx: 22, r: 200, paper: true }, { x: 12, s: 12, t: 28, d: -8, dx: -30, r: -180 },
  { x: 86, s: 12, t: 32, d: -2, dx: -34, r: -280 }, { x: 90, s: 10, t: 40, d: -26, dx: 24, r: 240, paper: true },
  { x: 94, s: 15, t: 35, d: -14, dx: -28, r: -300 }, { x: 98, s: 9, t: 44, d: -34, dx: 20, r: 220, paper: true },
  { x: 88, s: 11, t: 29, d: -9, dx: 30, r: 190, paper: true }, { x: 96, s: 13, t: 37, d: -20, dx: -22, r: -240 },
];

// Adornos de los costados de un nivel del organigrama (se coloca dentro del `.tier`)
export function TierDecor({ level }) {
  return (
    <div className="tier-decor" aria-hidden="true">
      {(TIER_ITEMS[level] ?? []).map((item, i) => <DecorItem key={i} {...item} />)}
    </div>
  );
}

// Papelitos y arcos que flotan detrás de todo el organigrama (se coloca como primer hijo de `.org`)
export function OrgAmbient() {
  return (
    <div className="org-ambient" aria-hidden="true">
      <span className="org-ring l" />
      <span className="org-ring r" />
      {BITS.map((b) => (
        <span
          key={b.x}
          className={`bit${b.paper ? ' paper' : ''}`}
          style={{ '--x': `${b.x}%`, '--s': `${b.s}px`, '--t': `${b.t}s`, '--d': `${b.d}s`, '--dx': `${b.dx}px`, '--r': `${b.r}deg` }}
        />
      ))}
    </div>
  );
}
