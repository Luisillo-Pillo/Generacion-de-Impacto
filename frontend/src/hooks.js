import { useEffect, useState } from 'react';
import { api } from './api.js';

// Carga un recurso de la API una sola vez por montaje y expone { data, error, loading }.
export function useFetch(path) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  useEffect(() => {
    let cancelled = false;
    setState({ data: null, error: null, loading: true });
    api(path)
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch((error) => !cancelled && setState({ data: null, error: error.message, loading: false }));
    return () => {
      cancelled = true;
    };
  }, [path]);
  return state;
}
