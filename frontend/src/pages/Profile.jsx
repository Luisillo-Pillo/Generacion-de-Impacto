import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api, fileUrl, setToken } from '../api.js';
import { useDialog } from '../components/Dialog.jsx';
import { initials } from '../utils.js';
import PasswordInput from '../components/PasswordInput.jsx';
import Spinner from '../components/Spinner.jsx';
import { ImageField, text } from './admin/shared.jsx';
import { ROLE_LABEL, ROLE_HELP } from '../roles.js';
import './Profile.css';

const blank = { currentPassword: '', newPassword: '', confirm: '' };

// Cada persona edita su propia información; el correo y el rol los cambia un Moderador
function MyInfo({ member, onSaved }) {
  const [form, setForm] = useState({ name: member.name ?? '', role: member.role ?? '', degree: member.degree ?? '', photo: member.photo ?? null });
  const [status, setStatus] = useState({ busy: false, error: '', ok: false });
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  async function save(e) {
    e.preventDefault();
    setStatus({ busy: true, error: '', ok: false });
    try {
      await api('/members/me', { method: 'PUT', body: form });
      await onSaved();
      setStatus({ busy: false, error: '', ok: true });
    } catch (err) {
      setStatus({ busy: false, error: err.message, ok: false });
    }
  }
  return (
    <>
      <h2 className="title small">Mi <mark>información</mark></h2>
      <form className="form card" onSubmit={save}>
        {text('Nombre', form.name, set('name'), { required: true, minLength: 2, maxLength: 100 })}
        {text('Cargo', form.role, set('role'), { maxLength: 100 })}
        {text('Licenciatura', form.degree, set('degree'), { maxLength: 120 })}
        <ImageField label="Foto" value={form.photo} onChange={set('photo')} />
        {status.error && <p className="error" role="alert">{status.error}</p>}
        {status.ok && <p role="status"><strong>Información actualizada ✔</strong></p>}
        <button className="btn btn-red" disabled={status.busy}>{status.busy ? <><Spinner inline /> Guardando…</> : 'Guardar mi información'}</button>
      </form>
    </>
  );
}

export default function Profile() {
  const { user, member, loading, refresh } = useAuth();
  const { confirm, notify } = useDialog();
  const [form, setForm] = useState(blank);
  const [status, setStatus] = useState({ busy: false, error: '', ok: false });

  if (loading) return <section className="section paper page-min"><div className="container"><Spinner /></div></section>;
  if (!user) return <Navigate to="/acceso" replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    if (form.newPassword !== form.confirm) {
      return setStatus({ busy: false, error: 'La confirmación no coincide con la contraseña nueva', ok: false });
    }
    setStatus({ busy: true, error: '', ok: false });
    try {
      const d = await api('/auth/password', { method: 'PATCH', body: { currentPassword: form.currentPassword, newPassword: form.newPassword } });
      setToken(d.token); // cambiar la contraseña cierra las demás sesiones; esta sigue con un token nuevo
      setForm(blank);
      setStatus({ busy: false, error: '', ok: true });
    } catch (err) {
      setStatus({ busy: false, error: err.message, ok: false });
    }
  }

  async function logoutEverywhere() {
    const ok = await confirm({
      title: '¿Cerrar sesión en todos los dispositivos?',
      message: 'Se cerrará tu sesión en tus demás computadoras y teléfonos. En este dispositivo seguirás con sesión.',
      confirmLabel: 'Cerrar en los demás',
    });
    if (!ok) return;
    try {
      const d = await api('/auth/logout-all', { method: 'POST' });
      setToken(d.token);
      await notify({ title: 'Listo', message: 'Se cerró la sesión en tus demás dispositivos.' });
    } catch (err) {
      await notify({ title: 'No se pudo cerrar las sesiones', message: err.message });
    }
  }

  return (
    <section className="section paper page-min">
      <div className="container narrow">
        <h1 className="title">Mi <mark>perfil</mark></h1>

        <article className="card profile">
          {member?.photo ? <img className="profile-photo" src={fileUrl(member.photo, 640)} alt="" /> : <div className="avatar big">{initials(user.name)}</div>}
          <div>
            <h2>{user.name}</h2>
            <p className="muted">{user.email}</p>
            {member?.role && <p className="role">{member.role}</p>}
            {member?.degree && <p className="muted">{member.degree}</p>}
            <span className="tag" title={ROLE_HELP[user.role]}>{ROLE_LABEL[user.role] ?? 'Sin rol'}</span>
          </div>
        </article>

        {member && <MyInfo key={member._id} member={member} onSaved={refresh} />}

        <h2 className="title small">Cambiar <mark>contraseña</mark></h2>
        <form className="form card" onSubmit={submit}>
          <label>Contraseña actual
            <PasswordInput required value={form.currentPassword} onChange={set('currentPassword')} autoComplete="current-password" />
          </label>
          <label>Contraseña nueva (mínimo 10 caracteres)
            <PasswordInput required minLength={10} value={form.newPassword} onChange={set('newPassword')} autoComplete="new-password" />
          </label>
          <label>Confirmar contraseña nueva
            <PasswordInput required minLength={10} value={form.confirm} onChange={set('confirm')} autoComplete="new-password" />
          </label>
          {status.error && <p className="error" role="alert">{status.error}</p>}
          {status.ok && <p role="status"><strong>Contraseña actualizada ✔</strong></p>}
          <button className="btn btn-red" disabled={status.busy}>{status.busy ? <><Spinner inline /> Guardando…</> : 'Guardar contraseña'}</button>
        </form>

        <h2 className="title small">Mis <mark>sesiones</mark></h2>
        <div className="card">
          <p>Tu sesión se renueva sola mientras usas el panel y termina tras 12 horas sin actividad. Si usaste tu cuenta en una computadora ajena, ciérrala en todos lados.</p>
          <button type="button" className="btn btn-dark" onClick={logoutEverywhere}>Cerrar sesión en todos los dispositivos</button>
        </div>
      </div>
    </section>
  );
}
