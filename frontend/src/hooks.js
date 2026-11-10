import { useEffect, useState } from 'react';
import { api } from './api.js';

// Vuelve a pedir un recurso cada `ms` milisegundos mientras la pestaña esté a la vista (y al volver a verla), para paneles que se
// mantienen al día solos. Devuelve el último resultado (o `null` mientras no llegue) y se calla ante los errores: el siguiente
// intento lo reintenta. Con `enabled` en false no pide nada.
export function usePoll(path, ms, enabled = true) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      api(path).then((d) => { if (!cancelled) setData(d); }).catch(() => {});
    };
    tick();
    const timer = setInterval(tick, ms);
    document.addEventListener('visibilitychange', tick);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [path, ms, enabled]);
  return data;
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
