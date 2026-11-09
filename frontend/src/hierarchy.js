// Jerarquía de la página «Equipo». El cargo es texto libre («Presidente», «Presidencia», «Vicepresidenta», «Tesorería»…),
// así que el nivel se deduce de cómo empieza, sin acentos ni mayúsculas ni género:
//   nivel 1 → Presidente / Presidenta / Presidencia
//   nivel 2 → Vicepresidente(a) / Vicepresidencia y Tesorero(a) / Tesorería
//   nivel 3 → todos los demás (y quien no tiene cargo)
// «Vicepresidente» contiene «presidente», por eso se revisa primero. Cambiar este archivo es lo único que hace falta para
// ajustar los niveles; no se guarda nada en la base de datos.
const normalize = (text) => String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function levelOf(role) {
  const r = normalize(role);
  if (/^vice[\s-]*presiden/.test(r) || /^tesorer/.test(r)) return 2;
  if (/^presiden/.test(r)) return 1;
  return 3;
}

// Dentro del segundo nivel la vicepresidencia va primero y la tesorería después (el resto conserva el orden del panel)
const rankInLevel2 = (role) => (/^tesorer/.test(normalize(role)) ? 1 : 0);

// Devuelve solo los niveles que tienen gente: [{ level: 1, members: [...] }, …]
export function groupByLevel(members) {
  const tiers = [1, 2, 3].map((level) => ({ level, members: members.filter((m) => levelOf(m.role) === level) }));
  tiers[1].members.sort((a, b) => rankInLevel2(a.role) - rankInLevel2(b.role)); // el orden de Array.sort es estable
  return tiers.filter((t) => t.members.length > 0);
}
