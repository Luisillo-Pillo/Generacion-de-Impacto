import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';

// Cuerpo de una noticia: Markdown SIN HTML crudo (`skipHtml`), solo con los elementos de formato permitidos y enlaces
// únicamente http(s) o correo. Así no se puede inyectar ningún script ni estilo desde el panel.
// Los saltos de línea simples se respetan (como en las noticias escritas antes del formato).
const ALLOWED = ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'h2', 'h3', 'blockquote'];
const safeUrl = (url) => (/^(https?:|mailto:)/i.test(url) ? url : '');

export default function MarkdownView({ children }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkBreaks]}
      skipHtml
      allowedElements={ALLOWED}
      unwrapDisallowed
      urlTransform={safeUrl}
      components={{ a: ({ href, children: label }) => <a href={href || undefined} target="_blank" rel="noopener noreferrer">{label}</a> }}
    >
      {children}
    </ReactMarkdown>
  );
}
