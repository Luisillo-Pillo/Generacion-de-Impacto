import { useEffect } from 'react';

const SITE = 'Generación de Impacto';
const DEFAULT_DESCRIPTION = 'Generación de Impacto: planilla del Consejo Estudiantil de la ENSFA. Nuestra voz, nuestras ideas, nuestro impacto.';

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!content) return el?.remove();
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

// Título, descripción y etiquetas para compartir de la página actual (para el navegador y para Google, que sí ejecuta
// JavaScript). Las vistas previas de WhatsApp/Facebook no ejecutan JavaScript: esas las sirve `api/og.js` en Vercel.
// Al salir de la página se restablecen los valores por defecto.
export function usePageMeta({ title, description, image, type = 'website' } = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} · ${SITE}` : SITE;
    const text = (description || DEFAULT_DESCRIPTION).trim().slice(0, 200);
    const url = `${window.location.origin}${window.location.pathname}`;
    document.title = fullTitle;
    setMeta('name', 'description', text);
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', text);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', image || `${window.location.origin}/og-default.png`);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setCanonical(url);
    return () => {
      document.title = SITE;
      setMeta('name', 'description', DEFAULT_DESCRIPTION);
    };
  }, [title, description, image, type]);
}
