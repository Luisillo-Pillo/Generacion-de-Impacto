// API simulada en el navegador para las pruebas de extremo a extremo (no hay backend): estado en memoria y las rutas que usa el sitio.

const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWP4//8/AAX+Av5Y8msOAAAAAElFTkSuQmCC', 'base64');
export const CODE = 'GI-ABCDE-FGHJK';
const ADMIN = { id: 'u1', name: 'Ana Prueba', email: 'ana@test.com', role: 'admin' };
const MEMBER = { _id: 'm1', name: 'Ana Prueba', role: 'Presidencia' };

// Simula las rutas de la API con un estado en memoria. Devuelve lo que la página envió, para poder comprobarlo.
export async function mockApi(page, { loggedIn = false, role = 'admin' } = {}) {
  const admin = { ...ADMIN, role };
  const state = {
    news: [{ _id: 'n1', slug: 'primera', title: 'Primera noticia', excerpt: 'Resumen', body: 'Cuerpo', published: true, createdAt: '2026-10-20T10:00:00Z', publishedAt: '2026-10-20T10:00:00Z' }],
    proposals: [
      { _id: 'p1', number: 1, title: 'Propuesta uno', objective: 'Objetivo uno', published: true, progress: 'planeada' },
      { _id: 'p2', number: 2, title: 'Propuesta dos', objective: 'Objetivo dos', published: true, progress: 'en_marcha', progressNote: 'Ya hay fecha' },
    ],
    messages: [{ _id: 'g1', type: 'queja', anonymous: true, subject: 'Un asunto', body: 'Un mensaje', status: 'nuevo', review: 'pendiente', images: [], createdAt: '2026-10-28T20:35:00Z' }],
    trash: [],
    sent: { message: null, news: null, patch: null, note: null, track: null, query: null, order: null, me: null, state: null },
    fileRequests: [],
    members: [MEMBER, { _id: 'm2', name: 'Beto Segundo', role: 'Secretaría' }],
    loggedIn,
  };
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const { pathname, searchParams } = new URL(req.url());
    const path = pathname.replace(/^\/api/, '');
    const method = req.method();

    if (path === '/settings') return json(route, { degrees: ['Licenciatura en Primaria'], groups: ['A'], semesters: ['1', '2'], groupDegrees: [], social: {} });
    // Las rutas del panel responden 401 cuando la sesión ya no vale
    const privada = path === '/messages' || path.startsWith('/messages/') || path === '/audit' || path.endsWith('/all');
    if (privada && method !== 'POST' && !state.loggedIn) return json(route, { error: 'Sesión inválida o expirada' }, 401);
    if (path === '/auth/login') {
      state.loggedIn = true;
      return json(route, { token: 'token-de-prueba', user: admin, member: MEMBER });
    }
    if (path === '/auth/me') return state.loggedIn ? json(route, { user: admin, member: MEMBER }) : json(route, { error: 'No autenticado' }, 401);
    if (path === '/news/all') return json(route, state.news);
    if (path === '/news' && method === 'POST') {
      state.sent.news = req.postDataJSON();
      const created = { _id: 'n2', slug: 'creada', createdAt: '2026-11-01T10:00:00Z', ...state.sent.news };
      state.news.unshift(created);
      return json(route, created, 201);
    }
    if (path.startsWith('/news/') && method === 'GET') {
      const n = state.news.find((x) => `/news/${x.slug}` === path);
      return n ? json(route, n) : json(route, { error: 'Noticia no encontrada' }, 404);
    }
    if (path === '/news') return json(route, state.news.filter((n) => n.published));
    if (path === '/proposals' || path === '/proposals/all') return json(route, state.proposals);
    if (path === '/members/order' && method === 'PUT') {
      state.sent.order = req.postDataJSON().ids;
      state.members = state.sent.order.map((id) => state.members.find((m) => m._id === id));
      return json(route, state.members);
    }
    if (path === '/members/me' && method === 'PUT') {
      state.sent.me = req.postDataJSON();
      return json(route, { user: { ...admin, name: state.sent.me.name }, member: { ...MEMBER, ...state.sent.me } });
    }
    // Correo y rol de cada integrante (nunca contraseñas): lo ven el Miembro y el Moderador
    if (path === '/members/all') return json(route, state.members.map((m) => ({ ...m, email: `${m._id}@test.com`, access: m._id === 'm1' ? role : 'miembro' })));
    if (path === '/members') return json(route, state.members);
    if (path === '/messages' && method === 'POST') {
      state.sent.message = req.postData() || '';
      return json(route, { ok: true, code: CODE }, 201);
    }
    if (path === '/messages/track') {
      state.sent.track = req.postDataJSON();
      return state.sent.track.code.replace(/[^A-Za-z0-9]/g, '').toUpperCase() === CODE.replace(/-/g, '')
        ? json(route, { type: 'queja', subject: 'Baños sin agua', status: 'leido', review: 'en_proceso', createdAt: '2026-10-28T20:35:00Z', updatedAt: '2026-10-30T09:00:00Z', publicReply: 'Ya mandamos arreglarlos.', publicReplyAt: '2026-10-30T09:00:00Z', publicReplyBy: { name: 'Ana Prueba', role: 'Presidencia' } })
        : json(route, { error: 'No encontramos un mensaje con ese código. Revisa que esté completo.' }, 404);
    }
    if (path === '/messages/stats') return json(route, { nuevos: state.messages.length, pendientes: state.messages.length, total: state.messages.length, porTipo: { queja: state.messages.length, propuesta: 0, pregunta: 0, problema: 0 } });
    if (path === '/messages/export') return route.fulfill({ status: 200, contentType: 'text/csv', body: '\ufeff"Asunto"\r\n"Un asunto"' });
    if (path === '/messages/g1/notes') {
      state.sent.note = req.postDataJSON();
      state.messages[0].notes = [...(state.messages[0].notes ?? []), { authorName: 'Ana Prueba', text: state.sent.note.text, at: '2026-11-02T12:00:00Z' }];
      return json(route, state.messages[0], 201);
    }
    if (/^\/(news|proposals)\/[^/]+\/state$/.test(path) && method === 'PATCH') {
      state.sent.state = { path, body: req.postDataJSON() };
      return json(route, { ok: true });
    }
    if (path === '/messages/g1' && method === 'PATCH') {
      state.sent.patch = req.postDataJSON();
      Object.assign(state.messages[0], state.sent.patch);
      if (state.sent.patch.publicReply) state.messages[0].publicReplyBy = { name: admin.name, role: MEMBER.role };
      return json(route, state.messages[0]);
    }
    if (path === '/messages') {
      state.sent.query = Object.fromEntries(searchParams);
      const list = searchParams.get('trash') === '1' ? state.trash : state.messages;
      const q = (searchParams.get('q') || '').toLowerCase();
      const items = q ? list.filter((m) => `${m.subject} ${m.body}`.toLowerCase().includes(q)) : list;
      return searchParams.has('page') ? json(route, { items, total: items.length, page: 1, pages: 1 }) : json(route, items);
    }
    if (path === '/messages/g1' && method === 'DELETE') {
      state.trash = state.messages.map((m) => ({ ...m, deletedAt: '2026-11-02T12:00:00Z' }));
      state.messages = [];
      return route.fulfill({ status: 204 });
    }
    if (path === '/messages/g1/restore') {
      state.messages = state.trash.map(({ deletedAt: _, ...m }) => m);
      state.trash = [];
      return json(route, state.messages[0]);
    }
    // Las imágenes de los mensajes son privadas: solo se entregan con la cabecera de sesión
    if (path.startsWith('/files/')) {
      state.fileRequests.push({ path: path + (searchParams.has('w') ? `?w=${searchParams.get('w')}` : ''), auth: req.headers()['authorization'] ?? null });
      if (!req.headers()['authorization']) return json(route, { error: 'No autenticado' }, 401);
      return route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1X1 });
    }
    if (path === '/audit') {
      return json(route, { items: [{ _id: 'a1', at: '2026-11-02T12:00:00Z', userName: 'Ana Prueba', action: 'noticia.crear', summary: 'Creó la noticia «Una noticia»' }], total: 1, page: 1, pages: 1 });
    }
    return json(route, { error: 'Ruta no simulada: ' + path }, 404);
  });
  return state;
}

// Deja la sesión iniciada como si ya hubiera entrado antes (el sitio guarda el token en localStorage)
export const withSession = (page) => page.addInitScript(() => localStorage.setItem('gi_token', 'token-de-prueba'));
