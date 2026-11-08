import { useCallback, useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import Spinner from '../../components/Spinner.jsx';
import { SECTIONS_BY_ROLE } from '../../roles.js';
import './AdminLayout.css';

const TABS = [
  ['mensajes', 'Mensajes'],
  ['noticias', 'Noticias'],
  ['propuestas', 'Propuestas'],
  ['equipo', 'Equipo'],
  ['ajustes', 'Ajustes'],
];

// Estructura común del panel: título, navegación por secciones (cada una con su URL) y la página activa
export default function AdminLayout() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const [stats, setStats] = useState(null); // contadores de mensajes (insignia de la pestaña y resumen de la lista)
  const staff = user?.role in SECTIONS_BY_ROLE; // Miembro o Moderador: ambos leen mensajes
  const refreshStats = useCallback(() => api('/messages/stats').then(setStats).catch(() => {}), []);
  useEffect(() => {
    if (staff) refreshStats();
  }, [staff, refreshStats, pathname]);

  if (loading) return <section className="section paper page-min"><div className="container"><Spinner /></div></section>;
  if (!user) return <Navigate to="/acceso" replace />;
  const sections = SECTIONS_BY_ROLE[user.role];
  if (!sections) {
    return (
      <section className="section paper page-min">
        <div className="container narrow">
          <h1 className="title">Sin <mark>acceso</mark></h1>
          <p className="lead">Tu cuenta no tiene permisos para el panel. Pide a un Moderador que te asigne un rol.</p>
        </div>
      </section>
    );
  }

  // Cada rol ve solo sus secciones (ver roles.js): cualquier otra lo regresa a la primera que le corresponde
  const section = pathname.split('/')[2];
  if (!sections.includes(section)) return <Navigate to={`/admin/${sections[0]}`} replace />;
  const tabs = TABS.filter(([path]) => sections.includes(path));

  return (
    <section className="section paper page-min">
      <div className="container">
        <h1 className="title">Panel de <mark>administración</mark></h1>
        <nav className="tabs" aria-label="Secciones del panel">
          {tabs.map(([path, label]) => (
            <NavLink key={path} to={`/admin/${path}`}>
              {label}
              {path === 'mensajes' && stats?.nuevos > 0 && <span className="count" aria-label={`${stats.nuevos} nuevos`}>{stats.nuevos}</span>}
            </NavLink>
          ))}
        </nav>
        <Outlet context={{ stats, refreshStats }} />
      </div>
    </section>
  );
}
