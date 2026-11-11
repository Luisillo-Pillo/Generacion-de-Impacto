import { CrudPanel, ImageField, text } from './shared.jsx';
import { useState } from 'react';
import { api } from '../../api.js';
import { useDialog } from '../../components/Dialog.jsx';
import { PROGRESS_LABEL } from '../../progress.js';

// Lo que un Miembro puede hacer con una propuesta ya creada: actualizar su estado (avance, nota y visibilidad)
function ProposalState({ item, reload }) {
  const { notify } = useDialog();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ progress: item.progress ?? 'planeada', progressNote: item.progressNote ?? '', published: item.published });
  async function save(e) {
    e.preventDefault();
    try {
      await api(`/proposals/${item._id}/state`, { method: 'PATCH', body: form });
      setOpen(false);
      reload();
    } catch (err) {
      await notify({ title: 'No se pudo actualizar el estado', message: err.message });
    }
  }
  if (!open) return <button className="btn btn-dark sm" onClick={() => setOpen(true)}>Actualizar estado</button>;
  return (
    <form className="form" onSubmit={save}>
      <label>Avance
        <select value={form.progress} onChange={(e) => setForm({ ...form, progress: e.target.value })}>
          {Object.entries(PROGRESS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      {text('Nota del avance (opcional)', form.progressNote, (v) => setForm({ ...form, progressNote: v }), { maxLength: 200 })}
      <label className="check"><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> Visible en el sitio</label>
      <div className="row"><button className="btn btn-red sm">Guardar</button><button type="button" className="btn btn-dark sm" onClick={() => setOpen(false)}>Cancelar</button></div>
    </form>
  );
}

export default function AdminProposals() {
  return (
    <CrudPanel memberCanCreate memberCanEdit memberActions={(item, reload) => <ProposalState item={item} reload={reload} />}
      listPath="/proposals/all" endpoint="/proposals" newLabel="Nueva propuesta" liveTopics={['proposals']}
      blank={(items) => ({ number: (items?.reduce((m, p) => Math.max(m, p.number), 0) || 0) + 1, title: '', objective: '', image: null, progress: 'planeada', progressNote: '', published: true })}
      summary={(p) => <><strong>#{p.number} · {p.title}</strong><br /><span className="muted">{PROGRESS_LABEL[p.progress ?? 'planeada']} · {p.published ? 'Visible' : 'Oculta'}</span></>}
      fields={(p, set) => (
        <>
          {text('Número', p.number, (v) => set('number')(Number(v)), { type: 'number', min: 1, required: true })}
          {text('Título', p.title, set('title'), { required: true, maxLength: 160 })}
          <label>Objetivo
            <textarea required rows={4} maxLength={600} value={p.objective} onChange={(e) => set('objective')(e.target.value)} />
          </label>
          <label>Avance
            <select value={p.progress ?? 'planeada'} onChange={(e) => set('progress')(e.target.value)}>
              {Object.entries(PROGRESS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          {text('Nota del avance (opcional)', p.progressNote, set('progressNote'), { maxLength: 200 })}
          <ImageField label="Imagen (opcional)" value={p.image} onChange={set('image')} />
          <label className="check"><input type="checkbox" checked={p.published} onChange={(e) => set('published')(e.target.checked)} /> Visible en el sitio</label>
        </>
      )}
    />
  );
}
