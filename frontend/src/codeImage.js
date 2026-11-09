// Imagen descargable del código de seguimiento (PNG de 1080 × 720, pensada para guardarla en la galería del teléfono o
// mandársela por WhatsApp). Lleva el código, el aviso de que no se debe perder y el enlace para consultarlo; NUNCA el
// asunto ni el texto del mensaje: por eso esta función ni siquiera los recibe. Se dibuja en el navegador (canvas).
const IMAGE_WIDTH = 1080;
const IMAGE_HEIGHT = 720;

const PAPER = '#f1e8db';
const BLACK = '#121212';
const RED = '#d4141c';

// Parte un texto en líneas que quepan en `maxWidth`
function wrap(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const attempt = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(attempt).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = attempt;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function loadLogo() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // sin logo la imagen sale igual
    img.src = '/brand/logo-planilla.svg';
  });
}

export async function renderCodeImage(code, origin = window.location.origin) {
  // Las tipografías del sitio tienen que estar cargadas antes de dibujar con ellas
  await Promise.all([
    document.fonts.load('136px Anton'),
    document.fonts.load('600 28px Poppins'),
    document.fonts.load('700 36px Poppins'),
    document.fonts.load('400 28px Poppins'),
  ]).catch(() => {});
  const logo = await loadLogo();

  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_WIDTH;
  canvas.height = IMAGE_HEIGHT;
  const ctx = canvas.getContext('2d');
  const cx = IMAGE_WIDTH / 2;

  ctx.fillStyle = BLACK;
  ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
  ctx.fillStyle = RED;
  ctx.fillRect(0, 0, IMAGE_WIDTH, 14);
  ctx.fillRect(0, IMAGE_HEIGHT - 14, IMAGE_WIDTH, 14);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  if (logo) {
    const height = 110;
    const width = (logo.naturalWidth || 561) / (logo.naturalHeight || 496) * height;
    ctx.drawImage(logo, cx - width / 2, 36, width, height);
  }

  ctx.fillStyle = PAPER;
  ctx.font = '600 28px Poppins, sans-serif';
  ctx.letterSpacing = '4px';
  ctx.fillText('TU CÓDIGO DE SEGUIMIENTO', cx, 200);
  ctx.letterSpacing = '6px';
  ctx.font = '136px Anton, Impact, sans-serif';
  ctx.fillText(code, cx, 345);
  ctx.letterSpacing = '0px';

  // Aviso destacado
  const boxX = 70;
  const boxW = IMAGE_WIDTH - 140;
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.roundRect(boxX, 385, boxW, 130, 14);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 36px Poppins, sans-serif';
  const aviso = wrap(ctx, '¡No lo pierdas! No se vuelve a mostrar y no lo podemos recuperar.', boxW - 70);
  const startY = 385 + 65 - ((aviso.length - 1) * 22) + 12;
  aviso.forEach((line, i) => ctx.fillText(line, cx, startY + i * 46));

  ctx.fillStyle = '#cfc6b8';
  ctx.font = '400 28px Poppins, sans-serif';
  ctx.fillText('Con él consultas en qué va tu mensaje y la respuesta del equipo en:', cx, 575);
  ctx.fillStyle = PAPER;
  ctx.font = '700 32px Poppins, sans-serif';
  ctx.fillText(`${origin.replace(/^https?:\/\//, '')}/seguimiento`, cx, 625);

  ctx.fillStyle = '#8f877b';
  ctx.font = '400 22px Poppins, sans-serif';
  ctx.fillText('Generación de Impacto · ENSFA', cx, 685);

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen'))), 'image/png'));
}
