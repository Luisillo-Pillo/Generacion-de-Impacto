// Urgencia de un mensaje del buzón, según quien lo escribe (la API acepta estos mismos valores)
export const URGENCY = [['baja', 'Baja'], ['media', 'Media'], ['alta', 'Alta'], ['urgente', 'Urgente']];
export const URGENCY_LABEL = Object.fromEntries(URGENCY);
export const DEFAULT_URGENCY = 'media';
