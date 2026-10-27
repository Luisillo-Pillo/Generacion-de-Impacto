import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const links = [
  ['/', 'Inicio'],
  ['/propuestas', 'Propuestas'],
  ['/noticias', 'Noticias'],
  ['/buzon', 'Buzón'],
  ['/equipo', 'Equipo'],
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const close = () => setOpen(false);

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="brand" onClick={close} aria-label="Generación de Impacto, inicio">
          <img src="/brand/logo-planilla.png" alt="Generación de Impacto" />
        </Link>
        <button className="menu-btn" aria-label="Abrir menú" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span /><span /><span />
        </button>
        <nav className={`nav ${open ? 'open' : ''}`}>
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={close}>
              {label}
            </NavLink>
          ))}
          {user?.role === 'admin' && (
            <NavLink to="/admin" onClick={close}>Panel</NavLink>
          )}
          {!user && (
            <NavLink to="/acceso" onClick={close} className="nav-access">Acceso</NavLink>
          )}
        </nav>
        <img className="ensfa-logo" src="/brand/logo-ensfa.png" alt="Escuela Normal Superior Federal de Aguascalientes" />
      </div>
    </header>
  );
}
