import { Link, useParams } from 'react-router-dom';
import { useFetch } from '../hooks.js';
import Spinner from '../components/Spinner.jsx';
import { imgSet, fileUrl, formatDate } from '../api.js';
import MarkdownView from '../components/MarkdownView.jsx';
import { usePageMeta } from '../pageMeta.js';
import './NewsDetail.css';

export default function NewsDetail() {
  const { slug } = useParams();
  const { data: n, error, loading } = useFetch(`/news/${slug}`);
  usePageMeta({ title: n?.title, description: n?.excerpt || n?.body?.replace(/[*_#>[\]()`-]/g, '').slice(0, 160), image: n?.coverImage ? fileUrl(n.coverImage, undefined, { og: true }) : undefined, type: 'article' });

  return (
    <section className="section paper page-min">
      <div className="container narrow">
        <Link to="/noticias" className="back">← Todas las noticias</Link>
        {loading && <Spinner />}
        {error && <p className="error">{error}</p>}
        {n && (
          <article className="article">
            <time>{formatDate(n.publishedAt || n.createdAt)}{n.author ? ` · ${n.author}` : ''}</time>
            <h1 className="title">{n.title}</h1>
            {n.coverImage && <img className="article-cover" {...imgSet(n.coverImage, '(max-width: 800px) 100vw, 800px')} alt={n.title} />}
            <MarkdownView>{n.body}</MarkdownView>
            {n.gallery?.length > 0 && (
              <ul className="article-gallery" aria-label="Más imágenes">
                {n.gallery.map((id) => (
                  <li key={id}>
                    <a href={fileUrl(id)} target="_blank" rel="noopener noreferrer"><img {...imgSet(id, '(max-width: 600px) 50vw, 250px')} alt="" loading="lazy" /></a>
                  </li>
                ))}
              </ul>
            )}
          </article>
        )}
      </div>
    </section>
  );
}
