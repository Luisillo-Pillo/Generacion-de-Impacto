# Generación de Impacto

Sitio web de la planilla **Generación de Impacto** para el Consejo Estudiantil de la ENSFA. *Nuestra voz, nuestras ideas, nuestro impacto.*

Para regenerar el proyecto desde cero con una IA, ver [`docs/Prompt Inicial.md`](docs/Prompt%20Inicial.md).

> Este README es la documentación del proyecto y se actualiza en cada cambio importante (ver `CLAUDE.md`). El historial está al final.

## 1. Arquitectura

```
Generacion-de-Impacto/
├── frontend/            React 18 + Vite + React Router 7 → Vercel
│   ├── public/brand/    logo-planilla.svg, logo-ensfa.png   (favicon.png = emblema de la planilla)
│   ├── api/             funciones de Vercel: vista previa al compartir (og), sitemap y robots (_seo.js lleva la lógica)
│   ├── e2e/             pruebas de humo y de accesibilidad (axe) con Playwright (API simulada en mock-api.js)
│   └── src/             App, auth, api, hooks, utils, pages/ (admin/: una página por sección del panel), components/; cada .jsx con estilos lleva su .css (mismo nombre) y `index.css` guarda solo lo global
├── backend/             Express 5 + Mongoose + Zod 4 → Render
│   ├── src/             app (Express sin arrancar), index (conecta y escucha), db (GridFS), uploads (multer + sharp: limpieza y versiones reducidas), migrate + migrations/ (migraciones de datos),
│   │                    settings, auth (tabla de permisos por rol), passwords (política), rateLimit (limitador del login), audit (bitácora),
│   │                    maintenance + purge (papelera y retención), tracking (códigos de seguimiento), csv, monitoring (Sentry con privacidad),
│   │                    models, validators, seed, create-admin, routes/ (auth, messages, members, files, content, audit)
│   ├── test/            pruebas de la API (node:test + MongoDB en memoria)
│   └── seed/            reto-impacto.jpg (portada de la primera noticia)
├── .github/             CI (ci.yml), respaldos cifrados (backup.yml), limpieza de datos (purge.yml) y Dependabot
├── scripts/             make-og-image.mjs (imagen por defecto para compartir)
├── docs/                Prompt Inicial y referencias visuales
├── eslint.config.mjs    reglas de lint (frontend, backend y pruebas)
├── README.md            esta documentación
├── render.yaml          Blueprint de Render (rootDir: backend)
└── package.json         workspaces: frontend, backend
```

Flujo: el navegador (Vercel) llama a la API (Render) con `VITE_API_URL`; la API guarda todo en MongoDB Atlas. Las imágenes subidas desde el panel se almacenan en **GridFS** (bucket `files`) y se sirven por `GET /api/files/:id` (las públicas con caché de un año; las de los mensajes del buzón son privadas).

## 2. Desarrollo local

```bash
npm install
cp backend/.env.example backend/.env   # completa MONGODB_URI (contraseña real) y JWT_SECRET
npm run seed                           # propuestas, ajustes y primera noticia (idempotente)
npm run create-admin                   # crea el primer administrador (ver sección 5)
npm run migrate                        # migraciones de datos (idempotentes; ver «Imágenes» en la sección 4)
npm run dev                            # API en :4000, web en :5173 (Vite usa otro puerto si está ocupado)
```

`npm run build` genera `frontend/dist`. En desarrollo Vite redirige `/api` a `localhost:4000`.

### Calidad: lint, pruebas y CI

| Comando | Qué hace |
|---|---|
| `npm run lint` | ESLint sobre todo el proyecto (variables sin uso, reglas de React y hooks). |
| `npm test` | Pruebas de la API (`backend/test`, `node:test`): permisos, validaciones, imágenes, anonimato, equipo, ajustes, CORS y cabeceras, freno del login, política de contraseñas, sesiones, protecciones del buzón, papelera y bitácora, imágenes, roles, retención, código de seguimiento, panel de mensajes, contenido, vista previa al compartir y monitoreo. Cada archivo levanta su **propia MongoDB en memoria**, así que nunca toca Atlas. |
| `npm run e2e` | Pruebas de humo en el navegador (`frontend/e2e`, Playwright con el Chrome instalado): inicio, enviar un mensaje anónimo (y el campo trampa), iniciar y cerrar sesión, sesión vencida, crear una noticia, papelera, pestaña Actividad, página 404, seguimiento, roles, Markdown, orden del equipo, teclado, y una **revisión de accesibilidad con axe** (WCAG 2.1 A y AA) de todas las páginas públicas y del panel (`e2e/a11y.spec.js`). La API se simula (`e2e/mock-api.js`), no necesitan backend. |
| `npm run check` | `lint` + `build` + `test`. Córrelo antes de subir cambios. |

- Las pruebas **se niegan a correr** si la base no es local y llamada `gi_test`. Si no puedes descargar el binario de MongoDB que usa `mongodb-memory-server`, define `TEST_MONGODB_URI` con una base llamada exactamente `gi_test` (nunca la real) y ejecuta `node --test --test-concurrency=1` dentro de `backend/`: se vacía al empezar y se elimina al terminar.
- **CI** (`.github/workflows/ci.yml`, en cada push a `main` y en cada PR): `lint` + `build` + `test` + `npm audit --omit=dev --audit-level=high`; las pruebas de humo; y una búsqueda de secretos con gitleaks sobre todo el historial. Su configuración (`.gitleaks.toml`) ignora **solo** las contraseñas falsas de las pruebas, que por su variedad de letras la regla genérica confunde con secretos: por eso las contraseñas inventadas en las pruebas deben empezar con `clave-` (p. ej. `clave-de-beto-1234`). **Dependabot** (`.github/dependabot.yml`) abre cada lunes un PR con las actualizaciones menores agrupadas (y uno por cada actualización mayor).

> `npm run dev` usa `node --watch`: si cierras solo el proceso hijo del servidor, el vigilante lo reinicia. Cierra la terminal (o el árbol completo de procesos) para detenerlo.

## 3. Variables de entorno

| Variable | Dónde | Descripción |
|---|---|---|
| `MONGODB_URI` | backend | Cadena de Atlas con la base `generacion_impacto`. **Secreto.** |
| `JWT_SECRET` | backend | Cadena aleatoria larga para firmar sesiones. **Secreto.** |
| `CORS_ORIGIN` | backend | Orígenes permitidos, separados por coma (URL de Vercel). |
| `CORS_ORIGIN_PATTERN` | backend | **Solo staging.** Acepta las previews de Vercel, p. ej. `https://generacion-impacto-*.vercel.app` (el `*` es un tramo de letras, números y guiones; no admite expresiones regulares). No se define en producción. |
| `TEST_MONGODB_URI` | pruebas | Opcional: base `gi_test` para correr las pruebas sin MongoDB en memoria (ver sección 2). |
| `RETENTION_MONTHS` | backend, GitHub (variable) | Opcional. Meses que se conservan los mensajes **resueltos** (archivados, completados o rechazados) antes de borrarlos con sus imágenes. Sin definir (o 0) no se borra nada por antigüedad. Pendientes y en proceso nunca se borran. |
| `SENTRY_DSN` · `SENTRY_ENVIRONMENT` | backend | Opcional. Activa el reporte de errores a Sentry (ver «Monitoreo»). Sin `SENTRY_DSN` no se envía nada. |
| `VITE_SENTRY_DSN` | frontend | Opcional. Lo mismo para el navegador; el código de Sentry solo se descarga si está definida. |
| `API_URL` | frontend (funciones de Vercel) | Opcional. URL de la API para `frontend/api`; si falta se usa `VITE_API_URL`. |
| `PORT` | backend | Puerto (Render lo define solo). |
| `VITE_API_URL` | frontend | URL pública del backend sin barra final (vacía en desarrollo). También la leen en tiempo de ejecución las funciones de Vercel de `frontend/api` (vista previa y sitemap); si prefieres, define `API_URL` con el mismo valor. |

`backend/.env` está en `.gitignore`; los `.env.example` solo llevan marcadores.

## 4. Datos (MongoDB)

Colecciones: `users`, `members`, `messages`, `news`, `proposals`, `settings`, `auditlogs` (bitácora), `ratelimits` (intentos fallidos de login, con índice TTL), más `files.files` / `files.chunks` (GridFS). Detalle de campos en `backend/src/models.js`.

- Cada mensaje tiene un **tipo** (`queja`, `propuesta`, `pregunta`, `problema`), un **estado de bandeja** (`status`: `nuevo`, `leido`, `archivado`) y un **estado de revisión** (`review`: `pendiente` por defecto, `en_proceso`, `completado`, `rechazado`). Son independientes: un mensaje puede estar leído y a la vez en proceso. Los mensajes anteriores a `review` se tratan como pendientes.
- Un mensaje **anónimo** nunca almacena nombre, teléfono, licenciatura, semestre ni grupo. Un mensaje **con datos** guarda además el **teléfono** (10 dígitos sin espacios; se captura y muestra como `000 000 0000`). El **grupo** solo se pide y guarda si la licenciatura elegida tiene varios grupos (ver Ajustes más abajo); en las demás se descarta.
- **Código de seguimiento:** al enviar un mensaje (anónimo o no) la API devuelve un código `GI-XXXXX-XXXXX` (10 caracteres de un alfabeto de 32 sin letras ambiguas, 50 bits) que la pantalla de agradecimiento muestra **una sola vez**, con botón para copiarlo. **En la base solo se guarda su hash SHA-256** (`codeHash`, que ninguna respuesta de la API expone): ni con acceso a la base se puede enlazar un código con una persona. Con él, en `/seguimiento` se ve el estado, la revisión y la **respuesta pública** que el equipo escriba (campo «Respuesta para quien escribió» de cada mensaje del panel; no debe llevar datos personales). Si se pierde el código no se puede recuperar. Los mensajes anteriores a esta función no tienen código.
- **Panel de mensajes:** paginación de 20 en 20, búsqueda, resumen de contadores (nuevos, pendientes, total y por tipo) con insignia de nuevos en la pestaña, **exportación a CSV** (solo administradores) y **notas internas** por mensaje (autor y fecha; nunca las ve quien escribió). Ni las notas ni las respuestas guardan su texto en la bitácora.
- Un mensaje puede llevar hasta **3 imágenes** (`images`, ids de GridFS; JPG/PNG/WEBP/GIF, 5 MB cada una, sin SVG), anónimo o no. Cada una se **decodifica y se vuelve a codificar** con `sharp` (se descarta lo que no sea una imagen real, se quitan los metadatos —ubicación GPS, cámara— y se aplica la orientación; máximo 4000 px por lado y 100 megapíxeles para evitar «bombas de descompresión»; el GIF animado se conserva) y son **privadas**: solo las ve un administrador con sesión. Se envían en la misma petición multipart que el mensaje (si algo falla no quedan archivos huérfanos) y se borran de GridFS al eliminar el mensaje.
- **Papelera**: eliminar un mensaje solo le pone `deletedAt`; desaparece del listado y queda en Panel → Mensajes → Papelera, donde se puede **restaurar** o **eliminar definitivamente** (con sus imágenes). A los 30 días se borra solo (`backend/src/maintenance.js`, al arrancar la API y cada 6 horas).
- **Bitácora** (`auditlogs`; se guarda y la API la expone en `GET /api/audit` para el Moderador, pero **el panel ya no tiene pestaña «Actividad»**, quitada el 2026-11-07 a petición del cliente): quién creó, editó o eliminó noticias, propuestas, integrantes y ajustes; cambios de estado y papelera de mensajes; cambios de contraseña, cierre de sesión en todos los dispositivos y bloqueos de cuenta por intentos fallidos. **Nunca guarda el contenido de los mensajes** (ni asunto ni texto), solo ids y el tipo de acción; tampoco contraseñas ni IPs. Se conserva un año (índice TTL).
- Cada **integrante** (`members`) apunta a su cuenta (`users`) mediante `member.user`. La API pública de integrantes nunca devuelve ese campo ni el correo.
- Las listas de licenciaturas, semestres y grupos del formulario viven en `settings` y se editan desde el panel. `groupDegrees` es la lista de **licenciaturas con varios grupos**; no se edita desde el panel (decisión del cliente: esa configuración no cambia) y se deduce: toda licenciatura cuyo nombre contenga “telesecundaria”. El valor se calcula en `backend/src/settings.js` y se usa tanto en `GET /api/settings` como al validar un mensaje.

## 5. Cuentas, integrantes y acceso

**No hay registro público.** Solo las personas dadas de alta como integrantes de la planilla tienen cuenta:

- **Alta de integrante** (Panel → Equipo → Nuevo integrante): se capturan nombre, cargo, licenciatura, **semestre y grupo (si aplica)**, foto, **correo y contraseña**. La API crea el usuario y la ficha juntos. Se elige el **rol**: Miembro (por defecto) o Moderador (ver «Roles y permisos» abajo). Siempre debe quedar al menos un Moderador y nadie se quita su propio rol. Si falla la creación de la ficha, se revierte la cuenta.
- **Contraseñas**: mínimo **10 caracteres** y no pueden ser de las más comunes (`1234567890`, `password123`, el nombre del sitio, un solo carácter repetido…) en el alta, el cambio de contraseña y `npm run create-admin`. Se guardan con bcrypt costo 12; las cuentas con contraseñas anteriores (costo 10, incluso de 8 caracteres) siguen entrando y su hash se **actualiza solo** al iniciar sesión.
- **Edición**: se puede cambiar el correo y restablecer la contraseña (campo vacío = no cambiar; al restablecerla se cierran las sesiones de esa persona). El nombre se sincroniza con la cuenta.
- **Baja**: eliminar al integrante elimina también su cuenta (su sesión deja de funcionar al instante). Nadie puede eliminar su propia ficha, así que siempre queda al menos un administrador.
- **Primer administrador**: `npm run create-admin` (interactivo; o con `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`). Crea cuenta + ficha. Si el correo ya tiene cuenta sin ficha de integrante, solo crea la ficha y la vincula sin tocar la contraseña. Para producción, ejecútalo en tu equipo con `MONGODB_URI` de Atlas.
- **Sesión**: correo + contraseña (bcrypt), JWT de **12 horas** que se **renueva solo** mientras se usa el panel (cuando ya pasó la mitad de su vida, la API manda uno nuevo en la cabecera `X-Renewed-Token`). El token lleva la **versión de sesión** de la cuenta (`users.tokenVersion`): cambiar la contraseña o usar «Cerrar sesión en todos los dispositivos» la sube y deja de valer cualquier otro token. Si la API rechaza la sesión (401), el sitio la cierra y manda a `/acceso` con un aviso. El rol se consulta en la BD en cada petición.
- **Freno de intentos**: 5 intentos fallidos **por correo** en 15 minutos bloquean esa cuenta (429 con `Retry-After`, incluso con la contraseña correcta). **No se limita por IP**: la comunidad estudiantil comparte red (misma IP) y un límite por IP bloquearía a todos por culpa de uno. El conteo vive en MongoDB (sobrevive a reinicios), con la llave en hash.
- **Perfil** (`/perfil`): datos del usuario, «Mi información» (nombre, cargo, licenciatura, semestre, grupo y foto), cambio de contraseña (pide la actual; cierra las demás sesiones y deja esta con un token nuevo) y un botón **«Cerrar sesión»** abajo a la derecha del primer recuadro (con confirmación; cierra solo este dispositivo). La pantalla «Mis sesiones» con el botón de cerrar en todos los dispositivos se quitó el 2026-11-07; `POST /api/auth/logout-all` sigue existiendo en la API.
- El header muestra, con sesión iniciada, un menú con **Ver perfil** y **Cerrar sesión** (con confirmación). Los campos de contraseña tienen botón de “ojo” para mostrarla.

### Roles y permisos

Solo hay **dos roles**, que elige un **Moderador** al dar de alta o editar al integrante (Panel → Equipo). La API lo lee de la base en cada petición, así que un cambio surte efecto de inmediato; el panel muestra a cada rol solo sus secciones (Miembro: Mensajes, Noticias, Propuestas y Equipo; Moderador: además Ajustes) y las rutas de la API responden 403 a lo que no le toca. La tabla vive en `backend/src/auth.js` y se prueba en `backend/test/permisos.test.js`.

| Acción | Miembro | Moderador (`admin`) |
|---|---|---|
| Leer mensajes (con datos de contacto), imágenes adjuntas y contadores | sí | sí |
| Cambiar estado y revisión, **responder** (queda su nombre y cargo) y dejar notas | sí | sí |
| Exportar mensajes a CSV | sí | sí |
| Ver la papelera, restaurar y eliminar mensajes | no | sí |
| Ver noticias y propuestas (con borradores) | sí | sí |
| **Publicar** noticias y propuestas nuevas y **cambiar su estado** (publicada/borrador/programada; avance, nota y visibilidad) | sí | sí |
| Editar el contenido de noticias y propuestas ya creadas | sí | sí |
| Eliminar noticias y propuestas | no | sí |
| Ver correos, nombres y roles del equipo (**nunca contraseñas**) | sí | sí |
| Editar su propia información (nombre, cargo, licenciatura, semestre, grupo, foto) y su contraseña | sí | sí |
| Ver la **última conexión** de cada integrante (Panel → Equipo; `lastSeenAt` en `GET /api/members/all`) | no | sí |
| Editar a otros, dar de alta, eliminar, cambiar roles y orden del equipo | no | sí |
| Ajustes del sitio y bitácora (`GET /api/audit`) | no | sí |

- **El Moderador puede todo**, sin restricciones. Su valor guardado es `admin` (así las cuentas de siempre conservan todo sin migrar nada); «Moderador» es el nombre que se ve.
- **El rol por defecto de un integrante nuevo es Miembro.** El primer Moderador se crea con `npm run create-admin`. Siempre debe quedar al menos un Moderador y nadie se quita su propio rol.
- **Roles anteriores:** `presidente` y el `moderador` limitado de las versiones 0.10 a 0.15 ya no existen. El servidor los trata como Miembro de inmediato y la migración `003-roles` (`npm run migrate`, idempotente) los convierte; no toca a los `admin`.
- Un Miembro cambia su información en **Mi perfil → Mi información** (`PUT /api/members/me`: solo nombre, cargo, licenciatura, semestre, grupo y foto; el correo, el rol y el orden no se pueden cambiar por esa vía) y su contraseña en la misma página.
- Al responder un mensaje se guarda quién lo hizo (`publicReplyBy`: nombre y cargo, nunca el correo) y se muestra en el panel y a quien consulta su código en `/seguimiento`.

## 6. API

Resumen (detalle de validaciones en `backend/src/routes/`):

- Auth: `POST /api/auth/login`, `GET /api/auth/me`, `PATCH /api/auth/password` y `POST /api/auth/logout-all` (ambos devuelven un `token` nuevo para el dispositivo actual).
- Seguimiento: `POST /api/messages/track` (público; `{code}` → `{ type, subject, status, review, createdAt, updatedAt, publicReply, publicReplyAt }`; nunca el texto del mensaje ni datos personales; la misma respuesta 404 para cualquier código que no exista, esté mal escrito o sea de un mensaje eliminado; **sin límite de intentos**: la comunidad comparte IP y el código tiene 50 bits de aleatoriedad).
- Buzón: `POST /api/messages` (público; multipart con los campos y hasta 3 archivos `images`, o JSON sin imágenes); admin: `GET /api/messages?status=&type=&review=&urgency=&q=&page=&limit=` (filtros opcionales y combinables; `q` busca en asunto y texto como texto literal, nunca como patrón; con `page` responde `{ items, total, page, pages }` de 20 en 20, máx. 100, y sin `page` el arreglo de siempre, hasta 500), `GET /stats` (`{ nuevos, pendientes, total, porTipo }`, para la insignia y el resumen del panel), `GET /export` (CSV UTF-8 con BOM, mismos filtros, para Miembro y Moderador, con las fórmulas de hoja de cálculo neutralizadas y registrado en la bitácora), `GET ?trash=1` (papelera), `PATCH /:id` (`{status?, review?, publicReply?}`, al menos uno; `publicReply` vacío la quita), `POST /:id/notes` (`{text}`: nota interna del equipo), `DELETE /:id` (a la papelera), `POST /:id/restore` y `DELETE /:id/permanent` (solo desde la papelera). El buzón descarta en silencio (respondiendo 201) los envíos con el campo trampa `website` lleno o enviados en menos de 3 s (`fillMs`), rechaza con 413 las imágenes que juntas pasen de 12 MB. Un mensaje **con datos personales** exige `consent: true` (aceptar el aviso de privacidad; se guarda `consentAt`) y responde 400 si falta. `GET /api/messages` y `PATCH` también los usan los **moderadores**, a quienes la API les quita `name`, `degree`, `semester`, `group` y `phone` (y marca `hasContact`); la papelera y el borrado son solo de administradores.
- Bitácora: `GET /api/audit?page=` (admin; 50 por página, la más reciente primero).
- Integrantes: `GET /api/members` (público, sin correo); `GET /api/members/all`, `POST`, `PUT /:id`, `DELETE /:id` y `PUT /order` (`{ ids }` en el orden nuevo; asigna 0, 1, 2… de una vez) (admin).
- Archivos: `POST /api/files` (admin, JPG/PNG/WEBP/GIF ≤ 5 MB, sin SVG; se re-codifica y genera versiones reducidas), `GET /api/files/:id[?w=640|1280]` (público para noticias, propuestas y equipo; **admin con sesión** para los adjuntos del buzón, con `Cache-Control: private, no-store`; `?w=` sirve la versión WebP reducida si existe, si no la original), `DELETE /api/files/:id` (admin; borra también sus versiones reducidas).
- Contenido: `/api/news`, `/api/proposals` (lectura pública; escritura admin; `/news/all` y `/proposals/all` incluyen no publicados; la lista pública de noticias solo trae las publicadas **cuya hora de publicación ya llegó**), `GET /api/settings`, `PUT /api/settings/:key` (admin; claves `degrees`, `groups`, `semesters`, `groupDegrees`, `social`).
- `GET /api/health` para el health check de Render.

## 7. Despliegue

1. **Atlas**: usuario de BD y *Network Access* abierto a Render.
2. **Render** → New → Blueprint con `render.yaml`. Define `MONGODB_URI` y `CORS_ORIGIN`. Plan gratuito: se duerme por inactividad (primera carga lenta).
3. **Vercel** → importar repo, *Root Directory* `frontend`, variable `VITE_API_URL`.
4. Ejecuta `npm run seed` y `npm run create-admin` una vez contra la base de producción (desde tu equipo, con el `MONGODB_URI` de Atlas). Luego inicia sesión en `/acceso` y da de alta al resto del equipo en Panel → Equipo.

### Contenido: noticias, propuestas y equipo

- **Noticias con formato:** el cuerpo se guarda como **Markdown** y se muestra con `react-markdown` **sin HTML crudo** (`skipHtml`), solo con negritas, cursiva, enlaces `https`/`mailto`, listas, subtítulos y citas; los enlaces peligrosos (`javascript:`) se descartan. Las noticias anteriores (párrafos separados por una línea en blanco) ya son Markdown válido, no hubo migración, y los saltos de línea simples se respetan. En el panel, `MarkdownEditor` ofrece una barra (negritas, cursiva, enlace, lista) y vista previa en vivo.
- **Galería:** hasta 6 imágenes más por noticia (campo `gallery`), con sus miniaturas; al quitar una o eliminar la noticia se borran del almacén. La portada lleva el título como texto alternativo.
- **Publicación programada:** el panel permite elegir fecha y hora de publicación; una fecha futura deja la noticia «Programada» y **aparece sola al llegar la hora** (las consultas públicas filtran `publishedAt <= ahora`; no hay ningún proceso programado). Despublicar y volver a publicar ya no reescribe la fecha original.
- **Avance de las propuestas:** cada propuesta tiene un avance público (`planeada` por defecto, `en_marcha`, `cumplida`) y una nota de hasta 200 caracteres; se muestra como insignia con texto (no solo color) y `/propuestas` permite filtrar por avance. Las propuestas anteriores quedan como «Planeada» sin migrar.
- **Orden del equipo:** en Panel → Equipo, «Ordenar el equipo» permite arrastrar a cada persona (ratón, dedo o teclado, con `@dnd-kit`) o usar los botones subir/bajar; cada cambio envía el orden completo a `PUT /api/members/order`. El campo numérico «Orden» desapareció del formulario.

### Vista previa al compartir y SEO

El sitio es una app de una sola página y los rastreadores de WhatsApp, Facebook, X, Telegram, LinkedIn, etc. **no ejecutan JavaScript**, así que sin ayuda todos los enlaces mostrarían la misma tarjeta en blanco. Por eso:

- `frontend/vercel.json` manda a esos rastreadores (por su User-Agent; **no** a Googlebot/Bingbot, que sí ejecutan JavaScript y deben ver la app) a la función `frontend/api/og.js`, que responde un HTML mínimo con las etiquetas Open Graph/Twitter de la página: título, descripción, canónica e imagen. Para una noticia usa su título, resumen (o el inicio del texto) y su portada, que la API entrega en JPEG de 1200 × 630 con `GET /api/files/:id?og=1`; para el resto, el título y la descripción de la página y la imagen `frontend/public/og-default.png` (se regenera con `node scripts/make-og-image.mjs`). Las personas siempre reciben la app normal.
- `usePageMeta` (`src/pageMeta.js`) pone título, descripción, canónica y etiquetas en cada página para el navegador y para Google; `index.html` lleva valores por defecto.
- `/sitemap.xml` (`api/sitemap.js`, rutas públicas + noticias publicadas con su fecha) y `/robots.txt` (`api/robots.js`; bloquea `/admin`, `/acceso` y `/perfil` y apunta al sitemap) son dinámicos para usar el dominio actual.
- Las funciones leen la URL de la API de `API_URL` o `VITE_API_URL` (variable de Vercel) y, si la API no responde, caen a los valores por defecto. **Después de desplegar, comprueba una noticia real** con el depurador de enlaces de Facebook (developers.facebook.com/tools/debug) y compartiendo un enlace por WhatsApp; la lógica está probada (`backend/test/seo.test.js`), pero el reenvío por User-Agent solo se puede verificar ya publicado.

### Accesibilidad

- **Revisión automática:** `frontend/e2e/a11y.spec.js` pasa axe (reglas WCAG 2.1 A y AA) por cada página pública, cada sección del panel, el buzón con datos, el editor de noticias y el diálogo de confirmación; corre en el CI, así que una violación nueva rompe la compilación.
- **Teclado y lectores de pantalla:** enlace «Saltar al contenido» como primer elemento enfocable; al cambiar de página el foco pasa al contenido (`<main id="contenido">`); el contorno de foco es rojo sobre papel y **papel sobre fondos oscuros** (encabezado, pie, secciones oscuras); los avisos de éxito y error usan `role="status"`/`role="alert"`; los campos de archivo del panel llevan nombre accesible; la portada del artículo usa el título como `alt` y las fotos del equipo el nombre (las imágenes decorativas llevan `alt=""`).
- **Contraste medido** (mínimo 4.5:1 para texto normal, 3:1 para texto grande y componentes): tinta sobre papel 14.2 · negro sobre papel 15.4 · papel sobre negro 15.4 · gris `--muted` sobre papel 4.9 y sobre blanco 6.0 · blanco sobre rojo 5.4 · rojo oscuro sobre papel 6.3 · pie `#b9afa3` sobre negro 8.7. **El rojo de la marca sobre papel da 4.42:1** (no llega a 4.5), por eso los textos y enlaces rojos sobre papel usan el rojo oscuro (`--red-dark`); el rojo solo se deja en texto grande, números y fondos de botones con texto blanco. El gris `--muted` sobre `--paper-2` da 4.4: no usarlo en esa combinación.
- **Falta una prueba humana** (ninguna herramienta la sustituye): recorrer el envío de un mensaje con un lector de pantalla (NVDA en Windows, gratuito) y comprobar el orden de lectura y que se anuncian los errores.

### Monitoreo

- **Disponibilidad (tú):** crea una cuenta gratuita en UptimeRobot y un monitor HTTP(s) a `https://<tu-api>.onrender.com/api/health` cada 5 minutos, con aviso por correo. Además de avisar si cae, mantiene despierto el servicio gratuito de Render (ojo: con dos servicios encendidos todo el mes se exceden las 750 horas gratuitas; ver «Entorno de pruebas»).
- **Errores (Sentry, opcional):** crea un proyecto de Node y otro de React en Sentry (capa gratuita) y define `SENTRY_DSN` en Render y `VITE_SENTRY_DSN` en Vercel. **Con privacidad:** el sitio guarda mensajes y datos personales, así que un filtro (`backend/src/monitoring.js`, `frontend/src/sanitize.js`) borra de cada evento la petición (URL con consulta, cabeceras, cuerpo), el usuario y su IP, extras, rastros de clics, nombre del equipo y variables locales, y quita de los mensajes de error los textos entre comillas, objetos, correos y números largos. Solo viaja el tipo de error, su pila y un id de petición. Sin las variables no se envía nada y el código de Sentry del navegador ni se descarga. La política CSP ya permite `*.ingest.sentry.io`.
- **Registros con id de petición:** cada respuesta lleva `X-Request-Id`; un error interno responde 500 con ese `requestId` (el sitio muestra sus primeros 8 caracteres: «id del error: …») y deja **una línea JSON** en los registros de Render con el id, método, ruta sin consulta, tipo de error, mensaje sin valores y las primeras líneas de la pila, nunca cuerpos ni cabeceras. Con el id que te dé una persona buscas esa línea en Render → Logs.
- Si falla el dibujo de una página, `ErrorBoundary` muestra «Algo salió mal» con un botón para recargar, en lugar de una pantalla en blanco.

### Imágenes

- **Al subirlas** (`backend/src/uploads.js`, con `sharp`): se decodifican por completo y se guardan **re-codificadas** en su formato real: se quitan los metadatos (EXIF: ubicación GPS, modelo de cámara, fecha), se aplica la orientación, se reducen a 4000 px por lado como máximo y se rechaza todo lo que no sea una imagen válida (firma falsa, archivo dañado, más de 100 megapíxeles). El GIF y el WebP animados se conservan.
- **Privadas:** los adjuntos del buzón se guardan con `metadata.private = true`; `GET /api/files/:id` exige sesión de administrador para ellos (`Cache-Control: private, no-store`). Como un `<img src>` no puede enviar el token, el panel las descarga con `fetch` y las muestra desde un `Blob` (`components/AuthImage.jsx`); el clic abre la original en otra pestaña. Las imágenes de noticias, propuestas y equipo siguen siendo públicas.
- **Versiones reducidas:** junto a cada imagen no animada se guardan versiones WebP de 640 y 1280 px (solo las menores que el original), enlazadas en `metadata.variants`. `GET /api/files/:id?w=640` (o `1280`) la sirve; sin parámetro o sin versión, la original. Las tarjetas de noticias y propuestas usan `srcset`/`sizes`; el equipo, el perfil y el panel piden la de 640. Al borrar una imagen se borran sus versiones.
- **Migraciones** (`npm run migrate`, idempotente; **corre contra la base de `backend/.env`**, así que revísalo antes): `001-private-message-images` marca como privadas las imágenes que ya estaban en mensajes (incluida la papelera) y `002-thumbnails` genera las versiones reducidas de lo subido antes. Se corren **después de desplegar el backend**. Hasta entonces las imágenes antiguas siguen como antes (públicas y sin versiones), así que nada se rompe.
- Medición local (12 megapíxeles con ruido, el peor caso): limpiar y generar 2 versiones de 3 fotos tarda ≈ 1.2 s y el proceso llega a ≈ 200 MB; conviene confirmarlo en el servidor de staging. El panel de administración se carga por separado (`React.lazy`), así que los visitantes no descargan su código.

### Privacidad y retención

- **Aviso de privacidad** en `/privacidad` (enlazado en el pie de página y desde la casilla del buzón). **Es un borrador razonable, no asesoría jurídica: debe revisarlo la ENSFA o alguien con conocimiento legal antes de darlo por definitivo** (`frontend/src/pages/Privacy.jsx`). Si cambia lo que se guarda o por cuánto tiempo, hay que actualizar ese texto.
- **Consentimiento:** al elegir «Con mis datos» el buzón pide marcar que se leyó el aviso; la API lo exige y guarda la fecha (`consentAt`). Los anónimos no guardan datos personales, así que no aplica. En el panel, los mensajes con datos muestran un recordatorio de no copiarlos fuera.
- **Retención:** los mensajes de la papelera se borran a los 30 días y los resueltos (archivados, completados o rechazados) al pasar `RETENTION_MONTHS` meses desde su última actualización (desactivado hasta que el cliente decida el plazo; se recomienda 12). Lo hace la propia API al arrancar y cada 6 horas (`maintenance.js`) y, de forma programada, el flujo `.github/workflows/purge.yml` (diario, necesita el secreto `MONGODB_URI` y la variable `RETENTION_MONTHS` en el repositorio; sin el secreto no hace nada). Manual: `npm run purge -- --dry-run` cuenta sin borrar y `npm run purge` borra. Cada borrado por retención queda en la bitácora sin contenido.

### Respaldos

`.github/workflows/backup.yml` hace cada domingo (y a demanda desde Actions → Run workflow) un `mongodump --gzip` de **toda** la base, lo **cifra con `age`** (los datos incluyen información personal) y lo sube a un almacenamiento compatible con S3 (Backblaze B2 o Cloudflare R2, ambos con capa gratuita), conservando las últimas 8 copias. Sin los secretos configurados no hace nada.

1. Instala `age` (`winget install FiloSottile.age` o `apt install age`) y genera la llave: `age-keygen -o llave-respaldos.txt`. **Guarda ese archivo en tu gestor de contraseñas y fuera del repositorio**; sin él las copias no se pueden abrir. La línea «public key: age1…» sí va como secreto.
2. Crea un bucket **privado** en B2 o R2 y una llave de aplicación con acceso solo a ese bucket.
3. En GitHub → Settings → Secrets and variables → Actions, crea los secretos `MONGODB_URI`, `AGE_PUBLIC_KEY`, `BACKUP_BUCKET`, `BACKUP_ENDPOINT` (la URL S3 del proveedor, p. ej. `https://s3.us-west-004.backblazeb2.com`), `BACKUP_KEY_ID` y `BACKUP_KEY_SECRET`. Corre el flujo a mano una vez y confirma que aparece la copia en el bucket.
4. **Prueba de restauración (hazla al menos una vez; un respaldo que nunca se probó no es un respaldo):** descarga una copia y restáurala en una base de prueba, nunca sobre la real:
   ```
   age -d -i llave-respaldos.txt gi-AAAAMMDD-HHMMSS.archive.gz.age > copia.archive.gz
   mongorestore --uri="<URI de un clúster de PRUEBA>" --gzip --archive=copia.archive.gz --nsFrom="generacion_impacto.*" --nsTo="gi_restore_test.*"
   ```
   Revisa en Atlas que `gi_restore_test` tenga mensajes, noticias y `files.files`, y bórrala al terminar. Alternativa sin código: un plan de Atlas de pago con respaldo continuo.

### Cabeceras de seguridad y CSP

`frontend/vercel.json` agrega `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` y una **Content-Security-Policy en modo «solo reporte»** (`Content-Security-Policy-Report-Only`): el navegador avisa en la consola de lo que bloquearía, pero todavía no bloquea nada. La política permite lo propio (`'self'`), imágenes y conexiones a `https://*.onrender.com` (la API), estilos en línea (React los usa). Las tipografías son **propias** (paquetes `@fontsource/*`, subconjunto latino), así que ya no se permite ningún host de fuentes externo.

Para activarla: navega unos días por el sitio publicado (incluido el panel) con la consola abierta; si no aparecen avisos de «Content Security Policy», cambia en `vercel.json` la clave a `Content-Security-Policy`. Si algún día la API deja de estar en `onrender.com` (dominio propio), actualiza `img-src` y `connect-src`. Se comprobó en local con la política **activa** sobre el build: 12 páginas (públicas y del panel) sin una sola violación.

### Entorno de pruebas (staging)

Copia del sitio con su propia API y base de datos, para probar cambios reales (subidas de imágenes, migraciones) sin arriesgar producción.

1. **Atlas:** crea un usuario `readWrite` **solo** sobre la base `gi_staging` (distinto al de producción).
2. **Render:** el Blueprint ya define `generacion-impacto-api-staging`. Al sincronizarlo te pide `MONGODB_URI` (la base `gi_staging`) y, si quieres, `CORS_ORIGIN`; `CORS_ORIGIN_PATTERN` viene preconfigurado (ajústalo al nombre real del proyecto de Vercel) y `JWT_SECRET` se genera distinto al de producción.
3. **Vercel:** define `VITE_API_URL` **solo en el entorno Preview** con la URL del staging; la variable de Production no cambia.
4. Ejecuta `npm run seed` y `npm run create-admin` con el `MONGODB_URI` de `gi_staging`.
5. Render gratuito da 750 horas al mes en total: deja dormir el staging (no lo incluyas en un ping de monitoreo).

### Rotar la contraseña de Atlas

1. En Atlas → *Database Access*: crea un usuario nuevo con rol `readWrite` solo sobre `generacion_impacto`, con contraseña larga y aleatoria; elimina el anterior.
2. Actualiza `MONGODB_URI` en `backend/.env` y en las variables de Render (y reinicia el servicio).
3. Comprueba `/api/health` y entra al panel. Revisa también *Network Access* y cierra lo que no se use.

## 8. Revisión de calidad (2026-10-26)

Ejecutado: ESLint (variables sin uso, reglas de React y hooks), búsqueda de CSS y exports sin uso, `npm audit`, 59 pruebas de API y 43 comprobaciones en navegador contra una base de pruebas aparte (eliminada después). Resultado y limitaciones conocidas:

- Sin errores, sin código muerto detectado y `npm audit` en 0 vulnerabilidades (se actualizaron `zod` 3→4 y `react-router-dom` 6→7).
- El rol `user` de `User.role` ya no se asigna a nadie (las cuentas son de integrantes: `admin` —el Moderador— o `miembro`). Se conserva el valor y la comprobación de rol como defensa si se edita la BD a mano: una cuenta `user` no ve mensajes ni imágenes privadas.
- **Imágenes huérfanas**: si en el panel subes una imagen y cancelas sin guardar, el archivo queda en GridFS. Se limpian solo al reemplazar o eliminar el registro que las usa.
- **Login con freno de fuerza bruta** (2026-10-29; reemplazado el 2026-11-06, ver sección 5): 5 intentos fallidos por correo en 15 minutos, guardados en MongoDB. Un correo inexistente tarda lo mismo que uno existente (hash de relleno), para no delatar qué cuentas existen.
- **Buzón sin captcha** (decisión del cliente): `POST /api/messages` es público. Desde el 2026-11-06 lleva protecciones invisibles (campo trampa, tiempo mínimo de llenado, tope de 12 MB por envío); **no hay ningún límite de envíos** (ni por IP ni global): la comunidad comparte red y el cliente no quiere topes.
- **Imágenes de los mensajes**: privadas desde la Fase 2 (ver «Imágenes» en la sección 4). Las que se subieron antes quedan públicas hasta correr `npm run migrate`.
- **Sesiones**: el token (JWT, 12 horas con renovación) se guarda en `localStorage`; se invalida al cambiar la contraseña, al cerrar sesión en todos los dispositivos y al eliminar al integrante. Seguir en `localStorage` significa que un script malicioso en el sitio podría leerlo; la CSP (abajo) reduce ese riesgo. Pasar a una cookie `httpOnly` queda como mejora opcional (requiere dominio propio o un proxy).
- Las páginas comparten un único `<title>` (“Generación de Impacto”).

Segunda revisión (2026-10-29): ESLint sin avisos, `npm audit` en 0 vulnerabilidades, `vite build` correcto, búsqueda de CSS, exports y archivos públicos sin uso (sin código muerto), y 55 pruebas de API contra una base aparte (`gi_test`, eliminada al terminar) que cubren permisos, ids inválidos, redes/correo, imágenes (firma falsa, SVG, tamaño, cantidad), anonimato, grupo condicionado, equipo, CORS y el freno del login.

Tercera revisión (2026-11-04), tras dividir el CSS: ESLint sin avisos, `vite build` correcto, 55 pruebas de API (base aparte, eliminada), búsqueda de CSS/exports/archivos sin uso y 62 capturas idénticas a la versión anterior. Único hallazgo: el sobre del buzón ignoraba “reducir movimiento” (corregido).

## 9. Pendientes y decisiones abiertas

- Propuesta **#7**: aún no definida; agregarla desde Panel → Propuestas.
- **Licenciaturas** por defecto son una suposición: confirmarlas con la ENSFA y editarlas en Panel → Ajustes.
- Integrantes del equipo, Instagram y correo de contacto: capturar desde el panel. (Facebook y TikTok se quitaron de Ajustes el 2026-11-07.)
- **Aviso por correo de mensajes nuevos: aplazado por decisión del cliente** (no hay código ni variables). Si se retoma: Render gratis bloquea SMTP (puertos 25/465/587), así que hay que usar una API HTTPS (p. ej. Brevo, verificando el remitente) o SMTP en hosting de pago; `ensfa.edu.mx` usa Google Workspace (SMTP con contraseña de aplicación entrega mejor). Guardar el mensaje antes de enviar el correo y que un fallo del correo nunca afecte al usuario; el correo no debe incluir datos personales de mensajes anónimos.
- **Rotar la contraseña de Atlas (S1):** la cadena de conexión se compartió en el chat durante el desarrollo. Decisión del cliente (2026-11-06): se deja igual por ahora y se hace al terminar el plan de trabajo, que ya terminó (ver «Rotar la contraseña de Atlas»). Conviene además un usuario de base de datos con permisos solo sobre la base del sitio.
- **Staging (Q2):** crear la base `gi_staging` en Atlas, el servicio de staging en Render desde `render.yaml` y la variable `VITE_API_URL` del entorno Preview en Vercel (ver «Entorno de pruebas (staging)»). Pospuesto por el cliente igual que S1.
- ~~**Migraciones de datos** (`npm run migrate`)~~ **Hecho el 2026-11-09** contra la base real: 001 sin imágenes de mensajes que marcar (aún no había), 002 revisó 2 imágenes y creó 3 versiones reducidas, 003 sin cuentas con roles antiguos. Es idempotente: se puede volver a correr tras futuras migraciones sin riesgo; si algún día se agrega una migración nueva, se corre igual.
- **Texto legal y retención:** el aviso de privacidad (`/privacidad`) es un borrador; lo debe revisar la ENSFA o alguien con conocimiento legal. Definir también `RETENTION_MONTHS` (se recomienda 12) como variable de Render y del repositorio.
- **Respaldos y limpieza programada:** crear el bucket privado (Backblaze B2 o Cloudflare R2) y los secretos de `backup.yml` y `purge.yml`, generar la llave `age` y **probar una restauración** (ver «Respaldos»).
- **Verificar ya publicado:** (1) la vista previa de un enlace de noticia en el depurador de Facebook y por WhatsApp, `/sitemap.xml` y `/robots.txt`; (2) el CI de GitHub tras cada subida; (3) activar la CSP (cambiar `Content-Security-Policy-Report-Only` por `Content-Security-Policy` en `frontend/vercel.json`) tras una semana sin avisos en la consola del sitio publicado.
- **Monitoreo:** crear el monitor de UptimeRobot y, si se quiere, las cuentas de Sentry (ver «Monitoreo»). Prueba con NVDA del envío de un mensaje (ver «Accesibilidad»).
- **Dependabot:** los PR de actualización mayor (React 19, ESLint 10, Vite 8, Mongoose 9, etc.) no se fusionan sin migrar y probar; los que fallen en el CI se pueden cerrar o dejar abiertos.

## 10. Registro de cambios

### 2026-11-09 — Tarjetas de integrantes del panel con más estilo (0.22.1)
- Las tarjetas de **Panel → Equipo** ya no son un párrafo corrido («Presidente · correo · Miembro · Última conexión…»): cada dato va en **su propia fila**, con una **etiqueta chica** y un **ícono de color** distinto. Arriba, el **nombre** en Anton y el **rol de acceso** como insignia (Moderador en rojo, Miembro en negro). Debajo: **Cargo** (ícono rojo y texto rojo en negritas; «Sin cargo» en cursiva si no hay), **Correo** (ícono negro y letra de máquina), **Estudios** (ícono de papel con borde; licenciatura y, si los hay, **Semestre** y **Grupo** como etiquetas con borde; la fila no aparece si no hay ninguno) y, solo para el Moderador, **Última conexión** con un **punto de color** —verde si fue en las últimas 24 horas, ámbar si fue esta semana, gris si fue antes o si no hay registro— y una nota debajo («en las últimas 24 horas», «esta semana», «hace más de una semana»). El texto dice lo mismo que el color, que solo lo refuerza.
- Código: componente nuevo `pages/admin/MemberSummary.jsx` (+ `.css`) y cuatro íconos nuevos en `ActionIcons.jsx` (cargo, correo, estudios y reloj). Prueba de navegador nueva (filas y etiquetas, colores, nota de conexión, filas ausentes). Total: 155 de API y 89 de navegador.

### 2026-11-09 — Última conexión de cada integrante, para el Moderador (0.22.0)
- En **Panel → Equipo** cada integrante muestra ahora **«Última conexión: 9 de noviembre de 2026 · 3:20 p. m.»**, y **solo el Moderador la ve**. Las cuentas que todavía no han entrado desde que existe este dato dicen «sin registro todavía» (se llenan solas la próxima vez que cada persona inicie sesión o use el panel; no hace falta migración).
- **Cómo se registra:** nuevo campo `lastSeenAt` en la cuenta (`User`). Se anota al **iniciar sesión** y cada vez que la cuenta **usa el sitio con sesión** (cualquier petición autenticada, incluida la renovación de la sesión), pero con **una sola escritura cada 5 minutos por cuenta**, para no escribir en la base en cada petición. Es solo la fecha y la hora: **no se guarda ninguna IP, dispositivo ni página visitada**.
- **Quién lo recibe:** `GET /api/members/all` incluye `lastSeenAt` (fecha o `null` si nunca) **solo si quien pregunta es Moderador**; el Miembro sigue viendo el directorio (correos, nombres, roles) sin ese dato, y tampoco aparece en la lista pública del equipo ni en la sesión (`/auth/me`). Las respuestas de alta y edición del Moderador también lo traen.
- Pruebas nuevas: 1 de API (se anota al iniciar sesión y al usar el panel, no se reescribe antes de 5 minutos, el Miembro no lo recibe y no sale en la lista pública ni en la sesión) y 2 de navegador (el Moderador ve la fecha, incluido «sin registro todavía»; el Miembro no ve nada). Total: 155 de API y 88 de navegador.

### 2026-11-09 — Decoración animada en el buzón (0.21.0)
- La página `/buzon` ahora lleva decoración en los **costados** (el formulario es una columna de 760 px y en pantallas anchas quedaban márgenes vacíos), con el mismo estilo que la del equipo y con animaciones leves. Es solo CSS y `aria-hidden` (no se lee con lector de pantalla ni recibe clics), con posiciones fijas. Mezcla los adornos del equipo (**estrellas** que titilan, **cruces** que giran, **líneas de marcador** que se dibujan y **retazos de puntos**) con piezas del tema del buzón: **aviones de papel** con su estela que planean, **burbujas** de «¿?» (roja) y «!» (negra) y un **sobre** que flotan, **rótulos a mano** («Tu opinión cuenta», «¡Escríbenos!») y **papelitos** rojos y crema que suben despacio.
- **Cómo evita tocar el formulario:** la página es un contenedor y los adornos aparecen según **su** ancho (consultas de contenedor): ≥ 1000 px adornos pequeños pegados a los bordes y papelitos; ≥ 1200 px además las piezas grandes. En pantallas angostas y en teléfono no hay decoración, y la **pantalla de agradecimiento** (de una sola columna y sin pie) tampoco la lleva. Con «reducir movimiento» las piezas quedan quietas y los papelitos no se muestran.
- **Código:** las formas pequeñas que comparten Equipo y Buzón se separaron en `components/DecorItem.jsx` y `DecorShapes.css` (antes vivían dentro de `TeamDecor`); `TeamDecor` conserva solo lo del organigrama y `MailboxDecor.jsx/.css` lo del buzón. Pruebas de navegador nuevas (nunca toca el formulario en 1000, 1100, 1200, 1440 y 1920 px y dentro de la pantalla —que detectó un retazo que sobresalía 2 px y rótulos que rozaban el formulario a 1200 px, ya corregidos—, piezas grandes solo desde 1200, sin decoración en angosto, teléfono y agradecimiento, y el movimiento solo si el sistema lo permite). Total: 154 de API y 86 de navegador.

### 2026-11-09 — «Con mis datos» primero y por defecto en el buzón (0.20.3)
- En «¿Cómo quieres enviarlo?» el orden ahora es **Con mis datos** y **De forma anónima**, y **Con mis datos** viene elegida desde el principio (antes era la anónima), por decisión del cliente. Con ella se muestran de entrada los campos personales (nombre, teléfono, licenciatura, semestre y grupo si aplica) y el consentimiento del aviso de privacidad. **Si la persona cambia a «De forma anónima», lo que haya escrito en esos campos no se envía**: la página solo adjunta los datos personales cuando el mensaje no es anónimo, y la API los descarta de todos modos (prueba de navegador nueva que lo comprueba). La API y los datos no cambian. Las pruebas de navegador que envían un mensaje anónimo ahora eligen esa opción primero.
- **Nombre y teléfono en una sola fila:** en el formulario con datos, «Nombre completo» y «Teléfono» van uno al lado del otro en proporción **60 / 40** (el nombre, más ancho) y ocupan el mismo ancho que el campo de Licenciatura de abajo; en teléfono (≤ 480 px) se apilan, porque a ese ancho el teléfono no cabría. Prueba de navegador nueva (misma fila, proporción 60/40, alineación y apilado en teléfono). Total: 154 de API y 84 de navegador.

### 2026-11-09 — «Pregunta» primero y por defecto en el buzón (0.20.2)
- Los chips de tipo del buzón ahora van en el orden **Pregunta, Queja, Propuesta, Problema**, y **Pregunta** viene elegida desde el principio (antes era Propuesta) hasta que la persona escoja otra. Solo cambia el valor inicial y el orden en pantalla: la API y los datos no cambian. Prueba de navegador nueva (orden, valor por defecto, que viaja `pregunta` si no se toca y que se respeta otra elección). Total: 154 de API y 82 de navegador.

### 2026-11-09 — Decoración animada en la página del equipo y subir al pulsar la página actual (0.20.1)
- **Decoración de `/equipo`** (componente `TeamDecor`, solo CSS, `aria-hidden` y sin clics) para minimizar los espacios en blanco que dejaron las tarjetas horizontales. Lo que se agregó: **estrellas** de cuatro puntas rojas y negras que titilan, **cruces** que giran muy despacio, **líneas onduladas de marcador** que se dibujan y se borran, **retazos de puntos**, **papelitos** rojos y crema que suben despacio por los costados de todo el organigrama, **dos arcos tenues** que giran (eco del círculo del logo), el **lema** a mano junto al título y, con mucho espacio, **rótulos a mano** («Presidencia», «Vicepresidencia y tesorería») con subrayado de marcador y **retazos de papel** con cinta roja que se mecen. Se vuelve a agregar tras la prueba anterior (retirada en 0.19.1) porque ahora está pensada para las tarjetas pequeñas.
- **Cómo evita encimarse:** el organigrama es un contenedor y los adornos aparecen según **su propio ancho** (consultas de contenedor), no el de la pantalla: ≥ 900 px adornos pequeños pegados a los bordes (el último nivel desde 1040 px), ≥ 1100 px además los rótulos y retazos grandes (más chicos en el nivel 2, que tiene menos espacio). En tablet angosta y en teléfono no hay decoración, porque ahí las tarjetas ocupan el ancho. Con «reducir movimiento» los adornos quedan quietos y los papelitos no se muestran.
- **Cada página empieza arriba, ahora también al pulsar el enlace de la página en la que ya estás** (por ejemplo el logo o «Inicio» estando abajo): antes la ruta no cambiaba y no subía; ahora se reacciona a la `key` de cada navegación. Los enlaces con ancla (`#`) siguen siendo del navegador.
- Pruebas nuevas: la decoración nunca tapa una tarjeta (en 1440, 1180, 1100, 1000 y 940 px), es decorativa, se oculta en pantallas angostas y se mueve solo si el sistema lo permite; y el scroll al pulsar la página actual. Total: 154 de API y 81 de navegador.

### 2026-11-09 — Semestre y grupo en la información de cada integrante (0.20.0)
- La ficha de cada integrante ahora guarda **semestre** y **grupo** (campos `semester` y `group` del modelo `Member`, vacíos por defecto, máx. 20 caracteres; los integrantes que ya existían quedan sin ellos y no hace falta migración). Se eligen en **menús desplegables con las opciones de Panel → Ajustes** (las mismas del buzón), junto a la licenciatura, tanto en **Mi perfil → Mi información** como en el formulario de **Panel → Equipo** del Moderador. El **grupo solo se puede elegir si la licenciatura tiene varios grupos** (`groupDegrees`, hoy Telesecundaria): en las demás el menú queda deshabilitado en «No aplica», al cambiar de licenciatura se borra el grupo elegido y la **API descarta el grupo** si la licenciatura no lo usa (igual que en el buzón). Ambos son opcionales. Si un valor ya no está en Ajustes se conserva como opción «(ya no está en Ajustes)» para no perderlo al guardar.
- Se muestran como **«Semestre 3 · Grupo A»** bajo la licenciatura en la tarjeta de `/equipo` (página pública) y en Mi perfil; quien no lo capture no verá esa línea. Como son datos de una persona, si prefieres que no sean públicos basta con quitar esa línea de `Team.jsx`.
- Código: componente nuevo `components/AcademicFields.jsx` (licenciatura + semestre + grupo con una sola consulta de ajustes), que **reemplaza a `DegreeSelect.jsx`**; ayudante `semesterGroupLine` en `utils.js`. Pruebas nuevas: 2 de API (regla del grupo al dar de alta, editar y en `/members/me`, valores largos) y 2 de navegador (menús y su dependencia, tarjeta del equipo). Total: 154 de API y 79 de navegador.

### 2026-11-09 — Tarjetas horizontales en la página del equipo (0.19.1)
- Los recuadros grandes de `/equipo` se cambiaron por **tarjetas pequeñas y horizontales**: foto (o iniciales) redonda a la izquierda y, a la derecha, nombre, cargo y licenciatura. La jerarquía se sigue notando por el tamaño: la presidencia es la tarjeta más grande (400 px de ancho, foto de 112 px), vicepresidencia y tesorería van un poco más chicas (330 px, foto de 92 px) y el resto todavía más (290 px, foto de 76 px). En teléfono las tarjetas ocupan todo el ancho, una bajo otra (ya no van de dos en dos). Antes de esto se probó una decoración lateral (rótulos, retazos de papel y un arco) y se **retiró** por decisión del cliente: la página queda solo con el organigrama. Pruebas: 152 de API y 77 de navegador.

### 2026-11-09 — Página del equipo por jerarquías (0.19.0)
- `/equipo` ya no es una cuadrícula pareja: se muestra como **organigrama de tres niveles**. **Nivel 1:** la presidencia (tarjeta más grande). **Nivel 2:** vicepresidencia y tesorería (la vicepresidencia primero). **Nivel 3:** todos los demás, incluidas las personas sin cargo. Los niveles van centrados uno bajo otro, cada tarjeta es más chica que la del nivel anterior y una línea roja con un punto los une. Si un nivel no tiene a nadie, no se dibuja. En teléfono la presidencia ocupa todo el ancho y los otros dos niveles van de dos en dos para que la página no sea larguísima. Dentro de cada nivel se respeta el orden que se fijó en el panel (Equipo → Ordenar el equipo).
- **Cómo se decide el nivel:** por el texto del **Cargo** (que es libre), con `frontend/src/hierarchy.js`: nivel 1 si empieza con «Presidente», «Presidenta» o «Presidencia»; nivel 2 si empieza con «Vicepresidente/a/ncia» o «Tesorero/a/ría»; nivel 3 en cualquier otro caso. No importan acentos, mayúsculas ni género, y «Vicepresidente» se reconoce antes que «Presidente». No hay campos nuevos ni migración: solo hay que **escribir el cargo así** en Panel → Equipo (o en «Mi información»). Un cargo como «Asistente de presidencia» queda en el nivel 3 a propósito. Pruebas de navegador nuevas (niveles, orden, tamaños, nivel vacío); total: 152 de API y 76 de navegador.

### 2026-11-09 — Animaciones ligeras de decoración (0.18.0)
- Se agregó movimiento **solo decorativo**, hecho únicamente con CSS (sin librerías ni JavaScript nuevo) y **apagado por completo para quien tiene activado «reducir movimiento»** en su sistema (todo va dentro de `prefers-reduced-motion: no-preference`). Qué se mueve: **fundido** al cambiar de página; en el **inicio**, el logo entra con un pequeño rebote y luego flota, el lema se **subraya como con marcador**, el botón «Escríbenos en el buzón» emite un **aro que late** cada pocos segundos, suben despacio **papelitos rojos y crema** detrás del héroe (decorativos: `aria-hidden` y sin clics) y el logo de la ENSFA flota; al **hacer scroll**, títulos, tarjetas y bloques **suben y aparecen** y el resaltado rojo de los títulos se **«pinta»** de izquierda a derecha (animaciones ligadas al scroll con `animation-timeline: view()` bajo `@supports`: en navegadores sin soporte, p. ej. Firefox por ahora, todo se ve de una vez); y el **menú** se subraya en rojo al pasar el cursor.
- Decisiones: solo se animan `opacity`, `translate` y `scale` (no `transform`, para no chocar con los efectos al pasar el cursor) y nada que cambie el tamaño o la posición en el flujo, así que no hay saltos de contenido ni peso extra; los papelitos tienen valores fijos (no aleatorios) para que la página se dibuje igual en cada visita. Las pruebas de navegador ya corren con «reducir movimiento», así que no se ven afectadas; una prueba nueva comprueba que las animaciones se apagan con esa preferencia y se encienden sin ella. Pruebas: 152 de API y 74 de navegador.

### 2026-11-09 — Avisos de «no hay mensajes» con estilo y exportar deshabilitado (0.17.2)
- Cuando la lista de mensajes del panel está vacía ya no sale una línea de texto suelta: hay un aviso con ícono, título y explicación (`components/EmptyState.jsx`), distinto según el motivo: **«Todo al día»** (filtros por defecto y nada por atender), **«Aún no hay mensajes»** (buzón sin mensajes), **«No hay mensajes con estos filtros»** (con la sugerencia de cambiar filtros o quitar la búsqueda) y **«La papelera está vacía»** (recuerda los 30 días). En los casos de «todo al día» y «sin resultados» un botón **«Ver todos los mensajes»** quita los filtros y la búsqueda. El botón **«Exportar CSV»** se **deshabilita** (con un texto emergente que explica por qué) cuando no hay mensajes con los filtros elegidos, y se vuelve a habilitar al cambiarlos. Pruebas: 152 de API y 73 de navegador.

### 2026-11-09 — Pantalla de agradecimiento sin scroll y sin pie de página (0.17.1)
- La pantalla que se muestra al enviar un mensaje conserva su formato de una sola columna (sello, título, texto, código y botones), pero ahora **no lleva pie de página** y reparte el contenido para ocupar justo el alto de la pantalla debajo del encabezado, así que **todo cabe sin scroll** en pantallas de escritorio (probado desde 1280×600). Los tamaños se calculan con la altura de la ventana (`vh`), así que se achican solos en pantallas bajas. El pie lo oculta una clase del `<body>` (`sin-pie`) que se quita al volver al formulario o al salir de la página. Además la página sube sola al terminar de enviar: antes el scroll se quedaba donde estaba el botón de enviar y se veía la pantalla cortada. En teléfono sigue de corrido (ahí puede haber scroll). Los dos botones del código (Copiar y Descargar imagen) van en una fila, del mismo tamaño.
- Pruebas de navegador nuevas: cabe sin scroll y sin pie en 1920×950, 1440×800, 1366×650 y 1280×600; el pie vuelve al salir; y en un teléfono de 390 px no desborda. Pruebas: 152 de API y 72 de navegador.

### 2026-11-09 — Que no se pierda el código de seguimiento (0.17.0)
- **Guardar el código en el dispositivo:** al enviar un mensaje, la pantalla del código trae la casilla «Recordar este código en este dispositivo» (marcada por defecto; se desmarca en una computadora compartida). El código y el asunto se guardan **solo en el navegador** (`localStorage`, `src/myMessages.js`): sin cuenta, nada de esto llega al servidor y no hay forma de enlazar un código con una persona. `/seguimiento` muestra una lista **«Mis mensajes»** con la situación de cada uno (estado, revisión y si ya tiene respuesta del equipo; se consulta con su código), con «Ver», «Quitar» y «Borrar todos de este dispositivo». Guarda los 20 más recientes; si el navegador bloquea el almacenamiento, todo sigue funcionando sin recordar nada. Se pierde si se borran los datos del navegador o se cambia de aparato.
- **Llevarse el código:** botones **Copiar código** y **Descargar imagen**. La imagen es un PNG de 1080 × 720 (se dibuja en el navegador, `src/codeImage.js`) con el logo, el código en letras grandes, el aviso destacado «¡No lo pierdas! No se vuelve a mostrar y no lo podemos recuperar.» y el enlace a `/seguimiento`; está pensada para guardarla en la galería del teléfono o mandársela por WhatsApp. Nunca lleva el asunto ni el texto del mensaje (la función ni siquiera los recibe). Los botones de compartir y de enviar por correo que hubo en la primera versión se quitaron (2026-11-09).
- El panel **no** muestra los códigos (en la base solo existe su hash): para mensajes anónimos no serviría y debilitaría el anonimato. Si más adelante se quiere ayudar a quien perdió el código de un mensaje **con datos**, la opción es un botón «Generar código nuevo» en el panel.
- Pruebas: 152 de API y 69 de navegador (unitarias del módulo local, descarga, correo, compartir, lista, almacenamiento bloqueado y accesibilidad).

### 2026-11-09 — Filtros por defecto de mensajes (0.16.10)
- Al abrir la pestaña de mensajes del panel, el estado empieza en **«Nuevos»** y la revisión en **«Pendiente»** (lo que hay por atender); tipo y urgencia siguen en «Todos». Todos se pueden volver a poner en «Todos». Esto reemplaza lo de la 0.16.0 («todos los filtros empiezan en Todos»); la lista sigue en orden cronológico, lo más reciente arriba.

### 2026-11-09 — Barra de búsqueda del panel y licenciaturas del buzón (0.16.9)
- **Mensajes del panel:** el botón de buscar es una **lupa** (con nombre accesible «Buscar»). Los filtros van en una fila y debajo una barra: la búsqueda a la izquierda y «Exportar CSV» y «Papelera» alineados a la derecha (en pantallas angostas se acomodan en dos filas).
- **Buzón:** si las licenciaturas, semestres y grupos no cargan (la API tarda en despertar —Render gratuito—, está caída o falló la red), ahora se avisa con «No se pudieron cargar…» y un botón **Reintentar** que no borra lo escrito; mientras cargan, el menú dice «Cargando…»; y si no hay licenciaturas configuradas se explica qué hacer. Antes quedaba un menú vacío sin explicación.
- **Ajustes:** la API ya no acepta dejar vacías las licenciaturas ni los semestres (400 «Debe haber al menos una licenciatura»), porque el buzón no tendría qué ofrecer; los grupos sí pueden quedar vacíos.
- Comprobado contra la API real que el menú carga tanto con licenciaturas guardadas como con las de por defecto.
- Pruebas: 146 de API y 64 de navegador.

### 2026-11-07 — Escáner de secretos del CI (0.16.8)
- El trabajo «Búsqueda de secretos» (gitleaks) marcó como posibles secretos las contraseñas inventadas de las pruebas de permisos (las mismas que ya lo habían hecho fallar en la Fase 3): no eran secretos reales. Se agregó `.gitleaks.toml`, que suma las reglas por defecto e ignora únicamente los valores que empiezan con `clave-`. Convención: toda contraseña falsa de una prueba empieza con `clave-`.

### 2026-11-07 — Revisión general (0.16.7)
- **Error corregido (seguridad):** editar a un integrante sin mandar el campo de rol (`PUT /api/members/:id` sin `access`) lo **ascendía a Moderador**, porque quedaba un valor por omisión de cuando el rol por defecto era administrador. Ahora el rol no cambia (y una cuenta nueva sin rol es Miembro). El panel siempre manda el rol, así que no se había podido dar por la interfaz; prueba nueva.
- **Código muerto eliminado:** `flushMonitoring` (nunca se usó), la regla CSS `.row.between` (ya sin uso tras el rediseño de las listas) y textos que seguían hablando de «administrador» (mensajes de error de roles, comentarios de modelos y de archivos).
- **Revisión sin hallazgos:** sin dependencias sin usar (`concurrently` y `eslint` se usan por línea de comandos), sin archivos ni clases CSS huérfanas, sin secretos en el repositorio, `npm audit` en 0 vulnerabilidades, árbol de dependencias consistente y todas las rutas de la API comprobadas contra la tabla de permisos.
- **Prueba de punta a punta sin simulaciones** (API real con MongoDB en memoria + sitio compilado + Chrome, 15 recorridos): buzón con imagen y código de seguimiento, respuesta firmada, alta de un Miembro, permisos de Miembro y Moderador, exportación a CSV, noticias y propuestas, perfil, scroll e idioma. Todos pasaron y sin errores de consola ni respuestas 4xx/5xx inesperadas.
- El plazo para que arranque la MongoDB en memoria de las pruebas subió de 60 a 120 s: en equipos ocupados algunas pruebas fallaban por tiempo sin ser errores reales.
- Pruebas: 146 de API y 61 de navegador (humo y accesibilidad).
- Se actualizó el árbol de la arquitectura. Compatibilidad que se conserva: `GET /api/messages` sin `?page=` sigue devolviendo el arreglo de antes (lo usan las pruebas); y la API conserva `POST /api/auth/logout-all` y `GET /api/audit` aunque el panel ya no tenga pantalla para ellos.

### 2026-11-07 — Idioma y corrector ortográfico (0.16.6)
- La página declara **español de México** (`<html lang="es-MX">` y `content-language`, también en el HTML de las vistas previas al compartir) para que el navegador use ese idioma en el corrector ortográfico y la traducción. Los campos que no son texto en español (nombres, correo de acceso, código de seguimiento y contraseñas, incluida la contraseña visible) ya no se subrayan como errores ni se autocorrigen; los de texto libre (asunto, mensaje, respuestas, notas, noticias, propuestas) sí se corrigen.
- **Si el navegador sigue marcando como error palabras bien escritas, falta su diccionario:** el corrector lo decide cada navegador con los idiomas que tenga activados. En Chrome: Configuración → Idiomas → Corrector ortográfico → activar «Español (México)» o «Español (Latinoamérica)» (y descargar el diccionario); en Edge: Configuración → Idiomas → Corrector ortográfico. La página solo puede indicar su idioma, no instalar el diccionario.
- Prueba de navegador nueva (idioma de cada página y propiedades de corrección de los campos).

### 2026-11-07 — Cada página empieza arriba (0.16.5)
- Al cambiar de ruta, al **recargar** y al **volver atrás**, la página aparece siempre en su parte superior, sin importar dónde se quedó el scroll en la anterior. Antes el navegador restauraba la posición al recargar y el `scroll-behavior: smooth` global animaba el salto desde donde estaba y las páginas que cargan después lo cortaban a medias. Ahora se apaga `history.scrollRestoration` y el salto es inmediato y antes de pintar (`ScrollToTop` en `App.jsx`). Prueba de navegador nueva (falla con el código anterior).

### 2026-11-07 — El Miembro también edita noticias y propuestas (0.16.4)
- El **Miembro** ahora puede **editar el contenido** de las noticias y propuestas (antes solo las publicaba nuevas y cambiaba su estado): `PUT /api/news/:id` y `PUT /api/proposals/:id` quedaron abiertos a Miembro y Moderador, con las mismas validaciones, y en el panel ve el botón de lápiz. **Eliminar** sigue siendo solo del Moderador. Las ediciones quedan en la bitácora con su nombre.
- Pruebas: 145 de API y 59 de navegador.

### 2026-11-07 — Perfil y menú de usuario (0.16.3)
- **Mi perfil:** se quitó la sección «Mis sesiones» y en su lugar hay un botón «Cerrar sesión» abajo a la derecha del primer recuadro (con la misma confirmación que el menú de usuario). También se corrigió que los títulos de las secciones se encimaban con los recuadros. La API de «cerrar sesión en todos los dispositivos» no cambió.
- **Menú de usuario:** el desplegable se ajusta al largo del correo (hasta 24 rem o el ancho de la pantalla) en vez de partirlo en dos líneas.
- Pruebas: 58 de navegador.

### 2026-11-07 — Listas del panel en dos columnas y con íconos (0.16.2)
- Noticias, propuestas y equipo del panel se muestran en **dos columnas** (una en teléfono, por debajo de 760 px) en lugar de una lista vertical, y los botones «Editar» y «Eliminar» son **íconos** de lápiz y de bote de basura (con `aria-label` y texto emergente, así que los lectores de pantalla siguen leyendo «Editar» y «Eliminar»). Aplica a todas las listas que usan `CrudPanel`. Las tarjetas de mensajes no cambiaron.
- Nuevo `components/ActionIcons.jsx`. Pruebas: 56 de navegador (dos columnas, íconos sin texto visible, una columna en teléfono).

### 2026-11-07 — Licenciatura en menú desplegable (0.16.1)
- Todos los campos de licenciatura son ahora un menú con las licenciaturas definidas en Panel → Ajustes (las mismas del buzón): el formulario de Equipo y «Mi información» del perfil (antes eran texto libre). Si alguien ya tenía una licenciatura que luego se quitó de Ajustes, se conserva como opción «(ya no está en Ajustes)» para no perderla al guardar. La API sigue aceptando texto en `degree` de la ficha, sin validarlo contra Ajustes, para no bloquear fichas antiguas.
- Pruebas: 54 de navegador.

### 2026-11-07 — Dos roles, filtros en «Todos», firma de quien responde y ajustes en dos columnas (0.16.0)
- **Roles redefinidos: solo Miembro y Moderador** (reemplazan a Técnico, Presidente, Miembro y el Moderador limitado de la 0.15.0). El **Miembro** lee mensajes (con datos de contacto), cambia su estado, responde, deja notas y exporta a CSV; publica noticias y propuestas nuevas y cambia su estado; ve correos, nombres y roles del equipo (nunca contraseñas) y edita solo su información. El **Moderador** puede todo. Tabla en «Roles y permisos».
- **API:** nuevos `PATCH /api/news/:id/state` y `PATCH /api/proposals/:id/state` (el Miembro cambia el estado sin tocar el contenido); `POST /api/news`, `POST /api/proposals` y `POST /api/files` abiertos al Miembro; `GET /api/members/all` devuelve correo y rol a ambos; la papelera, eliminar, editar lo ya creado, ajustes, bitácora y administrar el equipo siguen siendo solo del Moderador. Se quitó el ocultamiento de datos de contacto.
- **Migración `003-roles`:** convierte `presidente` y el `moderador` limitado en `miembro` (`npm run migrate`). Mientras no corra, el servidor ya los trata como Miembro. Las cuentas `admin` (el Moderador) no cambian.
- **Mensajes:** todos los filtros empiezan en «Todos» y la lista va siempre en orden cronológico, lo más reciente arriba. Al responder un mensaje se guarda y se muestra quién respondió (nombre y cargo), también a quien consulta su código.
- **Ajustes:** semestres y grupos van uno al lado del otro (uno debajo del otro en teléfono).
- Aviso de privacidad actualizado (los moderadores ya no tienen un acceso limitado).
- Pruebas: 145 de API (`permisos.test.js` reescrito, con la migración) y 52 de navegador.

### 2026-11-07 — Se quita la pestaña «Actividad» del panel (0.15.1)
- A petición del cliente, el panel ya no muestra la pestaña «Actividad» (ni la ruta `/admin/actividad`, la página `AdminActivity` y su prueba). La bitácora **sigue registrando** las acciones (solo ids y tipo de acción) y `GET /api/audit` sigue disponible para el Técnico y el Presidente: si se necesita consultarla, se puede volver a mostrar sin migrar datos.

### 2026-11-07 — Roles: Técnico, Presidente y Miembro (0.15.0)
- **Nuevos roles** además del Moderador: **Técnico** (ve y edita todo; es el `admin` de siempre), **Presidente** (ve todo, no edita) y **Miembro** (edita su información y ve la no crítica de los demás). Tabla completa en «Roles y permisos».
- **API:** `viewerOnly` (Técnico y Presidente) para la papelera, bitácora, exportación y listados con borradores; `readerOnly` (más Moderador) para leer mensajes e imágenes adjuntas; `panelUserOnly` para el directorio del equipo, que a un Miembro solo le devuelve lo no crítico; nuevo `PUT /api/members/me` para editar la propia ficha. Las escrituras siguen siendo solo del Técnico (y las de mensajes también del Moderador).
- **Panel:** cada rol ve sus secciones; el Presidente ve todo sin controles de edición (ajustes deshabilitados, sin botones de crear/editar/eliminar ni acciones sobre mensajes); el Miembro solo ve «Equipo» y edita lo suyo en «Mi perfil». El selector de rol del formulario de Equipo ofrece los cuatro.
- **Cambio de comportamiento:** el rol por defecto de un integrante nuevo es ahora **Miembro** (antes administrador). Las cuentas existentes no cambian.
- Pruebas: 152 de API (`permisos.test.js` con la matriz completa por rol) y 53 de navegador (Presidente y Miembro, y axe con cada rol). El recorrido largo de accesibilidad se dividió en pruebas más cortas y el tiempo límite de Playwright subió a 60 s, porque en equipos lentos o ocupados se pasaban de tiempo sin ser fallos reales.

### 2026-11-07 — Urgencia en el buzón, equipo y ajustes (0.14.0)
- **Urgencia del mensaje:** el buzón tiene un menú desplegable «Urgencia» (Baja, Media —por defecto—, Alta, Urgente). Se guarda en `messages.urgency` (la API rechaza otros valores con 400; los mensajes anteriores y los de formularios viejos cuentan como Media). En el panel cada mensaje muestra su urgencia con texto y color, hay un filtro «Urgencia» (también `?urgency=` en la API) y el CSV incluye la columna.
- **Equipo:** el botón «Nuevo integrante» pasó al final de la página. El formulario de edición no tiene campo de orden (el orden se cambia arrastrando en «Ordenar el equipo»; un integrante nuevo se agrega al final).
- **Ajustes:** se quitaron Facebook y TikTok (panel, API y página de Equipo). Quedan Instagram y el correo de contacto; si había valores guardados de antes, la API ya no los devuelve ni los acepta.
- Pruebas: 143 de API y 46 de navegador.

### 2026-11-06 — Fase 6 de mejoras: accesibilidad y monitoreo (0.13.0) — cierra el programa de mejoras
- **Accesibilidad (F8):** revisión automática con axe en el CI sobre todas las páginas y el panel (sin violaciones), enlace «Saltar al contenido», foco al contenido al cambiar de página, contorno de foco visible sobre fondos oscuros, nombres accesibles en los campos de archivo, página 404 con el diseño del sitio, y contraste corregido (el rojo de la marca sobre papel da 4.42:1: los textos y enlaces rojos sobre papel usan el rojo oscuro).
- **Monitoreo (Q3):** `X-Request-Id` en cada respuesta, errores internos con `requestId` y registro de una línea JSON sin datos, Sentry opcional (servidor y navegador) con filtro de privacidad, `ErrorBoundary` en el navegador y guía de UptimeRobot.
- Nuevas dependencias: `@sentry/node` (backend), `@sentry/react` (frontend, se descarga solo si hay clave) y `@axe-core/playwright` (pruebas).
- Revisión final: lint y build limpios, `npm audit` en 0 vulnerabilidades, CSP activa probada sobre 12 páginas sin violaciones ni hosts externos, 141 pruebas de API y 42 de humo/accesibilidad. Con esto se cierra el programa de mejoras de 21 puntos; el documento de trabajo temporal se eliminó y sus pendientes pasaron a la sección 9.

### 2026-11-06 — Fase 5 de mejoras: contenido y alcance (0.12.0)
- **Vista previa al compartir y SEO (F1):** etiquetas Open Graph/Twitter por página, función de Vercel para los rastreadores de redes sociales (WhatsApp, Facebook…), imagen por defecto 1200 × 630, `sitemap.xml` y `robots.txt` dinámicos, `usePageMeta` y `?og=1` en la API para portadas ligeras en JPEG. **Falta comprobarlo ya publicado** (depurador de Facebook / WhatsApp).
- **Avance de propuestas (F4):** estado público (Planeada, En marcha, Cumplida) con nota y filtro en `/propuestas`.
- **Editor de noticias (F5):** Markdown sin HTML crudo con barra y vista previa, galería de hasta 6 imágenes y publicación programada; se corrigió que `publishedAt` se reescribía al despublicar y volver a publicar. Nuevas dependencias: `react-markdown` y `remark-breaks` (la noticia individual se carga aparte para no pesar en el resto del sitio).
- **Equipo reordenable (F6):** arrastrar o botones subir/bajar (`@dnd-kit`), `PUT /api/members/order`; se quitó el campo «Orden».
- Pruebas: 134 de API (`contenido.test.js`, `seo.test.js` y `?og=1` en `imagenes.test.js`) y 22 de humo; Playwright usa 3 navegadores a la vez porque con más algunas pruebas se pasaban de tiempo por falta de recursos.

### 2026-11-06 — Fase 4 de mejoras: buzón (0.11.0)
- **Código de seguimiento (F3):** cada mensaje devuelve un código que se muestra una sola vez; en `/seguimiento` se consulta el estado y la respuesta pública del equipo. Solo se guarda su hash. Sin límite de intentos ni por IP ni global (decisión del cliente), a diferencia del plan original.
- **Panel de mensajes (F2):** paginación, búsqueda, contadores, exportación a CSV con las fórmulas neutralizadas (solo administradores, queda en la bitácora), notas internas y respuesta pública. `AdminMessages.jsx` se dividió: `MessageCard.jsx`, `messageLabels.js` y sus CSS.
- La lista sin `?page=` sigue devolviendo el arreglo de antes para no romper pestañas abiertas con el sitio anterior.
- Pruebas: 114 de API (`seguimiento.test.js`, `panel-mensajes.test.js` con 130 mensajes sembrados) y 18 de humo.

### 2026-11-06 — Fase 3 de mejoras: privacidad, respaldos y roles (0.10.0)
- **Privacidad (S3):** página `/privacidad` (borrador) enlazada en el pie, casilla de consentimiento obligatoria en el buzón cuando se envían datos personales (se guarda `consentAt`; la API responde 400 sin ella) y recordatorio en el panel. Retención configurable (`RETENTION_MONTHS`, desactivada por defecto) para mensajes resueltos, además de la papelera de 30 días; `npm run purge [-- --dry-run]` y flujo diario `purge.yml` en GitHub (sin el secreto no hace nada).
- **Respaldos (S4):** flujo semanal `backup.yml` (`mongodump` → cifrado con `age` → bucket S3 de B2/R2, últimas 8 copias) y guía con prueba de restauración. **Falta que el cliente cree el bucket y los secretos** (ver «Respaldos»).
- **Roles (S6):** primera versión con un rol limitado de «moderador»; reemplazado el 2026-11-07 por los dos roles actuales (ver «Roles y permisos»).
- Pruebas: 93 de API (nuevas: `roles.test.js`, `retencion.test.js` y el consentimiento en `messages.test.js`) y 15 de humo. Se quitó una mención obsoleta del límite global del buzón.

### 2026-11-06 — Fase 2 de mejoras: imágenes (0.9.0)
- **Imágenes privadas y limpias (S2):** los adjuntos del buzón solo los ve un administrador con sesión (antes bastaba el enlace) y todas las imágenes se re-codifican con `sharp` al subirse: sin EXIF/GPS, orientadas, máximo 4000 px, protección contra «bombas de descompresión» y rechazo de lo que no se pueda decodificar. Nueva dependencia: `sharp` (binarios precompilados; funciona en Render).
- **Miniaturas y carga más rápida (F7b):** versiones WebP de 640 y 1280 px (`?w=`), `srcset` en tarjetas de noticias y propuestas, y panel de administración con carga diferida. Ya no se descarga la imagen completa (hasta 5 MB) para una tarjeta.
- **Migraciones:** `npm run migrate` (001 imágenes de mensajes privadas, 002 miniaturas de lo anterior). **Pendiente de correr contra la base real, con visto bueno** (después de desplegar el backend).
- Se quitó `mozjpeg` de la codificación (12 veces más lento sin ventaja que importe) y se corrigió el PNG de prueba, que estaba dañado y ahora se rechaza al decodificarlo.
- Pruebas: 82 de API (11 nuevas en `imagenes.test.js`: EXIF, orientación, bomba, GIF animado, privacidad, miniaturas y migraciones) y 12 de humo.

### 2026-11-06 — Fase 1 de mejoras: seguridad rápida (0.8.0)
- **Contraseñas (S9):** mínimo de 10 caracteres y lista de contraseñas comunes (alta de integrantes, cambio de contraseña y `create-admin`); bcrypt costo 12 y re-hash automático de las cuentas anteriores al iniciar sesión. Las contraseñas existentes siguen funcionando.
- **Sesiones (S5, nivel A):** el token dura 12 horas y se renueva solo mientras se usa el panel; cambiar la contraseña, restablecerla desde Equipo o usar el nuevo botón «Cerrar sesión en todos los dispositivos» (Perfil) anula los demás tokens (`users.tokenVersion`); un 401 cierra la sesión en el sitio y avisa en `/acceso`. CSP en modo solo reporte en `vercel.json`.
- **Sin límites por IP (decisión del cliente, 2026-11-06):** la comunidad estudiantil comparte una sola red/IP, así que un límite por IP bloquearía a todos por culpa de uno. Por eso el buzón **no** lleva el «10 envíos por hora por IP» del plan original (ni ningún otro tope), y el freno del login pasó de «10 fallos por IP» a **5 fallos por correo** (se retiró el límite por IP que existía desde el 2026-10-29).
- **Buzón (S8):** protecciones invisibles para quien escribe: campo trampa `website`, tiempo mínimo de 3 s (`fillMs`), y tope de 12 MB entre todas las imágenes de un envío. **Sin límite de envíos**: el 2026-11-06 el cliente pidió quitar también el freno global de emergencia (`MESSAGE_RATE_LIMIT`, que ya no existe). El limitador de MongoDB (`ratelimits`, con TTL) queda solo para el login.
- **Bitácora y papelera (S7):** nueva pestaña Actividad (quién hizo qué, sin contenido de mensajes ni contraseñas, un año) y papelera de mensajes con restauración y borrado definitivo; a los 30 días se vacía sola. Eliminar un mensaje ya no lo borra al instante.
- **Tipografías propias (F7a):** Anton, Poppins (400/500/600/700) y Permanent Marker se sirven desde el propio sitio con `@fontsource/*` (importados en `main.jsx`, solo el subconjunto latino, que cubre el español). Se quitaron los `<link>` de Google Fonts de `index.html` y sus dos hosts de la CSP: el navegador ya no contacta a Google al abrir el sitio (privacidad y una dependencia externa menos).
- **Buzón sin ningún tope de envíos (2026-11-06):** a petición del cliente se quitó también el freno global de emergencia: ya no existe `MESSAGE_RATE_LIMIT` ni el límite de 100 envíos por hora (ni el archivo de pruebas `buzon-limite.test.js`). Quedan las protecciones invisibles (campo trampa, tiempo mínimo y tope de 12 MB). El limitador de `ratelimits` queda solo para el login.
- Pruebas: 71 de API y 11 de humo en el navegador; la CSP activa se comprobó sobre 12 páginas sin violaciones y sin peticiones a hosts externos. `npm audit` en 0 vulnerabilidades.

### 2026-11-05 — Fase 0 de mejoras: cimientos (0.7.0)
- **Pruebas en el repo:** 42 pruebas de la API (`backend/test`, `node:test` + `mongodb-memory-server`) que cubren permisos, ids inválidos, imágenes (firma falsa, SVG, tamaño, cantidad), anonimato, grupo condicionado, equipo, ajustes, CORS, cabeceras y freno del login; y 7 pruebas de humo en el navegador (`frontend/e2e`, Playwright con la API simulada). Las pruebas se niegan a correr contra una base que no sea local y llamada `gi_test`.
- **Lint en el repo:** `eslint.config.mjs` y `npm run lint`; `npm run check` = lint + build + test.
- **CI** (GitHub Actions): lint, build, pruebas, `npm audit` (producción, severidad alta), pruebas de humo y búsqueda de secretos (gitleaks, historial completo). **Dependabot** semanal para npm y para las acciones.
- **Backend:** la aplicación se separó en `app.js` (sin base de datos ni puerto) e `index.js` (arranque), para poder probarla. Un cuerpo JSON mayor al límite (100 kb) respondía 500; ahora 413. CORS acepta opcionalmente `CORS_ORIGIN_PATTERN` (solo staging).
- **Staging:** segundo servicio en `render.yaml` con su propia base (`gi_staging`); pasos en la sección 7. También se documenta cómo rotar la contraseña de Atlas.
- **Frontend:** la primera ejecución de las pruebas de humo encontró un error real: al cerrar sesión desde el panel, el usuario terminaba en la pantalla de acceso en vez del inicio (el panel redirigía a `/acceso` antes de que se aplicara la navegación). `UserMenu` ahora navega y cierra la sesión en la misma transición.
- La comparación visual de 62 capturas no se llevó a CI (era una verificación puntual del cambio de CSS).

### 2026-11-04 — Un CSS por componente (0.6.0)
- El antiguo `frontend/src/styles.css` (390 líneas) se dividió: cada `.jsx` con estilos propios importa su `.css` del mismo nombre (`Header.css`, `Footer.css`, `UserMenu.css`, `Dialog.css`, `PasswordInput.css`, `Spinner.css`, `MailboxIcons.css`, `NewsCard.css`, `ProposalCard.css`, `App.css`, `pages/Home.css`, `Mailbox.css`, `Team.css`, `NewsDetail.css`, `Profile.css`, `pages/admin/AdminLayout.css`, `AdminMessages.css` y `shared.css` para `shared.jsx`). `index.css` conserva solo lo global y compartido (variables, reinicio, tipografía, botones, formularios, tarjetas, secciones, `.grid`, `.tag`, `.avatar`, `.role`, miniaturas de adjuntos) y se importa primero en `main.jsx` para que las hojas de los componentes puedan sobrescribirlo. Las páginas sin estilos propios (Login, Noticias, Propuestas, AdminNoticias/Propuestas/Equipo/Ajustes) no tienen `.css`. Los puntos de quiebre responsive viven junto a los estilos que ajustan.
- Verificado con 62 capturas (21 pantallas y estados × 3 anchos, con API simulada) comparadas píxel a píxel contra la versión anterior: 0 diferencias.
- Corregido un error previo: con “reducir movimiento” activado el sobre del buzón seguía flotando, porque `.sticker.envelope` ganaba en especificidad a la regla que apagaba la animación.
- `.hero-cta` se unificó con la clase global `.btn-row` (eran la misma regla).

### 2026-10-29 — Revisión general: seguridad y errores (0.5.6)
- **Seguridad**: freno de fuerza bruta en el login (429 tras 10 fallos por IP en 15 min) y tiempo de respuesta igual con correos inexistentes; los enlaces de redes (`social`) solo aceptan `http(s)://` (y el correo de contacto debe ser válido), validado en la API y de nuevo al mostrarlos en `/equipo`, para impedir enlaces `javascript:`; el JWT se firma y verifica explícitamente con HS256; `vercel.json` agrega cabeceras (`X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`); `backend/.env.example` ya no lleva el usuario ni el host reales de Atlas (solo marcadores `<db_user>`, `<cluster>`).
- **Errores**: un id con formato inválido en la URL (p. ej. `PUT /api/news/abc`) devolvía 500; ahora 404. `PUT /api/settings/:key` sin cuerpo devolvía 500; ahora 400. Descargar un archivo que se borra a media descarga podía tumbar el servidor (stream sin manejador de error). En el panel, un error pasajero de carga ya no se queda visible después de una carga correcta.
- **Código muerto**: se quitó `export` a tres constantes/funciones que solo se usan dentro de su archivo (`SETTING_KEYS`, `MAX_IMAGE_BYTES`, `hasImageSignature`). No se encontró CSS, componentes ni archivos públicos sin uso.

### 2026-10-29 — Pie de página ordenado en teléfono (0.5.5)
- En pantallas de 600 px o menos el pie se veía deforme (logo, lema y logo de la ENSFA en una fila apretada, y el logo de la ENSFA suelto en otra). Ahora se apilan centrados —logo de la planilla, lema con líneas equilibradas y logo de la ENSFA un poco más pequeño— y la línea del © y “Acceso integrantes” también se centra. Escritorio no cambia.

### 2026-10-29 — Ajustes sin “Licenciaturas con varios grupos” (0.5.4)
- Se quitó de Panel → Ajustes la sección “Licenciaturas con varios grupos” porque esa configuración nunca se cambiará. Ajustes ya no guarda `groupDegrees`; sigue deduciéndose en el servidor (licenciaturas con “telesecundaria” en el nombre), así que el selector de grupo del buzón funciona igual.

### 2026-10-29 — Buzón sin adornos en los márgenes (0.5.3)
- Se quitaron los iconos de las opciones de tipo de mensaje y de anonimato, y se probaron y descartaron pegatinas en los márgenes laterales: toda la decoración queda dentro de la columna del formulario. Se conservan el candado del aviso de anonimato, el clip de las imágenes, el avión del botón de enviar, el sobre junto al título, la nota “¡Tu voz importa!” y el sello de palomita del agradecimiento.

### 2026-10-29 — Decoración del buzón con significado (0.5.2)
- Se agregó decoración sobria al buzón, donde **cada elemento tiene un sentido** y ninguno es una forma suelta. Nuevo `components/MailboxIcons.jsx`: iconos de línea (rojos, que heredan el tamaño del texto) en cada opción de tipo —globo con “!” para queja, foco para propuesta, signo de interrogación para pregunta, triángulo de advertencia para problema—, candado en “De forma anónima” y en el aviso de que no se guardan datos, persona en “Con mis datos”, clip en “Imágenes relacionadas” y avión de papel en “Enviar mensaje”.
- Pegatina del **sobre con flecha** junto al título (el mensaje que se deposita en el buzón; flota suavemente y se achica en móvil) y **sello de palomita** en la pantalla de agradecimiento (confirmación de recepción). Todo va `aria-hidden` porque el texto ya comunica lo mismo; con movimiento reducido no hay animación. Se conserva la nota “¡Tu voz importa!”. No hay adornos en los márgenes.

### 2026-10-29 — La documentación vive en el README (0.5.1)
- Buzón: debajo del texto introductorio se conserva la nota a mano “¡Tu voz importa!” (Permanent Marker roja, inclinada, con subrayado ondulado), de la decoración que se retiró.
- `docs/DOCUMENTACION.md` se fusionó en `README.md`, que ahora es el único archivo de documentación (arquitectura, desarrollo, variables, datos, cuentas, API, despliegue, calidad, pendientes y este registro). Se actualizaron `CLAUDE.md` (regla de documentación) y `docs/Prompt Inicial.md`. `docs/` conserva el Prompt Inicial y las referencias visuales.

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
