import { Router } from 'express';
import { AuditLog } from '../models.js';
import { adminOnly } from '../auth.js';

const router = Router();
const PAGE_SIZE = 50;

// Bitácora de acciones del panel (solo lectura), de la más reciente a la más antigua.
router.get('/', adminOnly, async (req, res) => {
  const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
  const [items, total] = await Promise.all([
    AuditLog.find().sort({ at: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE),
    AuditLog.countDocuments(),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) });
});

export default router;
