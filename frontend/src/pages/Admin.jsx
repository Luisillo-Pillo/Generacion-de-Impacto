import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api, fileUrl, formatDate, uploadImage } from '../api.js';
import PasswordInput from '../components/PasswordInput.jsx';

const TABS = [
  ['mensajes', 'Mensajes'],
  ['noticias', 'Noticias'],
  ['propuestas', 'Propuestas'],
  ['equipo', 'Equipo'],
  ['ajustes', 'Ajustes'],
];

export default function Admin() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState('mensajes');

  if (loading) return <section className="section paper page-min"><div className="container muted">Cargando…</div></section>;
  if (!user) return <Navigate to="/acceso" replace />;
  if (user.role !== 'admin') {
    return (
      <section className="section paper page-min">
        <div className="container narrow">
          <h1 className="title">Sin <mark>acceso</mark></h1>
          <p className="lead">Tu cuenta no tiene rol de administrador. Pide a un administrador que te lo asigne.</p>
        </div>
      </section>
    );
  }

  const Panel = { mensajes: Messages, noticias: NewsAdmin, propuestas: ProposalsAdmin, equipo: TeamAdmin, ajustes: SettingsAdmin }[tab];
  return (
    <section className="section paper page-min">
      <div className="container">
        <h1 className="title">Panel de <mark>administración</mark></h1>
        <div className="tabs" role="tablist">
          {TABS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        <Panel />
      </div>
    </section>
  );
}

// ---------- utilidades ----------
function useList(path) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const reload = useCallback(() => {
    api(path).then(setItems).catch((e) => setError(e.message));
  }, [path]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { items, error, reload, setError };
}

function ImageField({ value, onChange, label = 'Imagen' }) {
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
      {value && <img src={fileUrl(value)} alt="" />}
      <div className="row">
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={pick} disabled={busy} />
        {value && <button type="button" className="link-btn" onClick={() => onChange(null)}>Quitar</button>}
      </div>
      {busy && <small>Subiendo…</small>}
      {error && <small className="error">{error}</small>}
    </div>
  );
}

// ---------- Mensajes ----------
function Messages() {
  const [filter, setFilter] = useState('nuevo');
  const { items, error, reload, setError } = useList(`/messages${filter ? `?status=${filter}` : ''}`);

  const setStatus = (id, status) => api(`/messages/${id}`, { method: 'PATCH', body: { status } }).then(reload).catch((e) => setError(e.message));
  const remove = (id) => confirm('¿Eliminar este mensaje definitivamente?') && api(`/messages/${id}`, { method: 'DELETE' }).then(reload);

  return (
    <div>
      <div className="chips">
        {[['nuevo', 'Nuevos'], ['leido', 'Leídos'], ['archivado', 'Archivados'], ['', 'Todos']].map(([v, l]) => (
          <button key={v} className={`chip ${filter === v ? 'on' : ''}`} onClick={() => setFilter(v)}>{l}</button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      {items?.length === 0 && <p className="muted">No hay mensajes.</p>}
      {items?.map((m) => (
        <article key={m._id} className={`card msg ${m.status}`}>
          <header>
            <span className="tag">{m.type}</span>
            <span className="muted">{formatDate(m.createdAt)} · {m.status}</span>
          </header>
          <h3>{m.subject}</h3>
          <p className="pre">{m.body}</p>
          <p className="muted">
            {m.anonymous ? 'Anónimo' : `${m.name} · ${m.degree} · ${m.semester}° semestre · grupo ${m.group}`}
          </p>
          <div className="row">
            {m.status !== 'leido' && <button className="btn btn-dark sm" onClick={() => setStatus(m._id, 'leido')}>Marcar leído</button>}
            {m.status !== 'archivado' && <button className="btn btn-dark sm" onClick={() => setStatus(m._id, 'archivado')}>Archivar</button>}
            {m.status !== 'nuevo' && <button className="btn btn-dark sm" onClick={() => setStatus(m._id, 'nuevo')}>Marcar nuevo</button>}
            <button className="btn btn-red sm" onClick={() => remove(m._id)}>Eliminar</button>
          </div>
        </article>
      ))}
    </div>
  );
}

// ---------- Editor genérico (noticias / propuestas / equipo) ----------
function CrudPanel({ listPath, endpoint, blank, fields, summary, newLabel }) {
  const { items, error, reload, setError } = useList(listPath);
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
  const remove = (it) => confirm('¿Eliminar definitivamente?') && api(`${endpoint}/${it._id}`, { method: 'DELETE' }).then(reload);
  const set = (k) => (v) => setEditing((cur) => ({ ...cur, [k]: v }));

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
      <button className="btn btn-red" onClick={() => setEditing(blank(items))}>{newLabel}</button>
      {error && <p className="error">{error}</p>}
      {items?.map((it) => (
        <article key={it._id} className="card row between">
          <div>{summary(it)}</div>
          <div className="row">
            <button className="btn btn-dark sm" onClick={() => setEditing({ ...it })}>Editar</button>
            <button className="btn btn-red sm" onClick={() => remove(it)}>Eliminar</button>
          </div>
        </article>
      ))}
    </div>
  );
}

const text = (label, value, onChange, props = {}) => (
  <label>{label}
    <input value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...props} />
  </label>
);

function NewsAdmin() {
  return (
    <CrudPanel
      listPath="/news/all" endpoint="/news" newLabel="Nueva noticia"
      blank={() => ({ title: '', excerpt: '', body: '', coverImage: null, published: true })}
      summary={(n) => <><strong>{n.title}</strong><br /><span className="muted">{n.published ? 'Publicada' : 'Borrador'} · {formatDate(n.createdAt)}</span></>}
      fields={(n, set) => (
        <>
          {text('Título', n.title, set('title'), { required: true, maxLength: 160 })}
          {text('Resumen (opcional)', n.excerpt, set('excerpt'), { maxLength: 300 })}
          <label>Contenido (separa párrafos con una línea en blanco)
            <textarea required rows={10} value={n.body} onChange={(e) => set('body')(e.target.value)} />
          </label>
          <ImageField label="Imagen de portada" value={n.coverImage} onChange={set('coverImage')} />
          <label className="check"><input type="checkbox" checked={n.published} onChange={(e) => set('published')(e.target.checked)} /> Publicada</label>
        </>
      )}
    />
  );
}

function ProposalsAdmin() {
  return (
    <CrudPanel
      listPath="/proposals/all" endpoint="/proposals" newLabel="Nueva propuesta"
      blank={(items) => ({ number: (items?.reduce((m, p) => Math.max(m, p.number), 0) || 0) + 1, title: '', objective: '', image: null, published: true })}
      summary={(p) => <><strong>#{p.number} · {p.title}</strong><br /><span className="muted">{p.published ? 'Visible' : 'Oculta'}</span></>}
      fields={(p, set) => (
        <>
          {text('Número', p.number, (v) => set('number')(Number(v)), { type: 'number', min: 1, required: true })}
          {text('Título', p.title, set('title'), { required: true, maxLength: 160 })}
          <label>Objetivo
            <textarea required rows={4} maxLength={600} value={p.objective} onChange={(e) => set('objective')(e.target.value)} />
          </label>
          <ImageField label="Imagen (opcional)" value={p.image} onChange={set('image')} />
          <label className="check"><input type="checkbox" checked={p.published} onChange={(e) => set('published')(e.target.checked)} /> Visible en el sitio</label>
        </>
      )}
    />
  );
}

function TeamAdmin() {
  return (
    <CrudPanel
      listPath="/members/all" endpoint="/members" newLabel="Nuevo integrante"
      blank={(items) => ({ name: '', role: '', degree: '', photo: null, order: items?.length || 0, email: '', password: '' })}
      summary={(m) => <><strong>{m.name}</strong><br /><span className="muted">{m.role ? `${m.role} · ` : ''}{m.email}</span></>}
      fields={(m, set) => (
        <>
          {text('Nombre', m.name, set('name'), { required: true, maxLength: 100 })}
          {text('Cargo', m.role, set('role'), { maxLength: 100 })}
          {text('Licenciatura', m.degree, set('degree'), { maxLength: 120 })}
          {text('Orden', m.order, (v) => set('order')(Number(v)), { type: 'number' })}
          
          {text('Correo de acceso', m.email, set('email'), { type: 'email', required: true, autoComplete: 'off' })}
          <label>{m._id ? 'Nueva contraseña (déjala vacía para no cambiarla)' : 'Contraseña (mínimo 8 caracteres)'}
            <PasswordInput required={!m._id} minLength={8} value={m.password ?? ''} onChange={(e) => set('password')(e.target.value)} autoComplete="new-password" />
          </label>
          <ImageField label="Foto" value={m.photo} onChange={set('photo')} />
        </>
      )}
    />
  );
}

// ---------- Ajustes ----------
function SettingsAdmin() {
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => { api('/settings').then(setS).catch((e) => setMsg(e.message)); }, []);
  if (!s) return <p className="muted">{msg || 'Cargando…'}</p>;

  const lines = (key, label) => (
    <label>{label} (uno por línea)
      <textarea rows={6} value={s[key].join('\n')} onChange={(e) => setS({ ...s, [key]: e.target.value.split('\n') })} />
    </label>
  );
  const social = (key, label) => text(label, s.social[key], (v) => setS({ ...s, social: { ...s.social, [key]: v } }), { placeholder: key === 'email' ? 'correo@ejemplo.com' : 'https://…' });

  async function save(e) {
    e.preventDefault();
    setMsg('Guardando…');
    try {
      for (const key of ['degrees', 'groups', 'semesters']) {
        await api(`/settings/${key}`, { method: 'PUT', body: { value: s[key].map((v) => v.trim()).filter(Boolean) } });
      }
      await api('/settings/social', { method: 'PUT', body: { value: s.social } });
      setMsg('Guardado ✔');
    } catch (err) {
      setMsg(err.message);
    }
  }

  return (
    <form className="form card" onSubmit={save}>
      <p className="hint">Estas listas alimentan el formulario del buzón digital.</p>
      {lines('degrees', 'Licenciaturas')}
      {lines('semesters', 'Semestres')}
      {lines('groups', 'Grupos')}
      <h3>Redes y contacto</h3>
      {social('instagram', 'Instagram (URL)')}
      {social('facebook', 'Facebook (URL)')}
      {social('tiktok', 'TikTok (URL)')}
      {social('email', 'Correo de contacto')}
      <div className="row"><button className="btn btn-red">Guardar ajustes</button><span>{msg}</span></div>
    </form>
  );
}
