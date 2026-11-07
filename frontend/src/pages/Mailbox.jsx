import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useFetch } from '../hooks.js';
import { formatPhone } from '../utils.js';
import Spinner from '../components/Spinner.jsx';
import { URGENCY, DEFAULT_URGENCY } from '../urgency.js';
import TrackingCode from '../components/TrackingCode.jsx';
import { CheckStamp, EnvelopeSticker, IconClip, IconLock, IconSend } from '../components/MailboxIcons.jsx';
import './Mailbox.css';
import { usePageMeta } from '../pageMeta.js';

const TYPES = [
  ['queja', 'Queja'],
  ['propuesta', 'Propuesta'],
  ['pregunta', 'Pregunta'],
  ['problema', 'Problema'],
];

const empty = { type: 'propuesta', urgency: DEFAULT_URGENCY, anonymous: true, name: '', degree: '', semester: '', group: '', phone: '', consent: false, subject: '', body: '' };

const MAX_IMAGES = 3;
const MAX_MB = 5;
const MAX_TOTAL_MB = 12; // todas las imágenes juntas
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default function Mailbox() {
  usePageMeta({ title: 'Buzón digital', description: 'Cuéntanos tus quejas, propuestas, preguntas o problemas, de forma anónima o con tus datos.' });
  const { data: settings } = useFetch('/settings');
  const [form, setForm] = useState(empty);
  const [status, setStatus] = useState({ sending: false, error: '', done: false, code: '' });
  const [attachments, setAttachments] = useState([]); // [{ file, url }] con vista previa local
  const [attachError, setAttachError] = useState('');
  const picker = useRef(null);
  // Protecciones contra bots, invisibles para quien escribe: un campo oculto que una persona no llena y el tiempo que
  // tardó en llenar el formulario (nadie escribe un mensaje en menos de 3 segundos).
  const [trap, setTrap] = useState('');
  const shownAt = useRef(0);
  useEffect(() => {
    shownAt.current = Date.now();
  }, []);
  const latest = useRef(attachments);
  useEffect(() => {
    latest.current = attachments;
  }, [attachments]);
  // Libera las vistas previas al salir de la página
  useEffect(() => () => latest.current.forEach((a) => URL.revokeObjectURL(a.url)), []);

  // Solo algunas licenciaturas (p. ej. Telesecundaria) se dividen en grupos; en las demás el grupo no aplica
  const hasGroups = !!settings?.groupDegrees?.includes(form.degree);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setDegree = (e) => setForm({ ...form, degree: e.target.value, group: '' });

  function addFiles(e) {
    const added = [...e.target.files];
    e.target.value = ''; // permite volver a elegir el mismo archivo
    let problem = '';
    const accepted = [];
    let total = attachments.reduce((sum, a) => sum + a.file.size, 0);
    for (const file of added) {
      if (!IMAGE_TYPES.includes(file.type)) problem = 'Solo se permiten imágenes JPG, PNG, WEBP o GIF.';
      else if (file.size > MAX_MB * 1024 * 1024) problem = `Cada imagen debe pesar máximo ${MAX_MB} MB.`;
      else if (attachments.length + accepted.length >= MAX_IMAGES) problem = `Puedes adjuntar hasta ${MAX_IMAGES} imágenes.`;
      else if (total + file.size > MAX_TOTAL_MB * 1024 * 1024) problem = `Las imágenes juntas deben pesar máximo ${MAX_TOTAL_MB} MB.`;
      else {
        accepted.push({ file, url: URL.createObjectURL(file) });
        total += file.size;
      }
    }
    setAttachError(problem);
    if (accepted.length) setAttachments([...attachments, ...accepted]);
  }

  function removeFile(item) {
    URL.revokeObjectURL(item.url);
    setAttachments(attachments.filter((a) => a !== item));
    setAttachError('');
  }

  function clearFiles() {
    attachments.forEach((a) => URL.revokeObjectURL(a.url));
    setAttachments([]);
  }

  async function submit(e) {
    e.preventDefault();
    setStatus({ sending: true, error: '', done: false });
    const data = new FormData();
    for (const key of ['type', 'urgency', 'subject', 'body']) data.append(key, form[key]);
    data.append('anonymous', String(form.anonymous));
    if (!form.anonymous) {
      for (const key of ['name', 'degree', 'semester', 'phone']) data.append(key, form[key]);
      if (hasGroups) data.append('group', form.group);
      data.append('consent', String(form.consent));
    }
    attachments.forEach((a) => data.append('images', a.file));
    data.append('website', trap);
    data.append('fillMs', String(Date.now() - shownAt.current));
    try {
      const res = await api('/messages', { method: 'POST', form: data });
      setForm(empty);
      setTrap('');
      shownAt.current = Date.now();
      clearFiles();
      setStatus({ sending: false, error: '', done: true, code: res?.code ?? '' });
    } catch (err) {
      setStatus({ sending: false, error: err.message, done: false });
    }
  }

  if (status.done) {
    return (
      <section className="section paper page-min">
        <div className="container narrow center">
          <CheckStamp />
          <h1 className="title">¡Gracias por <mark>escribirnos</mark>!</h1>
          <p className="lead">Tu mensaje fue recibido. Lo revisaremos y le daremos seguimiento.</p>
          {status.code && <TrackingCode code={status.code} />}
          <div className="btn-row">
            <Link to="/" className="btn btn-red">Inicio</Link>
            <button className="btn btn-dark" onClick={() => setStatus({ sending: false, error: '', done: false })}>
              Enviar otro mensaje
            </button>
          </div>
        </div>
      </section>
    );
  }

  const options = (list) => list?.map((v) => <option key={v} value={v}>{v}</option>);

  return (
    <section className="section paper page-min">
      <div className="container narrow">
        <div className="mailbox-head">
          <h1 className="title">Buzón <mark>digital</mark></h1>
          <EnvelopeSticker />
        </div>
        <p className="lead">Tu opinión cuenta. Cuéntanos tus quejas, propuestas, preguntas o problemas.</p>
        <p className="note" aria-hidden="true">¡Tu voz importa!</p>

        <form className="form" onSubmit={submit}>
          <div className="trap" aria-hidden="true">
            <label>No llenes este campo
              <input name="website" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
            </label>
          </div>
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

          <label>Urgencia
            <select name="urgency" value={form.urgency} onChange={set('urgency')}>
              {URGENCY.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <span className="hint">Ayúdanos a priorizar: marca «Urgente» solo si necesita atención inmediata.</span>
          </label>

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
            {form.anonymous && <p className="hint hint-icon"><IconLock /> No guardamos ningún dato personal con tu mensaje.</p>}
          </fieldset>

          {!form.anonymous && (
            <div className="form-grid">
              <label className="full">Nombre completo
                <input required value={form.name} onChange={set('name')} maxLength={120} autoComplete="name" />
              </label>
              <label className="full">Teléfono
                <input
                  required type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="000 000 0000"
                  value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
                  pattern="\d{3} \d{3} \d{4}" maxLength={12} title="10 dígitos, en formato 000 000 0000"
                />
              </label>
              <label className="full">Licenciatura
                <select required value={form.degree} onChange={setDegree}>
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
              <label>Grupo (Telesecundaria)
                <select required={hasGroups} disabled={!hasGroups} value={form.group} onChange={set('group')}>
                  <option value="">{hasGroups ? 'Selecciona…' : 'No aplica'}</option>
                  {options(settings?.groups)}
                </select>
              </label>
              <label className="check full">
                <input type="checkbox" required checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
                <span>
                  He leído el <Link to="/privacidad" target="_blank">aviso de privacidad</Link> y acepto que mis datos se usen para atender mi mensaje.
                </span>
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

          <div className="attach">
            <span className="attach-title"><IconClip /> Imágenes relacionadas (opcional)</span>
            <p className="hint">Hasta {MAX_IMAGES} imágenes JPG, PNG, WEBP o GIF de máximo {MAX_MB} MB cada una ({MAX_TOTAL_MB} MB en total).</p>
            {form.anonymous && attachments.length > 0 && (
              <p className="hint">Revisa que tus imágenes no muestren datos que te identifiquen: tu mensaje es anónimo.</p>
            )}
            {attachments.length > 0 && (
              <ul className="attachments">
                {attachments.map((a) => (
                  <li key={a.url}>
                    <img src={a.url} alt={`Vista previa de ${a.file.name}`} />
                    <button type="button" className="remove" onClick={() => removeFile(a)} aria-label={`Quitar ${a.file.name}`}>×</button>
                  </li>
                ))}
              </ul>
            )}
            {attachments.length < MAX_IMAGES && (
              <>
                <input ref={picker} type="file" accept={IMAGE_TYPES.join(',')} multiple hidden onChange={addFiles} />
                <button type="button" className="btn btn-dark sm" onClick={() => picker.current.click()}>
                  {attachments.length ? 'Agregar otra imagen' : 'Adjuntar imágenes'}
                </button>
              </>
            )}
            {attachError && <p className="error" role="alert">{attachError}</p>}
          </div>

          {status.error && <p className="error" role="alert">{status.error}</p>}
          <button className="btn btn-red" disabled={status.sending}>
            {status.sending ? <><Spinner inline /> Enviando…</> : <><IconSend /> Enviar mensaje</>}
          </button>
        </form>
      </div>
    </section>
  );
}
