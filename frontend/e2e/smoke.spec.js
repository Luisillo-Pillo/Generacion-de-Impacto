// Recorridos de humo: lo mínimo que no debe romperse nunca. La API se simula en el navegador (no hay backend).
import { test, expect } from '@playwright/test';

const ADMIN = { id: 'u1', name: 'Ana Prueba', email: 'ana@test.com', role: 'admin' };
const MEMBER = { _id: 'm1', name: 'Ana Prueba', role: 'Presidencia' };

// Simula las rutas de la API con un estado en memoria. Devuelve lo que la página envió, para poder comprobarlo.
async function mockApi(page, { loggedIn = false } = {}) {
  const state = {
    news: [{ _id: 'n1', slug: 'primera', title: 'Primera noticia', excerpt: 'Resumen', body: 'Cuerpo', published: true, createdAt: '2026-10-20T10:00:00Z', publishedAt: '2026-10-20T10:00:00Z' }],
    proposals: [{ _id: 'p1', number: 1, title: 'Propuesta uno', objective: 'Objetivo uno', published: true }],
    messages: [{ _id: 'g1', type: 'queja', anonymous: true, subject: 'Un asunto', body: 'Un mensaje', status: 'nuevo', review: 'pendiente', images: [], createdAt: '2026-10-28T20:35:00Z' }],
    trash: [],
    sent: { message: null, news: null },
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
      return json(route, { token: 'token-de-prueba', user: ADMIN, member: MEMBER });
    }
    if (path === '/auth/me') return state.loggedIn ? json(route, { user: ADMIN, member: MEMBER }) : json(route, { error: 'No autenticado' }, 401);
    if (path === '/news/all') return json(route, state.news);
    if (path === '/news' && method === 'POST') {
      state.sent.news = req.postDataJSON();
      const created = { _id: 'n2', slug: 'creada', createdAt: '2026-11-01T10:00:00Z', ...state.sent.news };
      state.news.unshift(created);
      return json(route, created, 201);
    }
    if (path === '/news') return json(route, state.news.filter((n) => n.published));
    if (path === '/proposals' || path === '/proposals/all') return json(route, state.proposals);
    if (path === '/members') return json(route, [MEMBER]);
    if (path === '/messages' && method === 'POST') {
      state.sent.message = req.postData() || '';
      return json(route, { ok: true }, 201);
    }
    if (path === '/messages') return json(route, searchParams.get('trash') === '1' ? state.trash : state.messages);
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
    if (path === '/audit') {
      return json(route, { items: [{ _id: 'a1', at: '2026-11-02T12:00:00Z', userName: 'Ana Prueba', action: 'noticia.crear', summary: 'Creó la noticia «Una noticia»' }], total: 1, page: 1, pages: 1 });
    }
    return json(route, { error: 'Ruta no simulada: ' + path }, 404);
  });
  return state;
}

// Deja la sesión iniciada como si ya hubiera entrado antes (el sitio guarda el token en localStorage)
const withSession = (page) => page.addInitScript(() => localStorage.setItem('gi_token', 'token-de-prueba'));

test('el inicio muestra las noticias y las propuestas', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await expect(page).toHaveTitle('Generación de Impacto');
  await expect(page.getByRole('heading', { name: /Últimas noticias/i })).toBeVisible();
  await expect(page.getByText('Primera noticia')).toBeVisible();
  await expect(page.getByText('Propuesta uno')).toBeVisible();
});

test('se puede enviar un mensaje anónimo y no viaja ningún dato personal', async ({ page }) => {
  const state = await mockApi(page);
  await page.goto('/buzon');
  await page.getByLabel('Asunto').fill('Baños en mal estado');
  await page.locator('textarea').fill('Los baños del edificio B necesitan mantenimiento.');
  await page.getByRole('button', { name: /Enviar mensaje/ }).click();

  await expect(page.getByRole('heading', { name: /Gracias por/ })).toBeVisible();
  const enviado = state.sent.message;
  expect(enviado).toContain('name="anonymous"');
  expect(enviado).toMatch(/name="anonymous"\r\n\r\ntrue/);
  expect(enviado).not.toContain('name="name"');
  expect(enviado).not.toContain('name="phone"');
  // Protecciones contra bots: el campo trampa viaja vacío y se informa cuánto tardó en llenarse
  expect(enviado).toMatch(/name="website"\r\n\r\n\r\n/);
  expect(enviado).toMatch(/name="fillMs"\r\n\r\n\d+\r\n/);
});

test('el campo trampa del buzón no se ve ni se puede enfocar con el teclado', async ({ page }) => {
  await mockApi(page);
  await page.goto('/buzon');
  const trampa = page.locator('input[name=website]');
  await expect(trampa).toHaveAttribute('tabindex', '-1');
  const caja = await trampa.boundingBox();
  expect(caja === null || caja.x + caja.width < 0).toBe(true); // fuera de la pantalla
  await expect(page.getByRole('textbox', { name: /No llenes este campo/ })).toHaveCount(0); // oculto a lectores de pantalla
});

test('iniciar sesión lleva al panel y muestra los mensajes', async ({ page }) => {
  await mockApi(page);
  await page.goto('/acceso');
  await page.getByLabel('Correo').fill('ana@test.com');
  await page.locator('input[type=password]').fill('password123');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL(/\/admin\/mensajes$/);
  await expect(page.getByRole('heading', { name: /Panel de administración/i })).toBeVisible();
  await expect(page.getByText('Un asunto')).toBeVisible();
});

test('el panel exige sesión: sin ella manda a iniciar sesión', async ({ page }) => {
  await mockApi(page);
  await page.goto('/admin/noticias');
  await expect(page).toHaveURL(/\/acceso$/);
});

test('un administrador puede crear una noticia', async ({ page }) => {
  const state = await mockApi(page, { loggedIn: true });
  await withSession(page);
  await page.goto('/admin/noticias');

  await page.getByRole('button', { name: 'Nueva noticia' }).click();
  await page.getByLabel('Título').fill('Noticia desde la prueba');
  await page.getByLabel(/Contenido/).fill('Texto de la noticia.');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();

  await expect(page.getByText('Noticia desde la prueba')).toBeVisible();
  expect(state.sent.news).toMatchObject({ title: 'Noticia desde la prueba', body: 'Texto de la noticia.', published: true });
});

test('cerrar sesión pide confirmación y regresa al inicio', async ({ page }) => {
  await mockApi(page, { loggedIn: true });
  await withSession(page);
  await page.goto('/admin/mensajes');

  await page.getByRole('button', { name: /Ana/ }).click();
  await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar sesión' }).click();

  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => localStorage.getItem('gi_token'))).toBeNull();
  await expect(page.getByRole('link', { name: 'Acceso', exact: true })).toBeVisible();
});

test('una ruta inexistente muestra la página de error', async ({ page }) => {
  await mockApi(page);
  await page.goto('/esta-ruta-no-existe');
  await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible();
});

test('si la sesión deja de valer, el panel manda a iniciar sesión y lo explica', async ({ page }) => {
  const state = await mockApi(page, { loggedIn: true });
  await withSession(page);
  await page.goto('/admin/mensajes');
  await expect(page.getByText('Un asunto')).toBeVisible();

  state.loggedIn = false; // p. ej. se cambió la contraseña desde otro dispositivo
  await page.getByRole('button', { name: 'Papelera' }).click(); // cualquier petición del panel recibe 401

  await expect(page).toHaveURL(/\/acceso$/);
  await expect(page.getByText(/Tu sesión terminó/)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('gi_token'))).toBeNull();
});

test('eliminar un mensaje lo manda a la papelera, donde se puede restaurar', async ({ page }) => {
  await mockApi(page, { loggedIn: true });
  await withSession(page);
  await page.goto('/admin/mensajes');

  await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Enviar a la papelera' }).click();
  await expect(page.getByText('Un asunto')).toHaveCount(0);

  await page.getByRole('button', { name: 'Papelera' }).click();
  await expect(page.getByText('Un asunto')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Eliminar definitivamente' })).toBeVisible();
  await page.getByRole('button', { name: 'Restaurar' }).click();
  await expect(page.getByText('La papelera está vacía.')).toBeVisible();
});

test('la pestaña Actividad muestra quién hizo qué', async ({ page }) => {
  await mockApi(page, { loggedIn: true });
  await withSession(page);
  await page.goto('/admin/mensajes');
  await page.getByRole('link', { name: 'Actividad' }).click();

  await expect(page).toHaveURL(/\/admin\/actividad$/);
  await expect(page.getByText('Creó la noticia «Una noticia»')).toBeVisible();
  await expect(page.getByText('Ana Prueba', { exact: true }).last()).toBeVisible();
});
