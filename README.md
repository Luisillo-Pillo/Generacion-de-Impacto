# Generación de Impacto

Sitio web de la planilla **Generación de Impacto** para el Consejo Estudiantil de la ENSFA. *Nuestra voz, nuestras ideas, nuestro impacto.*

Para regenerar el proyecto desde cero con una IA, ver [`docs/Prompt Inicial.md`](docs/Prompt%20Inicial.md).

> Este README es la documentación del proyecto y se actualiza en cada cambio importante (ver `CLAUDE.md`). El historial está al final.

## 1. Arquitectura

```
Generacion-de-Impacto/
├── frontend/            React 18 + Vite + React Router 7 → Vercel
│   ├── public/brand/    logo-planilla.svg, logo-ensfa.png   (favicon.png = emblema de la planilla)
│   ├── e2e/             pruebas de humo con Playwright (API simulada)
│   └── src/             App, auth, api, hooks, utils, pages/ (admin/: una página por sección del panel), components/; cada .jsx con estilos lleva su .css (mismo nombre) y `index.css` guarda solo lo global
├── backend/             Express 5 + Mongoose + Zod 4 → Render
│   ├── src/             app (Express sin arrancar), index (conecta y escucha), db (GridFS), uploads (multer + sharp: limpieza y versiones reducidas), migrate + migrations/ (migraciones de datos),
│   │                    settings, auth, passwords (política), rateLimit (limitador en MongoDB), audit (bitácora), maintenance (papelera),
│   │                    models, validators, seed, create-admin, routes/ (auth, messages, members, files, content, audit)
│   ├── test/            pruebas de la API (node:test + MongoDB en memoria)
│   └── seed/            reto-impacto.jpg (portada de la primera noticia)
├── .github/             CI (workflows/ci.yml) y Dependabot
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
| `npm test` | Pruebas de la API (`backend/test`, `node:test`): permisos, validaciones, imágenes, anonimato, equipo, ajustes, CORS y cabeceras, freno del login, política de contraseñas, sesiones, protecciones del buzón, papelera y bitácora. Cada archivo levanta su **propia MongoDB en memoria**, así que nunca toca Atlas. |
| `npm run e2e` | Pruebas de humo en el navegador (`frontend/e2e`, Playwright con el Chrome instalado): inicio, enviar un mensaje anónimo (y el campo trampa), iniciar y cerrar sesión, sesión vencida, crear una noticia, papelera, pestaña Actividad, página 404. La API se simula, no necesitan backend. |
| `npm run check` | `lint` + `build` + `test`. Córrelo antes de subir cambios. |

- Las pruebas **se niegan a correr** si la base no es local y llamada `gi_test`. Si no puedes descargar el binario de MongoDB que usa `mongodb-memory-server`, define `TEST_MONGODB_URI` con una base llamada exactamente `gi_test` (nunca la real) y ejecuta `node --test --test-concurrency=1` dentro de `backend/`: se vacía al empezar y se elimina al terminar.
- **CI** (`.github/workflows/ci.yml`, en cada push a `main` y en cada PR): `lint` + `build` + `test` + `npm audit --omit=dev --audit-level=high`; las pruebas de humo; y una búsqueda de secretos con gitleaks sobre todo el historial. **Dependabot** (`.github/dependabot.yml`) abre cada lunes un PR con las actualizaciones menores agrupadas (y uno por cada actualización mayor).

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
- **Bitácora** (`auditlogs`, Panel → Actividad): quién creó, editó o eliminó noticias, propuestas, integrantes y ajustes; cambios de estado y papelera de mensajes; cambios de contraseña, cierre de sesión en todos los dispositivos y bloqueos de cuenta por intentos fallidos. **Nunca guarda el contenido de los mensajes** (ni asunto ni texto), solo ids y el tipo de acción; tampoco contraseñas ni IPs. Se conserva un año (índice TTL).
- Cada **integrante** (`members`) apunta a su cuenta (`users`) mediante `member.user`. La API pública de integrantes nunca devuelve ese campo ni el correo.
- Las listas de licenciaturas, semestres y grupos del formulario viven en `settings` y se editan desde el panel. `groupDegrees` es la lista de **licenciaturas con varios grupos**; no se edita desde el panel (decisión del cliente: esa configuración no cambia) y se deduce: toda licenciatura cuyo nombre contenga “telesecundaria”. El valor se calcula en `backend/src/settings.js` y se usa tanto en `GET /api/settings` como al validar un mensaje.

## 5. Cuentas, integrantes y acceso

**No hay registro público.** Solo las personas dadas de alta como integrantes de la planilla tienen cuenta:

- **Alta de integrante** (Panel → Equipo → Nuevo integrante): se capturan nombre, cargo, licenciatura, foto, **correo y contraseña**. La API crea el usuario y la ficha juntos. Se elige el **acceso al panel**: **administrador** (por defecto; todo) o **moderador** (solo lee y clasifica mensajes: no ve nombre, teléfono, licenciatura, semestre ni grupo, no elimina y no entra a noticias, propuestas, equipo, ajustes ni actividad). Siempre debe quedar al menos un administrador y nadie se quita su propio rol. Si falla la creación de la ficha, se revierte la cuenta.
- **Contraseñas**: mínimo **10 caracteres** y no pueden ser de las más comunes (`1234567890`, `password123`, el nombre del sitio, un solo carácter repetido…) en el alta, el cambio de contraseña y `npm run create-admin`. Se guardan con bcrypt costo 12; las cuentas con contraseñas anteriores (costo 10, incluso de 8 caracteres) siguen entrando y su hash se **actualiza solo** al iniciar sesión.
- **Edición**: se puede cambiar el correo y restablecer la contraseña (campo vacío = no cambiar; al restablecerla se cierran las sesiones de esa persona). El nombre se sincroniza con la cuenta.
- **Baja**: eliminar al integrante elimina también su cuenta (su sesión deja de funcionar al instante). Nadie puede eliminar su propia ficha, así que siempre queda al menos un administrador.
- **Primer administrador**: `npm run create-admin` (interactivo; o con `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`). Crea cuenta + ficha. Si el correo ya tiene cuenta sin ficha de integrante, solo crea la ficha y la vincula sin tocar la contraseña. Para producción, ejecútalo en tu equipo con `MONGODB_URI` de Atlas.
- **Sesión**: correo + contraseña (bcrypt), JWT de **12 horas** que se **renueva solo** mientras se usa el panel (cuando ya pasó la mitad de su vida, la API manda uno nuevo en la cabecera `X-Renewed-Token`). El token lleva la **versión de sesión** de la cuenta (`users.tokenVersion`): cambiar la contraseña o usar «Cerrar sesión en todos los dispositivos» la sube y deja de valer cualquier otro token. Si la API rechaza la sesión (401), el sitio la cierra y manda a `/acceso` con un aviso. El rol se consulta en la BD en cada petición.
- **Freno de intentos**: 5 intentos fallidos **por correo** en 15 minutos bloquean esa cuenta (429 con `Retry-After`, incluso con la contraseña correcta). **No se limita por IP**: la comunidad estudiantil comparte red (misma IP) y un límite por IP bloquearía a todos por culpa de uno. El conteo vive en MongoDB (sobrevive a reinicios), con la llave en hash.
- **Perfil** (`/perfil`): datos del usuario, cambio de contraseña (pide la actual; cierra las demás sesiones y deja esta con un token nuevo) y «Cerrar sesión en todos los dispositivos».
- El header muestra, con sesión iniciada, un menú con **Ver perfil** y **Cerrar sesión** (con confirmación). Los campos de contraseña tienen botón de “ojo” para mostrarla.

## 6. API

Resumen (detalle de validaciones en `backend/src/routes/`):

- Auth: `POST /api/auth/login`, `GET /api/auth/me`, `PATCH /api/auth/password` y `POST /api/auth/logout-all` (ambos devuelven un `token` nuevo para el dispositivo actual).
- Seguimiento: `POST /api/messages/track` (público; `{code}` → `{ type, subject, status, review, createdAt, updatedAt, publicReply, publicReplyAt }`; nunca el texto del mensaje ni datos personales; la misma respuesta 404 para cualquier código que no exista, esté mal escrito o sea de un mensaje eliminado; **sin límite de intentos**: la comunidad comparte IP y el código tiene 50 bits de aleatoriedad).
- Buzón: `POST /api/messages` (público; multipart con los campos y hasta 3 archivos `images`, o JSON sin imágenes); admin: `GET /api/messages?status=&type=&review=&q=&page=&limit=` (filtros opcionales y combinables; `q` busca en asunto y texto como texto literal, nunca como patrón; con `page` responde `{ items, total, page, pages }` de 20 en 20, máx. 100, y sin `page` el arreglo de siempre, hasta 500), `GET /stats` (`{ nuevos, pendientes, total, porTipo }`, para la insignia y el resumen del panel), `GET /export` (CSV UTF-8 con BOM, mismos filtros, **solo administradores**, con las fórmulas de hoja de cálculo neutralizadas y registrado en la bitácora), `GET ?trash=1` (papelera), `PATCH /:id` (`{status?, review?, publicReply?}`, al menos uno; `publicReply` vacío la quita), `POST /:id/notes` (`{text}`: nota interna del equipo), `DELETE /:id` (a la papelera), `POST /:id/restore` y `DELETE /:id/permanent` (solo desde la papelera). El buzón descarta en silencio (respondiendo 201) los envíos con el campo trampa `website` lleno o enviados en menos de 3 s (`fillMs`), rechaza con 413 las imágenes que juntas pasen de 12 MB. Un mensaje **con datos personales** exige `consent: true` (aceptar el aviso de privacidad; se guarda `consentAt`) y responde 400 si falta. `GET /api/messages` y `PATCH` también los usan los **moderadores**, a quienes la API les quita `name`, `degree`, `semester`, `group` y `phone` (y marca `hasContact`); la papelera y el borrado son solo de administradores.
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
- El rol `user` de `User.role` ya no se asigna a nadie (las cuentas son de integrantes: `admin` o `moderador`). Se conserva el valor y la comprobación de rol como defensa si se edita la BD a mano: una cuenta `user` no ve mensajes ni imágenes privadas.
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
- Integrantes del equipo, redes sociales y correo de contacto: capturar desde el panel.
- **Aviso por correo de mensajes nuevos: aplazado por decisión del cliente** (no hay código ni variables). Si se retoma: Render gratis bloquea SMTP (puertos 25/465/587), así que hay que usar una API HTTPS (p. ej. Brevo, verificando el remitente) o SMTP en hosting de pago; `ensfa.edu.mx` usa Google Workspace (SMTP con contraseña de aplicación entrega mejor). Guardar el mensaje antes de enviar el correo y que un fallo del correo nunca afecte al usuario; el correo no debe incluir datos personales de mensajes anónimos.
- Rotar la contraseña de Atlas: la cadena de conexión se compartió en el chat durante el desarrollo.
- **Texto legal:** el aviso de privacidad (`/privacidad`) es un borrador; lo debe revisar la ENSFA o alguien con conocimiento legal. Definir también `RETENTION_MONTHS`.

## 10. Registro de cambios

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
- **Rol moderador (S6):** además de administrador, un integrante puede ser moderador: lee y clasifica mensajes, sin ver datos de contacto, sin eliminar y sin el resto del panel. Se elige en Equipo; siempre queda al menos un administrador. Cambia la regla «todo integrante es administrador»: ahora lo es **por defecto**.
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
