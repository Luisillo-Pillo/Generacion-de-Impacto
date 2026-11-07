import { defineConfig } from '@playwright/test';

// Pruebas de humo del sitio: levantan la versión compilada y simulan la API en el navegador, así que no necesitan
// backend ni base de datos. Usan el Chrome instalado (en GitHub Actions ya viene incluido), sin descargar navegadores.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  // Con más navegadores a la vez (el valor por defecto es la mitad de los núcleos) algunas pruebas se pasaban de tiempo
  // por falta de recursos, sin ser fallos reales
  workers: 3,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    channel: 'chrome',
    reducedMotion: 'reduce',
    locale: 'es-MX',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
