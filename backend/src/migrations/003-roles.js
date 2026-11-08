// Convierte los roles que ya no existen en `miembro`: `presidente` y el `moderador` de antes (el que solo leía mensajes sin
// datos de contacto). Hoy `moderador` es el nombre que se ve del rol `admin` (puede todo), que NO se toca: las cuentas de
// siempre conservan todo. Se puede ejecutar varias veces. Mientras no corra, el servidor ya trata esos valores como `miembro`.
import { User } from '../models.js';

export const name = '003-roles';

export async function run() {
  const res = await User.updateMany({ role: { $in: ['presidente', 'moderador'] } }, { $set: { role: 'miembro' } });
  return `${res.modifiedCount} cuenta(s) pasaron a Miembro`;
}
