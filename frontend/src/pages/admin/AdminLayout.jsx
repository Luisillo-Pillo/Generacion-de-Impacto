import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth.jsx';
import Spinner from '../../components/Spinner.jsx';
import './AdminLayout.css';

const TABS = [
  ['mensajes', 'Mensajes'],
  ['noticias', 'Noticias'],
  ['propuestas', 'Propuestas'],
  ['equipo', 'Equipo'],
  ['ajustes', 'Ajustes'],
  ['actividad', 'Actividad'],
];

// Estructura común del panel: título, navegación por secciones (cada una con su URL) y la página activa
export default function AdminLayout() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();

  if (loading) return <section className="section paper page-min"><div className="container"><Spinner /></div></section>;
  if (!user) return <Navigate to="/acceso" replace />;
  const moderator = user.role === 'moderador';
  if (user.role !== 'admin' && !moderator) {
    return (
      <section className="section paper page-min">
        <div className="container narrow">
          <h1 className="title">Sin <mark>acceso</mark></h1>
          <p className="lead">Tu cuenta no tiene permisos para el panel. Pide a un administrador que te los asigne.</p>
        </div>
      </section>
    );
  }

  // Un moderador solo trabaja con los mensajes: cualquier otra sección lo regresa a ellos
  if (moderator && pathname !== '/admin/mensajes') return <Navigate to="/admin/mensajes" replace />;
  const tabs = moderator ? TABS.filter(([path]) => path === 'mensajes') : TABS;

  return (
    <section className="section paper page-min">
      <div className="container">
        <h1 className="title">Panel de <mark>administración</mark></h1>
        <nav className="tabs" aria-label="Secciones del panel">
          {tabs.map(([path, label]) => <NavLink key={path} to={`/admin/${path}`}>{label}</NavLink>)}
        </nav>
        <Outlet />
      </div>
    </section>
  );
}
