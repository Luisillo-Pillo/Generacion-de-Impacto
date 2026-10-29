import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { fileUrl } from '../api.js';
import { initials } from '../utils.js';
import { useDialog } from './Dialog.jsx';

// Menú desplegable del perfil (solo con sesión iniciada): ver perfil y cerrar sesión con confirmación.
export default function UserMenu() {
  const { user, member, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const { confirm } = useDialog();
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function askLogout() {
    setOpen(false);
    const ok = await confirm({
      title: '¿Cerrar sesión?',
      message: 'Tendrás que iniciar sesión de nuevo para entrar al panel.',
      confirmLabel: 'Cerrar sesión',
    });
    if (!ok) return;
    logout();
    navigate('/');
  }

  return (
    <div className="user-menu" ref={ref}>
      <button className="user-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {member?.photo ? <img src={fileUrl(member.photo)} alt="" /> : <span className="avatar sm">{initials(user.name)}</span>}
        <span className="user-name">{user.name.split(' ')[0]}</span>
        <span className="caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="user-dropdown" role="menu">
          <div className="user-info">
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </div>
          <Link to="/perfil" role="menuitem" onClick={() => setOpen(false)}>Ver perfil</Link>
          <button role="menuitem" onClick={askLogout}>Cerrar sesión</button>
        </div>
      )}
    </div>
  );
}
