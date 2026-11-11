import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { isLive, subscribe } from './live.js';

// ---------------- Panel: eventos en vivo ----------------

const FALLBACK_MS = 30 * 1000;
const BURST_MS = 250;

// Mantiene al día una pantalla del panel: llama a `refresh` cuando el servidor avisa que cambió alguno de los `topics` (juntando los
// avisos seguidos en una sola llamada), cada vez que el canal en vivo se (re)conecta y, mientras el canal no esté disponible (servidor
// dormido, sin red), cada 30 s con la pestaña a la vista. Con `enabled` en false no hace nada.
export function useLive(topics, refresh, enabled = true) {
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  });
  const key = topics.join(',');
  useEffect(() => {
    if (!enabled) return undefined;
    let burst;
    const fire = () => {
      clearTimeout(burst);
      burst = setTimeout(() => latest.current(), BURST_MS);
    };
    const off = subscribe(key.split(','), fire);
    const visible = () => document.visibilityState === 'visible';
    const fallback = setInterval(() => { if (!isLive() && visible()) latest.current(); }, FALLBACK_MS);
    const onVisible = () => { if (visible() && !isLive()) latest.current(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      off();
      clearTimeout(burst);
      clearInterval(fallback);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [key, enabled]);
}

// ---------------- Sitio público: refresco ligero ----------------

const FEED_MS = 60 * 1000;
const IDLE_MS = 10 * 60 * 1000;

// Llama a `tick` cada ~`ms` (con un poco de variación, para que los visitantes no pidan todos a la vez) solo con la pestaña a la
// vista y mientras la persona esté activa: tras 10 minutos sin tocar la página se detiene y se reanuda con la siguiente actividad.
// Al volver a ver la pestaña pide enseguida si ya pasó un buen rato. Devuelve la función que lo detiene.
export function startPolling(tick, ms = FEED_MS) {
  const visible = () => document.visibilityState === 'visible';
  let timer;
  let stopped = false;
  let idle = false;
  let lastActive = Date.now();
  let lastTick = Date.now();
  const run = () => {
    if (stopped) return;
    if (Date.now() - lastActive > IDLE_MS) {
      idle = true; // sin reprogramar: la próxima actividad lo reanuda
      return;
    }
    if (visible()) {
      lastTick = Date.now();
      tick();
    }
    schedule();
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(run, ms * (0.9 + Math.random() * 0.2));
  };
  const onActivity = () => {
    lastActive = Date.now();
    if (!idle) return;
    idle = false;
    if (visible()) {
      lastTick = Date.now();
      tick();
    }
    schedule();
  };
  const onVisible = () => {
    if (!visible() || idle || Date.now() - lastTick < ms / 2) return;
    lastTick = Date.now();
    tick();
  };
  schedule();
  const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
  events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    stopped = true;
    clearTimeout(timer);
    events.forEach((e) => window.removeEventListener(e, onActivity));
    document.removeEventListener('visibilitychange', onVisible);
  };
}

// Junta la lista que ya se ve con la última que llegó, sin mover nada de lo que la persona está leyendo: lo que ya estaba se
// actualiza en su lugar (ediciones) o desaparece (eliminado); lo nuevo NO se inserta, solo se cuenta (`incoming`) hasta que
// la persona lo pida. Si nada cambió devuelve el mismo estado (sin volver a dibujar).
function mergeFeed(cur, next) {
  if (!cur.shown) return { shown: next, incoming: 0, error: null };
  const byId = new Map(next.map((item) => [item._id, item]));
  const shown = cur.shown.filter((item) => byId.has(item._id)).map((item) => byId.get(item._id));
  const known = new Set(cur.shown.map((item) => item._id));
  const incoming = next.filter((item) => !known.has(item._id)).length;
  if (incoming === cur.incoming && !cur.error && JSON.stringify(shown) === JSON.stringify(cur.shown)) return cur;
  return { shown, incoming, error: null };
}

// Lista pública (noticias, propuestas, equipo) que se mantiene al día sola cada minuto y SIN saltos: ver `mergeFeed`.
// Devuelve { data, error, loading, incoming, showIncoming }; `showIncoming` suma lo nuevo a la lista (lo llama el botón «Ver»).
// Los errores del refresco se callan (el siguiente intento lo reintenta); solo el primero se muestra. La ruta debe ser fija.
export function useFeed(path) {
  const [state, setState] = useState({ shown: null, incoming: 0, error: null });
  const latest = useRef(null);
  useEffect(() => {
    let cancelled = false;
    const load = (first) =>
      api(path)
        .then((next) => {
          if (cancelled) return;
          latest.current = next;
          setState((cur) => mergeFeed(cur, next));
        })
        .catch((err) => {
          if (first && !cancelled) setState({ shown: null, incoming: 0, error: err.message });
        });
    load(true);
    const stop = startPolling(() => load(false));
    return () => {
      cancelled = true;
      stop();
    };
  }, [path]);
  const showIncoming = useCallback(() => setState((cur) => ({ shown: latest.current ?? cur.shown, incoming: 0, error: null })), []);
  return { data: state.shown, error: state.error, loading: state.shown === null && !state.error, incoming: state.incoming, showIncoming };
}

// Carga un recurso de la API y expone { data, error, loading }.
// El resultado guarda la ruta que lo originó: si la ruta cambia, `loading` vuelve a ser true
// sin necesidad de reiniciar el estado dentro del efecto.
export function useFetch(path) {
  const [result, setResult] = useState({ path: null, data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    api(path)
      .then((data) => !cancelled && setResult({ path, data, error: null }))
      .catch((err) => !cancelled && setResult({ path, data: null, error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [path]);

  const ready = result.path === path;
  return { data: ready ? result.data : null, error: ready ? result.error : null, loading: !ready };
}
