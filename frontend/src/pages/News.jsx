import { useFeed } from '../hooks.js';
import Spinner from '../components/Spinner.jsx';
import NewsCard from '../components/NewsCard.jsx';
import NewItemsBanner from '../components/NewItemsBanner.jsx';
import { usePageMeta } from '../pageMeta.js';

export default function News() {
  usePageMeta({ title: 'Noticias', description: 'Las últimas noticias de la planilla Generación de Impacto del Consejo Estudiantil de la ENSFA.' });
  const { data, error, loading, incoming, showIncoming } = useFeed('/news');
  return (
    <section className="section paper page-min">
      <div className="container">
        <h1 className="title">Noticias</h1>
        <NewItemsBanner count={incoming} singular="noticia nueva" plural="noticias nuevas" onShow={showIncoming} />
        {loading && <Spinner />}
        {error && <p className="error">{error}</p>}
        {data?.length === 0 && <p className="muted">Aún no hay noticias publicadas.</p>}
        <div className="grid">
          {data?.map((n) => <NewsCard key={n._id} n={n} />)}
        </div>
      </div>
    </section>
  );
}
