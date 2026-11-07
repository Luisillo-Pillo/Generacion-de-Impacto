// Genera frontend/public/og-default.png (1200 × 630): la imagen que se ve al compartir un enlace del sitio en WhatsApp,
// Facebook, etc. cuando la página no tiene una portada propia. Se usa `sharp` (dependencia del backend).
// Uso: node scripts/make-og-image.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sharp = createRequire(path.join(root, 'backend/package.json'))('sharp');

const W = 1200;
const H = 630;
const BLACK = '#121212'; // el logo lleva textos blancos: sobre fondo oscuro, como en el encabezado del sitio
const logo = await sharp(path.join(root, 'frontend/public/brand/logo-planilla.svg'), { density: 300 })
  .resize({ height: 470, fit: 'inside' })
  .png()
  .toBuffer();
const { width: logoW, height: logoH } = await sharp(logo).metadata();

// Filete rojo inferior, como el pie del sitio
const bands = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
     <rect y="${H - 14}" width="${W}" height="14" fill="#d4141c"/>
   </svg>`
);

await sharp({ create: { width: W, height: H, channels: 3, background: BLACK } })
  .composite([
    { input: bands, top: 0, left: 0 },
    { input: logo, top: Math.round((H - 14 - logoH) / 2), left: Math.round((W - logoW) / 2) },
  ])
  .png({ compressionLevel: 9 })
  .toFile(path.join(root, 'frontend/public/og-default.png'));
console.log('frontend/public/og-default.png generada');
