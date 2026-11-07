import { useState } from 'react';
import { formatDate, formatTime } from '../../api.js';
import AuthImage from '../../components/AuthImage.jsx';
import Spinner from '../../components/Spinner.jsx';
import { formatPhone } from '../../utils.js';
import { canManageMessages, canSeeAll, canEdit } from '../../roles.js';
import { REVIEW, REVIEW_LABEL, TYPE_LABEL, URGENCY_LABEL } from './messageLabels.js';
import './MessageCard.css';

// Una tarjeta de mensaje del panel: contenido, adjuntos, clasificación, respuesta para quien escribió y notas internas.
// Las acciones llegan del padre (`actions`) y devuelven una promesa; los errores los muestra el padre.
export default function MessageCard({ m, trash, role, actions }) {
  const seesContact = canSeeAll(role); // el Moderador no ve quién escribió
  const manages = canManageMessages(role); // el Presidente solo lee
  const canDelete = canEdit(role);
  const review = m.review || 'pendiente';
  const urgency = m.urgency || 'media'; // los mensajes anteriores a este campo cuentan como media
  const [reply, setReply] = useState(m.publicReply ?? '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [saved, setSaved] = useState('');

  async function run(key, fn, done) {
    setBusy(key);
    setSaved('');
    try {
      if ((await fn()) !== false && done) setSaved(done);
    } finally {
      setBusy('');
    }
  }
  const saveReply = (e) => {
    e.preventDefault();
    return run('reply', () => actions.update(m._id, { publicReply: reply }), reply.trim() ? 'Respuesta guardada ✔' : 'Respuesta quitada ✔');
  };
  const addNote = (e) => {
    e.preventDefault();
    return run('note', async () => {
      const ok = await actions.addNote(m._id, note);
      if (ok) setNote('');
      return ok;
    });
  };

  return (
    <article className={`card msg ${m.status}`}>
      <header>
        <span className="row">
          <span className="tag">{TYPE_LABEL[m.type]}</span>
          <span className={`badge review-${review}`}>{REVIEW_LABEL[review]}</span>
          <span className={`badge urgency-${urgency}`}>Urgencia: {URGENCY_LABEL[urgency]}</span>
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
      {!m.anonymous && seesContact && <p className="muted privacy-note">Contiene datos personales: úsalos solo para atender este mensaje y no los copies fuera del panel.</p>}
      <p className="muted">
        {m.anonymous ? 'Anónimo' : !seesContact ? 'Con datos de contacto (solo los ven el Técnico y el Presidente)' : [m.name, m.degree, `${m.semester}° semestre`, m.group && `grupo ${m.group}`, `Tel. ${formatPhone(m.phone)}`].filter(Boolean).join(' · ')}
      </p>

      {trash ? (
        <div className="row msg-actions">
          <span className="muted">Eliminado el {formatDate(m.deletedAt)}</span>
          {canDelete && <button className="btn btn-dark sm" onClick={() => actions.restore(m._id)}>Restaurar</button>}
          {canDelete && <button className="btn btn-red sm" onClick={() => actions.removeForever(m._id)}>Eliminar definitivamente</button>}
        </div>
      ) : (
        <>
          {manages ? <div className="row msg-actions">
            <label className="inline-select">Revisión
              <select value={review} onChange={(e) => actions.update(m._id, { review: e.target.value })}>
                {REVIEW.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            {m.status !== 'leido' && <button className="btn btn-dark sm" onClick={() => actions.update(m._id, { status: 'leido' })}>Marcar leído</button>}
            {m.status !== 'archivado' && <button className="btn btn-dark sm" onClick={() => actions.update(m._id, { status: 'archivado' })}>Archivar</button>}
            {m.status !== 'nuevo' && <button className="btn btn-dark sm" onClick={() => actions.update(m._id, { status: 'nuevo' })}>Marcar nuevo</button>}
            {canDelete && <button className="btn btn-red sm" onClick={() => actions.remove(m._id)}>Eliminar</button>}
          </div> : (
            <p className="muted msg-actions">Estado: {m.status === 'nuevo' ? 'nuevo' : m.status === 'leido' ? 'leído' : 'archivado'} · solo lectura</p>
          )}

          <details className="msg-extra">
            <summary>Respuesta para quien escribió{m.publicReply ? ' ✔' : ''}</summary>
            {manages ? (
              <form onSubmit={saveReply} className="form">
                <label>La verá quien consulte el código de seguimiento de este mensaje
                  <textarea rows={3} maxLength={1000} value={reply} onChange={(e) => setReply(e.target.value)} />
                </label>
                <p className="hint">Es pública para quien tenga el código: no escribas datos personales de nadie.</p>
                <div className="row">
                  <button className="btn btn-dark sm" disabled={busy === 'reply'}>{busy === 'reply' ? <Spinner inline /> : 'Guardar respuesta'}</button>
                  {saved && <span role="status" className="muted">{saved}</span>}
                </div>
              </form>
            ) : (
              <p className="pre">{m.publicReply || 'Todavía no hay respuesta.'}</p>
            )}
          </details>

          <details className="msg-extra">
            <summary>Notas internas ({m.notes?.length ?? 0})</summary>
            <ul className="notes">
              {m.notes?.map((n, i) => (
                <li key={n._id ?? i}>
                  <span className="muted">{n.authorName} · {formatDate(n.at)} {formatTime(n.at)}</span>
                  <p className="pre">{n.text}</p>
                </li>
              ))}
            </ul>
            {manages && (
              <form onSubmit={addNote} className="form">
                <label>Nueva nota (solo la ve el equipo)
                  <textarea rows={2} maxLength={1000} required value={note} onChange={(e) => setNote(e.target.value)} />
                </label>
                <button className="btn btn-dark sm" disabled={busy === 'note'}>{busy === 'note' ? <Spinner inline /> : 'Agregar nota'}</button>
              </form>
            )}
          </details>
        </>
      )}
    </article>
  );
}
