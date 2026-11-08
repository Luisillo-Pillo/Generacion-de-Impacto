// Roles del sitio: solo dos. El valor que guarda la API del Moderador es `admin` (así las cuentas de siempre conservan todo).
// La tabla completa de permisos vive en backend/src/auth.js; aquí solo lo que decide qué muestra el panel.
export const ROLE_LABEL = { admin: 'Moderador', miembro: 'Miembro' };

export const ROLE_HELP = {
  admin: 'puede hacer todo',
  miembro: 'lee, responde y actualiza mensajes, exporta a CSV, publica noticias y propuestas y cambia su estado, y edita su propia información',
};

export const hasPanel = (role) => role in ROLE_LABEL; // quién ve el enlace «Panel»
export const canEdit = (role) => role === 'admin'; // el Moderador: editar a otros, eliminar, ajustes, papelera

// Secciones del panel que ve cada rol (la primera es a la que se llega al entrar)
export const SECTIONS_BY_ROLE = {
  admin: ['mensajes', 'noticias', 'propuestas', 'equipo', 'ajustes'],
  miembro: ['mensajes', 'noticias', 'propuestas', 'equipo'],
};
