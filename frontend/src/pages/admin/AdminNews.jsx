import { formatDate } from '../../api.js';
import MarkdownEditor from '../../components/MarkdownEditor.jsx';
import { CrudPanel, GalleryField, ImageField, text } from './shared.jsx';

// <input type="datetime-local"> trabaja con la hora local sin zona; la API guarda ISO
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocalInput = (value) => (value ? new Date(value).toISOString() : null);
const status = (n) => (!n.published ? 'Borrador' : n.publishedAt && new Date(n.publishedAt) > new Date() ? `Programada para el ${formatDate(n.publishedAt)}` : 'Publicada');

export default function AdminNews() {
  return (
    <CrudPanel
      listPath="/news/all" endpoint="/news" newLabel="Nueva noticia"
      blank={() => ({ title: '', excerpt: '', body: '', coverImage: null, gallery: [], publishedAt: null, published: true })}
      summary={(n) => <><strong>{n.title}</strong><br /><span className="muted">{status(n)} · {formatDate(n.createdAt)}</span></>}
      fields={(n, set) => (
        <>
          {text('Título', n.title, set('title'), { required: true, maxLength: 160 })}
          {text('Resumen (opcional)', n.excerpt, set('excerpt'), { maxLength: 300 })}
          <MarkdownEditor label="Contenido" required value={n.body} onChange={set('body')} />
          <ImageField label="Imagen de portada" value={n.coverImage} onChange={set('coverImage')} />
          <GalleryField label="Galería" value={n.gallery ?? []} onChange={set('gallery')} />
          <label className="check"><input type="checkbox" checked={n.published} onChange={(e) => set('published')(e.target.checked)} /> Publicada</label>
          {n.published && (
            <label>Fecha y hora de publicación (déjala vacía para publicar ahora; una fecha futura la deja programada)
              <input type="datetime-local" value={toLocalInput(n.publishedAt)} onChange={(e) => set('publishedAt')(fromLocalInput(e.target.value))} />
            </label>
          )}
        </>
      )}
    />
  );
}
