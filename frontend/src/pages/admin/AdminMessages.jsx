import { useState } from 'react';
import { api, formatDate } from '../../api.js';
import { useDialog } from '../../components/Dialog.jsx';
import { useList } from './shared.jsx';

const TYPES = [['', 'Todos'], ['queja', 'Quejas'], ['propuesta', 'Propuestas'], ['pregunta', 'Preguntas'], ['problema', 'Problemas']];
const STATUS = [['nuevo', 'Nuevos'], ['leido', 'Leídos'], ['archivado', 'Archivados'], ['', 'Todos']];
const REVIEW = [['pendiente', 'Pendiente'], ['en_proceso', 'En proceso'], ['completado', 'Completado'], ['rechazado', 'Rechazado']];
const REVIEW_LABEL = Object.fromEntries(REVIEW);
const TYPE_LABEL = { queja: 'Queja', propuesta: 'Propuesta', pregunta: 'Pregunta', problema: 'Problema' };

function Filter({ label, options, value, onChange }) {
  return (
    <label className="filter">{label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

export default function AdminMessages() {
  const { confirm, notify } = useDialog();
  const [filters, setFilters] = useState({ type: '', status: 'nuevo', review: '' });
  const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  const { items, error, reload, setError } = useList(`/messages${query ? `?${query}` : ''}`);
  const setFilter = (key) => (value) => setFilters((f) => ({ ...f, [key]: value }));

  const update = (id, changes) => api(`/messages/${id}`, { method: 'PATCH', body: changes }).then(reload).catch((e) => setError(e.message));
  async function remove(id) {
    const ok = await confirm({ title: '¿Eliminar mensaje?', message: 'Se eliminará definitivamente. Esta acción no se puede deshacer.', confirmLabel: 'Eliminar' });
    if (!ok) return;
    try {
      await api(`/messages/${id}`, { method: 'DELETE' });
      reload();
    } catch (err) {
      await notify({ title: 'No se pudo eliminar', message: err.message });
    }
  }

  return (
    <div>
      <div className="filters">
        <Filter label="Tipo" options={TYPES} value={filters.type} onChange={setFilter('type')} />
        <Filter label="Estado" options={STATUS} value={filters.status} onChange={setFilter('status')} />
        <Filter label="Revisión" options={[['', 'Todas'], ...REVIEW]} value={filters.review} onChange={setFilter('review')} />
      </div>
      {error && <p className="error">{error}</p>}
      {items?.length === 0 && <p className="muted">No hay mensajes con estos filtros.</p>}
      {items?.map((m) => {
        const review = m.review || 'pendiente';
        return (
          <article key={m._id} className={`card msg ${m.status}`}>
            <header>
              <span className="row">
                <span className="tag">{TYPE_LABEL[m.type]}</span>
                <span className={`badge review-${review}`}>{REVIEW_LABEL[review]}</span>
              </span>
              <span className="muted">{formatDate(m.createdAt)} · {m.status}</span>
            </header>
            <h3>{m.subject}</h3>
            <p className="pre">{m.body}</p>
            <p className="muted">
              {m.anonymous ? 'Anónimo' : `${m.name} · ${m.degree} · ${m.semester}° semestre · grupo ${m.group}`}
            </p>
            <div className="row msg-actions">
              <label className="inline-select">Revisión
                <select value={review} onChange={(e) => update(m._id, { review: e.target.value })}>
                  {REVIEW.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              {m.status !== 'leido' && <button className="btn btn-dark sm" onClick={() => update(m._id, { status: 'leido' })}>Marcar leído</button>}
              {m.status !== 'archivado' && <button className="btn btn-dark sm" onClick={() => update(m._id, { status: 'archivado' })}>Archivar</button>}
              {m.status !== 'nuevo' && <button className="btn btn-dark sm" onClick={() => update(m._id, { status: 'nuevo' })}>Marcar nuevo</button>}
              <button className="btn btn-red sm" onClick={() => remove(m._id)}>Eliminar</button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
