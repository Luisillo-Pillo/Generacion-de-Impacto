// Función de Vercel: robots.txt con el sitemap del dominio actual (por eso es dinámico). /robots.txt se reescribe aquí.
import { originOf, renderRobots } from './_seo.js';

export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=86400');
  res.status(200).send(renderRobots({ origin: originOf(req) }));
}
