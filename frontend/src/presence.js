import { api, sendOffline } from './api.js';

// Presencia: mientras haya una sesión iniciada, esta pestaña le avisa al servidor cada minuto que sigue conectada (latido) y al
// cerrarla le avisa que se fue. Así el Moderador ve en Panel → Equipo quién está conectado ahora.
// Si hay varias pestañas abiertas, cada una se anota en localStorage (`gi_tab_*`): al cerrar una, solo se avisa de la salida
// cuando no queda otra pestaña viva (si no, la cuenta aparecería desconectada hasta el siguiente latido de la otra).
export const BEAT_MS = 60 * 1000;
const TAB_PREFIX = 'gi_tab_';
const ALIVE_MS = BEAT_MS * 2.5;

const store = {
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* almacenamiento bloqueado */ } },
  remove: (k) => { try { localStorage.removeItem(k); } catch { /* almacenamiento bloqueado */ } },
  keys: () => { try { return Object.keys(localStorage); } catch { return []; } },
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
};

function otherTabAlive(ownKey) {
  return store.keys().some((k) => k.startsWith(TAB_PREFIX) && k !== ownKey && Date.now() - Number(store.get(k)) < ALIVE_MS);
}

// Empieza a mandar latidos; devuelve la función que los detiene (sin avisar de salida: eso lo hace el cierre de sesión o de pestaña)
export function startPresence() {
  const key = TAB_PREFIX + Math.random().toString(36).slice(2);
  const beat = () => {
    store.set(key, String(Date.now()));
    api('/auth/ping', { method: 'POST' }).catch(() => {}); // sin red o servidor dormido: el siguiente latido lo reintenta
  };
  const onVisible = () => { if (document.visibilityState === 'visible') beat(); };
  const onHide = () => {
    store.remove(key);
    if (!otherTabAlive(key)) sendOffline();
  };
  beat();
  const timer = setInterval(beat, BEAT_MS);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('pagehide', onHide);
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('pagehide', onHide);
    store.remove(key);
  };
}
