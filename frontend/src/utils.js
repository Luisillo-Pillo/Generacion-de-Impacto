// Iniciales para avatares sin foto: "Ana María López" → "AM".
export const initials = (name) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

// "5512345678" o "551 234 5678" → "551 234 5678" (se queda con los primeros 10 dígitos)
export const formatPhone = (value) => {
  const d = String(value ?? '').replace(/\D/g, '').slice(0, 10);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6)].filter(Boolean).join(' ');
};
