import { useFetch } from '../hooks.js';
import './AcademicFields.css';

// Menú desplegable con las opciones de Ajustes. Si la persona ya tenía un valor que después se quitó de Ajustes, se conserva
// como opción para no perderlo sin querer al guardar.
function Menu({ label, value, options, loading, placeholder, disabled = false, onChange }) {
  const removed = !loading && value && !options.includes(value);
  return (
    <label>{label}
      <select value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        <option value="">{loading ? 'Cargando…' : placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
        {removed && <option value={value}>{value} (ya no está en Ajustes)</option>}
      </select>
    </label>
  );
}

// Licenciatura, semestre y grupo con las opciones de Panel → Ajustes (las mismas del buzón). El grupo solo se elige en las
// licenciaturas con varios grupos (`groupDegrees`); en las demás el menú queda deshabilitado en «No aplica» y se vacía.
// `onChange(campo, valor)` recibe 'degree', 'semester' o 'group'.
export default function AcademicFields({ degree, semester, group, onChange }) {
  const { data: settings, loading } = useFetch('/settings');
  const hasGroups = !!settings?.groupDegrees?.includes(degree);

  return (
    <>
      <Menu
        label="Licenciatura" value={degree} options={settings?.degrees ?? []} loading={loading} placeholder="Sin especificar"
        onChange={(v) => {
          onChange('degree', v);
          if (group) onChange('group', ''); // el grupo depende de la licenciatura
        }}
      />
      <div className="academic-row">
        <Menu label="Semestre" value={semester} options={settings?.semesters ?? []} loading={loading} placeholder="Sin especificar" onChange={(v) => onChange('semester', v)} />
        <Menu
          label={hasGroups ? 'Grupo' : 'Grupo (si aplica)'} value={hasGroups ? group : ''} options={settings?.groups ?? []} loading={loading}
          placeholder={hasGroups ? 'Sin especificar' : 'No aplica'} disabled={!hasGroups} onChange={(v) => onChange('group', v)}
        />
      </div>
    </>
  );
}
