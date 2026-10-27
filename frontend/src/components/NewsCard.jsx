import { Link } from 'react-router-dom';
import { fileUrl, formatDate } from '../api.js';

export default function NewsCard({ n }) {
  return (
    <Link to={`/noticias/${n.slug}`} className="news-card">
      <div className="news-cover">
        {n.coverImage ? (
          <img src={fileUrl(n.coverImage)} alt="" loading="lazy" />
        ) : (
          <img className="news-placeholder" src="/brand/logo-planilla.png" alt="" />
        )}
      </div>
      <div className="news-card-body">
        <time>{formatDate(n.publishedAt || n.createdAt)}</time>
        <h3>{n.title}</h3>
        {n.excerpt && <p>{n.excerpt}</p>}
        <span className="more">Leer más →</span>
      </div>
    </Link>
  );
}
