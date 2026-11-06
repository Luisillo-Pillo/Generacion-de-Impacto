import { useState } from 'react';
import { formatDate, formatTime } from '../../api.js';
import Spinner from '../../components/Spinner.jsx';
import { useList } from './shared.jsx';
import './AdminActivity.css';

// Bitácora de acciones del panel (solo lectura): quién hizo qué y cuándo. Nunca muestra el contenido de los mensajes.
export default function AdminActivity() {
  const [page, setPage] = useState(1);
  const { items: data, loading, error } = useList(`/audit?page=${page}`);

  return (
    <div>
      <p className="muted">Registro de lo que se hace en el panel. Se conserva un año. No incluye el contenido de los mensajes.</p>
      {error && <p className="error">{error}</p>}
      {loading && <Spinner />}
      {data?.items.length === 0 && <p className="muted">Todavía no hay actividad registrada.</p>}
      {data?.items.map((a) => (
        <article key={a._id} className="card activity-row">
          <div>
            <strong>{a.summary || a.action}</strong>
            <br />
            <span className="muted">{a.userName || 'Sistema'}</span>
          </div>
          <span className="muted activity-when">{formatDate(a.at)} · {formatTime(a.at)}</span>
        </article>
      ))}
      {data && data.pages > 1 && (
        <nav className="row activity-pager" aria-label="Páginas de la actividad">
          <button className="btn btn-dark sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Más recientes</button>
          <span className="muted">Página {data.page} de {data.pages}</span>
          <button className="btn btn-dark sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Más antiguas →</button>
        </nav>
      )}
    </div>
  );
}
