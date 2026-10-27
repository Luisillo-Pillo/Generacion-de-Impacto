# Generación de Impacto

Sitio web de la planilla **Generación de Impacto** para el Consejo Estudiantil de la ENSFA. *Nuestra voz, nuestras ideas, nuestro impacto.*

- `frontend/` — React + Vite (Vercel)
- `backend/` — Express + MongoDB Atlas (Render)
- `docs/` — [Documentación](docs/DOCUMENTACION.md) y [Prompt Inicial](docs/Prompt%20Inicial.md)

## Inicio rápido

```bash
npm install
cp backend/.env.example backend/.env   # completa MONGODB_URI y JWT_SECRET
npm run seed                           # contenido inicial
npm run create-admin                   # primer administrador (no hay registro público)
npm run dev
```

Los demás integrantes se dan de alta en Panel → Equipo (con correo y contraseña) y son administradores. Detalles de despliegue y API en la [documentación](docs/DOCUMENTACION.md).
