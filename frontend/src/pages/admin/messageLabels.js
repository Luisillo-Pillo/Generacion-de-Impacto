// Etiquetas compartidas por la lista de mensajes del panel y sus tarjetas.
export const TYPES = [['', 'Todos'], ['queja', 'Quejas'], ['propuesta', 'Propuestas'], ['pregunta', 'Preguntas'], ['problema', 'Problemas']];
export const STATUS = [['', 'Todos'], ['nuevo', 'Nuevos'], ['leido', 'Leídos'], ['archivado', 'Archivados']];
export const REVIEW = [['pendiente', 'Pendiente'], ['en_proceso', 'En proceso'], ['completado', 'Completado'], ['rechazado', 'Rechazado']];
export const REVIEW_LABEL = Object.fromEntries(REVIEW);
export { URGENCY, URGENCY_LABEL } from '../../urgency.js';
export const TYPE_LABEL = { queja: 'Queja', propuesta: 'Propuesta', pregunta: 'Pregunta', problema: 'Problema' };
