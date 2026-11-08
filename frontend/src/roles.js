// Roles del sitio. El valor que guarda la API del Técnico es `admin` (así las cuentas existentes no cambian).
// La tabla completa de permisos vive en backend/src/auth.js; aquí solo lo que decide qué muestra el panel.
export const ROLE_LABEL = { admin: 'Técnico', presidente: 'Presidente', miembro: 'Miembro', moderador: 'Moderador' };

export const ROLE_HELP = {
  admin: 've y edita todo',
  presidente: 've todo, no edita',
  miembro: 'edita su información y ve la no crítica del equipo',
  moderador: 'solo lee y clasifica mensajes, sin datos de contacto',
};

export const hasPanel = (role) => role in ROLE_LABEL; // quién ve el enlace «Panel»
export const canEdit = (role) => role === 'admin'; // edita contenido, ajustes y equipo
export const canSeeAll = (role) => role === 'admin' || role === 'presidente'; // datos de contacto, papelera, bitácora, exportación
export const canManageMessages = (role) => role === 'admin' || role === 'moderador'; // estado, revisión, respuesta y notas
export const canReadMessages = (role) => role === 'admin' || role === 'presidente' || role === 'moderador';

// Secciones del panel que ve cada rol (la primera es a la que se llega al entrar)
export const SECTIONS_BY_ROLE = {
  admin: ['mensajes', 'noticias', 'propuestas', 'equipo', 'ajustes'],
  presidente: ['mensajes', 'noticias', 'propuestas', 'equipo', 'ajustes'],
  moderador: ['mensajes'],
  miembro: ['equipo'],
};
