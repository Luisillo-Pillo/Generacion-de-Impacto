import { useEffect, useState } from 'react';
import { api } from './api.js';

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
