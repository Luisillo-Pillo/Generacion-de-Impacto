import { CrudPanel, ImageField, text } from './shared.jsx';

export default function AdminProposals() {
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
