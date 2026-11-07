// Función de Vercel: HTML con las etiquetas Open Graph para los rastreadores de redes sociales (ver _seo.js).
// Llega aquí solo cuando el User-Agent es de uno de ellos (reglas en vercel.json).
import { apiBase, fetchJson, originOf, previewFor, renderPreview } from './_seo.js';

export default async function handler(req, res) {
  const { slug, page } = req.query;
  const api = apiBase();
  const news = slug && api ? await fetchJson(`${api}/api/news/${encodeURIComponent(slug)}`) : null;
  const preview = previewFor({ origin: originOf(req), slug, page, news, api });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Los rastreadores guardan su propia copia; unos minutos de caché en el borde bastan para no saturar la API
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
  res.status(slug && !news ? 404 : 200).send(renderPreview(preview));
}
