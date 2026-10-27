import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import PasswordInput from '../components/PasswordInput.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/admin" replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(form.email, form.password);
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section paper page-min">
      <div className="container narrow">
        <h1 className="title">Acceso <mark>integrantes</mark></h1>
        <p className="lead">Solo para integrantes de la planilla</p>
        <form className="form" onSubmit={submit}>
          <label>Correo
            <input required type="email" value={form.email} onChange={set('email')} autoComplete="email" />
          </label>
          <label>Contraseña
            <PasswordInput required value={form.password} onChange={set('password')} autoComplete="current-password" />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn btn-red" disabled={busy}>{busy ? 'Espera…' : 'Entrar'}</button>
        </form>
      </div>
    </section>
  );
}
