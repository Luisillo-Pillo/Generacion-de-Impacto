# Documentación — Generación de Impacto

Sitio web de la planilla **Generación de Impacto** (Consejo Estudiantil de la ENSFA). Para regenerar el proyecto desde cero con una IA, ver [`Prompt Inicial.md`](Prompt%20Inicial.md).

> Este documento se actualiza en cada cambio importante (ver `CLAUDE.md`). El historial está al final.

## 1. Arquitectura

```
Generacion-de-Impacto/
├── frontend/            React 18 + Vite + React Router → Vercel
│   ├── public/brand/    logo-planilla.png, logo-ensfa.png
│   └── src/             App, auth, api, pages/, components/, styles.css
├── backend/             Express 5 + Mongoose → Render
│   ├── src/             index, db (GridFS), auth, models, seed, routes/
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
npm run dev                            # API en :4000, web en :5173 (Vite usa otro puerto si está ocupado)
```

`npm run build` genera `frontend/dist`. En desarrollo Vite redirige `/api` a `localhost:4000`.

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

Colecciones: `users`, `messages`, `news`, `proposals`, `members`, `settings`, más `files.files` / `files.chunks` (GridFS). Detalle de campos en `backend/src/models.js`.

- Un mensaje **anónimo** nunca almacena nombre, licenciatura, semestre ni grupo.
- Las listas de licenciaturas, semestres y grupos del formulario viven en `settings` y se editan desde el panel.

## 5. Autenticación y roles

- Correo + contraseña (bcrypt), JWT de 7 días. El rol se consulta en la BD en cada petición.
- **El primer usuario registrado es admin.** Registro abierto para el resto (rol `user`).
- Los admins dan o quitan el rol desde Panel → Usuarios; no se puede quitar al último admin.

## 6. API

Resumen (detalle de validaciones en `backend/src/routes/`):

- Auth: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `GET /api/auth/users` (admin), `PATCH /api/auth/users/:id/role` (admin).
- Buzón: `POST /api/messages` (público); `GET`, `PATCH /:id`, `DELETE /:id` (admin).
- Archivos: `POST /api/files` (admin, JPG/PNG/WEBP/GIF ≤ 5 MB, sin SVG), `GET /api/files/:id`, `DELETE /api/files/:id` (admin).
- Contenido: `/api/news`, `/api/proposals`, `/api/members` (lectura pública; escritura admin; `/news/all` y `/proposals/all` incluyen no publicados), `GET /api/settings`, `PUT /api/settings/:key` (admin).
- `GET /api/health` para el health check de Render.

## 7. Despliegue

1. **Atlas**: usuario de BD y *Network Access* abierto a Render.
2. **Render** → New → Blueprint con `render.yaml`. Definir `MONGODB_URI` y `CORS_ORIGIN`. Plan gratuito: se duerme por inactividad (primera carga lenta).
3. **Vercel** → importar repo, *Root Directory* `frontend`, variable `VITE_API_URL`.
4. Registrarse en `/acceso` **de inmediato** (primer usuario = admin) y asignar admin a los demás desde el panel.
5. Ejecutar `npm run seed` una vez contra la base de producción.

## 8. Pendientes y decisiones abiertas

- Propuesta **#7**: aún no definida; agregarla desde Panel → Propuestas.
- **Licenciaturas** por defecto son una suposición: confirmarlas con la ENSFA y editarlas en Panel → Ajustes.
- Integrantes del equipo, redes sociales y correo de contacto: capturar desde el panel.
- Buzón **sin protección anti-spam** por decisión del cliente. Si hay abuso, añadir límite por IP y/o Cloudflare Turnstile.
- Registro abierto + “primer usuario = admin”: quien se registre primero tras el despliegue queda como admin.
- Rotar la contraseña de Atlas: la cadena de conexión se compartió en el chat durante el desarrollo.

## 9. Registro de cambios

### 2026-10-26 — Versión inicial (0.1.0)
- Monorepo `frontend/` + `backend/` con npm workspaces; `render.yaml` para Render y `vercel.json` para Vercel.
- Backend: auth con primer usuario admin y gestión de roles; buzón digital (anónimo/identificado); CRUD de noticias, propuestas, equipo y ajustes; imágenes en GridFS; seed con 9 propuestas, ajustes y la noticia “Reto Impacto: Tapitas con Causa”.
- Frontend: Inicio, Propuestas, Noticias (+detalle), Buzón, Equipo, Acceso y Panel admin, con estilo de papel rasgado crema/rojo/negro y logos de la planilla y la ENSFA.
- Verificado: build del frontend, endpoints y permisos del backend en una BD de pruebas (eliminada), sin desbordamiento horizontal a 390 px.
- Documentación inicial: este archivo, `Prompt Inicial.md`, `CLAUDE.md` con la regla de actualización automática.
