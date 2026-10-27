import { Link, useParams } from 'react-router-dom';
import { useFetch } from '../hooks.js';
import { fileUrl, formatDate } from '../api.js';

export default function NewsDetail() {
  const { slug } = useParams();
  const { data: n, error, loading } = useFetch(`/news/${slug}`);

  return (
    <section className="section paper page-min">
      <div className="container narrow">
        <Link to="/noticias" className="back">← Todas las noticias</Link>
        {loading && <p className="muted">Cargando…</p>}
        {error && <p className="error">{error}</p>}
        {n && (
          <article className="article">
            <time>{formatDate(n.publishedAt || n.createdAt)}{n.author ? ` · ${n.author}` : ''}</time>
            <h1 className="title">{n.title}</h1>
            {n.coverImage && <img className="article-cover" src={fileUrl(n.coverImage)} alt="" />}
            {n.body.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
          </article>
        )}
      </div>
    </section>
  );
}
