import './DecorShapes.css';

// Un adorno decorativo (estrella, cruz, línea de marcador, retazo de puntos, rótulo a mano o retazo de papel) listo para
// colocarse con CSS (ver DecorShapes.css). Siempre se usa dentro de un contenedor `aria-hidden`.
//   k: tipo · side: 'l' izquierda / 'r' derecha · top: % de alto · o: distancia al borde (px o %) · s: tamaño (px)
//   r: giro (grados) · d: retraso de la animación (s) · wide: solo cuando hay muchísimo espacio · color: 'black' (por defecto, rojo)
const STAR_PATH = 'M12 0C13 8 16 11 24 12 16 13 13 16 12 24 11 16 8 13 0 12 8 11 11 8 12 0Z';
const px = (v) => (typeof v === 'number' ? `${v}px` : v);

// Variables CSS de posición, tamaño, giro y retraso
export const decorStyle = ({ top, o, s, r, d }) => ({
  '--t': `${top}%`,
  '--o': px(o),
  ...(s && { '--s': `${s}px` }),
  ...(r !== undefined && { '--r': `${r}deg` }),
  ...(d !== undefined && { '--d': `${d}s` }),
});

export const decorClass = ({ k, side, wide, color }) => `d d-${k} ${side}${wide ? ' wide' : ''}${color === 'black' ? ' black' : ''}`;

export default function DecorItem(item) {
  const { k, label } = item;
  const style = decorStyle(item);
  const cls = decorClass(item);
  if (k === 'star') return <svg className={cls} style={style} viewBox="0 0 24 24" focusable="false"><path d={STAR_PATH} /></svg>;
  if (k === 'squig') return <svg className={cls} style={style} viewBox="0 0 84 14" focusable="false"><path pathLength="1" d="M3 8Q13 -1 23 8T43 8 63 8 81 8" /></svg>;
  return <span className={cls} style={style}>{label}</span>;
}
