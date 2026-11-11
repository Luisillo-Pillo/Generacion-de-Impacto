import { useState } from 'react';
import { useFeed } from '../hooks.js';
import { PROGRESS_LABEL } from '../progress.js';
import './Proposals.css';
import Spinner from '../components/Spinner.jsx';
import ProposalCard from '../components/ProposalCard.jsx';
import NewItemsBanner from '../components/NewItemsBanner.jsx';
import { usePageMeta } from '../pageMeta.js';

export default function Proposals() {
  usePageMeta({ title: 'Propuestas', description: 'Acciones concretas de la planilla Generación de Impacto para una ENSFA más unida, participativa y solidaria.' });
  const { data, error, loading, incoming, showIncoming } = useFeed('/proposals');
  const [progress, setProgress] = useState('');
  const shown = data?.filter((p) => !progress || (p.progress ?? 'planeada') === progress);
  return (
    <section className="section dark page-min">
      <div className="container">
        <h1 className="title light">Nuestras <mark>propuestas</mark></h1>
        <p className="lead light">Acciones concretas para una ENSFA más unida, participativa y solidaria.</p>
        {data?.some((p) => p.progress && p.progress !== 'planeada') && (
          <div className="progress-filter" role="group" aria-label="Filtrar por avance">
            {[['', 'Todas'], ...Object.entries(PROGRESS_LABEL)].map(([v, l]) => (
              <button key={v} type="button" className={`filter-btn ${progress === v ? 'on' : ''}`} aria-pressed={progress === v} onClick={() => setProgress(v)}>{l}</button>
            ))}
          </div>
        )}
        <NewItemsBanner count={incoming} singular="propuesta nueva" plural="propuestas nuevas" onShow={showIncoming} />
        {loading && <Spinner />}
        {error && <p className="error">{error}</p>}
        <div className="grid">
          {shown?.map((p) => <ProposalCard key={p._id} p={p} />)}
        </div>
      </div>
    </section>
  );
}
