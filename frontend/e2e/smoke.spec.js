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
  await page.getByText('De forma anónima').click(); // la opción por defecto es «Con mis datos»
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

test('buzón: «Pregunta» va primero y viene elegida hasta que se escoja otro tipo', async ({ page }) => {
  const state = await mockApi(page);
  await page.goto('/buzon');
  await page.getByText('De forma anónima').click(); // la opción por defecto es «Con mis datos»
  const tipos = page.getByRole('radiogroup').or(page.locator('fieldset', { hasText: '¿Qué quieres enviarnos?' })).locator('.chip');
  await expect(tipos).toHaveText(['Pregunta', 'Queja', 'Propuesta', 'Problema']);
  await expect(page.getByRole('radio', { name: 'Pregunta' })).toBeChecked();

  // Sin tocar el tipo, el mensaje viaja como pregunta
  await page.getByLabel('Asunto').fill('¿Cuándo abre la biblioteca?');
  await page.locator('textarea').fill('Quisiera saber el horario de la biblioteca.');
  await page.getByRole('button', { name: /Enviar mensaje/ }).click();
  await expect(page.getByRole('heading', { name: /Gracias por/ })).toBeVisible();
  expect(state.sent.message).toMatch(/name="type"\r\n\r\npregunta\r\n/);

  // Si se escoge otro, se respeta
  await page.goto('/buzon');
  await page.getByText('De forma anónima').click(); // la opción por defecto es «Con mis datos»
  await page.getByText('Queja', { exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Queja' })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Pregunta' })).not.toBeChecked();
  await page.getByLabel('Asunto').fill('Baños sin agua');
  await page.locator('textarea').fill('Los baños del edificio B no tienen agua.');
  await page.getByRole('button', { name: /Enviar mensaje/ }).click();
  await expect(page.getByRole('heading', { name: /Gracias por/ })).toBeVisible();
  expect(state.sent.message).toMatch(/name="type"\r\n\r\nqueja\r\n/);
});

test('buzón: «Con mis datos» va primero y viene elegido; si se cambia a anónimo, no viaja nada de lo que se había escrito', async ({ page }) => {
  const state = await mockApi(page);
  await page.goto('/buzon');
  const forma = page.locator('fieldset', { hasText: '¿Cómo quieres enviarlo?' }).locator('.chip');
  await expect(forma).toHaveText(['Con mis datos', 'De forma anónima']);
  await expect(page.getByRole('radio', { name: 'Con mis datos' })).toBeChecked();
  await expect(page.getByLabel('Nombre completo')).toBeVisible(); // con datos: se piden los campos personales
  await expect(page.getByText('No guardamos ningún dato personal')).toHaveCount(0);

  // Se escriben datos y luego se decide enviarlo de forma anónima: los datos no se envían
  await page.getByLabel('Nombre completo').fill('Luis Pérez');
  await page.getByLabel('Teléfono').fill('5512345678');
  await page.getByText('De forma anónima').click();
  await expect(page.getByLabel('Nombre completo')).toHaveCount(0);
  await expect(page.getByText('No guardamos ningún dato personal')).toBeVisible();
  await page.getByLabel('Asunto').fill('Una duda');
  await page.locator('textarea').fill('¿Dónde entrego el formato?');
  await page.getByRole('button', { name: /Enviar mensaje/ }).click();
  await expect(page.getByRole('heading', { name: /Gracias por/ })).toBeVisible();
  const enviado = state.sent.message;
  expect(enviado).toMatch(/name="anonymous"\r\n\r\ntrue/);
  for (const campo of ['name', 'phone', 'degree', 'semester', 'consent']) expect(enviado).not.toContain(`name="${campo}"`);
  expect(enviado).not.toContain('Luis');
  expect(enviado).not.toContain('5512345678');
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
  await expect(page.getByRole('heading', { name: 'La papelera está vacía' })).toBeVisible();
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
  // Por defecto: estado «Nuevos» y revisión «Pendiente»; tipo y urgencia en «Todos» (no se mandan)
  expect(state.sent.query).toMatchObject({ status: 'nuevo', review: 'pendiente' });
  for (const filtro of ['type', 'urgency']) expect(state.sent.query).not.toHaveProperty(filtro);

  await page.getByRole('searchbox').fill('no-existe');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click(); // la lupa
  await expect(page.getByRole('heading', { name: 'No hay mensajes con estos filtros' })).toBeVisible();
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
  await page.getByText('De forma anónima').click(); // la opción por defecto es «Con mis datos»
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

test('los filtros del panel empiezan en Nuevos y Pendiente, y los mensajes van de lo más reciente a lo más antiguo', async ({ page }) => {
  const state = await mockApi(page, { loggedIn: true });
  state.messages = [
    // La API los entrega del más reciente al más antiguo (lo prueban las pruebas de la API); la pantalla respeta ese orden
    { ...state.messages[0], _id: 'g3', subject: 'Mensaje del viernes', createdAt: '2026-11-06T10:00:00Z', status: 'archivado' },
    { ...state.messages[0], _id: 'g2', subject: 'Mensaje del miércoles', createdAt: '2026-11-04T10:00:00Z', status: 'leido' },
    { ...state.messages[0], _id: 'g1', subject: 'Mensaje del lunes', createdAt: '2026-11-02T10:00:00Z' },
  ];
  await withSession(page);
  await page.goto('/admin/mensajes');
  const filtro = (etiqueta) => page.locator('.filters').getByRole('combobox', { name: new RegExp(`^${etiqueta}`) });
  await expect(filtro('Estado')).toHaveValue('nuevo');
  await expect(filtro('Estado').locator('option:checked')).toHaveText('Nuevos');
  await expect(filtro('Revisión')).toHaveValue('pendiente');
  await expect(filtro('Revisión').locator('option:checked')).toHaveText('Pendiente');
  await expect(filtro('Tipo')).toHaveValue('');
  await expect(filtro('Urgencia')).toHaveValue('');
  // Se pueden volver a poner en «Todos»
  await filtro('Estado').selectOption('');
  await expect.poll(() => state.sent.query).not.toHaveProperty('status');
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

test('cada página empieza arriba: al cambiar de ruta, al recargar y al volver atrás', async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 1200, height: 500 });
  const scrollY = () => page.evaluate(() => window.scrollY);

  await page.goto('/');
  await page.evaluate(() => window.scrollTo({ top: 99999, behavior: 'instant' }));
  expect(await scrollY()).toBeGreaterThan(300); // la portada es larga: sí se bajó

  // Cambiar de ruta (desde el pie de página, para estar abajo): la nueva página aparece arriba
  await page.getByRole('link', { name: 'Aviso de privacidad' }).click();
  await expect(page).toHaveURL(/\/privacidad$/);
  expect(await scrollY()).toBe(0);

  // Recargar con la página bajada: no se restaura el scroll anterior
  await page.evaluate(() => window.scrollTo({ top: 99999, behavior: 'instant' }));
  expect(await scrollY()).toBeGreaterThan(100);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Aviso de privacidad/i })).toBeVisible();
  expect(await scrollY()).toBe(0);

  // Volver atrás también lleva arriba
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  expect(await scrollY()).toBe(0);

  // Pulsar el enlace de la página en la que ya estás también sube (la ruta no cambia)
  await page.evaluate(() => window.scrollTo({ top: 99999, behavior: 'instant' }));
  expect(await scrollY()).toBeGreaterThan(300);
  await page.getByRole('link', { name: 'Generación de Impacto' }).first().click(); // el logo del encabezado lleva a «/»
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(scrollY).toBe(0);
});

test('todo el sitio está en español de México: idioma de la página y corrector ortográfico en los campos de texto', async ({ page }) => {
  await mockApi(page, { loggedIn: true });
  await withSession(page);
  const rutas = ['/', '/buzon', '/seguimiento', '/acceso', '/privacidad', '/perfil', '/admin/mensajes', '/admin/noticias', '/admin/equipo', '/admin/ajustes'];
  for (const ruta of rutas) {
    await page.goto(ruta);
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => document.documentElement.lang), ruta).toBe('es-MX');
    expect(await page.locator('meta[http-equiv="content-language"]').getAttribute('content'), ruta).toBe('es-MX');
    expect(await page.locator('[lang]:not(html)').evaluateAll((els) => els.filter((e) => !e.lang.startsWith('es')).length), `${ruta}: ningún elemento con otro idioma`).toBe(0);
  }

  // Lo que se escribe en español se corrige; los nombres, códigos y contraseñas no
  await page.goto('/buzon');
  expect(await page.locator('textarea').evaluate((e) => e.spellcheck), 'mensaje').toBe(true);
  expect(await page.getByLabel('Asunto').evaluate((e) => e.spellcheck), 'asunto').toBe(true);
  await page.getByText('Con mis datos').click();
  expect(await page.getByLabel('Nombre completo').evaluate((e) => e.spellcheck), 'nombre').toBe(false);
  await page.goto('/seguimiento');
  expect(await page.getByLabel('Código de seguimiento').evaluate((e) => e.spellcheck), 'código').toBe(false);
  await page.goto('/perfil');
  const contraseña = page.locator('.password-field input').first();
  await page.getByRole('button', { name: 'Mostrar contraseña' }).first().click(); // visible: sería texto normal
  expect(await contraseña.evaluate((e) => [e.type, e.spellcheck])).toEqual(['text', false]);
});

test('buzón: si no cargan las licenciaturas se avisa y se puede reintentar sin perder lo escrito', async ({ page }) => {
  await mockApi(page);
  let fallar = true;
  await page.route('**/api/settings**', (route) => (fallar ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Error interno del servidor' }) }) : route.fallback()));
  await page.goto('/buzon');
  await page.getByLabel('Asunto').fill('Algo que escribí antes del error');
  await page.getByText('Con mis datos').click();
  await expect(page.getByRole('alert').filter({ hasText: 'No se pudieron cargar las licenciaturas' })).toBeVisible();

  fallar = false;
  await page.getByRole('button', { name: 'Reintentar' }).click();
  const menu = page.getByRole('combobox', { name: /^Licenciatura/ });
  await expect(menu.locator('option')).toHaveText(['Selecciona…', 'Licenciatura en Primaria']);
  await expect(page.getByRole('alert').filter({ hasText: 'No se pudieron cargar' })).toHaveCount(0);
  await expect(page.getByLabel('Asunto')).toHaveValue('Algo que escribí antes del error');
});

test('buzón: si no hay licenciaturas configuradas se explica qué hacer', async ({ page }) => {
  await mockApi(page);
  await page.route('**/api/settings**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ degrees: [], groups: [], semesters: ['1'], groupDegrees: [], social: {} }) }));
  await page.goto('/buzon');
  await page.getByText('Con mis datos').click();
  await expect(page.getByRole('alert').filter({ hasText: 'Todavía no hay licenciaturas configuradas' })).toBeVisible();
});

async function enviarMensaje(page, asunto = 'Fuga de agua en el edificio B') {
  await page.goto('/buzon');
  await page.getByText('De forma anónima').click(); // la opción por defecto es «Con mis datos»
  await page.getByLabel('Asunto').fill(asunto);
  await page.locator('textarea').fill('Hay una fuga de agua en el pasillo desde la mañana.');
  await page.getByRole('button', { name: /Enviar mensaje/ }).click();
  await expect(page.getByRole('heading', { name: /Gracias por/ })).toBeVisible();
}
const guardados = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('gi_mis_mensajes') || '[]'));

test('el código se descarga como imagen (PNG) con el código y el aviso de no perderlo, y no trae el asunto', async ({ page }) => {
  await mockApi(page);
  await enviarMensaje(page, 'Asunto que NO debe aparecer en la imagen');
  await expect(page.getByRole('button', { name: 'Compartir' })).toHaveCount(0); // ya no hay compartir ni correo
  await expect(page.getByRole('link', { name: 'Enviármelo por correo' })).toHaveCount(0);

  const descarga = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar imagen' }).click();
  const archivo = await descarga;
  expect(archivo.suggestedFilename()).toBe(`codigo-seguimiento-${CODE}.png`);
  const bytes = await (await import('node:fs/promises')).readFile(await archivo.path());

  // Es un PNG de 1080 × 720
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1080, 720]);
  expect(bytes.length).toBeGreaterThan(15_000); // lleva texto dibujado, no es un fondo liso

  // Se revisa lo dibujado: fondo negro, el recuadro rojo del aviso y letras claras donde va el código
  const dibujo = await page.evaluate(async (base64) => {
    const img = new Image();
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = `data:image/png;base64,${base64}`; });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const px = (x, y) => [...ctx.getImageData(x, y, 1, 1).data].slice(0, 3);
    const claros = (x, y, w, h) => { const d = ctx.getImageData(x, y, w, h).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 190 && d[i + 2] > 170) n++; return n; };
    return { fondo: px(10, 300), aviso: px(100, 400), codigo: claros(150, 220, 780, 140), textoAviso: claros(90, 400, 900, 100), enlace: claros(200, 595, 680, 40) };
  }, bytes.toString('base64'));
  expect(dibujo.fondo).toEqual([18, 18, 18]); // #121212
  expect(dibujo.aviso).toEqual([212, 20, 28]); // #d4141c: recuadro del aviso
  expect(dibujo.codigo).toBeGreaterThan(3000); // el código en letras grandes
  expect(dibujo.textoAviso).toBeGreaterThan(500); // «¡No lo pierdas!…» en blanco sobre el rojo
  expect(dibujo.enlace).toBeGreaterThan(300); // el enlace a /seguimiento
});

test('el código se recuerda en este dispositivo (se puede desmarcar) y aparece en «Mis mensajes» con su situación', async ({ page }) => {
  await mockApi(page);
  await enviarMensaje(page);

  const recordar = page.getByRole('checkbox', { name: /Recordar este código en este dispositivo/ });
  await expect(recordar).toBeChecked(); // por defecto sí
  expect(await guardados(page)).toMatchObject([{ code: CODE, subject: 'Fuga de agua en el edificio B' }]);
  await recordar.uncheck(); // computadora compartida
  expect(await guardados(page)).toEqual([]);
  await recordar.check();
  expect(await guardados(page)).toHaveLength(1);

  await page.getByRole('link', { name: 'Seguimiento', exact: true }).first().click();
  await expect(page).toHaveURL(/\/seguimiento$/);
  const lista = page.getByRole('region', { name: /Mis mensajes/ });
  await expect(lista.getByText('Fuga de agua en el edificio B')).toBeVisible();
  await expect(lista.getByText('Leído', { exact: true })).toBeVisible(); // situación consultada con el código
  await expect(lista.getByText('En proceso')).toBeVisible();
  await expect(lista.getByText('Con respuesta del equipo')).toBeVisible();

  // Ver: llena el campo y muestra el detalle
  await lista.getByRole('button', { name: 'Ver' }).click();
  await expect(page.getByLabel('Código de seguimiento')).toHaveValue(CODE);
  await expect(page.getByRole('heading', { name: 'Baños sin agua' })).toBeVisible();

  // Quitar
  await lista.getByRole('button', { name: /^Quitar/ }).click();
  await expect(page.getByRole('region', { name: /Mis mensajes/ })).toHaveCount(0);
  expect(await guardados(page)).toEqual([]);
});

test('«Mis mensajes»: un código que ya no existe se avisa, y «Borrar todos» vacía la lista', async ({ page }) => {
  await page.addInitScript(([code]) => {
    localStorage.setItem('gi_mis_mensajes', JSON.stringify([
      { code, subject: 'Mensaje vivo', savedAt: '2026-11-01T10:00:00Z' },
      { code: 'GI-22222-33333', subject: 'Mensaje eliminado', savedAt: '2026-10-30T10:00:00Z' },
    ]));
  }, [CODE]);
  await mockApi(page);
  await page.goto('/seguimiento');
  const lista = page.getByRole('region', { name: /Mis mensajes/ });
  await expect(lista.getByText('Mensaje vivo')).toBeVisible();
  await expect(lista.getByText('Este mensaje ya no existe')).toBeVisible();
  await expect(lista.getByRole('button', { name: 'Ver' })).toHaveCount(1); // el que ya no existe no se puede abrir

  await lista.getByRole('button', { name: 'Borrar todos de este dispositivo' }).click();
  await expect(page.getByRole('region', { name: /Mis mensajes/ })).toHaveCount(0);
  expect(await guardados(page)).toEqual([]);
});

test('sin nada guardado no aparece «Mis mensajes»; y si el almacenamiento está bloqueado todo sigue funcionando', async ({ page }) => {
  await mockApi(page);
  await page.goto('/seguimiento');
  await expect(page.getByRole('region', { name: /Mis mensajes/ })).toHaveCount(0);

  await page.addInitScript(() => {
    const bloqueado = () => { throw new Error('almacenamiento bloqueado'); };
    Object.defineProperty(window, 'localStorage', { get: bloqueado, configurable: true });
  });
  await mockApi(page);
  await page.goto('/buzon');
  await page.getByText('De forma anónima').click(); // la opción por defecto es «Con mis datos»
  await page.getByLabel('Asunto').fill('Con el almacenamiento bloqueado');
  await page.locator('textarea').fill('Aun así el mensaje se envía y se muestra el código.');
  await page.getByRole('button', { name: /Enviar mensaje/ }).click();
  await expect(page.getByText(CODE)).toBeVisible();
});

test('la pantalla de gracias no lleva pie de página y todo el contenido cabe sin scroll en pantallas de escritorio', async ({ page }) => {
  await mockApi(page);
  for (const [ancho, alto] of [[1920, 950], [1440, 800], [1366, 650], [1280, 600]]) {
    await page.setViewportSize({ width: ancho, height: alto });
    await page.goto('/buzon');
    await page.getByText('De forma anónima').click(); // la opción por defecto es «Con mis datos»
    await page.getByLabel('Asunto').fill('Fuga de agua en el edificio B');
    await page.locator('textarea').fill('Hay una fuga de agua en el pasillo desde la mañana.');
    await page.getByRole('button', { name: /Enviar mensaje/ }).scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: /Enviar mensaje/ }).click();
    await expect(page.locator('.tracking-code')).toBeVisible();

    const medida = await page.evaluate(() => ({ y: window.scrollY, alto: document.documentElement.scrollHeight, ventana: window.innerHeight }));
    expect(medida.y, `${ancho}×${alto}: se muestra desde arriba`).toBe(0);
    expect(medida.alto, `${ancho}×${alto}: la página completa cabe en la pantalla (sin scroll)`).toBeLessThanOrEqual(medida.ventana);
    await expect(page.locator('footer.footer')).toBeHidden(); // sin pie: ese espacio es para el contenido
    await expect(page.locator('header.header')).toBeVisible(); // el encabezado sí
    for (const nombre of ['Copiar código', 'Descargar imagen']) await expect(page.getByText(nombre, { exact: true })).toBeInViewport();
    await expect(page.getByRole('link', { name: 'Inicio', exact: true }).last()).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Enviar otro mensaje' })).toBeInViewport();
  }
});

test('el pie de página vuelve al salir de la pantalla de gracias', async ({ page }) => {
  await mockApi(page);
  await page.goto('/buzon');
  await page.getByText('De forma anónima').click(); // la opción por defecto es «Con mis datos»
  await page.getByLabel('Asunto').fill('Fuga de agua en el edificio B');
  await page.locator('textarea').fill('Hay una fuga de agua en el pasillo desde la mañana.');
  await page.getByRole('button', { name: /Enviar mensaje/ }).click();
  await expect(page.locator('footer.footer')).toBeHidden();
  await page.getByRole('button', { name: 'Enviar otro mensaje' }).click(); // vuelve el formulario
  await expect(page.getByLabel('Asunto')).toBeVisible();
  await expect(page.locator('footer.footer')).toBeVisible();

  await page.getByText('De forma anónima').click(); // el formulario vuelve a empezar en «Con mis datos»
  await page.getByLabel('Asunto').fill('Otro mensaje distinto del anterior');
  await page.locator('textarea').fill('Texto del segundo mensaje, suficientemente largo.');
  await page.getByRole('button', { name: /Enviar mensaje/ }).click();
  await expect(page.locator('footer.footer')).toBeHidden();
  await page.getByRole('link', { name: 'Inicio', exact: true }).last().click(); // otra página
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('footer.footer')).toBeVisible();
});

test('en teléfono la pantalla de gracias sigue de corrido, sin desbordar de lado', async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/buzon');
  await page.getByText('De forma anónima').click(); // la opción por defecto es «Con mis datos»
  await page.getByLabel('Asunto').fill('Fuga de agua en el edificio B');
  await page.locator('textarea').fill('Hay una fuga de agua en el pasillo desde la mañana.');
  await page.getByRole('button', { name: /Enviar mensaje/ }).click();
  const [cabecera, codigo] = [await page.locator('.thanks-head').boundingBox(), await page.locator('.tracking-code').boundingBox()];
  expect(codigo.y).toBeGreaterThan(cabecera.y + cabecera.height - 1); // el código debajo del agradecimiento
  expect(codigo.x + codigo.width).toBeLessThanOrEqual(390); // sin desbordar
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('cuando no hay mensajes el panel lo explica según el motivo y ofrece salir del callejón', async ({ page }) => {
  const state = await mockApi(page, { loggedIn: true });
  state.messages = [];
  await withSession(page);
  await page.goto('/admin/mensajes');

  // Filtros por defecto (Nuevos + Pendiente) y nada por atender
  const vacio = page.locator('.empty-state');
  await expect(vacio.getByRole('heading', { name: 'Todo al día' })).toBeVisible();
  await expect(vacio).toContainText('No hay mensajes nuevos pendientes de revisar');

  // «Ver todos los mensajes» quita los filtros; sin ningún mensaje en el buzón se dice
  await vacio.getByRole('button', { name: 'Ver todos los mensajes' }).click();
  await expect(vacio.getByRole('heading', { name: 'Aún no hay mensajes' })).toBeVisible();
  await expect(vacio.getByRole('button')).toHaveCount(0);
  expect(state.sent.query).not.toHaveProperty('status');
  expect(state.sent.query).not.toHaveProperty('review');

  // Con una búsqueda o un filtro que no encuentran nada
  await page.getByRole('searchbox').fill('xyz');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(vacio.getByRole('heading', { name: 'No hay mensajes con estos filtros' })).toBeVisible();
  await vacio.getByRole('button', { name: 'Ver todos los mensajes' }).click();
  await expect(page.getByRole('searchbox')).toHaveValue(''); // también limpia la búsqueda
  await expect(vacio.getByRole('heading', { name: 'Aún no hay mensajes' })).toBeVisible();

  // Papelera vacía
  await page.getByRole('button', { name: 'Papelera' }).click();
  await expect(vacio.getByRole('heading', { name: 'La papelera está vacía' })).toBeVisible();
  await expect(vacio).toContainText('30 días');
});

test('«Exportar CSV» se deshabilita cuando no hay mensajes con los filtros elegidos', async ({ page }) => {
  const state = await mockApi(page, { loggedIn: true });
  await withSession(page);
  await page.goto('/admin/mensajes');
  const exportar = page.getByRole('button', { name: 'Exportar CSV' });
  await expect(page.getByText('Un asunto')).toBeVisible();
  await expect(exportar).toBeEnabled(); // hay mensajes

  await page.getByRole('searchbox').fill('no-existe-nada');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.locator('.empty-state')).toBeVisible();
  await expect(exportar).toBeDisabled();
  await expect(exportar).toHaveAttribute('title', /No hay mensajes para exportar/);

  await page.getByRole('button', { name: 'Limpiar' }).click();
  await expect(page.getByText('Un asunto')).toBeVisible();
  await expect(exportar).toBeEnabled(); // vuelve a habilitarse
  expect(state.messages).toHaveLength(1);
});


test('las animaciones decorativas se apagan si el sistema pide reducir el movimiento', async ({ page }) => {
  await mockApi(page);
  await page.goto('/'); // la configuración de las pruebas pide «reducir movimiento»
  await expect(page.locator('.hero-confetti')).toBeHidden();
  expect(await page.locator('.hero-logo').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  expect(await page.locator('.nav a').first().evaluate((el) => getComputedStyle(el).backgroundSize)).not.toContain('3px');

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('.hero-confetti')).toBeVisible();
  expect(await page.locator('.hero-confetti .bit').first().evaluate((el) => getComputedStyle(el).animationName)).toBe('hero-drift');
  expect(await page.locator('.hero-logo').evaluate((el) => getComputedStyle(el).animationName)).toContain('hero-bob');
  // lo decorativo no se anuncia ni recibe clics
  await expect(page.locator('.hero-confetti')).toHaveAttribute('aria-hidden', 'true');
  expect(await page.locator('.hero-confetti').evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
  await expect(page.getByRole('link', { name: 'Escríbenos en el buzón' })).toBeVisible();
});

test('Equipo: se organiza por niveles (presidencia, vicepresidencia y tesorería, y el resto) según el cargo', async ({ page }) => {
  await mockApi(page);
  const equipo = [
    { _id: 'a', name: 'Vocal Uno', role: 'Vocal de eventos' },
    { _id: 'b', name: 'Tesorera Dos', role: 'Tesorería' },
    { _id: 'c', name: 'Sin Cargo', role: '' },
    { _id: 'd', name: 'Vice Tres', role: 'Vicepresidente' },
    { _id: 'e', name: 'Presi Cuatro', role: 'Presidencia' },
    { _id: 'f', name: 'Secretario Cinco', role: 'Secretaría' },
  ];
  await page.route('**/api/members', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(equipo) }));
  await page.goto('/equipo');

  const nivel = (n) => page.locator(`.tier-${n} .member h3`);
  await expect(nivel(1)).toHaveText(['Presi Cuatro']);
  await expect(nivel(2)).toHaveText(['Vice Tres', 'Tesorera Dos']); // la vicepresidencia va antes que la tesorería
  await expect(nivel(3)).toHaveText(['Vocal Uno', 'Sin Cargo', 'Secretario Cinco']); // conservan el orden del panel
  await expect(page.locator('.tier')).toHaveCount(3);
  // De arriba hacia abajo: cada nivel está más abajo que el anterior
  const y = async (n) => (await page.locator(`.tier-${n}`).boundingBox()).y;
  expect(await y(1)).toBeLessThan(await y(2));
  expect(await y(2)).toBeLessThan(await y(3));
  // El nivel 1 tiene la tarjeta más grande
  const ancho = async (n) => (await page.locator(`.tier-${n} .member`).first().boundingBox()).width;
  expect(await ancho(1)).toBeGreaterThan(await ancho(2));
  expect(await ancho(2)).toBeGreaterThan(await ancho(3));
});

test('Equipo: sin presidencia o sin segundo nivel no quedan huecos ni niveles vacíos', async ({ page }) => {
  await mockApi(page);
  await page.route('**/api/members', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ _id: 'a', name: 'Solo Vocal', role: 'Vocal' }]) }));
  await page.goto('/equipo');
  await expect(page.locator('.tier')).toHaveCount(1);
  await expect(page.locator('.tier-3 .member h3')).toHaveText(['Solo Vocal']);
});

test('Equipo: las tarjetas son horizontales (foto a la izquierda, datos a la derecha) y de poca altura, también en teléfono', async ({ page }) => {
  await mockApi(page);
  for (const [ancho, alto] of [[1280, 720], [390, 800]]) {
    await page.setViewportSize({ width: ancho, height: alto });
    await page.goto('/equipo');
    await expect(page.locator('.member').first()).toBeVisible();
    for (const card of await page.locator('.member').all()) {
      const c = await card.boundingBox();
      const foto = await card.locator('.avatar, img').boundingBox();
      const datos = await card.locator('.member-info').boundingBox();
      expect(foto.x + foto.width, `a ${ancho}px la foto va a la izquierda de los datos`).toBeLessThanOrEqual(datos.x);
      expect(Math.abs(foto.y + foto.height / 2 - (datos.y + datos.height / 2)), 'foto y datos alineados al centro').toBeLessThan(24);
      expect(c.height, 'tarjeta compacta, no un recuadro grande').toBeLessThan(180);
      expect(c.width).toBeGreaterThan(c.height); // más ancha que alta
    }
  }
});

test('el semestre y el grupo de un integrante se eligen en menús con las opciones de Ajustes; el grupo solo si la licenciatura lo usa', async ({ page }) => {
  const state = await mockApi(page, { loggedIn: true });
  await page.route('**/api/settings', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ degrees: ['Licenciatura en Primaria', 'Licenciatura en Telesecundaria'], groups: ['A', 'B'], semesters: ['1', '2', '3'], groupDegrees: ['Licenciatura en Telesecundaria'], social: {} }),
  }));
  await withSession(page);
  await page.goto('/perfil');

  const licenciatura = page.getByRole('combobox', { name: /^Licenciatura/ });
  const semestre = page.getByRole('combobox', { name: 'Semestre' });
  const grupo = page.getByRole('combobox', { name: /^Grupo/ });
  await expect(semestre.locator('option')).toHaveText(['Sin especificar', '1', '2', '3']);
  // Licenciatura sin grupos: el menú de grupo no aplica
  await licenciatura.selectOption('Licenciatura en Primaria');
  await expect(grupo).toBeDisabled();
  await expect(grupo.locator('option:checked')).toHaveText('No aplica');
  // Licenciatura con grupos: se habilita con las opciones de Ajustes
  await licenciatura.selectOption('Licenciatura en Telesecundaria');
  await expect(grupo).toBeEnabled();
  await expect(grupo.locator('option')).toHaveText(['Sin especificar', 'A', 'B']);
  await semestre.selectOption('2');
  await grupo.selectOption('B');
  await page.getByRole('button', { name: 'Guardar mi información' }).click();
  await expect(page.getByText('Información actualizada ✔')).toBeVisible();
  expect(state.sent.me).toMatchObject({ degree: 'Licenciatura en Telesecundaria', semester: '2', group: 'B' });

  // Al cambiar a una licenciatura sin grupos, el grupo elegido se borra
  await page.goto('/perfil');
  await licenciatura.selectOption('Licenciatura en Telesecundaria');
  await grupo.selectOption('A');
  await licenciatura.selectOption('Licenciatura en Primaria');
  await page.getByRole('button', { name: 'Guardar mi información' }).click();
  await expect.poll(() => state.sent.me).toMatchObject({ degree: 'Licenciatura en Primaria', group: '' });

  // El Moderador ve los mismos menús al editar a un integrante
  await page.goto('/admin/equipo');
  await page.getByRole('button', { name: 'Editar' }).first().click();
  await expect(page.getByRole('combobox', { name: 'Semestre' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: /^Grupo/ })).toBeVisible();
});

test('Equipo: la tarjeta muestra el semestre y el grupo cuando los hay', async ({ page }) => {
  await mockApi(page);
  await page.route('**/api/members', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([
      { _id: 'a', name: 'Con Datos', role: 'Vocal', degree: 'Licenciatura en Telesecundaria', semester: '3', group: 'B' },
      { _id: 'b', name: 'Solo Semestre', role: 'Vocal', degree: 'Licenciatura en Primaria', semester: '5' },
      { _id: 'c', name: 'Sin Nada', role: 'Vocal' },
    ]),
  }));
  await page.goto('/equipo');
  const tarjeta = (nombre) => page.locator('.member', { hasText: nombre });
  await expect(tarjeta('Con Datos')).toContainText('Semestre 3 · Grupo B');
  await expect(tarjeta('Solo Semestre')).toContainText('Semestre 5');
  await expect(tarjeta('Solo Semestre')).not.toContainText('Grupo');
  await expect(tarjeta('Sin Nada')).not.toContainText('Semestre');
});

test('Equipo: la decoración es solo visual, se adapta al ancho y nunca se encima con una tarjeta', async ({ page }) => {
  await mockApi(page);
  const equipo = [
    { _id: 'e', name: 'Presi Cuatro', role: 'Presidencia' },
    { _id: 'd', name: 'Vice Tres', role: 'Vicepresidente' },
    { _id: 'b', name: 'Tesorera Dos', role: 'Tesorería' },
    { _id: 'a', name: 'Vocal Uno', role: 'Vocal' },
    { _id: 'f', name: 'Secretario Cinco', role: 'Secretaría' },
    { _id: 'g', name: 'Vocal Seis', role: 'Vocal' },
    { _id: 'h', name: 'Vocal Siete', role: 'Vocal' },
  ];
  await page.route('**/api/members', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(equipo) }));

  const encima = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  for (const ancho of [1440, 1180, 1100, 1000, 940]) {
    await page.setViewportSize({ width: ancho, height: 900 });
    await page.goto('/equipo');
    await expect(page.locator('.tier-1 .tier-decor')).toBeVisible();
    // Todo lo decorativo va oculto para lectores de pantalla y sin recibir clics
    for (const el of await page.locator('.tier-decor, .org-ambient, .team-slogan').all()) await expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(await page.locator('.tier-decor').first().evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
    // Ningún adorno visible tapa una tarjeta de su nivel
    for (const nivel of [1, 2, 3]) {
      const tarjetas = await Promise.all((await page.locator(`.tier-${nivel} .member`).all()).map((c) => c.boundingBox()));
      for (const adorno of await page.locator(`.tier-${nivel} .tier-decor .d`).all()) {
        if (!(await adorno.isVisible())) continue;
        const caja = await adorno.boundingBox();
        for (const tarjeta of tarjetas) expect(encima(caja, tarjeta), `a ${ancho}px un adorno del nivel ${nivel} tapa una tarjeta`).toBe(false);
      }
    }
  }
  // Rótulos y retazos grandes solo con muchísimo espacio
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/equipo');
  await expect(page.locator('.d-tag')).toHaveText(['Presidencia', 'Vicepresidencia y tesorería']);
  await expect(page.locator('.d-tag').first()).toBeVisible();
  await page.setViewportSize({ width: 1000, height: 900 });
  await expect(page.locator('.d-tag').first()).toBeHidden();
  await expect(page.locator('.d-patch').first()).toBeHidden();
  // En pantallas angostas y en teléfono no hay decoración
  for (const ancho of [800, 390]) {
    await page.setViewportSize({ width: ancho, height: 900 });
    await expect(page.locator('.tier-decor').first()).toBeHidden();
    await expect(page.locator('.org-ambient')).toBeHidden();
  }
});

test('Equipo: la decoración se mueve solo si el sistema lo permite', async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/equipo'); // las pruebas piden «reducir movimiento»
  const animacion = (selector) => page.locator(selector).first().evaluate((el) => getComputedStyle(el).animationName);
  expect(await animacion('.d-star')).toBe('none');
  await expect(page.locator('.org-ambient .bit').first()).toBeHidden(); // los papelitos no se ven
  await expect(page.locator('.d-star').first()).toBeVisible(); // los adornos quedan quietos

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(await animacion('.d-star')).toBe('twinkle');
  expect(await animacion('.d-plus')).toBe('spin-slow');
  expect(await animacion('.d-squig path')).toBe('scribble');
  expect(await animacion('.org-ambient .bit')).toBe('org-drift');
  await expect(page.locator('.org-ambient .bit').first()).toBeVisible();
});

test('buzón: nombre y teléfono van en una sola fila, 60 % y 40 %, y en teléfono se apilan', async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/buzon');
  const cajas = async () => [await page.getByLabel('Nombre completo').boundingBox(), await page.getByLabel('Teléfono').boundingBox()];

  let [nombre, telefono] = await cajas();
  expect(Math.abs(nombre.y - telefono.y), 'misma fila').toBeLessThan(2);
  expect(nombre.x + nombre.width, 'el nombre va a la izquierda del teléfono').toBeLessThan(telefono.x);
  const total = nombre.width + telefono.width;
  expect(nombre.width / total).toBeGreaterThan(0.57);
  expect(nombre.width / total).toBeLessThan(0.63);
  expect(telefono.width / total).toBeGreaterThan(0.37);
  expect(telefono.width / total).toBeLessThan(0.43);
  // Ocupan el mismo ancho que el campo de Licenciatura de abajo
  const licenciatura = await page.getByLabel('Licenciatura').boundingBox();
  expect(Math.abs(nombre.x - licenciatura.x)).toBeLessThan(2);
  expect(Math.abs(telefono.x + telefono.width - (licenciatura.x + licenciatura.width))).toBeLessThan(2);

  // En una pantalla de teléfono se apilan: el teléfono queda debajo del nombre
  await page.setViewportSize({ width: 390, height: 800 });
  [nombre, telefono] = await cajas();
  expect(telefono.y).toBeGreaterThan(nombre.y + nombre.height - 1);
  expect(Math.abs(nombre.x - telefono.x)).toBeLessThan(2);
});

test('buzón: la decoración de los costados es solo visual, se adapta al ancho y nunca toca el formulario', async ({ page }) => {
  await mockApi(page);
  const encima = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

  for (const ancho of [1000, 1100, 1200, 1440, 1920]) {
    await page.setViewportSize({ width: ancho, height: 900 });
    await page.goto('/buzon');
    const formulario = await page.locator('.mailbox-page > .container').boundingBox();
    const adornos = page.locator('.mailbox-decor .d');
    await expect(adornos.first()).toBeVisible();
    for (const adorno of await adornos.all()) {
      if (!(await adorno.isVisible())) continue;
      const caja = await adorno.boundingBox();
      expect(encima(caja, formulario), `a ${ancho}px un adorno toca el formulario`).toBe(false);
      expect(caja.x, 'dentro de la pantalla').toBeGreaterThanOrEqual(-1);
      expect(caja.x + caja.width, 'dentro de la pantalla').toBeLessThanOrEqual(ancho + 1);
    }
    // Todo lo decorativo va oculto para lectores de pantalla y sin recibir clics
    await expect(page.locator('.mailbox-decor')).toHaveAttribute('aria-hidden', 'true');
    expect(await page.locator('.mailbox-decor').evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
    // Las piezas grandes (aviones, burbujas, sobres, rótulos) solo con ≥ 1200 px
    const grandes = await page.locator('.mailbox-decor .d.wide').first().isVisible();
    expect(grandes, `piezas grandes a ${ancho}px`).toBe(ancho >= 1200);
  }

  // Con las piezas grandes: avión, burbujas, sobre y rótulos del tema del buzón
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/buzon');
  await expect(page.locator('.mailbox-decor .d-plane').first()).toBeVisible();
  await expect(page.locator('.mailbox-decor .d-bubble')).toHaveCount(2);
  await expect(page.locator('.mailbox-decor .d-env')).toBeVisible();
  await expect(page.locator('.mailbox-decor .d-tag')).toHaveText(['Tu opinión cuenta', '¡Escríbenos!']);

  // En pantallas angostas y en teléfono no hay decoración
  for (const ancho of [980, 390]) {
    await page.setViewportSize({ width: ancho, height: 900 });
    await expect(page.locator('.mailbox-decor').first()).toBeHidden();
  }

  // La pantalla de agradecimiento (sin pie y de una sola columna) no lleva decoración
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/buzon');
  await page.getByText('De forma anónima').click();
  await page.getByLabel('Asunto').fill('Una duda');
  await page.locator('textarea').fill('¿Dónde entrego el formato?');
  await page.getByRole('button', { name: /Enviar mensaje/ }).click();
  await expect(page.getByRole('heading', { name: /Gracias por/ })).toBeVisible();
  await expect(page.locator('.mailbox-decor')).toHaveCount(0);
});

test('buzón: la decoración se mueve solo si el sistema lo permite', async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/buzon'); // las pruebas piden «reducir movimiento»
  const animacion = (selector) => page.locator(selector).first().evaluate((el) => getComputedStyle(el).animationName);
  expect(await animacion('.mailbox-decor .d-plane')).toBe('none');
  expect(await animacion('.mailbox-decor .d-star')).toBe('none');
  await expect(page.locator('.mailbox-ambient .bit').first()).toBeHidden(); // los papelitos no se ven
  await expect(page.locator('.mailbox-decor .d-plane').first()).toBeVisible(); // las piezas quedan quietas

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(await animacion('.mailbox-decor .d-plane')).toBe('fly');
  expect(await animacion('.mailbox-decor .d-bubble')).toBe('bob');
  expect(await animacion('.mailbox-decor .d-env')).toBe('bob');
  expect(await animacion('.mailbox-decor .d-star')).toBe('twinkle');
  expect(await animacion('.mailbox-ambient .bit')).toBe('mailbox-drift');
  await expect(page.locator('.mailbox-ambient .bit').first()).toBeVisible();
});
