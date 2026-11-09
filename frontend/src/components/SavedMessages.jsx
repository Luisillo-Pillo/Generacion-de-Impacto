import { useEffect, useState } from 'react';
import { api, formatDate } from '../api.js';
import { forgetAll, forgetCode, listSaved } from '../myMessages.js';
import './SavedMessages.css';

const STATUS_LABEL = { nuevo: 'Recibido', leido: 'Leído', archivado: 'Archivado' };
const REVIEW_LABEL = { pendiente: 'Pendiente', en_proceso: 'En proceso', completado: 'Completado', rechazado: 'Rechazado' };
const CHECK_LIMIT = 10; // cuántos se consultan al abrir la página

// Lista de los mensajes cuyo código se recordó en este dispositivo, con su situación actual (se consulta con cada código;
// el servidor no sabe de quién es ninguno). `onView(code)` abre el detalle en la página de seguimiento.
export default function SavedMessages({ onView }) {
  const [items, setItems] = useState(listSaved);
  const [info, setInfo] = useState({}); // código → { status, review, reply } | { gone: true } | { failed: true }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const { code } of listSaved().slice(0, CHECK_LIMIT)) {
        let next;
        try {
          const r = await api('/messages/track', { method: 'POST', body: { code } });
          next = { status: r.status, review: r.review, reply: !!r.publicReply };
        } catch (err) {
          next = /No encontramos/.test(err.message) ? { gone: true } : { failed: true };
        }
        if (cancelled) return;
        setInfo((prev) => ({ ...prev, [code]: next }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (items.length === 0) return null;

  const remove = (code) => {
    forgetCode(code);
    setItems(listSaved());
  };
  const removeAll = () => {
    forgetAll();
    setItems([]);
  };

  return (
    <section className="saved" aria-labelledby="saved-title">
      <h2 id="saved-title" className="title small">Mis <mark>mensajes</mark></h2>
      <p className="hint">Los códigos que recordaste en <strong>este dispositivo</strong>. Solo están en este navegador: si borras sus datos o usas otro aparato, tendrás que escribir el código.</p>
      <ul className="saved-list">
        {items.map(({ code, subject, savedAt }) => {
          const i = info[code];
          return (
            <li key={code} className="card saved-item">
              <div className="saved-main">
                <strong className="saved-subject">{subject || 'Mensaje sin asunto'}</strong>
                <span className="muted">Enviado el {formatDate(savedAt)}</span>
                <span className="saved-status" aria-live="polite">
                  {!i && 'Consultando…'}
                  {i?.gone && 'Este mensaje ya no existe'}
                  {i?.failed && 'No se pudo consultar ahora'}
                  {i?.status && (
                    <>
                      <span className="badge-lite">{STATUS_LABEL[i.status] ?? i.status}</span>
                      <span className="badge-lite">{REVIEW_LABEL[i.review] ?? i.review}</span>
                      {i.reply && <span className="badge-lite reply">Con respuesta del equipo</span>}
                    </>
                  )}
                </span>
              </div>
              <div className="row saved-actions">
                {!i?.gone && <button type="button" className="btn btn-dark sm" onClick={() => onView(code)}>Ver</button>}
                <button type="button" className="btn btn-dark sm" onClick={() => remove(code)} aria-label={`Quitar «${subject || code}» de este dispositivo`}>Quitar</button>
              </div>
            </li>
          );
        })}
      </ul>
      <button type="button" className="saved-clear" onClick={removeAll}>Borrar todos de este dispositivo</button>
    </section>
  );
}
