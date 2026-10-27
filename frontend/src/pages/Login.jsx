import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const u = mode === 'login' ? await login(form.email, form.password) : await register(form.name, form.email, form.password);
      navigate(u.role === 'admin' ? '/admin' : '/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section paper page-min">
      <div className="container narrow">
        <h1 className="title">{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h1>
        <form className="form" onSubmit={submit}>
          {mode === 'register' && (
            <label>Nombre
              <input required value={form.name} onChange={set('name')} maxLength={80} autoComplete="name" />
            </label>
          )}
          <label>Correo
            <input required type="email" value={form.email} onChange={set('email')} autoComplete="email" />
          </label>
          <label>Contraseña
            <input required type="password" minLength={mode === 'register' ? 8 : undefined} value={form.password} onChange={set('password')}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn btn-red" disabled={busy}>{busy ? 'Espera…' : mode === 'login' ? 'Entrar' : 'Registrarme'}</button>
          <button type="button" className="link-btn" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
            {mode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
        </form>
      </div>
    </section>
  );
}
