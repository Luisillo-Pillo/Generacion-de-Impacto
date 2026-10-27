import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api, fileUrl } from '../api.js';
import { initials } from '../utils.js';
import PasswordInput from '../components/PasswordInput.jsx';

const blank = { currentPassword: '', newPassword: '', confirm: '' };

export default function Profile() {
  const { user, member, loading } = useAuth();
  const [form, setForm] = useState(blank);
  const [status, setStatus] = useState({ busy: false, error: '', ok: false });

  if (loading) return <section className="section paper page-min"><div className="container muted">Cargando…</div></section>;
  if (!user) return <Navigate to="/acceso" replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    if (form.newPassword !== form.confirm) {
      return setStatus({ busy: false, error: 'La confirmación no coincide con la contraseña nueva', ok: false });
    }
    setStatus({ busy: true, error: '', ok: false });
    try {
      await api('/auth/password', { method: 'PATCH', body: { currentPassword: form.currentPassword, newPassword: form.newPassword } });
      setForm(blank);
      setStatus({ busy: false, error: '', ok: true });
    } catch (err) {
      setStatus({ busy: false, error: err.message, ok: false });
    }
  }

  return (
    <section className="section paper page-min">
      <div className="container narrow">
        <h1 className="title">Mi <mark>perfil</mark></h1>

        <article className="card profile">
          {member?.photo ? <img className="profile-photo" src={fileUrl(member.photo)} alt="" /> : <div className="avatar big">{initials(user.name)}</div>}
          <div>
            <h2>{user.name}</h2>
            <p className="muted">{user.email}</p>
            {member?.role && <p className="role">{member.role}</p>}
            {member?.degree && <p className="muted">{member.degree}</p>}
            <span className="tag">Administrador</span>
          </div>
        </article>

        <h2 className="title small">Cambiar <mark>contraseña</mark></h2>
        <form className="form card" onSubmit={submit}>
          <label>Contraseña actual
            <PasswordInput required value={form.currentPassword} onChange={set('currentPassword')} autoComplete="current-password" />
          </label>
          <label>Contraseña nueva
            <PasswordInput required minLength={8} value={form.newPassword} onChange={set('newPassword')} autoComplete="new-password" />
          </label>
          <label>Confirmar contraseña nueva
            <PasswordInput required minLength={8} value={form.confirm} onChange={set('confirm')} autoComplete="new-password" />
          </label>
          {status.error && <p className="error" role="alert">{status.error}</p>}
          {status.ok && <p role="status"><strong>Contraseña actualizada ✔</strong></p>}
          <button className="btn btn-red" disabled={status.busy}>{status.busy ? 'Guardando…' : 'Guardar contraseña'}</button>
        </form>
      </div>
    </section>
  );
}
