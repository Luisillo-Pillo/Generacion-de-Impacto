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
    sent: { message: null, news: null },
    loggedIn,
  };
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const { pathname } = new URL(req.url());
    const path = pathname.replace(/^\/api/, '');
    const method = req.method();

    if (path === '/settings') return json(route, { degrees: ['Licenciatura en Primaria'], groups: ['A'], semesters: ['1', '2'], groupDegrees: [], social: {} });
    if (path === '/auth/login') return json(route, { token: 'token-de-prueba', user: ADMIN, member: MEMBER });
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
    if (path === '/messages') return json(route, state.messages);
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
