import crypto from 'node:crypto';

// Código de seguimiento: 10 caracteres de un alfabeto de 32 sin símbolos que se confunden (0/O, 1/I), o sea 50 bits
// de aleatoriedad, con el formato GI-XXXXX-XXXXX. En la base solo se guarda su hash SHA-256: ni quien tenga acceso a la
// base puede enlazar un código con una persona, y el mensaje anónimo sigue sin datos personales.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const LENGTH = 10;

export function newCode() {
  // 256 es múltiplo de 32: cada letra del alfabeto es igual de probable
  const body = [...crypto.randomBytes(LENGTH)].map((b) => ALPHABET[b % ALPHABET.length]).join('');
  return `GI-${body.slice(0, 5)}-${body.slice(5)}`;
}

// Acepta el código con o sin guiones, en mayúsculas o minúsculas y con espacios sobrantes. Devuelve los 10 caracteres
// o null si no tiene la forma de un código.
export function normalizeCode(input) {
  let clean = String(input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length === LENGTH + 2 && clean.startsWith('GI')) clean = clean.slice(2);
  return clean.length === LENGTH && [...clean].every((c) => ALPHABET.includes(c)) ? clean : null;
}

export function hashCode(input) {
  const body = normalizeCode(input);
  return body ? crypto.createHash('sha256').update(body).digest('hex') : null;
}
