// Vista previa al compartir, sitemap y robots (F1). Son funciones puras de frontend/api: no necesitan base de datos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { escapeHtml, plainText, previewFor, renderPreview, renderSitemap, renderRobots, apiBase, originOf, fetchJson, PAGES } from '../../frontend/api/_seo.js';
import ogHandler from '../../frontend/api/og.js';
import sitemapHandler from '../../frontend/api/sitemap.js';
import robotsHandler from '../../frontend/api/robots.js';

const ORIGIN = 'https://sitio.example';
const API = 'https://api.example';
const vercel = JSON.parse(fs.readFileSync(new URL('../../frontend/vercel.json', import.meta.url), 'utf8'));

// Respuesta falsa con la misma forma que la de Vercel
function fakeRes() {
  const res = { headers: {}, setHeader: (k, v) => (res.headers[k.toLowerCase()] = v), status: (c) => ((res.code = c), res), send: (b) => ((res.body = b), res) };
  return res;
}
const fakeReq = (query = {}, host = 'sitio.example') => ({ query, headers: { host } });

test('las etiquetas se escapan: un título con HTML no puede inyectar nada en la vista previa', () => {
  assert.equal(escapeHtml(`<script>alert("x")</script> & 'y'`), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;');
  const html = renderPreview({ origin: ORIGIN, path: '/noticias/x', title: '"><script>alert(1)</script>', description: '<img src=x onerror=alert(1)>' });
  assert.ok(!html.includes('<script>') && !html.includes('<img'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('plainText quita la sintaxis de Markdown y acorta', () => {
  assert.equal(plainText('Hola **mundo** con [un enlace](https://x.com) y *cursiva*\n\n- lista'), 'Hola mundo con un enlace y cursiva lista');
  const largo = plainText('palabra '.repeat(100), 50);
  assert.ok(largo.length <= 50 && largo.endsWith('…'));
});

test('la vista previa de una noticia lleva su título, resumen, portada JPEG de la API y canónica', () => {
  const news = { title: 'Reto Impacto', excerpt: 'Tapitas con causa', body: 'cuerpo', coverImage: 'abc123' };
  const html = renderPreview(previewFor({ origin: ORIGIN, slug: 'reto-impacto', news, api: API }));
  assert.match(html, /<title>Reto Impacto · Generación de Impacto<\/title>/);
  assert.ok(html.includes('<meta property="og:title" content="Reto Impacto · Generación de Impacto">'));
  assert.ok(html.includes('<meta property="og:description" content="Tapitas con causa">'));
  assert.ok(html.includes(`<meta property="og:image" content="${API}/api/files/abc123?og=1">`));
  assert.ok(html.includes('<meta property="og:type" content="article">'));
  assert.ok(html.includes(`<link rel="canonical" href="${ORIGIN}/noticias/reto-impacto">`));
  assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image">'));
  assert.ok(html.includes('og:image:width" content="1200"') && html.includes('og:image:height" content="630"'));
});

test('sin resumen se usa el cuerpo sin formato; sin portada, la imagen por defecto del sitio', () => {
  const p = previewFor({ origin: ORIGIN, slug: 's', news: { title: 'T', body: 'Un **texto** largo', coverImage: null }, api: API });
  assert.equal(p.description, 'Un texto largo');
  assert.ok(renderPreview(p).includes(`content="${ORIGIN}/og-default.png"`));
});

test('las páginas fijas y el inicio tienen su propia vista previa; una ruta desconocida cae al inicio', () => {
  for (const page of Object.keys(PAGES)) {
    const p = previewFor({ origin: ORIGIN, page });
    assert.equal(p.title, PAGES[page][0]);
    assert.equal(p.path, `/${page}`);
  }
  assert.equal(previewFor({ origin: ORIGIN }).path, '/');
  assert.equal(previewFor({ origin: ORIGIN, page: 'admin' }).path, '/', 'nada del panel');
  assert.ok(renderPreview(previewFor({ origin: ORIGIN })).includes('<title>Generación de Impacto</title>'));
});

test('sitemap: rutas públicas y noticias con su fecha; sin rutas del panel; escapa los caracteres especiales', () => {
  const xml = renderSitemap({ origin: ORIGIN, news: [{ slug: 'una-noticia', publishedAt: '2026-10-27T10:00:00Z' }, { slug: 'con&simbolo' }] });
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  for (const ruta of ['/', '/propuestas', '/noticias', '/buzon', '/seguimiento', '/equipo', '/privacidad']) assert.ok(xml.includes(`<loc>${ORIGIN}${ruta}</loc>`), ruta);
  assert.ok(xml.includes(`<loc>${ORIGIN}/noticias/una-noticia</loc><lastmod>2026-10-27</lastmod>`));
  assert.ok(xml.includes('con&amp;simbolo'));
  assert.ok(!/admin|acceso|perfil/.test(xml));
});

test('robots.txt bloquea el panel, el acceso y el perfil, y apunta al sitemap del dominio actual', () => {
  const txt = renderRobots({ origin: ORIGIN });
  assert.ok(txt.includes('Disallow: /admin') && txt.includes('Disallow: /acceso') && txt.includes('Disallow: /perfil'));
  assert.ok(txt.includes(`Sitemap: ${ORIGIN}/sitemap.xml`));
});

test('apiBase lee API_URL o VITE_API_URL sin barra final; originOf respeta el host reenviado', () => {
  assert.equal(apiBase({ API_URL: 'https://a.example/' }), 'https://a.example');
  assert.equal(apiBase({ VITE_API_URL: 'https://b.example' }), 'https://b.example');
  assert.equal(apiBase({}), '');
  assert.equal(originOf({ headers: { host: 'interno', 'x-forwarded-host': 'publico.example' } }), 'https://publico.example');
});

test('fetchJson devuelve null ante errores, respuestas no exitosas o JSON roto (la vista previa sigue funcionando)', async () => {
  assert.deepEqual(await fetchJson('x', async () => ({ ok: true, json: async () => ({ a: 1 }) })), { a: 1 });
  assert.equal(await fetchJson('x', async () => ({ ok: false })), null);
  assert.equal(await fetchJson('x', async () => { throw new Error('caído'); }), null);
  assert.equal(await fetchJson('x', async () => ({ ok: true, json: async () => { throw new Error('mal'); } })), null);
});

test('los manejadores: og responde HTML con caché y 404 para una noticia inexistente; sitemap y robots, su tipo', async () => {
  const original = globalThis.fetch;
  process.env.API_URL = API;
  try {
    globalThis.fetch = async (url) => (String(url).endsWith('/api/news/existe') ? { ok: true, json: async () => ({ title: 'Existe', excerpt: 'Sí', body: 'x', coverImage: 'img1' }) } : { ok: false });
    const ok = fakeRes();
    await ogHandler(fakeReq({ slug: 'existe' }), ok);
    assert.equal(ok.code, 200);
    assert.match(ok.headers['content-type'], /text\/html/);
    assert.match(ok.headers['cache-control'], /s-maxage/);
    assert.ok(ok.body.includes('Existe · Generación de Impacto') && ok.body.includes(`${API}/api/files/img1?og=1`));

    const falta = fakeRes();
    await ogHandler(fakeReq({ slug: 'no-existe' }), falta);
    assert.equal(falta.code, 404);

    const inicio = fakeRes();
    await ogHandler(fakeReq({}), inicio);
    assert.equal(inicio.code, 200);

    globalThis.fetch = async () => ({ ok: true, json: async () => [{ slug: 'una', publishedAt: '2026-11-01T00:00:00Z' }] });
    const sm = fakeRes();
    await sitemapHandler(fakeReq(), sm);
    assert.match(sm.headers['content-type'], /xml/);
    assert.ok(sm.body.includes('https://sitio.example/noticias/una'));

    globalThis.fetch = async () => { throw new Error('API caída'); };
    const smCaido = fakeRes();
    await sitemapHandler(fakeReq(), smCaido);
    assert.equal(smCaido.code, 200, 'con la API caída el sitemap sigue listando las rutas fijas');
    assert.ok(smCaido.body.includes('/propuestas'));

    const rb = fakeRes();
    robotsHandler(fakeReq(), rb);
    assert.match(rb.headers['content-type'], /text\/plain/);
  } finally {
    globalThis.fetch = original;
    delete process.env.API_URL;
  }
});

test('vercel.json: solo los rastreadores de redes sociales van a /api/og; los navegadores y buscadores siguen a la app', () => {
  const reglas = vercel.rewrites.filter((r) => r.destination.startsWith('/api/og'));
  assert.equal(reglas.length, 3, 'noticia, páginas fijas e inicio');
  const patron = new RegExp(reglas[0].has[0].value);
  for (const r of reglas) assert.equal(r.has[0].value, reglas[0].has[0].value, 'misma lista de rastreadores');

  const rastreadores = [
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', 'WhatsApp/2.23.20.0 A', 'Twitterbot/1.0',
    'TelegramBot (like TwitterBot)', 'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)', 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
    'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)', 'Mozilla/5.0 (Macintosh) Applebot/0.1', 'Pinterest/0.2 (+http://www.pinterest.com/bot.html)',
  ];
  const personasYBuscadores = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  ];
  for (const ua of rastreadores) assert.ok(patron.test(ua), ua);
  for (const ua of personasYBuscadores) assert.ok(!patron.test(ua), ua);

  // La reescritura general a la app va al final, y sitemap y robots antes que ella
  assert.deepEqual(vercel.rewrites.at(-1), { source: '/(.*)', destination: '/index.html' });
  assert.ok(vercel.rewrites.some((r) => r.source === '/sitemap.xml' && r.destination === '/api/sitemap'));
  assert.ok(vercel.rewrites.some((r) => r.source === '/robots.txt' && r.destination === '/api/robots'));
});
