import { useCallback, useEffect, useRef, useState } from 'react';
import { api, fileUrl, uploadImage } from '../../api.js';
import { useDialog } from '../../components/Dialog.jsx';
import Spinner from '../../components/Spinner.jsx';
import './shared.css';

export function useList(path) {
  // El resultado guarda la ruta que lo originó: si la ruta cambia (p. ej. otro filtro) la lista vuelve a estar
  // "cargando" sin vaciar el estado dentro del efecto; recargar la misma ruta actualiza sin parpadeo.
  const [result, setResult] = useState({ path: null, items: null });
  const [error, setError] = useState('');
  const latest = useRef({ path, request: 0 });

  // `reload` es estable y siempre pide la ruta vigente; una respuesta tardía de una ruta anterior (p. ej. al cambiar
  // un filtro mientras otra petición sigue en vuelo) se descarta para no mostrar resultados que ya no corresponden.
  const reload = useCallback(() => {
    const request = ++latest.current.request;
    const requested = latest.current.path;
    api(requested)
      .then((items) => {
        if (request !== latest.current.request) return;
        setResult({ path: requested, items });
        setError(''); // un fallo anterior ya no aplica si esta carga salió bien
      })
      .catch((e) => request === latest.current.request && setError(e.message));
  }, []);
  useEffect(() => {
    latest.current.path = path;
    reload();
  }, [path, reload]);

  const ready = result.path === path;
  return { items: ready ? result.items : null, loading: !ready && !error, error, reload, setError };
}

export function ImageField({ value, onChange, label = 'Imagen' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function pick(e) {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const { id } = await uploadImage(file);
      onChange(id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="image-field">
      <span>{label}</span>
      {value && <img src={fileUrl(value, 640)} alt="" />}
      <div className="row">
        <input type="file" aria-label={label} accept="image/jpeg,image/png,image/webp,image/gif" onChange={pick} disabled={busy} />
        {value && <button type="button" className="link-btn" onClick={() => onChange(null)}>Quitar</button>}
      </div>
      {busy && <small><Spinner inline /> Subiendo…</small>}
      {error && <small className="error">{error}</small>}
    </div>
  );
}

// Varias imágenes (galería de una noticia): hasta `max`, con vista previa y botón para quitar cada una
export function GalleryField({ value = [], onChange, label = 'Galería', max = 6 }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function add(e) {
    const files = [...e.target.files].slice(0, max - value.length);
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    setError('');
    const added = [];
    try {
      for (const file of files) added.push((await uploadImage(file)).id);
    } catch (err) {
      setError(err.message);
    } finally {
      onChange([...value, ...added]);
      setBusy(false);
    }
  }
  return (
    <div className="image-field">
      <span>{label} (hasta {max} imágenes)</span>
      {value.length > 0 && (
        <ul className="gallery-thumbs">
          {value.map((id) => (
            <li key={id}>
              <img src={fileUrl(id, 640)} alt="" />
              <button type="button" className="link-btn" onClick={() => onChange(value.filter((v) => v !== id))}>Quitar</button>
            </li>
          ))}
        </ul>
      )}
      <input type="file" multiple aria-label={`Agregar imágenes a ${label.toLowerCase()}`} accept="image/jpeg,image/png,image/webp,image/gif" onChange={add} disabled={busy || value.length >= max} />
      {busy && <small><Spinner inline /> Subiendo…</small>}
      {error && <small className="error">{error}</small>}
    </div>
  );
}

// Editor genérico (noticias / propuestas / equipo)
// `newAtEnd`: el botón de crear va debajo de la lista en vez de encima
export function CrudPanel({ listPath, endpoint, blank, fields, summary, newLabel, deleteNote, newAtEnd = false }) {
  const { confirm, notify } = useDialog();
  const { items, loading, error, reload, setError } = useList(listPath);
  const [editing, setEditing] = useState(null);

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      const { _id, ...body } = editing;
      await api(_id ? `${endpoint}/${_id}` : endpoint, { method: _id ? 'PUT' : 'POST', body });
      setEditing(null);
      reload();
    } catch (err) {
      setError(err.message);
    }
  }
  async function remove(it) {
    const ok = await confirm({
      title: '¿Eliminar definitivamente?',
      message: ['Esta acción no se puede deshacer.', deleteNote].filter(Boolean).join(' '),
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;
    try {
      await api(`${endpoint}/${it._id}`, { method: 'DELETE' });
      reload();
    } catch (err) {
      await notify({ title: 'No se pudo eliminar', message: err.message });
    }
  }
  const set = (k) => (v) => setEditing((cur) => ({ ...cur, [k]: v }));
  const newButton = <button className="btn btn-red" onClick={() => setEditing(blank(items))}>{newLabel}</button>;

  if (editing) {
    return (
      <form className="form card" onSubmit={save}>
        {fields(editing, set)}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="row">
          <button className="btn btn-red">Guardar</button>
          <button type="button" className="btn btn-dark" onClick={() => { setEditing(null); setError(''); }}>Cancelar</button>
        </div>
      </form>
    );
  }
  return (
    <div>
      {!newAtEnd && newButton}
      {error && <p className="error">{error}</p>}
      {loading && <Spinner />}
      {items?.map((it) => (
        <article key={it._id} className="card row between">
          <div>{summary(it)}</div>
          <div className="row">
            <button className="btn btn-dark sm" onClick={() => setEditing({ ...it })}>Editar</button>
            <button className="btn btn-red sm" onClick={() => remove(it)}>Eliminar</button>
          </div>
        </article>
      ))}
      {newAtEnd && <div className="crud-new-end">{newButton}</div>}
    </div>
  );
}

export const text = (label, value, onChange, props = {}) => (
  <label>{label}
    <input value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...props} />
  </label>
);
