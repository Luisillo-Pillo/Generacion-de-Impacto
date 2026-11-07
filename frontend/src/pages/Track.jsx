import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDate, formatTime } from '../api.js';
import Spinner from '../components/Spinner.jsx';
import './Track.css';

const TYPE_LABEL = { queja: 'Queja', propuesta: 'Propuesta', pregunta: 'Pregunta', problema: 'Problema' };
const STATUS_LABEL = { nuevo: 'Recibido', leido: 'Leído por el equipo', archivado: 'Archivado' };
const REVIEW_LABEL = { pendiente: 'Pendiente', en_proceso: 'En proceso', completado: 'Completado', rechazado: 'Rechazado' };

// Seguimiento de un mensaje con su código: solo estado y respuesta; nunca el texto del mensaje ni datos de nadie.
export default function Track() {
  const [code, setCode] = useState('');
  const [state, setState] = useState({ loading: false, error: '', result: null });

  async function submit(e) {
    e.preventDefault();
    setState({ loading: true, error: '', result: null });
    try {
      setState({ loading: false, error: '', result: await api('/messages/track', { method: 'POST', body: { code } }) });
    } catch (err) {
      setState({ loading: false, error: err.message, result: null });
    }
  }

  const { loading, error, result } = state;
  return (
    <section className="section paper page-min">
      <div className="container narrow">
        <h1 className="title">Seguimiento de tu <mark>mensaje</mark></h1>
        <p className="lead">Escribe el código que recibiste al enviar tu mensaje en el <Link to="/buzon">buzón</Link>.</p>

        <form className="form track-form" onSubmit={submit}>
          <label>Código de seguimiento
            <input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="GI-XXXXX-XXXXX" maxLength={30} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
          </label>
          <button className="btn btn-red" disabled={loading}>{loading ? <><Spinner inline /> Buscando…</> : 'Consultar'}</button>
        </form>

        {error && <p className="error" role="alert">{error}</p>}
        {result && (
          <article className="card track-result" aria-live="polite">
            <header>
              <span className="tag">{TYPE_LABEL[result.type]}</span>
              <span className="muted">Enviado el {formatDate(result.createdAt)}</span>
            </header>
            <h2>{result.subject}</h2>
            <dl>
              <div><dt>Estado</dt><dd>{STATUS_LABEL[result.status] ?? result.status}</dd></div>
              <div><dt>Revisión</dt><dd>{REVIEW_LABEL[result.review] ?? result.review}</dd></div>
              <div><dt>Última actualización</dt><dd>{formatDate(result.updatedAt)} · {formatTime(result.updatedAt)}</dd></div>
            </dl>
            {result.publicReply ? (
              <div className="track-reply">
                <h3>Respuesta del equipo</h3>
                <p className="pre">{result.publicReply}</p>
                <p className="muted">{formatDate(result.publicReplyAt)}</p>
              </div>
            ) : (
              <p className="muted">Todavía no hay una respuesta del equipo. Vuelve a consultar más adelante.</p>
            )}
          </article>
        )}
      </div>
    </section>
  );
}
