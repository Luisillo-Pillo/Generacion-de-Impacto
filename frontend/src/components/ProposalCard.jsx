import { imgSet } from '../api.js';
import './ProposalCard.css';

export default function ProposalCard({ p }) {
  return (
    <article className="proposal">
      <span className="proposal-num">{p.number}</span>
      <h3>{p.title}</h3>
      {p.image && <img className="proposal-img" {...imgSet(p.image, '(max-width: 700px) 100vw, 400px')} alt="" loading="lazy" />}
      <div className="objective">
        <span className="tag">Objetivo</span>
        <p>{p.objective}</p>
      </div>
    </article>
  );
}
