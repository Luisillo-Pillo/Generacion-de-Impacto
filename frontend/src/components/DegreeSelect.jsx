import { useFetch } from '../hooks.js';

// Menú desplegable de licenciaturas con las que se definen en Panel → Ajustes (las mismas del buzón). Si la persona ya tenía
// una que después se quitó de Ajustes, se conserva como opción para no perderla sin querer al guardar.
export default function DegreeSelect({ value, onChange, label = 'Licenciatura', required = false }) {
  const { data: settings, loading } = useFetch('/settings');
  const degrees = settings?.degrees ?? [];
  const removed = !loading && value && !degrees.includes(value);
  return (
    <label>{label}
      <select value={value ?? ''} required={required} onChange={(e) => onChange(e.target.value)}>
        <option value="">{loading ? 'Cargando…' : required ? 'Selecciona…' : 'Sin especificar'}</option>
        {degrees.map((d) => <option key={d} value={d}>{d}</option>)}
        {removed && <option value={value}>{value} (ya no está en Ajustes)</option>}
      </select>
    </label>
  );
}
