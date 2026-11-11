import { openEventStream } from './api.js';

// Canal de eventos en vivo del panel: con una sesión de Miembro o Moderador, la pestaña mantiene una conexión abierta con el
// servidor (`GET /api/events`) y este recibe avisos al instante cuando algo cambia (`messages`, `news`, `proposals`, `team`,
// `presence`). El aviso no lleva contenido: quien lo recibe vuelve a pedir su lista por la ruta de siempre (ver `useLive`).
// Hay una sola conexión por pestaña, compartida por todas las pantallas. Si se corta (red, servidor dormido, renovación cada
// 15 minutos), reconecta sola con espera creciente y, al volver, avisa a todos para recuperar lo que pudo perderse.

const listeners = new Set(); // { topics: string[], fn }
let connected = false;

export const isLive = () => connected;

// Pide avisos de esos temas; devuelve la función para dejar de recibirlos
export function subscribe(topics, fn) {
  const entry = { topics, fn };
  listeners.add(entry);
  return () => listeners.delete(entry);
}

const emit = (topic) => {
  for (const l of [...listeners]) if (topic === 'all' || l.topics.includes(topic)) l.fn();
};

const sleep = (ms, signal) =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
  });

// Lee el flujo de eventos (texto `data: {"topic":"messages"}` separado por líneas en blanco; las líneas que empiezan con `:` son
// latidos del servidor y se ignoran)
async function read(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    let end;
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const data = /^data: (.*)$/m.exec(block);
      if (!data) continue;
      try {
        emit(JSON.parse(data[1]).topic);
      } catch {
        /* aviso mal formado: se ignora */
      }
    }
  }
}

async function run(signal) {
  let fails = 0;
  while (!signal.aborted) {
    const started = Date.now();
    try {
      const res = await openEventStream(signal);
      if (res) {
        connected = true;
        emit('all'); // al conectar (o reconectar) todas las pantallas se ponen al día
        await read(res.body);
      }
    } catch {
      /* sin red o conexión cortada: se reintenta abajo */
    }
    connected = false;
    if (signal.aborted) return;
    // Una conexión que duró (más de 10 s) reinicia la espera; las que fallan enseguida la duplican (1 s, 2 s, 4 s… hasta 1 min)
    fails = Date.now() - started > 10 * 1000 ? 0 : Math.min(fails + 1, 6);
    await sleep(Math.min(60 * 1000, 1000 * 2 ** Math.max(0, fails - 1)), signal);
  }
}

// Empieza a mantener la conexión; devuelve la función que la cierra (al cerrar sesión)
export function startLive() {
  const ctrl = new AbortController();
  run(ctrl.signal);
  return () => {
    ctrl.abort();
    connected = false;
  };
}
