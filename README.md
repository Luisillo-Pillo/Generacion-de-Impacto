# Generación de Impacto

Sitio web de la planilla **Generación de Impacto** para el Consejo Estudiantil de la ENSFA. *Nuestra voz, nuestras ideas, nuestro impacto.*

- `frontend/` — React + Vite (Vercel)
- `backend/` — Express + MongoDB Atlas (Render)
- `docs/` — [Documentación](docs/DOCUMENTACION.md) y [Prompt Inicial](docs/Prompt%20Inicial.md)

## Inicio rápido

```bash
npm install
cp backend/.env.example backend/.env   # completa MONGODB_URI y JWT_SECRET
npm run seed
npm run dev
```

El primer usuario que se registre en `/acceso` será administrador. Más detalles de despliegue y API en la [documentación](docs/DOCUMENTACION.md).
