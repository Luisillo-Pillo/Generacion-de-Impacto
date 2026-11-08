// Utilidades compartidas por las pruebas de la API.
//
// Cada archivo de prueba arranca su propia MongoDB en memoria (nunca se conecta a Atlas ni a ninguna base real) y monta
// la aplicación en un puerto libre. Antes de conectar se comprueba por código que el URI sea local y la base `gi_test`.
//
// Alternativa si no se puede descargar el binario de MongoDB: definir TEST_MONGODB_URI con una base llamada exactamente
// `gi_test` (p. ej. en Atlas, nunca la real). Se vacía al empezar y se elimina al terminar. Los archivos de prueba se
// ejecutan uno por uno en ese caso (`npm test` lo hace solo), porque comparten esa única base.
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

// PNG de 1×1 píxel que se decodifica por completo (el servidor lo vuelve a codificar al recibirlo)
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWP4//8/AAX+Av5Y8msOAAAAAElFTkSuQmCC',
  'base64'
);

export async function startServer(env = {}) {
  // Estas variables se leen al cargar app.js, por eso se fijan antes de importarlo.
  process.env.JWT_SECRET = 'secreto-solo-para-pruebas-'.repeat(3);
  delete process.env.CORS_ORIGIN_PATTERN;
  // El límite de envíos del buzón se sube para que las pruebas normales no lo topen; sus pruebas lo fijan en `env`.
  Object.assign(process.env, { CORS_ORIGIN: 'http://localhost:5173', ...env });

  const external = process.env.TEST_MONGODB_URI;
  let mongod = null;
  let uri = external;
  if (!external) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    // Cada archivo de prueba levanta su propio mongod y corren en paralelo: el plazo por defecto (10 s) se queda corto en equipos lentos o con antivirus
    mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 120000 } });
    uri = mongod.getUri('gi_test');
  }
  const { hostname, pathname } = new URL(uri);
  const nameOk = pathname === '/gi_test';
  const hostOk = external ? true : ['127.0.0.1', 'localhost'].includes(hostname);
  if (!nameOk || !hostOk) {
    await mongod?.stop();
    throw new Error(`Las pruebas solo corren contra una base llamada gi_test, nunca contra una real (se recibió ${hostname}${pathname})`);
  }
  process.env.MONGODB_URI = uri;

  const { connectDb } = await import('../src/db.js');
  await connectDb();
  if (external) await mongoose.connection.dropDatabase(); // empezar siempre limpio
  const { app } = await import('../src/app.js');
  const models = await import('../src/models.js');
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;

  // Llama a la API y devuelve { status, json, headers, text, buffer }.
  async function call(method, path, { token, body, form, headers: extra = {} } = {}) {
    const headers = { ...extra };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + path, { method, headers, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined) });
    const buffer = Buffer.from(await res.arrayBuffer());
    const text = buffer.toString('utf8');
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* no era JSON */
    }
    return { status: res.status, json, headers: res.headers, text, buffer };
  }

  // Crea una cuenta de administrador con su ficha de integrante, igual que `npm run create-admin`.
  async function createAdmin(name = 'Ana Prueba', email = 'ana@test.com', password = 'password123') {
    const user = await models.User.create({ name, email, passwordHash: await bcrypt.hash(password, 4), role: 'admin' });
    const member = await models.Member.create({ name, user: user._id });
    return { user, member, email, password };
  }

  async function login(email = 'ana@test.com', password = 'password123') {
    const res = await call('POST', '/auth/login', { body: { email, password } });
    if (res.status !== 200) throw new Error(`No se pudo iniciar sesión (${res.status}): ${res.text}`);
    return res.json.token;
  }

  // Arma un envío multipart del buzón con imágenes opcionales: [{ data, type, name }]
  function messageForm(fields, images = []) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, String(value));
    for (const { data, type, name } of images) form.append('images', new Blob([data], { type }), name);
    return form;
  }

  async function stop() {
    await new Promise((resolve) => server.close(resolve));
    if (external) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    await mongod?.stop();
  }

  return { call, createAdmin, login, messageForm, models, stop, base };
}
