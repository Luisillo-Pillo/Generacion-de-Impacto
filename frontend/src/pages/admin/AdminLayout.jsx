import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../auth.jsx';

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

  if (loading) return <section className="section paper page-min"><div className="container muted">Cargando…</div></section>;
  if (!user) return <Navigate to="/acceso" replace />;
  if (user.role !== 'admin') {
    return (
      <section className="section paper page-min">
        <div className="container narrow">
          <h1 className="title">Sin <mark>acceso</mark></h1>
          <p className="lead">Tu cuenta no tiene rol de administrador. Pide a un administrador que te lo asigne.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="section paper page-min">
      <div className="container">
        <h1 className="title">Panel de <mark>administración</mark></h1>
        <nav className="tabs" aria-label="Secciones del panel">
          {TABS.map(([path, label]) => <NavLink key={path} to={`/admin/${path}`}>{label}</NavLink>)}
        </nav>
        <Outlet />
      </div>
    </section>
  );
}
