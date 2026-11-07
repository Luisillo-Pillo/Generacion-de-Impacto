// Accesibilidad (WCAG 2.1 A y AA) con axe sobre las páginas principales, públicas y del panel. Una violación nueva rompe la
// prueba. Lo que axe no puede juzgar (orden lógico, lector de pantalla) está en la lista manual del README.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockApi, withSession } from './mock-api.js';

const PUBLICAS = ['/', '/propuestas', '/noticias', '/noticias/primera', '/buzon', '/seguimiento', '/equipo', '/privacidad', '/acceso', '/esta-ruta-no-existe'];
const PANEL = ['/admin/mensajes', '/admin/noticias', '/admin/propuestas', '/admin/equipo', '/admin/ajustes', '/admin/actividad', '/perfil'];

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

test('accesibilidad: buzón con datos personales, editor de noticias y diálogo abiertos', async ({ page }) => {
  await mockApi(page, { loggedIn: true });
  await withSession(page);
  await page.goto('/buzon');
  await page.getByText('Con mis datos').click();
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`), 'buzón con datos').toEqual([]);

  await page.goto('/admin/noticias');
  await page.getByRole('button', { name: 'Nueva noticia' }).click();
  await page.getByLabel('Vista previa').check();
  const editor = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(editor.violations.map((v) => `${v.id}: ${v.help}`), 'editor de noticias').toEqual([]);

  await page.goto('/admin/mensajes');
  await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const dialogo = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(dialogo.violations.map((v) => `${v.id}: ${v.help}`), 'diálogo').toEqual([]);
});
