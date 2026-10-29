# Documentación — Generación de Impacto

Sitio web de la planilla **Generación de Impacto** (Consejo Estudiantil de la ENSFA). Para regenerar el proyecto desde cero con una IA, ver [`Prompt Inicial.md`](Prompt%20Inicial.md).

> Este documento se actualiza en cada cambio importante (ver `CLAUDE.md`). El historial está al final.

## 1. Arquitectura

```
Generacion-de-Impacto/
├── frontend/            React 18 + Vite + React Router 7 → Vercel
│   ├── public/brand/    logo-planilla.svg, logo-ensfa.png   (favicon.png = emblema de la planilla)
│   └── src/             App, auth, api, hooks, utils, pages/ (admin/: una página por sección del panel), components/, styles.css
├── backend/             Express 5 + Mongoose + Zod 4 → Render
│   ├── src/             index, db (GridFS), uploads (multer + firma de imágenes), settings, auth, models, validators,
│   │                    seed, create-admin, routes/ (auth, messages, members, files, content)
│   └── seed/            reto-impacto.jpg (portada de la primera noticia)
├── docs/                esta documentación, Prompt Inicial y referencias visuales
├── render.yaml          Blueprint de Render (rootDir: backend)
└── package.json         workspaces: frontend, backend
```

Flujo: el navegador (Vercel) llama a la API (Render) con `VITE_API_URL`; la API guarda todo en MongoDB Atlas. Las imágenes subidas desde el panel se almacenan en **GridFS** (bucket `files`) y se sirven por `GET /api/files/:id` con caché de un año.

## 2. Desarrollo local

```bash
npm install
cp backend/.env.example backend/.env   # completa MONGODB_URI (contraseña real) y JWT_SECRET
npm run seed                           # propuestas, ajustes y primera noticia (idempotente)
npm run create-admin                   # crea el primer administrador (ver sección 5)
npm run dev                            # API en :4000, web en :5173 (Vite usa otro puerto si está ocupado)
```

`npm run build` genera `frontend/dist`. En desarrollo Vite redirige `/api` a `localhost:4000`.

> `npm run dev` usa `node --watch`: si cierras solo el proceso hijo del servidor, el vigilante lo reinicia. Cierra la terminal (o el árbol completo de procesos) para detenerlo.

## 3. Variables de entorno

| Variable | Dónde | Descripción |
|---|---|---|
| `MONGODB_URI` | backend | Cadena de Atlas con la base `generacion_impacto`. **Secreto.** |
| `JWT_SECRET` | backend | Cadena aleatoria larga para firmar sesiones. **Secreto.** |
| `CORS_ORIGIN` | backend | Orígenes permitidos, separados por coma (URL de Vercel). |
| `PORT` | backend | Puerto (Render lo define solo). |
| `VITE_API_URL` | frontend | URL pública del backend sin barra final (vacía en desarrollo). |

`backend/.env` está en `.gitignore`; los `.env.example` solo llevan marcadores.

## 4. Datos (MongoDB)

Colecciones: `users`, `members`, `messages`, `news`, `proposals`, `settings`, más `files.files` / `files.chunks` (GridFS). Detalle de campos en `backend/src/models.js`.

- Cada mensaje tiene un **tipo** (`queja`, `propuesta`, `pregunta`, `problema`), un **estado de bandeja** (`status`: `nuevo`, `leido`, `archivado`) y un **estado de revisión** (`review`: `pendiente` por defecto, `en_proceso`, `completado`, `rechazado`). Son independientes: un mensaje puede estar leído y a la vez en proceso. Los mensajes anteriores a `review` se tratan como pendientes.
- Un mensaje **anónimo** nunca almacena nombre, teléfono, licenciatura, semestre ni grupo. Un mensaje **con datos** guarda además el **teléfono** (10 dígitos sin espacios; se captura y muestra como `000 000 0000`). El **grupo** solo se pide y guarda si la licenciatura elegida tiene varios grupos (ver Ajustes más abajo); en las demás se descarta.
- Un mensaje puede llevar hasta **3 imágenes** (`images`, ids de GridFS; JPG/PNG/WEBP/GIF, 5 MB cada una, sin SVG), anónimo o no. Se validan por tipo y por la **firma real del archivo**; se envían en la misma petición multipart que el mensaje (si algo falla no quedan archivos huérfanos) y se borran de GridFS al eliminar el mensaje. Las imágenes pueden contener metadatos (p. ej. ubicación del EXIF) que no se eliminan: el formulario avisa a quien escribe de forma anónima que revise lo que adjunta.
- Cada **integrante** (`members`) apunta a su cuenta (`users`) mediante `member.user`. La API pública de integrantes nunca devuelve ese campo ni el correo.
- Las listas de licenciaturas, semestres y grupos del formulario viven en `settings` y se editan desde el panel. `groupDegrees` es la lista de **licenciaturas con varios grupos** (casillas en Panel → Ajustes); mientras nadie la guarde, se deduce: toda licenciatura cuyo nombre contenga “telesecundaria”. El valor se calcula en `backend/src/settings.js` y se usa tanto en `GET /api/settings` como al validar un mensaje.

## 5. Cuentas, integrantes y acceso

**No hay registro público.** Solo las personas dadas de alta como integrantes de la planilla tienen cuenta:

- **Alta de integrante** (Panel → Equipo → Nuevo integrante): se capturan nombre, cargo, licenciatura, orden, foto, **correo y contraseña**. La API crea el usuario y la ficha juntos, y **todo integrante es administrador**. Si falla la creación de la ficha, se revierte la cuenta.
- **Edición**: se puede cambiar el correo y restablecer la contraseña (campo vacío = no cambiar). El nombre se sincroniza con la cuenta.
- **Baja**: eliminar al integrante elimina también su cuenta (su sesión deja de funcionar al instante). Nadie puede eliminar su propia ficha, así que siempre queda al menos un administrador.
- **Primer administrador**: `npm run create-admin` (interactivo; o con `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`). Crea cuenta + ficha. Si el correo ya tiene cuenta sin ficha de integrante, solo crea la ficha y la vincula sin tocar la contraseña. Para producción, ejecútalo en tu equipo con `MONGODB_URI` de Atlas.
- **Sesión**: correo + contraseña (bcrypt), JWT de 7 días. El rol se consulta en la BD en cada petición.
- **Perfil** (`/perfil`): datos del usuario y cambio de contraseña (pide la actual). Las sesiones ya emitidas siguen válidas hasta expirar tras cambiar la contraseña.
- El header muestra, con sesión iniciada, un menú con **Ver perfil** y **Cerrar sesión** (con confirmación). Los campos de contraseña tienen botón de “ojo” para mostrarla.

## 6. API

Resumen (detalle de validaciones en `backend/src/routes/`):

- Auth: `POST /api/auth/login`, `GET /api/auth/me`, `PATCH /api/auth/password`.
- Buzón: `POST /api/messages` (público; multipart con los campos y hasta 3 archivos `images`, o JSON sin imágenes); admin: `GET /api/messages?status=&type=&review=` (filtros opcionales y combinables), `PATCH /:id` (`{status?, review?}`, al menos uno) y `DELETE /:id`.
- Integrantes: `GET /api/members` (público, sin correo); `GET /api/members/all`, `POST`, `PUT /:id`, `DELETE /:id` (admin).
- Archivos: `POST /api/files` (admin, JPG/PNG/WEBP/GIF ≤ 5 MB, sin SVG), `GET /api/files/:id`, `DELETE /api/files/:id` (admin).
- Contenido: `/api/news`, `/api/proposals` (lectura pública; escritura admin; `/news/all` y `/proposals/all` incluyen no publicados), `GET /api/settings`, `PUT /api/settings/:key` (admin; claves `degrees`, `groups`, `semesters`, `groupDegrees`, `social`).
- `GET /api/health` para el health check de Render.

## 7. Despliegue

1. **Atlas**: usuario de BD y *Network Access* abierto a Render.
2. **Render** → New → Blueprint con `render.yaml`. Define `MONGODB_URI` y `CORS_ORIGIN`. Plan gratuito: se duerme por inactividad (primera carga lenta).
3. **Vercel** → importar repo, *Root Directory* `frontend`, variable `VITE_API_URL`.
4. Ejecuta `npm run seed` y `npm run create-admin` una vez contra la base de producción (desde tu equipo, con el `MONGODB_URI` de Atlas). Luego inicia sesión en `/acceso` y da de alta al resto del equipo en Panel → Equipo.

## 8. Revisión de calidad (2026-10-26)

Ejecutado: ESLint (variables sin uso, reglas de React y hooks), búsqueda de CSS y exports sin uso, `npm audit`, 59 pruebas de API y 43 comprobaciones en navegador contra una base de pruebas aparte (eliminada después). Resultado y limitaciones conocidas:

- Sin errores, sin código muerto detectado y `npm audit` en 0 vulnerabilidades (se actualizaron `zod` 3→4 y `react-router-dom` 6→7).
- El rol `user` de `User.role` ya no se asigna a nadie (todas las cuentas son de integrantes y por tanto `admin`). Se conserva el campo y la comprobación de rol como defensa si se edita la BD a mano.
- **Imágenes huérfanas**: si en el panel subes una imagen y cancelas sin guardar, el archivo queda en GridFS. Se limpian solo al reemplazar o eliminar el registro que las usa.
- **Login sin límite de intentos**: no hay rate limit en `/api/auth/login`; con cuentas de administrador conviene agregarlo antes de promocionar el sitio.
- **Buzón sin anti-spam** (decisión del cliente).
- Las páginas comparten un único `<title>` (“Generación de Impacto”).

## 9. Pendientes y decisiones abiertas

- Propuesta **#7**: aún no definida; agregarla desde Panel → Propuestas.
- **Licenciaturas** por defecto son una suposición: confirmarlas con la ENSFA y editarlas en Panel → Ajustes.
- Integrantes del equipo, redes sociales y correo de contacto: capturar desde el panel.
- **Aviso por correo de mensajes nuevos: aplazado por decisión del cliente** (no hay código ni variables). Si se retoma: Render gratis bloquea SMTP (puertos 25/465/587), así que hay que usar una API HTTPS (p. ej. Brevo, verificando el remitente) o SMTP en hosting de pago; `ensfa.edu.mx` usa Google Workspace (SMTP con contraseña de aplicación entrega mejor). Guardar el mensaje antes de enviar el correo y que un fallo del correo nunca afecte al usuario; el correo no debe incluir datos personales de mensajes anónimos.
- Rotar la contraseña de Atlas: la cadena de conexión se compartió en el chat durante el desarrollo.

## 10. Registro de cambios

### 2026-10-29 — Círculos de carga (0.5.0)
- Nuevo componente `components/Spinner.jsx`: círculo giratorio (rojo sobre gris) con texto “Cargando…” para lectores de pantalla (`role="status"`), y variante `inline` (pequeña) para botones. Con movimiento reducido sigue girando, más lento.
- Se muestra en toda sección que espera datos de la API: Inicio (noticias y propuestas), Noticias, detalle de noticia, Propuestas, Equipo, Perfil y panel (mientras se valida la sesión), y en Panel → Mensajes, Noticias, Propuestas, Equipo y Ajustes. En Mensajes, al cambiar un filtro la lista se vacía y muestra el círculo hasta que llegan los resultados (`useList` ahora devuelve `loading`; recargar la misma ruta tras una acción no parpadea).
- Círculo pequeño dentro de los botones mientras trabajan: “Entrando…”, “Enviando…”, “Guardando…” (contraseña) y “Subiendo…” (imágenes del panel).

### 2026-10-29 — Hora de registro en las tarjetas de mensajes (0.4.2)
- En Panel → Mensajes, la esquina superior de cada tarjeta muestra **fecha y hora de registro** (p. ej. “29 de octubre de 2026 · 2:35 p.m.”, en la hora local de quien consulta) en lugar del estado de bandeja. El estado sigue visible por el borde rojo de los mensajes nuevos y por el filtro Estado.

### 2026-10-29 — Ajustes del desplegable y del bloque de grupo (0.4.1)
- Se retiró la lista desplegable personalizada (`appearance: base-select`): según el espacio disponible en la ventana, Chrome podía mostrarla con una sola opción. Ahora los `<select>` conservan el campo estilizado (borde, flecha roja) con la lista nativa del navegador, que siempre muestra todas las opciones.
- Buzón: la etiqueta del selector es **“Grupo (Telesecundaria)”** y se quitó el texto de ayuda inferior, que además desalineaba el bloque respecto a Semestre.

### 2026-10-29 — Imágenes y teléfono en el buzón; grupos solo en Telesecundaria (0.4.0)
- **Imágenes adjuntas.** El buzón permite adjuntar hasta 3 imágenes (JPG, PNG, WEBP o GIF, 5 MB cada una) con vista previa y botón para quitarlas. Se envían junto con el mensaje (multipart). Nuevo `backend/src/uploads.js` (multer, comprobación de firma, guardado en GridFS) que también usa `POST /api/files`. En Panel → Mensajes se ven como miniaturas que abren la imagen completa en otra pestaña.
- **Teléfono.** Los mensajes con datos piden teléfono de 10 dígitos con máscara `000 000 0000` (solo números, máximo 10); se guarda sin espacios y el panel lo muestra con formato. Los anónimos no lo envían ni lo guardan.
- **Grupo condicionado.** El selector de grupo está deshabilitado (“No aplica”) salvo que se elija una licenciatura con varios grupos (hoy, Telesecundaria); al cambiar de licenciatura se limpia. La API lo exige solo en esas licenciaturas y lo descarta en las demás. Nueva opción en Panel → Ajustes: “Licenciaturas con varios grupos” (`groupDegrees`).
- Corrección de seguridad menor: `POST /api/files` ahora también verifica la firma real del archivo, no solo el tipo declarado.

### 2026-10-29 — Filtros de mensajes como menús desplegables (0.3.1)
- En Panel → Mensajes, los filtros **Tipo**, **Estado** y **Revisión** pasaron de chips a tres menús desplegables (con el estilo de selectores del sitio) en una fila compacta (ancho ajustado al contenido, que se acomoda en varias líneas en móvil). Siguen siendo combinables.
- Corrección en `useList` (panel): `reload` ahora es estable, consulta siempre la ruta vigente y descarta respuestas tardías de rutas anteriores; antes, al cambiar un filtro justo después de otra acción, podía mostrarse una lista que ya no correspondía a los filtros.

### 2026-10-29 — Panel por páginas, clasificación de mensajes, diálogos propios y selectores (0.3.0)
- **Panel admin en rutas propias.** Cada pestaña es una página con su URL: `/admin/mensajes`, `/admin/noticias`, `/admin/propuestas`, `/admin/equipo` y `/admin/ajustes` (`/admin` redirige a mensajes). `pages/Admin.jsx` se dividió en `pages/admin/`: `AdminLayout` (protección de acceso, título y navegación con `NavLink` + `<Outlet />`), una página por sección y `shared.jsx` (lista, editor genérico, campo de imagen). La estructura visual es la misma; el botón Atrás y los enlaces directos funcionan.
- **Mensajes: clasificación y revisión.** Nuevo campo `review` (`pendiente`, `en_proceso`, `completado`, `rechazado`) además del estado de bandeja. En Panel → Mensajes hay tres filtros combinables (Tipo, Estado, Revisión), cada tarjeta muestra el tipo y una insignia de revisión de color, y un selector permite cambiarla. API: `GET /api/messages` acepta `type` y `review`; `PATCH` acepta `status` y/o `review`.
- **Sin `alert()`/`confirm()` del navegador.** Nuevo `components/Dialog.jsx` (`DialogProvider` + `useDialog()` con `confirm()` y `notify()`) muestra confirmaciones y avisos en un modal con el diseño del sitio (foco inicial en la opción segura, Esc y clic fuera cancelan). Se usa al eliminar elementos del panel, al cerrar sesión y para mostrar errores del servidor al eliminar (antes fallaban en silencio). Se retiró `ConfirmDialog.jsx`.
- **Menús de selección con estilo.** Campo con borde negro y flecha roja propia. (Se probó una lista desplegable personalizada con `appearance: base-select`, pero en algunas pantallas Chrome la dejaba con una sola opción visible; se retiró en 0.4.1 y se usa la lista nativa del navegador.)
- Buzón: en la pantalla de agradecimiento, **Inicio** es el botón primario (rojo) y va primero; “Enviar otro mensaje” es el secundario (negro).

### 2026-10-29 — Título de la pestaña (0.2.6)
- El `<title>` del sitio es ahora solo **Generación de Impacto** (antes incluía “| Consejo Estudiantil ENSFA”), en `frontend/index.html`.

### 2026-10-29 — Botón “Inicio” tras enviar un mensaje (0.2.5)
- En la pantalla de agradecimiento del buzón, junto a “Enviar otro mensaje” se agregó el botón **Inicio** (enlace a `/`).

### 2026-10-29 — Logo de la planilla en SVG (0.2.4)
- El logo se veía borroso (el PNG original medía solo 585 px). Se rehízo como **vector**: `frontend/public/brand/logo-planilla.svg` (sin fondo, sin ruido; ~40 KB). El puño y los dos arcos son el trazo vectorial del original (potrace) y los textos “GENERACIÓN DE” (Montserrat Bold) e “IMPACTO” (Montserrat ExtraBold) están convertidos a curvas, así que no depende de tipografías. Rojo `#d0191f`, blanco cálido `#f4f1ec`.
- Header, hero, footer y la miniatura de noticias sin portada usan el SVG; se eliminó `logo-planilla.png` y la regla `mix-blend-mode: lighten`. El favicon sigue siendo `favicon.png` (PNG 128 px).
- Nota: la restricción de “no SVG” aplica solo a las **imágenes subidas** por el panel (por seguridad), no a los recursos propios del sitio.

### 2026-10-27 — Revisión en vista de teléfono (0.2.3)
- Revisadas todas las páginas públicas, el perfil y el panel admin a 375 px y 320 px (emulación móvil en Chrome): sin desbordes horizontales, textos y formularios legibles, menú hamburguesa y menú de usuario funcionales.
- `logo-planilla.png`: el fondo casi negro del PNG se convirtió en transparente (el ruido oscuro dejaba ver un rectángulo con motas junto al logo en header y footer).

### 2026-10-27 — Noticias antes de “Quiénes somos” en Inicio (0.2.2)
- En la página de inicio, la sección **Últimas noticias** ahora va justo después del hero y antes de **Quiénes somos**. Orden actual: hero, noticias, quiénes somos, propuestas, banda “Tu opinión cuenta”. Se mantiene la alternancia **claro–oscuro–claro**: noticias (crema), quiénes somos (negro, título claro) y propuestas (crema, con tarjetas blancas para que resalten).

### 2026-10-26 — Se retira el aviso por correo (0.2.1)
- Por decisión del cliente, **no se incluye el aviso por correo** de mensajes nuevos: se eliminaron `notify.js`, la dependencia `nodemailer`, las variables `MAIL_*`, `BREVO_API_KEY`, `SMTP_*` y `SITE_URL`, y su documentación. El buzón solo guarda el mensaje; se consultan en Panel → Mensajes. Ver nota en “Pendientes” por si se retoma.

### 2026-10-26 — Cuentas solo para integrantes, perfil y revisión general (0.2.0)
- Header: se quitó el logo de la ENSFA (sigue en el footer y en “Quiénes somos”); menú de usuario con **Ver perfil** y **Cerrar sesión** con confirmación (`<dialog>`); botón de “ojo” en todos los campos de contraseña.
- **Eliminado el registro público** y la gestión de roles. Las cuentas nacen al dar de alta a un integrante (correo + contraseña obligatorios) y todo integrante es admin. Baja de integrante = baja de cuenta. Nuevo `npm run create-admin` para el primer administrador. Nueva página `/perfil` con cambio de contraseña.
- Favicon: emblema del puño de la planilla en lugar del logo de la ENSFA.
- (Se había añadido un aviso por correo de mensajes nuevos; fue retirado en 0.2.1.)
- Revisión general: `useFetch` sin `setState` síncrono en efectos, `<h1>` en la portada, foco inicial del diálogo en “Cancelar”, exports y CSS sin uso eliminados, `zod` 4 y `react-router-dom` 7 (0 vulnerabilidades). Backend: `routes/members.js` y `validators.js` separados; `deleteFile` centralizado en `db.js`.
- Verificado: 59 pruebas de API y 43 comprobaciones en navegador, todo en una base de pruebas eliminada después.

### 2026-10-26 — Versión inicial (0.1.0)
- Monorepo `frontend/` + `backend/` con npm workspaces; `render.yaml` para Render y `vercel.json` para Vercel.
- Backend: auth con primer usuario admin y gestión de roles; buzón digital (anónimo/identificado); CRUD de noticias, propuestas, equipo y ajustes; imágenes en GridFS; seed con 9 propuestas, ajustes y la noticia “Reto Impacto: Tapitas con Causa”.
- Frontend: Inicio, Propuestas, Noticias (+detalle), Buzón, Equipo, Acceso y Panel admin, con estilo de papel rasgado crema/rojo/negro y logos de la planilla y la ENSFA.
- Documentación inicial: este archivo, `Prompt Inicial.md`, `CLAUDE.md` con la regla de actualización automática.
