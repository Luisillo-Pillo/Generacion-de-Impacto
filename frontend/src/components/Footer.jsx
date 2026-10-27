import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Footer() {
  const { user, logout } = useAuth();
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <img src="/brand/logo-planilla.png" alt="Generación de Impacto" className="footer-logo" />
        <p className="footer-tagline">NUESTRA VOZ, NUESTRAS IDEAS, NUESTRO IMPACTO.</p>
        <img src="/brand/logo-ensfa.png" alt="ENSFA" className="footer-ensfa" />
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Generación de Impacto · ENSFA “Profr. José Santos Valdés”</span>
        {user ? (
          <button className="link-btn" onClick={logout}>Cerrar sesión ({user.name})</button>
        ) : (
          <Link to="/acceso">Acceso</Link>
        )}
      </div>
    </footer>
  );
}
