# Documentación — Generación de Impacto

Sitio web de la planilla **Generación de Impacto** (Consejo Estudiantil de la ENSFA). Para regenerar el proyecto desde cero con una IA, ver [`Prompt Inicial.md`](Prompt%20Inicial.md).

> Este documento se actualiza en cada cambio importante (ver `CLAUDE.md`). El historial está al final.

## 1. Arquitectura

```
Generacion-de-Impacto/
├── frontend/            React 18 + Vite + React Router 7 → Vercel
│   ├── public/brand/    logo-planilla.png, logo-ensfa.png   (favicon.png = emblema de la planilla)
│   └── src/             App, auth, api, hooks, utils, pages/, components/, styles.css
├── backend/             Express 5 + Mongoose + Zod 4 → Render
│   ├── src/             index, db (GridFS), auth, models, validators,
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

- Un mensaje **anónimo** nunca almacena nombre, licenciatura, semestre ni grupo.
- Cada **integrante** (`members`) apunta a su cuenta (`users`) mediante `member.user`. La API pública de integrantes nunca devuelve ese campo ni el correo.
- Las listas de licenciaturas, semestres y grupos del formulario viven en `settings` y se editan desde el panel.

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
- Buzón: `POST /api/messages` (público); `GET`, `PATCH /:id`, `DELETE /:id` (admin).
- Integrantes: `GET /api/members` (público, sin correo); `GET /api/members/all`, `POST`, `PUT /:id`, `DELETE /:id` (admin).
- Archivos: `POST /api/files` (admin, JPG/PNG/WEBP/GIF ≤ 5 MB, sin SVG), `GET /api/files/:id`, `DELETE /api/files/:id` (admin).
- Contenido: `/api/news`, `/api/proposals` (lectura pública; escritura admin; `/news/all` y `/proposals/all` incluyen no publicados), `GET /api/settings`, `PUT /api/settings/:key` (admin).
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
- Las páginas comparten un único `<title>`.

## 9. Pendientes y decisiones abiertas

- Propuesta **#7**: aún no definida; agregarla desde Panel → Propuestas.
- **Licenciaturas** por defecto son una suposición: confirmarlas con la ENSFA y editarlas en Panel → Ajustes.
- Integrantes del equipo, redes sociales y correo de contacto: capturar desde el panel.
- **Aviso por correo de mensajes nuevos: aplazado por decisión del cliente** (no hay código ni variables). Si se retoma: Render gratis bloquea SMTP (puertos 25/465/587), así que hay que usar una API HTTPS (p. ej. Brevo, verificando el remitente) o SMTP en hosting de pago; `ensfa.edu.mx` usa Google Workspace (SMTP con contraseña de aplicación entrega mejor). Guardar el mensaje antes de enviar el correo y que un fallo del correo nunca afecte al usuario; el correo no debe incluir datos personales de mensajes anónimos.
- Rotar la contraseña de Atlas: la cadena de conexión se compartió en el chat durante el desarrollo.

## 10. Registro de cambios

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
