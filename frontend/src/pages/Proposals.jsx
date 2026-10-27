import { useFetch } from '../hooks.js';
import ProposalCard from '../components/ProposalCard.jsx';

export default function Proposals() {
  const { data, error, loading } = useFetch('/proposals');
  return (
    <section className="section dark page-min">
      <div className="container">
        <h1 className="title light">Nuestras <mark>propuestas</mark></h1>
        <p className="lead light">Acciones concretas para una ENSFA más unida, participativa y solidaria.</p>
        {loading && <p className="muted">Cargando…</p>}
        {error && <p className="error">{error}</p>}
        <div className="grid">
          {data?.map((p) => <ProposalCard key={p._id} p={p} />)}
        </div>
      </div>
    </section>
  );
}
