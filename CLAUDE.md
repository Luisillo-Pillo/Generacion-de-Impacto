# Generación de Impacto — guía para Claude

Sitio web de la planilla Generación de Impacto (Consejo Estudiantil ENSFA). Monorepo con `frontend/` (React + Vite, Vercel) y `backend/` (Express + MongoDB Atlas, Render).

## Regla de documentación (obligatoria)

Cada vez que hagas una **actualización importante** (nueva funcionalidad, cambio de arquitectura, modelos de datos, endpoints, variables de entorno, despliegue, decisiones de diseño o de producto), actualiza la documentación **en el mismo cambio, sin que el usuario lo pida**:

1. `docs/DOCUMENTACION.md`: ajusta la sección afectada y agrega una entrada al **Registro de cambios** (fecha, qué cambió y por qué).
2. `docs/Prompt Inicial.md`: si el cambio altera los requisitos base (stack, modelos, endpoints, páginas, diseño, reglas de negocio), actualiza el prompt para que siga permitiendo regenerar el sitio desde cero tal como está hoy.

## Reglas del proyecto

- Idioma de la interfaz, textos y mensajes de error: español (México).
- Nunca escribir credenciales en archivos versionados. Los secretos van en `backend/.env` (ignorado por git) y en las variables de entorno de Render/Vercel. Los `.env.example` llevan solo marcadores.
- El primer usuario registrado es administrador; los admins gestionan roles desde el panel. No debe poder quedar el sistema sin administradores.
- Mensajes anónimos del buzón: nunca guardar datos personales (la API los descarta).
- Las imágenes se guardan en MongoDB (GridFS) y se sirven desde `/api/files/:id`. No se aceptan SVG.
- Estilo visual: papel rasgado crema (`#f1e8db`), rojo (`#d4141c`) y negro (`#121212`); tipografías Anton, Poppins y Permanent Marker.

## Comandos

- `npm install` (raíz) · `npm run dev` (backend en :4000 y frontend en :5173) · `npm run build` · `npm run seed`.
