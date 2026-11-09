// «Mis mensajes en este dispositivo»: los códigos de seguimiento que la persona decide recordar se guardan SOLO en su
// navegador (`localStorage`), nunca en el servidor: sin cuenta, sin datos personales y sin poder enlazar un código con
// alguien. Se pierden si borra los datos del navegador o cambia de aparato. Si el almacenamiento no está disponible
// (modo privado, bloqueado), todo sigue funcionando, simplemente no se recuerda nada.
const KEY = 'gi_mis_mensajes';
const MAX = 20; // los más recientes

const valid = (item) => item && typeof item.code === 'string' && /^GI-[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(item.code);

export function listSaved() {
  try {
    const items = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(items) ? items.filter(valid) : [];
  } catch {
    return [];
  }
}

function write(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {
    /* almacenamiento no disponible */
  }
}

export function saveCode({ code, subject }) {
  const rest = listSaved().filter((item) => item.code !== code);
  write([{ code, subject: String(subject ?? '').slice(0, 140), savedAt: new Date().toISOString() }, ...rest]);
}

export function forgetCode(code) {
  write(listSaved().filter((item) => item.code !== code));
}

export function forgetAll() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* almacenamiento no disponible */
  }
}
