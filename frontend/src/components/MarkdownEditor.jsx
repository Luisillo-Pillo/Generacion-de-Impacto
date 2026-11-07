import { useRef, useState } from 'react';
import MarkdownView from './MarkdownView.jsx';
import './MarkdownEditor.css';

// Editor sencillo de Markdown: una barra que inserta la sintaxis (negrita, cursiva, enlace, lista) alrededor de lo
// seleccionado y una vista previa en vivo con el mismo componente que usa el sitio.
export default function MarkdownEditor({ label, value, onChange, required, maxLength = 20000 }) {
  const ref = useRef(null);
  const [preview, setPreview] = useState(false);

  // Aplica `edit(selección, inicio) → { text, from?, to? }` sobre el texto seleccionado (from/to: qué queda seleccionado
  // después, por defecto lo insertado) y devuelve el foco al campo
  function apply(edit) {
    const el = ref.current;
    const [start, end] = [el.selectionStart, el.selectionEnd];
    const { text, from = start, to = start + text.length } = edit(value.slice(start, end), start);
    onChange(value.slice(0, start) + text + value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(from, to);
    });
  }
  function wrap(mark, placeholder) {
    apply((sel, start) => {
      const inner = sel || placeholder;
      return { text: `${mark}${inner}${mark}`, from: start + mark.length, to: start + mark.length + inner.length };
    });
  }
  function link() {
    apply((sel, start) => {
      const labelText = sel || 'texto del enlace';
      const text = `[${labelText}](https://)`;
      return { text, from: start + labelText.length + 3, to: start + text.length - 1 };
    });
  }
  function list() {
    apply((sel) => ({ text: (sel || 'elemento').split('\n').map((l) => `- ${l}`).join('\n') }));
  }

  return (
    <div className="md-editor">
      <span className="md-label">{label}</span>
      <div className="md-toolbar" role="toolbar" aria-label="Formato del texto">
        <button type="button" onClick={() => wrap('**', 'negritas')} aria-label="Negritas"><strong>N</strong></button>
        <button type="button" onClick={() => wrap('*', 'cursiva')} aria-label="Cursiva"><em>K</em></button>
        <button type="button" onClick={link} aria-label="Enlace">Enlace</button>
        <button type="button" onClick={list} aria-label="Lista">Lista</button>
        <label className="md-preview-toggle"><input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} /> Vista previa</label>
      </div>
      <textarea ref={ref} required={required} rows={12} maxLength={maxLength} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} />
      <small className="muted">Separa párrafos con una línea en blanco. Los enlaces deben empezar con https://</small>
      {preview && (
        <div className="md-preview article" aria-label="Vista previa">
          {value.trim() ? <MarkdownView>{value}</MarkdownView> : <p className="muted">Escribe algo para ver cómo quedará.</p>}
        </div>
      )}
    </div>
  );
}
