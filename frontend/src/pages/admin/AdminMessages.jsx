import { useState } from 'react';
import { api, formatDate, formatTime } from '../../api.js';
import AuthImage from '../../components/AuthImage.jsx';
import { useDialog } from '../../components/Dialog.jsx';
import Spinner from '../../components/Spinner.jsx';
import { formatPhone } from '../../utils.js';
import { useList } from './shared.jsx';
import './AdminMessages.css';

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
  const [trash, setTrash] = useState(false); // papelera: mensajes eliminados, se borran solos a los 30 días
  const query = trash ? 'trash=1' : new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  const { items, loading, error, reload, setError } = useList(`/messages${query ? `?${query}` : ''}`);
  const setFilter = (key) => (value) => setFilters((f) => ({ ...f, [key]: value }));

  const update = (id, changes) => api(`/messages/${id}`, { method: 'PATCH', body: changes }).then(reload).catch((e) => setError(e.message));
  async function remove(id) {
    const ok = await confirm({ title: '¿Enviar a la papelera?', message: 'Podrás restaurarlo durante 30 días; después se eliminará definitivamente.', confirmLabel: 'Enviar a la papelera' });
    if (!ok) return;
    try {
      await api(`/messages/${id}`, { method: 'DELETE' });
      reload();
    } catch (err) {
      await notify({ title: 'No se pudo eliminar', message: err.message });
    }
  }
  async function restore(id) {
    try {
      await api(`/messages/${id}/restore`, { method: 'POST' });
      reload();
    } catch (err) {
      await notify({ title: 'No se pudo restaurar', message: err.message });
    }
  }
  async function removeForever(id) {
    const ok = await confirm({ title: '¿Eliminar definitivamente?', message: 'Se eliminará el mensaje con sus imágenes. Esta acción no se puede deshacer.', confirmLabel: 'Eliminar definitivamente' });
    if (!ok) return;
    try {
      await api(`/messages/${id}/permanent`, { method: 'DELETE' });
      reload();
    } catch (err) {
      await notify({ title: 'No se pudo eliminar', message: err.message });
    }
  }

  return (
    <div>
      <div className="filters">
        {!trash && (
          <>
            <Filter label="Tipo" options={TYPES} value={filters.type} onChange={setFilter('type')} />
            <Filter label="Estado" options={STATUS} value={filters.status} onChange={setFilter('status')} />
            <Filter label="Revisión" options={[['', 'Todas'], ...REVIEW]} value={filters.review} onChange={setFilter('review')} />
          </>
        )}
        <button type="button" className="btn btn-dark sm trash-toggle" aria-pressed={trash} onClick={() => setTrash(!trash)}>
          {trash ? '← Volver a los mensajes' : 'Papelera'}
        </button>
      </div>
      {trash && <p className="muted">Los mensajes eliminados se quedan aquí 30 días y después se borran solos.</p>}
      {error && <p className="error">{error}</p>}
      {loading && <Spinner />}
      {items?.length === 0 && <p className="muted">{trash ? 'La papelera está vacía.' : 'No hay mensajes con estos filtros.'}</p>}
      {items?.map((m) => {
        const review = m.review || 'pendiente';
        return (
          <article key={m._id} className={`card msg ${m.status}`}>
            <header>
              <span className="row">
                <span className="tag">{TYPE_LABEL[m.type]}</span>
                <span className={`badge review-${review}`}>{REVIEW_LABEL[review]}</span>
              </span>
              <span className="muted">{formatDate(m.createdAt)} · {formatTime(m.createdAt)}</span>
            </header>
            <h3>{m.subject}</h3>
            <p className="pre">{m.body}</p>
            {m.images?.length > 0 && (
              <ul className="attachments">
                {m.images.map((id) => (
                  <li key={id}>
                    <AuthImage id={id} alt="Imagen adjunta" />
                  </li>
                ))}
              </ul>
            )}
            <p className="muted">
              {m.anonymous ? 'Anónimo' : [m.name, m.degree, `${m.semester}° semestre`, m.group && `grupo ${m.group}`, `Tel. ${formatPhone(m.phone)}`].filter(Boolean).join(' · ')}
            </p>
            {trash ? (
              <div className="row msg-actions">
                <span className="muted">Eliminado el {formatDate(m.deletedAt)}</span>
                <button className="btn btn-dark sm" onClick={() => restore(m._id)}>Restaurar</button>
                <button className="btn btn-red sm" onClick={() => removeForever(m._id)}>Eliminar definitivamente</button>
              </div>
            ) : (
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
            )}
          </article>
        );
      })}
    </div>
  );
}
