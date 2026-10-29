# Prompt Inicial

Este documento contiene el prompt completo que se le entregaría a una IA de programación (Claude Code u otra) para generar **desde cero** el sitio web de la planilla *Generación de Impacto*. Describe el producto, la arquitectura, los datos, la API, el diseño, el contenido y el despliegue tal como existen hoy. Se actualiza cada vez que cambian los requisitos base (ver `CLAUDE.md`).

**Antes de usarlo:** coloca en la carpeta de trabajo las imágenes de `docs/referencias/` (la IA debe verlas para replicar el estilo) y los logos que se mencionan en la sección 6. Las credenciales **nunca** se pegan en el prompt: se colocan después en `backend/.env`.

**Última actualización del prompt:** 2026-10-29 (v0.4.0: imágenes y teléfono en el buzón, grupos solo en Telesecundaria; v0.3.0: panel en rutas propias, revisión de mensajes, diálogos propios, selectores con estilo; v0.2.2: en Inicio, noticias antes de “Quiénes somos”; cuentas solo para integrantes, perfil; sin aviso por correo).

---

## PROMPT (copiar desde aquí)

Actúa como desarrollador full-stack senior. Construye desde cero un sitio web completo, en español de México, para **Generación de Impacto**, una planilla que compite por el Consejo Estudiantil de la **Escuela Normal Superior Federal de Aguascalientes (ENSFA) “Profr. José Santos Valdés”**. Lema: **“Nuestra voz, nuestras ideas, nuestro impacto.”**

Entrega código funcional, probado y documentado. Antes de dar algo por terminado, ejecuta el build, levanta los servidores y prueba los endpoints; no declares funcionalidad verificada si no la verificaste.

### 1. Propósito del sitio

1. Dar a conocer la planilla (quiénes son, propuestas, equipo, redes).
2. Publicar noticias y avisos (ej. campañas, eventos).
3. Ofrecer un **buzón digital** para que estudiantes envíen quejas, propuestas, preguntas o problemas, de forma **anónima** o **identificándose**.

### 2. Stack y estructura del monorepo

- Monorepo con **npm workspaces**. Carpetas **`frontend/`** y **`backend/`** (estos nombres exactos).
- **frontend**: React 18 + Vite + React Router 7, JavaScript, CSS plano (sin frameworks de UI). Se despliega en **Vercel** (Root Directory = `frontend`, con `vercel.json` que reescribe todo a `/index.html` para el router).
- **backend**: Node ≥ 20, Express 5, Mongoose 8, ESM (`"type": "module"`). Librerías: `zod` 4 (validación), `bcryptjs`, `jsonwebtoken`, `multer` (memoria), `helmet`, `cors`. Se despliega en **Render** como Web Service (`render.yaml` en la raíz con `rootDir: backend`, `healthCheckPath: /api/health`).
- Base de datos: **MongoDB Atlas** (Mongoose). **Los mensajes y todos los recursos visuales subidos desde el panel se guardan en MongoDB**; las imágenes van en **GridFS** (bucket `files`).
- Scripts raíz: `dev` (backend + frontend con `concurrently`), `build`, `start`, `seed`, `create-admin`.
- En desarrollo, Vite hace proxy de `/api` a `http://localhost:4000`. En producción el frontend usa `VITE_API_URL` (URL del backend en Render, sin barra final).
- Variables de entorno (con archivos `.env.example` solo con marcadores, y `.env` ignorado por git):
  - backend: `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGIN` (lista separada por comas), `PORT`.
  - frontend: `VITE_API_URL`.
- El script `dev` del backend usa `node --watch --env-file-if-exists=.env src/index.js`.

### 3. Modelo de datos (colecciones)

- **User**: `name`, `email` (único, minúsculas), `passwordHash` (bcrypt), `role` (`admin` | `user`; todas las cuentas que crea la app son `admin`), timestamps.
- **Message**: `type` (`queja` | `propuesta` | `pregunta` | `problema`), `anonymous` (bool), `name`, `degree` (licenciatura), `semester`, `group` (solo si la licenciatura tiene varios grupos), `phone` (10 dígitos sin espacios, solo con datos), `images` (hasta 3 ids de GridFS), `subject` (≤140), `body` (≤4000), `status` (`nuevo` | `leido` | `archivado`, por defecto `nuevo`), `review` (revisión: `pendiente` por defecto | `en_proceso` | `completado` | `rechazado`; independiente de `status`), timestamps. **Si `anonymous` es true no se guarda ningún dato personal** (la API descarta `name`, `degree`, `semester`, `group` aunque lleguen).
- **News**: `title`, `slug` (único, generado del título sin acentos y con sufijo numérico si se repite), `excerpt` (≤300), `body` (≤20 000, párrafos separados por línea en blanco), `coverImage` (ObjectId de GridFS), `published`, `publishedAt`, `author` (nombre del admin que la crea).
- **Proposal**: `number` (único), `title`, `objective`, `image` (opcional, GridFS), `published`.
- **Member** (equipo): `name`, `role` (cargo), `degree`, `photo` (GridFS), `order`, `user` (ObjectId de su cuenta; nunca se expone en la API pública).
- **Setting** (clave/valor): `degrees` (lista de licenciaturas), `semesters` (lista, por defecto 1–8), `groups` (lista, por defecto A–D), `groupDegrees` (licenciaturas con varios grupos; si no se ha guardado, se deducen las que contengan “telesecundaria”), `social` (`instagram`, `facebook`, `tiktok`, `email`). Estas listas alimentan los desplegables del buzón y son editables en el panel. Valores por defecto en código si no existen en BD.

### 4. Cuentas y acceso

- **No hay registro público.** Solo los integrantes de la planilla tienen cuenta. Login con **correo + contraseña** (mínimo 8 caracteres), sesión con **JWT de 7 días** (`Authorization: Bearer`). El token solo contiene el id; **el rol se lee de la base de datos en cada petición**.
- **Todo integrante es administrador** automáticamente. Al **dar de alta un integrante** (panel → Equipo) son obligatorios **correo y contraseña**: la API crea la cuenta (`role: admin`) y la ficha juntas; si falla la ficha, se revierte la cuenta. Correo único (409 si existe), normalizado a minúsculas.
- Al **editar** un integrante se puede cambiar el correo y restablecer la contraseña (vacía = no cambiar); el nombre se sincroniza con la cuenta. Al **eliminar** un integrante se elimina también su cuenta (su sesión deja de funcionar al instante). **Nadie puede eliminar su propia ficha**, de modo que siempre queda al menos un admin.
- **Primer administrador:** script `npm run create-admin` (interactivo con contraseña oculta, o con `ADMIN_NAME`/`ADMIN_EMAIL`/`ADMIN_PASSWORD`). Crea cuenta + ficha; si el correo ya tiene cuenta sin ficha, solo crea la ficha y la vincula sin cambiar la contraseña; falla si ya es integrante.
- **Perfil:** cualquier usuario con sesión puede ver su perfil y **cambiar su contraseña** (pide la actual, mínimo 8 caracteres para la nueva).
- Solo los `admin` acceden al panel y a las rutas de gestión.
- El buzón digital es público y **no lleva protección anti-spam por ahora** (decisión del cliente: sin rate limit, sin captcha). Sí hay validación estricta de longitudes y tipos.

### 5. API REST (prefijo `/api`)

Los errores devuelven `{ "error": "mensaje en español" }`; los de validación (zod) responden 400. JSON limitado a 100 kb.

| Método y ruta | Acceso | Descripción |
|---|---|---|
| `GET /health` | público | `{ ok: true }` |
| `POST /auth/login` | público | `{email,password}` → `{token,user,member}`; 401 genérico |
| `GET /auth/me` | sesión | `{user,member}` (ficha de integrante, sin el campo `user`) |
| `PATCH /auth/password` | sesión | `{currentPassword,newPassword}`; 400 si la actual no coincide |
| `POST /messages` | público | crea mensaje; **multipart** con los campos y hasta 3 archivos `images` (JPG/PNG/WEBP/GIF, 5 MB c/u, validando también la firma real del archivo; sin SVG), o JSON sin imágenes. Unión discriminada por `anonymous`: si es `false`, `name`, `degree`, `semester` y `phone` (10 dígitos; acepta `000 000 0000` y se guarda sin espacios) son obligatorios y `group` solo si la licenciatura está en `groupDegrees` (en las demás se descarta). Si algo falla no quedan archivos huérfanos (sin aviso por correo) |
| `GET /messages?status=&type=&review=` | admin | lista (más recientes primero, máx. 500); filtros opcionales y combinables |
| `PATCH /messages/:id` | admin | `{status?, review?}` (al menos uno) |
| `DELETE /messages/:id` | admin | elimina |
| `POST /files` | admin | multipart `file`; solo JPG/PNG/WEBP/GIF (**nunca SVG**), máx. 5 MB → `{id,url}` |
| `GET /files/:id` | público | stream desde GridFS con `Content-Type` correcto y `Cache-Control: public, max-age=31536000, immutable` |
| `DELETE /files/:id` | admin | borra el archivo |
| `GET /news` · `GET /news/:slug` | público | solo publicadas (la lista sin `body`) |
| `GET /news/all` · `POST/PUT/DELETE /news[/:id]` | admin | CRUD; al cambiar o quitar la portada se borra el archivo anterior de GridFS; al eliminar la noticia se borra su portada |
| `GET /proposals` | público | publicadas, por `number` |
| `GET /proposals/all` · `POST/PUT/DELETE /proposals[/:id]` | admin | CRUD; 409 si el número se repite |
| `GET /members` | público | por `order`; sin correo ni cuenta |
| `GET /members/all` | admin | igual, con el `email` de cada cuenta |
| `POST /members` | admin | `name` + **`email` + `password` obligatorios**; crea cuenta admin y ficha |
| `PUT /members/:id` | admin | `email` y `password` opcionales (vacío = sin cambio); 409 si el correo es de otra cuenta |
| `DELETE /members/:id` | admin | elimina ficha, foto y cuenta; 400 si es la propia ficha |
| `GET /settings` | público | todos los ajustes (con valores por defecto) |
| `PUT /settings/:key` | admin | `{value}` para `degrees`, `groups`, `semesters`, `groupDegrees`, `social` |

Detalles de seguridad: `helmet` (con `Cross-Origin-Resource-Policy: cross-origin` para poder mostrar imágenes desde otro dominio), CORS restringido a `CORS_ORIGIN`, `trust proxy` activado (Render), manejador de errores central que no filtra trazas.

### 6. Identidad visual (replicar las imágenes de `docs/referencias/`)

Estilo **“papel rasgado”** tipo collage de cartel: capas de papel crema con bordes irregulares sobre fondo negro, con rojo intenso como acento, tipografía gruesa en mayúsculas y detalles de garabato.

- Colores: crema `#f1e8db`, rojo `#d4141c`, rojo oscuro `#a8101a`, negro `#121212`, texto `#1b1b1b`.
- Tipografías (Google Fonts): **Anton** (títulos, en mayúsculas), **Poppins** (texto), **Permanent Marker** (acentos manuscritos).
- Palabras clave de los títulos resaltadas con un **bloque rojo ligeramente girado** (`<mark>` con sombra), como “CONVIVENCIA” o “ESTUDIANTES” en los carteles.
- Secciones con bordes superiores e inferiores irregulares (`clip-path: polygon(...)` en una variable CSS reutilizable) que se superponen con margen negativo para que se vea el fondo negro entre capas. Franja roja rasgada al final del hero.
- Tarjetas de propuestas: papel crema, número grande en rojo (Anton), título en mayúsculas, sombra dura roja desplazada, y recuadro blanco con etiqueta pill roja oscura **“OBJETIVO”** seguida del texto.
- Tarjetas de noticias: blancas con sombra dura negra, portada 4:3, fecha, título, resumen y “Leer más →”.
- Botones: píldora, mayúsculas, rojo / crema / negro.
- **Menús de selección (`<select>`)**: campo con borde negro y flecha roja propia (`appearance: none` + SVG de fondo); la lista desplegable es la **nativa del navegador** (no usar `appearance: base-select`: en algunas ventanas dejaba visible una sola opción).
- **Nunca usar `alert()`, `confirm()` ni `prompt()` del navegador**: toda confirmación o aviso se muestra en un diálogo modal con el diseño del sitio (`DialogProvider` + `useDialog()` con `confirm()` y `notify()`; foco inicial en la opción segura; Esc y clic fuera cancelan).
- **Logos** (ambos obligatorios; el de la planilla va en header y footer, el de la ENSFA en el footer y en “Quiénes somos”, **no en el header**): logo de la planilla (puño rojo dentro de un aro rojo y blanco, “GENERACIÓN DE” en blanco e “IMPACTO” en rojo) como **SVG vectorial sin fondo** en `frontend/public/brand/logo-planilla.svg` (viewBox `14 14 561 496`; puño y aros trazados del original de `docs/referencias/tarjeta-generacion-de-impacto.jpg`, textos en Montserrat Bold/ExtraBold convertidos a curvas; rojo `#d0191f`, blanco `#f4f1ec`; se usa en header, hero, footer y miniatura de noticias sin portada) y logo de la ENSFA en `frontend/public/brand/logo-ensfa.png` (original en `docs/referencias/logo-ensfa-original.png`, 512 px). **Favicon: el emblema del puño de la planilla** (recorte cuadrado del puño, PNG de 128 px), no el de la ENSFA. **Título de la pestaña: “Generación de Impacto”** (único para todas las páginas).
- Tema único (sin modo oscuro). Diseño **responsive** (menú hamburguesa ≤ 820 px; sin desbordamiento horizontal a 390 px), foco visible, `prefers-reduced-motion` respetado, formularios con etiquetas.

### 7. Páginas del frontend

Header fijo negro con borde rojo inferior: logo de la planilla y navegación (Inicio, Propuestas, Noticias, Buzón, Equipo, y “Panel” si eres admin o “Acceso” si no hay sesión). **Sin logo de la ENSFA.** Con sesión iniciada aparece un **menú desplegable de perfil** (foto o iniciales + nombre) con **“Ver perfil”** y **“Cerrar sesión”**; cerrar sesión pide **confirmación** en un `<dialog>` modal con el foco inicial en “Cancelar”. El menú se cierra con clic fuera o Esc y funciona en móvil junto a la hamburguesa. Footer con ambos logos, lema, aviso de derechos y enlace “Acceso integrantes” (solo sin sesión).

1. **Inicio `/`**: hero (logo grande dentro de un `<h1>` con su `alt`, “Planilla del Consejo Estudiantil de la ENSFA”, botones al buzón y a propuestas); 3 últimas noticias (primera sección tras el hero, fondo crema); **Quiénes somos** (fondo negro; texto de la sección 8 + logo ENSFA); 3 propuestas destacadas (fondo crema, tarjetas blancas); banda roja “Tu opinión cuenta” con enlace al buzón.
2. **Propuestas `/propuestas`**: todas las propuestas publicadas.
3. **Noticias `/noticias`** y **detalle `/noticias/:slug`** (portada, fecha, autor, párrafos).
4. **Buzón `/buzon`**: elegir tipo (queja, propuesta, pregunta, problema) con chips; elegir **anónimo** o **con mis datos**. Si es con datos aparecen: nombre completo, **teléfono** (`type=tel`, placeholder `000 000 0000`, solo dígitos, máximo 10, formateado en vivo a `000 000 0000`), licenciatura (desplegable), semestre (desplegable) y grupo (desplegable, con la etiqueta **“Grupo (Telesecundaria)”** y sin texto de ayuda), tomados de `/settings`. **El grupo está deshabilitado (“No aplica”) y no es obligatorio salvo que la licenciatura elegida esté en `groupDegrees` (hoy Telesecundaria); al cambiar de licenciatura se limpia.** Siempre, de forma opcional: **imágenes relacionadas** (hasta 3, JPG/PNG/WEBP/GIF, 5 MB c/u) con botón “Adjuntar imágenes”/“Agregar otra imagen”, vista previa con botón × para quitar y errores en pantalla; si el mensaje es anónimo y hay imágenes se avisa que no deben mostrar datos que identifiquen. Siempre: asunto y mensaje (contador 0/4000). Si es anónimo, mostrar “No guardamos ningún dato personal con tu mensaje” y **no enviar** datos personales. Pantalla de agradecimiento tras el envío con dos botones: **“Inicio” (primario, rojo, primero)** y “Enviar otro mensaje” (secundario, negro).
5. **Equipo `/equipo`**: integrantes con foto (o iniciales) y cargo; bloque de contacto y redes (solo muestra las que tengan valor).
6. **Acceso `/acceso`**: solo iniciar sesión (**sin opción de registrarse**; indica que es para integrantes). Tras entrar va a `/admin`. **Todos los campos de contraseña de la app (acceso, perfil, alta de integrante) llevan un botón de “ojo”** (con `aria-label` y `aria-pressed`) para mostrar u ocultar lo escrito.
   - **Perfil `/perfil`** (protegido): foto o iniciales, nombre, correo, cargo y licenciatura, y formulario **Cambiar contraseña** (actual, nueva y confirmación).
7. **Panel `/admin`** (protegido). Cada sección es **una página con su propia URL** dentro de un layout común (título “Panel de administración” + navegación por pestañas con `NavLink` + `<Outlet />`): `/admin/mensajes`, `/admin/noticias`, `/admin/propuestas`, `/admin/equipo`, `/admin/ajustes`; `/admin` redirige a `/admin/mensajes`; el código vive en `frontend/src/pages/admin/` (una página por sección + utilidades compartidas). **Mensajes** (tres filtros combinables como **menús desplegables compactos** (ancho ajustado al contenido, mín. ~9.5rem, texto de .9rem) en una fila que se acomoda en varias líneas en móvil: **Tipo** Todos/Quejas/Propuestas/Preguntas/Problemas, **Estado** Nuevos (por defecto)/Leídos/Archivados/Todos y **Revisión** Todas/Pendiente/En proceso/Completado/Rechazado; la lista se vuelve a pedir al cambiar un filtro y se descartan respuestas tardías de filtros anteriores; cada tarjeta muestra la **fecha y hora de registro** (formato “29 de octubre de 2026 · 2:35 p.m.”, hora local) en su esquina superior, el tipo, una insignia de revisión de color —amarillo pendiente, azul en proceso, verde completado, rojo rechazado— y un selector para cambiarla; marcar leído, archivar, marcar nuevo y eliminar con confirmación; muestra “Anónimo” o los datos del remitente —incluido el teléfono con formato y el grupo solo si aplica—, y las imágenes adjuntas como miniaturas que abren la imagen completa en otra pestaña), **Noticias**, **Propuestas** y **Equipo** (CRUD con subida de imagen y vista previa; el alta pide **correo y contraseña** y avisa que el integrante recibe acceso de administrador; al editar, la contraseña es opcional), y **Ajustes** (licenciaturas, semestres, grupos —una por línea—, casillas “Licenciaturas con varios grupos” y redes/correo). No hay pestaña de usuarios ni gestión de roles.
8. Ruta desconocida: mensaje “Página no encontrada”.

### 8. Contenido inicial (script `npm run seed`, idempotente)

**Quiénes somos:** “**Generación de Impacto** propone un Consejo Estudiantil cercano a la comunidad de la ENSFA, que escuche a los distintos grupos, dé seguimiento a sus inquietudes y organice actividades que fortalezcan la formación docente, la convivencia y la responsabilidad social. Promover la participación y el bienestar de la comunidad estudiantil de la ENSFA mediante acciones académicas, recreativas, solidarias y de representación, con mecanismos claros de diálogo, gestión y rendición de cuentas.”

**Propuestas** (la **#7 aún no existe**; no inventarla, se agrega desde el panel):

1. Jornadas de activación física y convivencia — *Promover espacios periódicos de movimiento, recreación y convivencia.*
2. Conferencia mensual para la formación docente y personal — *Complementar la formación profesional y humana de los futuros docentes.*
3. Mesas de diálogo con jefes de grupo y Consejo Estudiantil — *Que los estudiantes puedan estar en comunicación para radicar con problemas e inquietudes generadas.*
4. Academia de representantes de grupo — *Crear un espacio periódico de coordinación con jefes y docentes.*
5. Concientización del cuidado de baños, áreas verdes y espacios comunes — *Fomentar el uso responsable y el cuidado compartido de las instalaciones.*
6. Programa de orientación y acompañamiento estudiantil — *Brindar apoyo y orientación a los estudiantes que enfrenten dificultades académicas o situaciones con docentes, personal administrativo o directivos.*
8. Campañas solidarias — *Fomentar la participación de la comunidad estudiantil en acciones solidarias que beneficien a distintos sectores de la sociedad.*
9. Red de tutorías y asesorías entre estudiantes — *Facilitar apoyo académico voluntario en asignaturas que representen dificultad por parte de los estudiantes a estudiantes.*
10. Buzón digital permanente — *Recibir de manera continua sugerencias, inquietudes y propuestas de los estudiantes.*

**Primera noticia:** “Reto Impacto: Tapitas con Causa” (propuesta #8, Campañas solidarias). Del 27 al 30 de octubre participan todos los grupos de la ENSFA; las tapitas se entregan al **CRIT Aguascalientes (Teletón)**; el grupo que más tapitas reúna gana un premio. Lema: “Pequeñas tapitas, grandes cambios”. Portada: el cartel `docs/referencias/cartel-reto-impacto-tapitas.png` convertido a JPG y subido a GridFS por el seed.

**Ajustes por defecto:** licenciaturas (editables; **confirmar con la ENSFA**): Educación Preescolar, Primaria, Secundaria, Física y Especial; semestres 1–8; grupos A–D; redes vacías.

### 9. Fuera de alcance por ahora

- **Aviso por correo** de mensajes nuevos: el cliente pidió **no incluirlo de momento**. No agregar `nodemailer`, proveedores de correo ni variables relacionadas; los mensajes se consultan solo desde el panel.
- Anti-spam del buzón, límite de intentos de login, registro público y gestión de roles (ver secciones 4 y 5).

### 10. Despliegue (documentar paso a paso en `docs/DOCUMENTACION.md`)

1. **MongoDB Atlas**: cluster, usuario de base de datos, *Network Access* que permita a Render (0.0.0.0/0 en plan gratuito), URI con base `generacion_impacto`.
2. **Render**: Blueprint desde `render.yaml`; definir `MONGODB_URI` y `CORS_ORIGIN` (URL de Vercel); `JWT_SECRET` se genera solo. Nota: el plan gratuito se duerme tras inactividad (primera petición lenta).
3. **Vercel**: importar el repo, Root Directory `frontend`, variable `VITE_API_URL` con la URL de Render.
4. **Datos y primer admin**: desde el equipo del desarrollador, con `MONGODB_URI` de Atlas, ejecutar `npm run seed` y `npm run create-admin`; luego iniciar sesión en `/acceso` y dar de alta al resto del equipo en Panel → Equipo.

### 11. Calidad y entregables

- Código claro, sin dependencias innecesarias, comentarios solo donde expliquen un porqué.
- Probar con una base de datos **aparte** (nunca la de producción, y confirmar por código que el URI apunta a ella antes de ejecutar): login, permisos 401/403, que el registro público y la gestión de roles **no existan** (404), alta/edición/baja de integrantes (cuenta admin creada, correo duplicado 409, no poder borrarse a sí mismo, sesión invalidada al darlo de baja), cambio de contraseña, mensajes anónimos (descartan datos personales) e identificados (validan campos), subida de imágenes (rechaza SVG y > 5 MB), descarga con caché y CRUD de noticias y propuestas. Probar en navegador headless: menú de perfil, diálogo de confirmación, botón de “ojo”, formulario del buzón en ambos modos, ausencia de errores de consola en cada ruta y de desbordamiento horizontal a 390 px; verificar visualmente inicio, buzón y móvil.
- **Revisión final**: ESLint (variables sin uso, reglas de React y hooks), búsqueda de CSS y exports sin uso, `npm audit` sin vulnerabilidades, y cerrar **todos** los procesos de desarrollo (`node --watch` revive al hijo si solo se mata el servidor).
- Crear **`README.md`** (arranque rápido), **`CLAUDE.md`** (reglas del proyecto y la **regla de documentación**), **`docs/DOCUMENTACION.md`** (arquitectura, variables, API, despliegue, registro de cambios) y este **`docs/Prompt Inicial.md`**.
- **Regla de documentación:** tras cada actualización importante, actualizar automáticamente `docs/DOCUMENTACION.md` (incluido su registro de cambios) y, si cambian los requisitos base, este prompt, sin que el usuario lo pida.
- No escribir secretos en archivos versionados ni repetirlos en la conversación.

## FIN DEL PROMPT
