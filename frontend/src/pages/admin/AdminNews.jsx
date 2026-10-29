import { formatDate } from '../../api.js';
import { CrudPanel, ImageField, text } from './shared.jsx';

export default function AdminNews() {
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
