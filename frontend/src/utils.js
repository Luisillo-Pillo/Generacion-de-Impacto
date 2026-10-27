// Iniciales para avatares sin foto: "Ana María López" → "AM".
export const initials = (name) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
