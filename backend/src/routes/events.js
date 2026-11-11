import { Router } from 'express';
import { panelUserOnly } from '../auth.js';
import { openStream } from '../events.js';

// Canal de eventos en vivo del panel (ver events.js). Solo Miembro y Moderador. El navegador lo abre con `fetch` y la cabecera de
// sesión (EventSource no puede mandarla); los avisos no llevan contenido.
const router = Router();

router.get('/', panelUserOnly, (req, res) => openStream(req, res));

export default router;
