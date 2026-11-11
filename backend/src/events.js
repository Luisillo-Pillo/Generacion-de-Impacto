// Eventos en vivo para el panel (Server-Sent Events): cuando algo cambia (llega o se responde un mensaje, se publica una noticia o
// propuesta, cambia el equipo o alguien se conecta), el servidor avisa a las sesiones abiertas del panel al instante.
//
// El aviso lleva SOLO el tema que cambió (`messages`, `news`, `proposals`, `team`, `presence`): nunca contenido, ids ni datos de
// nadie. Al recibirlo, el panel vuelve a pedir esa lista por la ruta de siempre, con sus permisos de siempre.
//
// Es un bus en memoria: sirve con una sola instancia del servidor (Render gratis). Con varias haría falta un bus compartido.
// No limita por IP (la comunidad comparte red); el único tope es por cuenta, para que una persona con muchas pestañas no acapare.
const TOPICS = ['messages', 'news', 'proposals', 'team', 'presence'];

const HEARTBEAT_MS = 25 * 1000; // comentario periódico: evita que proxys o el navegador cierren la conexión por inactiva
const MAX_STREAM_MS = 15 * 60 * 1000; // cada conexión se renueva sola (y vuelve a validar la sesión)
const MAX_PER_USER = 8; // conexiones simultáneas por cuenta; al pasarse se cierra la más antigua

const clients = new Set(); // { res, userId, role, timers }

// Avisos que solo recibe el Moderador (quién está conectado es un dato suyo)
const ADMIN_ONLY = new Set(['presence']);

function close(client) {
  if (!clients.delete(client)) return;
  clearInterval(client.heartbeat);
  clearTimeout(client.expire);
  client.res.end();
}

// Abre el canal para una petición ya autenticada y lo mantiene hasta que se cierre o venza
export function openStream(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // que ningún proxy retenga los avisos
  });
  const client = { res, userId: String(req.user._id), role: req.user.role };
  // Si la cuenta ya tiene el máximo de conexiones, se cierra la más antigua (las pestañas olvidadas)
  const mine = [...clients].filter((c) => c.userId === client.userId);
  if (mine.length >= MAX_PER_USER) close(mine[0]);
  clients.add(client);
  res.write('retry: 5000\n: conectado\n\n');
  client.heartbeat = setInterval(() => res.write(': latido\n\n'), HEARTBEAT_MS);
  client.expire = setTimeout(() => close(client), MAX_STREAM_MS);
  client.heartbeat.unref();
  client.expire.unref();
  req.on('close', () => close(client));
}

// Avisa a quien corresponda que cambió un tema. Es "dispara y olvida": nunca rompe la petición que lo origina.
export function publish(topic) {
  if (!TOPICS.includes(topic)) return;
  const message = `data: ${JSON.stringify({ topic })}\n\n`;
  for (const client of clients) {
    if (ADMIN_ONLY.has(topic) && client.role !== 'admin') continue;
    try {
      client.res.write(message);
    } catch {
      close(client);
    }
  }
}

// Cierra las conexiones de una cuenta (cambió su rol o su contraseña, o la eliminaron): al reconectar se valida otra vez
export function closeUser(userId) {
  for (const client of [...clients]) if (client.userId === String(userId)) close(client);
}
