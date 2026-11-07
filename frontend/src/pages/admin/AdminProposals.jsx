import { CrudPanel, ImageField, text } from './shared.jsx';
import { PROGRESS_LABEL } from '../../progress.js';

export default function AdminProposals() {
  return (
    <CrudPanel
      listPath="/proposals/all" endpoint="/proposals" newLabel="Nueva propuesta"
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
