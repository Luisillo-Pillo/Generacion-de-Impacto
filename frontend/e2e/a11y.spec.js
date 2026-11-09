// Accesibilidad (WCAG 2.1 A y AA) con axe sobre las páginas principales, públicas y del panel. Una violación nueva rompe la
// prueba. Lo que axe no puede juzgar (orden lógico, lector de pantalla) está en la lista manual del README.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockApi, withSession } from './mock-api.js';

const PUBLICAS = ['/', '/propuestas', '/noticias', '/noticias/primera', '/buzon', '/seguimiento', '/equipo', '/privacidad', '/acceso', '/esta-ruta-no-existe'];
const PANEL = ['/admin/mensajes', '/admin/noticias', '/admin/propuestas', '/admin/equipo', '/admin/ajustes', '/perfil'];

async function revisar(page, ruta) {
  await page.goto(ruta);
  await page.waitForLoadState('networkidle');
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const resumen = violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n   ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n   ')}`);
  expect(resumen, `Violaciones de accesibilidad en ${ruta}:\n${resumen.join('\n')}`).toEqual([]);
}

for (const ruta of PUBLICAS) {
  test(`accesibilidad: ${ruta}`, async ({ page }) => {
    await mockApi(page);
    await revisar(page, ruta);
  });
}

for (const ruta of PANEL) {
  test(`accesibilidad del panel: ${ruta}`, async ({ page }) => {
    await mockApi(page, { loggedIn: true });
    await withSession(page);
    await revisar(page, ruta);
  });
}

const ETIQUETAS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const sinViolaciones = async (page, donde) => {
  const { violations } = await new AxeBuilder({ page }).withTags(ETIQUETAS).analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`), donde).toEqual([]);
};

test('accesibilidad: buzón con datos personales', async ({ page }) => {
  await mockApi(page);
  await page.goto('/buzon');
  await page.getByText('Con mis datos').click();
  await sinViolaciones(page, 'buzón con datos');
});

test('accesibilidad: editor de noticias con vista previa', async ({ page }) => {
  await mockApi(page, { loggedIn: true });
  await withSession(page);
  await page.goto('/admin/noticias');
  await page.getByRole('button', { name: 'Nueva noticia' }).click();
  await page.getByLabel('Vista previa').check();
  await sinViolaciones(page, 'editor de noticias');
});

test('accesibilidad: diálogo de confirmación abierto', async ({ page }) => {
  await mockApi(page, { loggedIn: true });
  await withSession(page);
  await page.goto('/admin/mensajes');
  await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await sinViolaciones(page, 'diálogo');
});

for (const rol of ['miembro']) {
  test(`accesibilidad del panel con el rol ${rol}`, async ({ page }) => {
    await mockApi(page, { loggedIn: true, role: rol });
    await withSession(page);
    await page.goto(rol === 'miembro' ? '/admin/equipo' : '/admin/mensajes');
    await page.waitForLoadState('networkidle');
    await sinViolaciones(page, `panel (${rol})`);
  });
}

test('accesibilidad: pantalla de gracias con el código y seguimiento con «Mis mensajes»', async ({ page }) => {
  await mockApi(page);
  await page.goto('/buzon');
  await page.getByLabel('Asunto').fill('Fuga de agua en el edificio B');
  await page.locator('textarea').fill('Hay una fuga de agua en el pasillo desde la mañana.');
  await page.getByRole('button', { name: /Enviar mensaje/ }).click();
  await page.locator('.tracking-code').waitFor();
  await sinViolaciones(page, 'pantalla de gracias con el código');

  await page.getByRole('link', { name: 'Seguimiento', exact: true }).first().click();
  await page.getByText('Con respuesta del equipo').waitFor();
  await sinViolaciones(page, 'seguimiento con Mis mensajes');
});

