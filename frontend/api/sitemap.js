// Función de Vercel: sitemap.xml dinámico (rutas públicas + noticias publicadas). `vercel.json` reescribe /sitemap.xml aquí.
import { apiBase, fetchJson, originOf, renderSitemap } from './_seo.js';

export default async function handler(req, res) {
  const api = apiBase();
  const news = api ? await fetchJson(`${api}/api/news`) : null;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(renderSitemap({ origin: originOf(req), news: Array.isArray(news) ? news : [] }));
}
