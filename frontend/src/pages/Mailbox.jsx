import { useState } from 'react';
import { api } from '../api.js';
import { useFetch } from '../hooks.js';

const TYPES = [
  ['queja', 'Queja'],
  ['propuesta', 'Propuesta'],
  ['pregunta', 'Pregunta'],
  ['problema', 'Problema'],
];

const empty = { type: 'propuesta', anonymous: true, name: '', degree: '', semester: '', group: '', subject: '', body: '' };

export default function Mailbox() {
  const { data: settings } = useFetch('/settings');
  const [form, setForm] = useState(empty);
  const [status, setStatus] = useState({ sending: false, error: '', done: false });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setStatus({ sending: true, error: '', done: false });
    const payload = form.anonymous
      ? { type: form.type, anonymous: true, subject: form.subject, body: form.body }
      : { ...form };
    try {
      await api('/messages', { method: 'POST', body: payload });
      setForm(empty);
      setStatus({ sending: false, error: '', done: true });
    } catch (err) {
      setStatus({ sending: false, error: err.message, done: false });
    }
  }

  if (status.done) {
    return (
      <section className="section paper page-min">
        <div className="container narrow center">
          <h1 className="title">¡Gracias por <mark>escribirnos</mark>!</h1>
          <p className="lead">Tu mensaje fue recibido. Lo revisaremos y le daremos seguimiento.</p>
          <button className="btn btn-red" onClick={() => setStatus({ sending: false, error: '', done: false })}>
            Enviar otro mensaje
          </button>
        </div>
      </section>
    );
  }

  const options = (list) => list?.map((v) => <option key={v} value={v}>{v}</option>);

  return (
    <section className="section paper page-min">
      <div className="container narrow">
        <h1 className="title">Buzón <mark>digital</mark></h1>
        <p className="lead">Tu opinión cuenta. Cuéntanos tus quejas, propuestas, preguntas o problemas.</p>

        <form className="form" onSubmit={submit}>
          <fieldset>
            <legend>¿Qué quieres enviarnos?</legend>
            <div className="chips">
              {TYPES.map(([value, label]) => (
                <label key={value} className={`chip ${form.type === value ? 'on' : ''}`}>
                  <input type="radio" name="type" value={value} checked={form.type === value} onChange={set('type')} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>¿Cómo quieres enviarlo?</legend>
            <div className="chips">
              <label className={`chip ${form.anonymous ? 'on' : ''}`}>
                <input type="radio" name="anon" checked={form.anonymous} onChange={() => setForm({ ...form, anonymous: true })} />
                De forma anónima
              </label>
              <label className={`chip ${!form.anonymous ? 'on' : ''}`}>
                <input type="radio" name="anon" checked={!form.anonymous} onChange={() => setForm({ ...form, anonymous: false })} />
                Con mis datos
              </label>
            </div>
            {form.anonymous && <p className="hint">No guardamos ningún dato personal con tu mensaje.</p>}
          </fieldset>

          {!form.anonymous && (
            <div className="form-grid">
              <label className="full">Nombre completo
                <input required value={form.name} onChange={set('name')} maxLength={120} autoComplete="name" />
              </label>
              <label className="full">Licenciatura
                <select required value={form.degree} onChange={set('degree')}>
                  <option value="">Selecciona…</option>
                  {options(settings?.degrees)}
                </select>
              </label>
              <label>Semestre
                <select required value={form.semester} onChange={set('semester')}>
                  <option value="">Selecciona…</option>
                  {options(settings?.semesters)}
                </select>
              </label>
              <label>Grupo
                <select required value={form.group} onChange={set('group')}>
                  <option value="">Selecciona…</option>
                  {options(settings?.groups)}
                </select>
              </label>
            </div>
          )}

          <label>Asunto
            <input required value={form.subject} onChange={set('subject')} maxLength={140} />
          </label>
          <label>Mensaje
            <textarea required rows={7} value={form.body} onChange={set('body')} maxLength={4000} />
            <span className="counter">{form.body.length}/4000</span>
          </label>

          {status.error && <p className="error" role="alert">{status.error}</p>}
          <button className="btn btn-red" disabled={status.sending}>
            {status.sending ? 'Enviando…' : 'Enviar mensaje'}
          </button>
        </form>
      </div>
    </section>
  );
}
