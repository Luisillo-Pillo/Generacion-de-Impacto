import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { text } from './shared.jsx';

export default function AdminSettings() {
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => { api('/settings').then(setS).catch((e) => setMsg(e.message)); }, []);
  if (!s) return <p className="muted">{msg || 'Cargando…'}</p>;

  const lines = (key, label) => (
    <label>{label} (uno por línea)
      <textarea rows={6} value={s[key].join('\n')} onChange={(e) => setS({ ...s, [key]: e.target.value.split('\n') })} />
    </label>
  );
  const social = (key, label) => text(label, s.social[key], (v) => setS({ ...s, social: { ...s.social, [key]: v } }), { placeholder: key === 'email' ? 'correo@ejemplo.com' : 'https://…' });

  const toggleGroupDegree = (degree, on) =>
    setS({ ...s, groupDegrees: on ? [...s.groupDegrees, degree] : s.groupDegrees.filter((d) => d !== degree) });

  async function save(e) {
    e.preventDefault();
    setMsg('Guardando…');
    try {
      for (const key of ['degrees', 'groups', 'semesters']) {
        await api(`/settings/${key}`, { method: 'PUT', body: { value: s[key].map((v) => v.trim()).filter(Boolean) } });
      }
      const degrees = s.degrees.map((v) => v.trim()).filter(Boolean);
      await api('/settings/groupDegrees', { method: 'PUT', body: { value: s.groupDegrees.filter((d) => degrees.includes(d)) } });
      await api('/settings/social', { method: 'PUT', body: { value: s.social } });
      setMsg('Guardado ✔');
    } catch (err) {
      setMsg(err.message);
    }
  }

  return (
    <form className="form card" onSubmit={save}>
      <p className="hint">Estas listas alimentan el formulario del buzón digital.</p>
      {lines('degrees', 'Licenciaturas')}
      <fieldset>
        <legend>Licenciaturas con varios grupos</legend>
        <p className="hint">Solo quienes elijan una de estas licenciaturas podrán seleccionar grupo en el buzón.</p>
        {s.degrees.map((d) => d.trim()).filter(Boolean).map((d) => (
          <label key={d} className="check">
            <input type="checkbox" checked={s.groupDegrees.includes(d)} onChange={(e) => toggleGroupDegree(d, e.target.checked)} /> {d}
          </label>
        ))}
      </fieldset>
      {lines('semesters', 'Semestres')}
      {lines('groups', 'Grupos (para las licenciaturas con varios grupos)')}
      <h3>Redes y contacto</h3>
      {social('instagram', 'Instagram (URL)')}
      {social('facebook', 'Facebook (URL)')}
      {social('tiktok', 'TikTok (URL)')}
      {social('email', 'Correo de contacto')}
      <div className="row"><button className="btn btn-red">Guardar ajustes</button><span>{msg}</span></div>
    </form>
  );
}
