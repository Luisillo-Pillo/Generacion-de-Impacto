import { AuditLog } from './models.js';

// Registra una acción del panel en la bitácora. Es de mejor esfuerzo: si falla, se avisa en el registro del servidor
// pero la acción del usuario no se cancela. `summary` nunca debe llevar el contenido de un mensaje.
export async function audit(req, action, entity, entityId, summary = '') {
  try {
    await AuditLog.create({
      userId: req?.user?._id,
      userName: req?.user?.name,
      action,
      entity,
      entityId: entityId ? String(entityId) : undefined,
      summary: summary.slice(0, 300),
    });
  } catch (err) {
    console.error('No se pudo registrar en la bitácora:', err.message);
  }
}
