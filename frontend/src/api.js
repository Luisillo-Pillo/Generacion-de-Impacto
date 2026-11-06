const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export const fileUrl = (id) => (id ? `${BASE}/api/files/${id}` : null);

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

export async function api(path, { method = 'GET', body, form } = {}) {
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ocurrió un error');
  return data;
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
