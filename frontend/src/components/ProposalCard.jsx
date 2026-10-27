import { fileUrl } from '../api.js';

export default function ProposalCard({ p }) {
  return (
    <article className="proposal">
      <span className="proposal-num">{p.number}</span>
      <h3>{p.title}</h3>
      {p.image && <img className="proposal-img" src={fileUrl(p.image)} alt="" loading="lazy" />}
      <div className="objective">
        <span className="tag">Objetivo</span>
        <p>{p.objective}</p>
      </div>
    </article>
  );
}
