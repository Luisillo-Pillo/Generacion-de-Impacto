const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

// `w` pide la versión reducida (640 o 1280 px, en WebP); sin él, la imagen original.
// `{ og: true }` pide el JPEG de 1200 × 630 para la vista previa al compartir (la URL es absoluta si VITE_API_URL lo es).
export const fileUrl = (id, w, { og = false } = {}) => (id ? `${BASE}/api/files/${id}${og ? '?og=1' : w ? `?w=${w}` : ''}` : null);

// Atributos de <img> para las imágenes públicas: el navegador elige la versión de 640 o de 1280 px según el espacio
// que ocupa (`sizes`) y la densidad de la pantalla, en vez de bajar siempre la original (de hasta 5 MB).
export const imgSet = (id, sizes) =>
  id ? { src: fileUrl(id, 1280), srcSet: `${fileUrl(id, 640)} 640w, ${fileUrl(id, 1280)} 1280w`, sizes } : {};

const TOKEN_KEY = 'gi_token';
export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
export const setToken = (t) => {
  try {
    t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* almacenamiento no disponible */
  }
};

// Se emite cuando el servidor rechaza la sesión (token vencido, contraseña cambiada o sesión cerrada en otro dispositivo).
export const SESSION_EXPIRED = 'gi:session-expired';

// `blob: true` devuelve el archivo (para imágenes privadas, que exigen la cabecera de sesión y no pueden ir en un <img src>).
export async function api(path, { method = 'GET', body, form, blob = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, { method, headers, body: payload });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Inténtalo de nuevo.');
  }
  // El servidor renueva el token mientras se usa el panel y lo manda en una cabecera
  const renewed = res.headers.get('X-Renewed-Token');
  if (renewed && getToken() === token) setToken(renewed);
  // Un 401 con sesión iniciada (y que no sea el propio intento de login) significa que la sesión ya no vale. Solo si el
  // token sigue siendo el mismo con el que se hizo la petición: otra petición pudo haberlo cambiado entre tanto.
  if (res.status === 401 && token && path !== '/auth/login' && getToken() === token) {
    setToken(null);
    window.dispatchEvent(new Event(SESSION_EXPIRED));
  }
  if (res.status === 204) return null;
  if (blob && res.ok) return res.blob();
  const data = await res.json().catch(() => ({}));
  // En un error del servidor se añade el id de la petición: con él se encuentra el fallo en los registros
  if (!res.ok) throw new Error(`${data.error || 'Ocurrió un error'}${res.status >= 500 && data.requestId ? ` (id del error: ${data.requestId.slice(0, 8)})` : ''}`);
  return data;
}

// Avisa que esta sesión se desconecta (cerrar sesión o cerrar la pestaña). `keepalive` hace que la petición termine aunque la
// página se esté cerrando; si no llega, el servidor igual da por desconectada la cuenta a los pocos minutos sin latidos.
export function sendOffline() {
  const token = getToken();
  if (!token) return;
  try {
    fetch(`${BASE}/api/auth/offline`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, keepalive: true }).catch(() => {});
  } catch {
    /* sin red: el servidor la desconecta por tiempo */
  }
}

export async function uploadImage(file) {
  const form = new FormData();
  form.append('file', file);
  return api('/files', { method: 'POST', form }); // { id, url }
}

export const formatDate = (d) =>
  new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

// "2:35 p. m." en la hora local de quien consulta
export const formatTime = (d) =>
  new Date(d).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true });
