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

  async function save(e) {
    e.preventDefault();
    setMsg('Guardando…');
    try {
      for (const key of ['degrees', 'groups', 'semesters']) {
        await api(`/settings/${key}`, { method: 'PUT', body: { value: s[key].map((v) => v.trim()).filter(Boolean) } });
      }
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
      {lines('semesters', 'Semestres')}
      {lines('groups', 'Grupos')}
      <h3>Redes y contacto</h3>
      {social('instagram', 'Instagram (URL)')}
      {social('facebook', 'Facebook (URL)')}
      {social('tiktok', 'TikTok (URL)')}
      {social('email', 'Correo de contacto')}
      <div className="row"><button className="btn btn-red">Guardar ajustes</button><span>{msg}</span></div>
    </form>
  );
}
