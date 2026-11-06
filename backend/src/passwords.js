import bcrypt from 'bcryptjs';
import { z } from 'zod';

// Política de contraseñas en un solo lugar: alta de integrantes, cambio de contraseña y `npm run create-admin`.
export const BCRYPT_COST = 12;
export const MIN_PASSWORD = 10;
const MAX_PASSWORD = 100;

// Las más usadas (en minúsculas). Con el mínimo de 10 caracteres, las cortas ya no pasan por largo; se dejan por si
// el mínimo cambia. Incluye variantes con el nombre del sitio, que es lo primero que probaría alguien.
const COMMON = new Set([
  '12345678', '123456789', '1234567890', '0123456789', '1234567891', '12345678910', '123456789a', '1q2w3e4r5t',
  'password', 'password1', 'password12', 'password123', 'password1234', 'passw0rd123', 'qwertyuiop', 'qwerty1234',
  'qwerty12345', 'asdfghjkl', 'asdfghjklñ', 'zxcvbnm123', 'iloveyou12', 'abc1234567', 'abcd123456',
  'contraseña', 'contraseña1', 'contraseña12', 'contraseña123', 'contrasena123', 'contrasena1234', 'micontraseña',
  'bienvenido', 'bienvenido1', 'bienvenido123', 'administrador', 'administrador1', 'admin12345', 'admin123456',
  'generacion', 'generacion1', 'generacion123', 'generaciondeimpacto', 'generaciondeimpacto1', 'impacto123', 'impacto1234',
  'ensfa12345', 'ensfa123456', 'normalista1', 'estudiante1', 'consejo123', 'consejoestudiantil',
]);

export const isCommonPassword = (value) => {
  const v = value.toLowerCase();
  return COMMON.has(v) || /^(.)\1+$/.test(v); // también "aaaaaaaaaa"
};

// Esquema de zod para contraseñas NUEVAS. El login no lo usa: las cuentas con contraseñas anteriores siguen entrando.
export const passwordSchema = (message = 'Captura una contraseña') =>
  z
    .string({ error: (issue) => (issue.input === undefined ? message : undefined) })
    .min(MIN_PASSWORD, `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`)
    .max(MAX_PASSWORD, `La contraseña debe tener máximo ${MAX_PASSWORD} caracteres`)
    .refine((v) => !isCommonPassword(v), 'Esa contraseña es muy común. Elige otra más difícil de adivinar');

export const hashPassword = (password) => bcrypt.hash(password, BCRYPT_COST);

// ¿El hash se hizo con un costo menor al actual? Se vuelve a calcular al iniciar sesión, cuando se conoce la contraseña.
export const needsRehash = (hash) => {
  try {
    return bcrypt.getRounds(hash) < BCRYPT_COST;
  } catch {
    return false;
  }
};
