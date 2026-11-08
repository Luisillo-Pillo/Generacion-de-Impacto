// Recorridos de humo: lo mínimo que no debe romperse nunca. La API se simula en el navegador (no hay backend).
import { test, expect } from '@playwright/test';
import { mockApi, withSession, CODE } from './mock-api.js';

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
  await expect(page.getByText(CODE)).toBeVisible(); // el código de seguimiento se muestra al terminar
  await expect(page.getByText(/no se vuelve a mostrar/)).toBeVisible();
  const enviado = state.sent.message;
  expect(enviado).toContain('name="anonymous"');
  expect(enviado).toMatch(/name="anonymous"\r\n\r\ntrue/);
  expect(enviado).toMatch(/name="urgency"\r\n\r\nmedia\r\n/); // media por defecto
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

test('las imágenes adjuntas de los mensajes se piden con la sesión y se muestran reducidas', async ({ page }) => {
  const state = await mockApi(page, { loggedIn: true });
  state.messages[0].images = ['img1'];
  await withSession(page);
  await page.goto('/admin/mensajes');

  const imagen = page.getByRole('img', { name: 'Imagen adjunta' });
  await expect(imagen).toBeVisible();
  expect(await imagen.getAttribute('src')).toMatch(/^blob:/); // no es una URL pública que se pueda abrir sin sesión
  expect(state.fileRequests).toEqual([{ path: '/files/img1?w=640', auth: 'Bearer token-de-prueba' }]);
});

test('con datos personales hace falta aceptar el aviso de privacidad y el consentimiento viaja con el mensaje', async ({ page }) => {
  const state = await mockApi(page);
  await page.goto('/buzon');
  await page.getByText('Con mis datos').click();
  await page.getByLabel('Nombre completo').fill('Luis Pérez');
  await page.getByLabel('Teléfono').fill('5512345678');
  await page.getByLabel('Licenciatura').selectOption('Licenciatura en Primaria');
  await page.getByLabel('Semestre').selectOption('1');
  await page.getByLabel('Asunto').fill('Una idea para el comedor');
  await page.locator('textarea').fill('Propongo ampliar el horario del comedor.');

  const casilla = page.getByRole('checkbox', { name: /aviso de privacidad/ });
  await page.getByRole('button', { name: /Enviar mensaje/ }).click();
  expect(state.sent.message).toBeNull(); // sin aceptar el aviso el navegador no deja enviar
  await expect(casilla).toBeVisible();

  await casilla.check();
  await page.getByRole('button', { name: /Enviar mensaje/ }).click();
  await expect(page.getByRole('heading', { name: /Gracias por/ })).toBeVisible();
  expect(state.sent.message).toMatch(/name="consent"\r\n\r\ntrue/);
});

test('el aviso de privacidad es público y se enlaza desde el pie de página', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await page.getByRole('link', { name: 'Aviso de privacidad' }).click();
  await expect(page).toHaveURL(/\/privacidad$/);
  await expect(page.getByRole('heading', { name: /Aviso de privacidad/i })).toBeVisible();
  await expect(page.getByText(/No guardamos ningún dato personal/)).toBeVisible();
});

test('con el código de seguimiento se consulta el estado y la respuesta del equipo', async ({ page }) => {
  const state = await mockApi(page);
  await page.goto('/seguimiento');
  await page.getByLabel('Código de seguimiento').fill('gi abcde fghjk');
  await page.getByRole('button', { name: 'Consultar' }).click();
  await expect(page.getByRole('heading', { name: 'Baños sin agua' })).toBeVisible();
  await expect(page.getByText('En proceso')).toBeVisible();
  await expect(page.getByText('Ya mandamos arreglarlos.')).toBeVisible();
  await expect(page.getByText(/Respondió/)).toContainText('Ana Prueba (Presidencia)');
  expect(state.sent.track).toEqual({ code: 'gi abcde fghjk' });

  await page.getByLabel('Código de seguimiento').fill('GI-00000-00000');
  await page.getByRole('button', { name: 'Consultar' }).click();
  await expect(page.getByRole('alert')).toContainText('No encontramos un mensaje con ese código');
  await expect(page.getByRole('heading', { name: 'Baños sin agua' })).toHaveCount(0);
});

test('el panel pagina, busca, muestra contadores y exporta a CSV', async ({ page }) => {
  const state = await mockApi(page, { loggedIn: true });
  await withSession(page);
  await page.goto('/admin/mensajes');
  await expect(page.getByLabel('Resumen de mensajes')).toContainText('1 nuevos');
  await expect(page.getByRole('link', { name: /Mensajes/ })).toContainText('1'); // insignia de la pestaña
  expect(state.sent.query).toMatchObject({ page: '1', limit: '20' });
  for (const filtro of ['status', 'type', 'review', 'urgency']) expect(state.sent.query).not.toHaveProperty(filtro); // todos los filtros empiezan en «Todos»

  await page.getByLabel('Buscar').fill('no-existe');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByText('No hay mensajes con estos filtros.')).toBeVisible();
  expect(state.sent.query).toMatchObject({ q: 'no-existe', page: '1' });
  await page.getByRole('button', { name: 'Limpiar' }).click();
  await expect(page.getByText('Un asunto')).toBeVisible();

  const descarga = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  expect((await descarga).suggestedFilename()).toMatch(/^mensajes-\d{4}-\d{2}-\d{2}\.csv$/);
});

test('en el panel se escribe la respuesta pública y se agregan notas internas', async ({ page }) => {
  const state = await mockApi(page, { loggedIn: true });
  await withSession(page);
  await page.goto('/admin/mensajes');

  await page.getByText('Respuesta para quien escribió').click();
  await page.getByLabel(/La verá quien consulte el código/).fill('Gracias, ya lo estamos viendo.');
  await page.getByRole('button', { name: 'Guardar respuesta' }).click();
  await expect(page.getByText('Respuesta guardada ✔')).toBeVisible();
  await expect(page.getByText(/Respondió/)).toContainText('Ana Prueba (Presidencia)'); // quién respondió
  expect(state.sent.patch).toEqual({ publicReply: 'Gracias, ya lo estamos viendo.' });

  await page.getByText(/Notas internas/).click();
  await page.getByLabel(/Nueva nota/).fill('Hablar con intendencia');
  await page.getByRole('button', { name: 'Agregar nota' }).click();
  await expect(page.getByText('Hablar con intendencia')).toBeVisible();
  expect(state.sent.note).toEqual({ text: 'Hablar con intendencia' });
});

test('la noticia se muestra con formato Markdown, sin HTML crudo y sin enlaces peligrosos', async ({ page }) => {
  const state = await mockApi(page);
  state.news[0].body = 'Texto con **negritas** y *cursiva*.\n\n<script>window.__xss = 1</script>\n\n[malo](javascript:alert(1)) y [bueno](https://example.com)\n\n- uno\n- dos';
  await page.goto('/noticias/primera');
  await expect(page.getByRole('heading', { name: 'Primera noticia' })).toBeVisible();
  await expect(page.locator('.article strong')).toHaveText('negritas');
  await expect(page.locator('.article em')).toHaveText('cursiva');
  await expect(page.locator('.article li')).toHaveCount(2);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  await expect(page.locator('.article script')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'bueno' })).toHaveAttribute('href', 'https://example.com');
  await expect(page.getByRole('link', { name: 'bueno' })).toHaveAttribute('rel', /noopener/);
  expect(await page.getByText('malo').getAttribute('href')).toBeNull(); // javascript: se descarta
  await expect(page).toHaveTitle('Primera noticia · Generación de Impacto');
});

test('las propuestas muestran su avance y se pueden filtrar por él', async ({ page }) => {
  await mockApi(page);
  await page.goto('/propuestas');
  await expect(page).toHaveTitle('Propuestas · Generación de Impacto');
  await expect(page.getByText('Ya hay fecha')).toBeVisible();
  await expect(page.locator('.progress-en_marcha')).toHaveText('En marcha');
  await expect(page.locator('.progress-planeada')).toHaveText('Planeada');

  await page.getByRole('button', { name: 'En marcha' }).click();
  await expect(page.getByText('Propuesta dos')).toBeVisible();
  await expect(page.getByText('Propuesta uno')).toHaveCount(0);
  await page.getByRole('button', { name: 'Todas' }).click();
  await expect(page.getByText('Propuesta uno')).toBeVisible();
});

test('en el panel el equipo se reordena con los botones y el orden completo se envía a la API', async ({ page }) => {
  const state = await mockApi(page, { loggedIn: true });
  await withSession(page);
  await page.goto('/admin/equipo');
  await page.getByText('Ordenar el equipo').click();
  await page.getByRole('button', { name: 'Subir a Beto Segundo' }).click();
  await expect.poll(() => state.sent.order).toEqual(['m2', 'm1']);
  await expect(page.locator('.order-name').first()).toContainText('Beto Segundo');
  await expect(page.getByRole('button', { name: 'Subir a Beto Segundo' })).toBeDisabled();
});

test('el editor de noticias da formato, muestra vista previa y permite programar la publicación', async ({ page }) => {
  const state = await mockApi(page, { loggedIn: true });
  await withSession(page);
  await page.goto('/admin/noticias');
  await page.getByRole('button', { name: 'Nueva noticia' }).click();

  await page.getByLabel('Título').fill('Noticia programada');
  const cuerpo = page.getByRole('textbox', { name: 'Contenido' });
  await cuerpo.fill('Esto es importante');
  await cuerpo.selectText();
  await page.getByRole('button', { name: 'Negritas' }).click();
  await expect(cuerpo).toHaveValue('**Esto es importante**');
  await page.getByLabel('Vista previa').check();
  await expect(page.locator('.md-preview strong')).toHaveText('Esto es importante');

  await page.getByLabel(/Fecha y hora de publicación/).fill('2030-01-15T09:30');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText('Noticia programada')).toBeVisible();
  expect(state.sent.news.body).toBe('**Esto es importante**');
  expect(state.sent.news.publishedAt).toBe(new Date('2030-01-15T09:30').toISOString());
  await expect(page.getByText(/Programada para/)).toBeVisible();
});

test('con el teclado: «Saltar al contenido» es lo primero y al cambiar de página el foco pasa al contenido', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await page.keyboard.press('Tab');
  const salto = page.getByRole('link', { name: 'Saltar al contenido' });
  await expect(salto).toBeFocused();
  await expect(salto).toBeVisible();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('contenido');

  await page.getByRole('navigation').getByRole('link', { name: 'Propuestas' }).click();
  await expect(page).toHaveURL(/\/propuestas$/);
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('contenido');
});

test('si falla el dibujo de una página se muestra un aviso con la opción de recargar, no una pantalla en blanco', async ({ page }) => {
  await mockApi(page);
  // Una noticia con un cuerpo que no es texto hace fallar el lector de Markdown
  await page.route('**/api/news/rota', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ _id: 'x', slug: 'rota', title: 'Rota', body: { no: 'es texto' }, published: true, createdAt: '2026-10-20T10:00:00Z' }) }));
  await page.goto('/noticias/rota');
  await expect(page.getByRole('heading', { name: 'Algo salió mal' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Recargar' })).toBeVisible();
});

test('el buzón permite elegir la urgencia del mensaje en un menú desplegable', async ({ page }) => {
  const state = await mockApi(page);
  await page.goto('/buzon');
  const urgencia = page.getByLabel('Urgencia');
  await expect(urgencia).toHaveValue('media');
  await expect(urgencia.locator('option')).toHaveText(['Baja', 'Media', 'Alta', 'Urgente']);
  await urgencia.selectOption('urgente');
  await page.getByLabel('Asunto').fill('Fuga de agua en el edificio A');
  await page.locator('textarea').fill('Hay una fuga que está inundando el pasillo.');
  await page.getByRole('button', { name: /Enviar mensaje/ }).click();
  await expect(page.getByRole('heading', { name: /Gracias por/ })).toBeVisible();
  expect(state.sent.message).toMatch(/name="urgency"\r\n\r\nurgente\r\n/);
});

test('el panel muestra la urgencia de cada mensaje y permite filtrar por ella', async ({ page }) => {
  const state = await mockApi(page, { loggedIn: true });
  state.messages[0].urgency = 'alta';
  await withSession(page);
  await page.goto('/admin/mensajes');
  await expect(page.getByText('Urgencia: Alta')).toBeVisible();
  await page.getByRole('combobox', { name: /^Urgencia/ }).selectOption('urgente');
  await expect.poll(() => state.sent.query).toMatchObject({ urgency: 'urgente', page: '1' });
});

test('en Equipo el botón «Nuevo integrante» va al final de la página y el formulario no tiene campo de orden', async ({ page }) => {
  await mockApi(page, { loggedIn: true });
  await withSession(page);
  await page.goto('/admin/equipo');
  const boton = page.getByRole('button', { name: 'Nuevo integrante' });
  await expect(boton).toBeVisible();
  const ultimaTarjeta = page.locator('article.card').last();
  const [cajaBoton, cajaTarjeta] = [await boton.boundingBox(), await ultimaTarjeta.boundingBox()];
  expect(cajaBoton.y).toBeGreaterThan(cajaTarjeta.y + cajaTarjeta.height - 1);

  await page.getByRole('button', { name: 'Editar' }).first().click();
  await expect(page.getByLabel('Nombre', { exact: true })).toBeVisible();
  await expect(page.getByLabel(/^Orden/)).toHaveCount(0);
  await expect(page.getByLabel('Licenciatura')).toBeVisible();
});

test('los ajustes ya no piden Facebook ni TikTok', async ({ page }) => {
  await mockApi(page, { loggedIn: true });
  await withSession(page);
  await page.goto('/admin/ajustes');
  await expect(page.getByLabel('Instagram (URL)')).toBeVisible();
  await expect(page.getByLabel('Correo de contacto')).toBeVisible();
  await expect(page.getByText(/Facebook|TikTok/)).toHaveCount(0);
});

test('los filtros del panel empiezan en «Todos» y los mensajes van de lo más reciente a lo más antiguo', async ({ page }) => {
  const state = await mockApi(page, { loggedIn: true });
  state.messages = [
    // La API los entrega del más reciente al más antiguo (lo prueban las pruebas de la API); la pantalla respeta ese orden
    { ...state.messages[0], _id: 'g3', subject: 'Mensaje del viernes', createdAt: '2026-11-06T10:00:00Z', status: 'archivado' },
    { ...state.messages[0], _id: 'g2', subject: 'Mensaje del miércoles', createdAt: '2026-11-04T10:00:00Z', status: 'leido' },
    { ...state.messages[0], _id: 'g1', subject: 'Mensaje del lunes', createdAt: '2026-11-02T10:00:00Z' },
  ];
  await withSession(page);
  await page.goto('/admin/mensajes');
  for (const etiqueta of ['Tipo', 'Estado', 'Revisión', 'Urgencia']) {
    await expect(page.locator('.filters').getByRole('combobox', { name: new RegExp(`^${etiqueta}`) })).toHaveValue('');
  }
  await expect(page.locator('.filters').getByRole('combobox', { name: /^Estado/ }).locator('option:checked')).toHaveText('Todos');
  await expect(page.locator('.msg h3')).toHaveText(['Mensaje del viernes', 'Mensaje del miércoles', 'Mensaje del lunes']);
});

test('Ajustes: semestres y grupos van uno al lado del otro', async ({ page }) => {
  await mockApi(page, { loggedIn: true });
  await withSession(page);
  await page.goto('/admin/ajustes');
  const semestres = await page.getByLabel(/^Semestres/).boundingBox();
  const grupos = await page.getByLabel(/^Grupos/).boundingBox();
  expect(Math.abs(semestres.y - grupos.y)).toBeLessThan(5); // misma fila
  expect(grupos.x).toBeGreaterThan(semestres.x + semestres.width - 1); // grupos a la derecha
});

test('Miembro: lee y responde mensajes (con datos de contacto), exporta, y no ve papelera, eliminar ni Ajustes', async ({ page }) => {
  const state = await mockApi(page, { loggedIn: true, role: 'miembro' });
  Object.assign(state.messages[0], { anonymous: false, name: 'Luis Pérez', degree: 'Primaria', semester: '3', phone: '5512345678' });
  await withSession(page);
  await page.goto('/admin/mensajes');

  const pestañas = page.getByRole('navigation', { name: 'Secciones del panel' });
  await expect(pestañas.getByRole('link')).toHaveText([/^Mensajes/, 'Noticias', 'Propuestas', 'Equipo']);
  await expect(page.getByText(/Luis Pérez · Primaria/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Exportar CSV' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Marcar leído', exact: true })).toBeVisible();
  await expect(page.getByText('Papelera', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Eliminar', exact: true })).toHaveCount(0);

  await page.getByText('Respuesta para quien escribió').click();
  await page.getByLabel(/La verá quien consulte/).fill('Gracias, ya lo vemos.');
  await page.getByRole('button', { name: 'Guardar respuesta' }).click();
  await expect(page.getByText('Respuesta guardada ✔')).toBeVisible();
  expect(state.sent.patch).toEqual({ publicReply: 'Gracias, ya lo vemos.' });

  await page.goto('/admin/ajustes');
  await expect(page).toHaveURL(/\/admin\/mensajes$/); // los ajustes son solo del Moderador
});

test('Miembro: publica noticias y propuestas nuevas, las edita y cambia su estado, pero no las elimina', async ({ page }) => {
  const state = await mockApi(page, { loggedIn: true, role: 'miembro' });
  await withSession(page);

  await page.goto('/admin/noticias');
  await expect(page.getByRole('button', { name: 'Nueva noticia' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Editar' })).toHaveCount(1); // puede editar el contenido
  await expect(page.getByRole('button', { name: 'Eliminar' })).toHaveCount(0); // pero no eliminar
  await page.getByRole('button', { name: 'Pasar a borrador' }).click();
  await expect.poll(() => state.sent.state).toEqual({ path: '/news/n1/state', body: { published: false } });

  await page.goto('/admin/propuestas');
  await expect(page.getByRole('button', { name: 'Nueva propuesta' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Editar' })).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Eliminar' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Actualizar estado' }).first().click();
  await page.getByRole('combobox', { name: /^Avance/ }).selectOption('cumplida');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect.poll(() => state.sent.state).toMatchObject({ path: '/proposals/p1/state', body: { progress: 'cumplida' } });
});

test('Miembro: ve correos y roles del equipo, no puede administrarlo y edita su propia información en Mi perfil', async ({ page }) => {
  const state = await mockApi(page, { loggedIn: true, role: 'miembro' });
  await withSession(page);
  await page.goto('/admin/equipo');

  await expect(page.getByText(/beto|m2@test\.com/).first()).toBeVisible(); // correos del equipo
  await expect(page.getByText(/Moderador|Miembro/).first()).toBeVisible(); // su rol
  await expect(page.getByRole('button', { name: 'Nuevo integrante' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Editar' })).toHaveCount(0);
  await expect(page.getByText('Ordenar el equipo')).toHaveCount(0);

  await page.getByRole('link', { name: 'Mi perfil' }).click();
  await expect(page.getByText('Miembro', { exact: true })).toBeVisible();
  await page.getByLabel('Cargo').fill('Vocal de eventos');
  await page.getByRole('button', { name: 'Guardar mi información' }).click();
  await expect(page.getByText('Información actualizada ✔')).toBeVisible();
  expect(state.sent.me).toMatchObject({ name: 'Ana Prueba', role: 'Vocal de eventos' });
  expect(state.sent.me).not.toHaveProperty('email');
});

test('Moderador: ve todo el panel, incluida la papelera y los ajustes, y puede editar y eliminar', async ({ page }) => {
  await mockApi(page, { loggedIn: true });
  await withSession(page);
  await page.goto('/admin/mensajes');
  const pestañas = page.getByRole('navigation', { name: 'Secciones del panel' });
  await expect(pestañas.getByRole('link')).toHaveText([/^Mensajes/, 'Noticias', 'Propuestas', 'Equipo', 'Ajustes']);
  await expect(page.getByText('Papelera', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Eliminar', exact: true })).toBeVisible();
  await pestañas.getByRole('link', { name: 'Noticias' }).click();
  await expect(page.getByRole('button', { name: 'Editar' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Eliminar' }).first()).toBeVisible();
});

test('la licenciatura de un integrante se elige en un menú con las licenciaturas de Ajustes', async ({ page }) => {
  const state = await mockApi(page, { loggedIn: true });
  await withSession(page);

  // Panel → Equipo → editar
  await page.goto('/admin/equipo');
  await page.getByRole('button', { name: 'Editar' }).first().click();
  const menu = page.getByRole('combobox', { name: /^Licenciatura/ });
  await expect(menu.locator('option')).toHaveText(['Sin especificar', 'Licenciatura en Primaria']);
  await expect(page.getByRole('textbox', { name: 'Licenciatura' })).toHaveCount(0); // ya no es un campo libre

  // Mi perfil
  await page.goto('/perfil');
  const menuPerfil = page.getByRole('combobox', { name: /^Licenciatura/ });
  await expect(menuPerfil.locator('option')).toHaveText(['Sin especificar', 'Licenciatura en Primaria']);
  await menuPerfil.selectOption('Licenciatura en Primaria');
  await page.getByRole('button', { name: 'Guardar mi información' }).click();
  await expect(page.getByText('Información actualizada ✔')).toBeVisible();
  expect(state.sent.me).toMatchObject({ degree: 'Licenciatura en Primaria' });
});

test('si la licenciatura de alguien ya no está en Ajustes, se conserva como opción', async ({ page }) => {
  const state = await mockApi(page, { loggedIn: true });
  state.members[1].degree = 'Licenciatura en Física';
  await withSession(page);
  await page.goto('/admin/equipo');
  await page.getByRole('button', { name: 'Editar' }).nth(1).click();
  const menu = page.getByRole('combobox', { name: /^Licenciatura/ });
  await expect(menu).toHaveValue('Licenciatura en Física');
  await expect(menu.locator('option:checked')).toHaveText('Licenciatura en Física (ya no está en Ajustes)');
});

test('noticias, propuestas y equipo del panel van en dos columnas, con íconos de lápiz y bote de basura', async ({ page }) => {
  const state = await mockApi(page, { loggedIn: true });
  state.news.push({ ...state.news[0], _id: 'n2', slug: 'segunda', title: 'Segunda noticia' });
  await withSession(page);
  for (const ruta of ['/admin/noticias', '/admin/propuestas', '/admin/equipo']) {
    await page.goto(ruta);
    const tarjetas = page.locator('.crud-card');
    await expect(tarjetas).toHaveCount(2);
    const [a, b] = [await tarjetas.nth(0).boundingBox(), await tarjetas.nth(1).boundingBox()];
    expect(Math.abs(a.y - b.y), `${ruta}: misma fila`).toBeLessThan(5);
    expect(b.x, `${ruta}: la segunda a la derecha`).toBeGreaterThan(a.x + a.width - 1);

    const editar = tarjetas.first().getByRole('button', { name: 'Editar' });
    const eliminar = tarjetas.first().getByRole('button', { name: 'Eliminar' });
    await expect(editar.locator('svg')).toHaveCount(1); // ícono de lápiz
    await expect(eliminar.locator('svg')).toHaveCount(1); // ícono de bote de basura
    await expect(editar).toHaveText(''); // sin texto visible
    await expect(eliminar).toHaveText('');
    await expect(eliminar).toHaveAttribute('title', 'Eliminar');
  }
});

test('en teléfono las tarjetas del panel pasan a una sola columna', async ({ page }) => {
  const state = await mockApi(page, { loggedIn: true });
  state.news.push({ ...state.news[0], _id: 'n2', slug: 'segunda', title: 'Segunda noticia' });
  await page.setViewportSize({ width: 390, height: 800 });
  await withSession(page);
  await page.goto('/admin/noticias');
  const [a, b] = [await page.locator('.crud-card').nth(0).boundingBox(), await page.locator('.crud-card').nth(1).boundingBox()];
  expect(b.y).toBeGreaterThan(a.y + a.height - 1);
});

test('el menú de usuario se ajusta al largo del correo: no se corta ni se parte', async ({ page }) => {
  const correo = 'pepe.pecas130508.con.un.correo.largo@gmail.com';
  await mockApi(page, { loggedIn: true, email: correo });
  await withSession(page);
  await page.goto('/admin/mensajes');
  await page.getByRole('button', { name: /Ana/ }).click();
  const linea = page.locator('.user-info small');
  await expect(linea).toHaveText(correo);
  expect((await linea.boundingBox()).height, 'el correo cabe en una sola línea').toBeLessThan(30);
  const menu = await page.locator('.user-dropdown').boundingBox();
  expect(menu.x).toBeGreaterThanOrEqual(0); // tampoco se sale de la pantalla
  expect(menu.x + menu.width).toBeLessThanOrEqual(page.viewportSize().width);
});

test('Mi perfil: «Cerrar sesión» está abajo a la derecha del primer recuadro (ya no hay «Mis sesiones»)', async ({ page }) => {
  await mockApi(page, { loggedIn: true });
  await withSession(page);
  await page.goto('/perfil');
  await expect(page.getByText('Mis sesiones')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cerrar sesión en todos los dispositivos' })).toHaveCount(0);

  const recuadro = await page.locator('.profile').boundingBox();
  const boton = await page.locator('.profile').getByRole('button', { name: 'Cerrar sesión' }).boundingBox();
  expect(boton.x + boton.width, 'a la derecha').toBeGreaterThan(recuadro.x + recuadro.width - 40);
  expect(boton.y + boton.height, 'abajo').toBeGreaterThan(recuadro.y + recuadro.height - 40);

  // Los títulos ya no se encimen con los recuadros
  const [formInfo, tituloPass] = [await page.locator('.card').nth(1).boundingBox(), await page.getByRole('heading', { name: /Cambiar contraseña/ }).boundingBox()];
  expect(tituloPass.y).toBeGreaterThan(formInfo.y + formInfo.height + 10);

  await page.locator('.profile').getByRole('button', { name: 'Cerrar sesión' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => localStorage.getItem('gi_token'))).toBeNull();
});

test('Miembro: abre una noticia para editar su contenido y guarda los cambios', async ({ page }) => {
  const state = await mockApi(page, { loggedIn: true, role: 'miembro' });
  await withSession(page);
  await page.goto('/admin/noticias');
  await page.getByRole('button', { name: 'Editar' }).click();
  await page.getByLabel('Título').fill('Primera noticia corregida');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText('Primera noticia corregida')).toBeVisible();
  expect(state.sent.news).toMatchObject({ title: 'Primera noticia corregida' });
});

