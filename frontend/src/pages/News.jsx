import { useFetch } from '../hooks.js';
import NewsCard from '../components/NewsCard.jsx';

export default function News() {
  const { data, error, loading } = useFetch('/news');
  return (
    <section className="section paper page-min">
      <div className="container">
        <h1 className="title">Noticias</h1>
        {loading && <p className="muted">Cargando…</p>}
        {error && <p className="error">{error}</p>}
        {data?.length === 0 && <p className="muted">Aún no hay noticias publicadas.</p>}
        <div className="grid">
          {data?.map((n) => <NewsCard key={n._id} n={n} />)}
        </div>
      </div>
    </section>
  );
}
