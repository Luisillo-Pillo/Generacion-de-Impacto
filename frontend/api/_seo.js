// Piezas puras de la vista previa al compartir (Open Graph), el sitemap y el robots.txt. Las usan las funciones de
// Vercel de esta carpeta (og.js, sitemap.js, robots.js); van aparte para poder probarlas sin servidor. Los archivos cuyo
// nombre empieza con «_» no se publican como funciones.
//
// Por qué existe: el sitio es una app de una sola página y los rastreadores de WhatsApp, Facebook, X, Telegram, etc. NO
// ejecutan JavaScript, así que sin esto todos los enlaces mostrarían la misma tarjeta en blanco. `vercel.json` manda a
// esos rastreadores (por su User-Agent) a `/api/og`, que les devuelve un HTML mínimo con las etiquetas de la página.
// Las personas reciben siempre la app normal.

export const SITE = 'Generación de Impacto';
export const DEFAULT_DESCRIPTION = 'Generación de Impacto: planilla del Consejo Estudiantil de la ENSFA. Nuestra voz, nuestras ideas, nuestro impacto.';

// Rutas públicas fijas: título y descripción que se muestran al compartirlas
export const PAGES = {
  propuestas: ['Propuestas', 'Acciones concretas de la planilla Generación de Impacto para una ENSFA más unida, participativa y solidaria.'],
  noticias: ['Noticias', 'Las últimas noticias de la planilla Generación de Impacto del Consejo Estudiantil de la ENSFA.'],
  buzon: ['Buzón digital', 'Cuéntanos tus quejas, propuestas, preguntas o problemas, de forma anónima o con tus datos.'],
  seguimiento: ['Seguimiento de tu mensaje', 'Consulta en qué va tu mensaje del buzón con tu código de seguimiento.'],
  equipo: ['Equipo', 'Conoce a las personas de la planilla Generación de Impacto y cómo contactarlas.'],
  privacidad: ['Aviso de privacidad', 'Cómo cuidamos los datos y mensajes que nos compartes en el buzón de Generación de Impacto.'],
};

export const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Quita la sintaxis de Markdown y acorta, para usar el cuerpo de una noticia como descripción
export const plainText = (markdown, max = 200) => {
  const text = String(markdown ?? '').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_#>`~-]/g, '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
};

// URL base de la API (variable de Vercel: API_URL, o VITE_API_URL que ya existe para el sitio), sin barra final
export const apiBase = (env = process.env) => (env.API_URL || env.VITE_API_URL || '').replace(/\/$/, '');

// HTML mínimo para el rastreador: etiquetas de la página y un enlace al sitio real
export function renderPreview({ origin, path, title, description, image, type = 'website' }) {
  const fullTitle = title ? `${title} · ${SITE}` : SITE;
  const desc = description || DEFAULT_DESCRIPTION;
  const url = `${origin}${path}`;
  const img = image || `${origin}/og-default.png`;
  const meta = [
    ['name', 'description', desc],
    ['property', 'og:site_name', SITE],
    ['property', 'og:locale', 'es_MX'],
    ['property', 'og:type', type],
    ['property', 'og:title', fullTitle],
    ['property', 'og:description', desc],
    ['property', 'og:url', url],
    ['property', 'og:image', img],
    ['property', 'og:image:width', '1200'],
    ['property', 'og:image:height', '630'],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:title', fullTitle],
    ['name', 'twitter:description', desc],
    ['name', 'twitter:image', img],
  ];
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${escapeHtml(fullTitle)}</title>
<link rel="canonical" href="${escapeHtml(url)}">
${meta.map(([attr, key, value]) => `<meta ${attr}="${key}" content="${escapeHtml(value)}">`).join('\n')}
</head>
<body>
<h1>${escapeHtml(title || SITE)}</h1>
<p>${escapeHtml(desc)}</p>
<p><a href="${escapeHtml(url)}">Abrir en ${SITE}</a></p>
</body>
</html>
`;
}

// Qué mostrar para una petición: noticia (si se encontró), página fija o inicio
export function previewFor({ origin, slug, page, news, api }) {
  if (slug && news) {
    return {
      origin, path: `/noticias/${slug}`, title: news.title, type: 'article',
      description: news.excerpt || plainText(news.body),
      image: news.coverImage && api ? `${api}/api/files/${news.coverImage}?og=1` : undefined,
    };
  }
  if (page && PAGES[page]) return { origin, path: `/${page}`, title: PAGES[page][0], description: PAGES[page][1] };
  return { origin, path: '/' };
}

const xml = (value) => escapeHtml(value);

export function renderSitemap({ origin, news = [] }) {
  const fixed = ['/', '/propuestas', '/noticias', '/buzon', '/seguimiento', '/equipo', '/privacidad'];
  const urls = [
    ...fixed.map((p) => `  <url><loc>${xml(origin + p)}</loc></url>`),
    ...news.map((n) => `  <url><loc>${xml(`${origin}/noticias/${n.slug}`)}</loc>${n.publishedAt ? `<lastmod>${xml(new Date(n.publishedAt).toISOString().slice(0, 10))}</lastmod>` : ''}</url>`),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

export const renderRobots = ({ origin }) =>
  `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /acceso\nDisallow: /perfil\n\nSitemap: ${origin}/sitemap.xml\n`;

// Origen (https://dominio) de la petición, detrás del proxy de Vercel
export const originOf = (req) => `https://${req.headers['x-forwarded-host'] || req.headers.host}`;

// Pide un recurso JSON a la API con un tope de tiempo; null si falla (la vista previa cae a los valores por defecto)
export async function fetchJson(url, fetchFn = fetch) {
  try {
    const res = await fetchFn(url, { signal: AbortSignal.timeout(5000), headers: { Accept: 'application/json' } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}
