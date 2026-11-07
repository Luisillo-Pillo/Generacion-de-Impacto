import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // Roles del sitio (ver auth.js):
    //  admin      = «Técnico»: ve y edita todo.
    //  presidente = «Presidente»: ve todo (datos de contacto incluidos), no edita nada.
    //  miembro    = «Miembro»: edita su propia información y ve la no crítica de los demás integrantes.
    //  moderador  = lee y clasifica mensajes sin ver datos de contacto ni borrar.
    // El valor guardado del Técnico sigue siendo `admin` (así las cuentas existentes no cambian).
    role: { type: String, enum: ['admin', 'presidente', 'miembro', 'moderador', 'user'], default: 'user' },
    // Se suma al cambiar la contraseña o al cerrar sesión en todos los dispositivos: los tokens con otra versión dejan de valer.
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Los datos personales (name, degree, semester, group) solo existen si el mensaje NO es anónimo.
export const MESSAGE_TYPES = ['queja', 'propuesta', 'pregunta', 'problema'];
export const MESSAGE_STATUS = ['nuevo', 'leido', 'archivado'];
// Seguimiento que le da el equipo al mensaje, independiente de si ya se leyó o se archivó
export const MESSAGE_REVIEW = ['pendiente', 'en_proceso', 'completado', 'rechazado'];
// Qué tan pronto necesita atención, según quien escribe (los mensajes anteriores a este campo cuentan como «media»)
export const MESSAGE_URGENCY = ['baja', 'media', 'alta', 'urgente'];

const messageSchema = new Schema(
  {
    type: { type: String, enum: MESSAGE_TYPES, required: true },
    anonymous: { type: Boolean, default: true },
    name: { type: String, trim: true, maxlength: 120 },
    degree: { type: String, trim: true, maxlength: 120 },
    semester: { type: String, trim: true, maxlength: 20 },
    group: { type: String, trim: true, maxlength: 20 }, // solo en licenciaturas con varios grupos
    phone: { type: String, match: /^\d{10}$/ }, // solo mensajes con datos; 10 dígitos sin espacios
    images: [{ type: Schema.Types.ObjectId }], // archivos en GridFS adjuntados por quien escribe
    subject: { type: String, required: true, trim: true, maxlength: 140 },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    status: { type: String, enum: MESSAGE_STATUS, default: 'nuevo' },
    review: { type: String, enum: MESSAGE_REVIEW, default: 'pendiente' },
    urgency: { type: String, enum: MESSAGE_URGENCY, default: 'media' },
    // SHA-256 del código de seguimiento (el código en claro nunca se guarda; ver tracking.js). No sale en las consultas.
    codeHash: { type: String, select: false, index: { unique: true, sparse: true } },
    publicReply: { type: String, trim: true, maxlength: 1000 }, // respuesta del equipo que ve quien escribe con su código
    publicReplyAt: { type: Date },
    // Notas internas del equipo: nunca las ve quien escribió
    notes: [{ authorName: { type: String, maxlength: 80 }, text: { type: String, required: true, maxlength: 1000 }, at: { type: Date, default: Date.now } }],
    consentAt: { type: Date }, // cuándo aceptó el aviso de privacidad (solo mensajes con datos personales)
    deletedAt: { type: Date }, // papelera: se marca al eliminar y se borra de verdad a los 30 días
  },
  { timestamps: true }
);

const newsSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true },
    excerpt: { type: String, trim: true, maxlength: 300, default: '' },
    body: { type: String, required: true, maxlength: 20000 },
    coverImage: { type: Schema.Types.ObjectId }, // _id del archivo en GridFS
    gallery: [{ type: Schema.Types.ObjectId }], // más imágenes bajo el artículo (máximo 6)
    published: { type: Boolean, default: false },
    // Fecha de publicación. Si es futura la noticia está PROGRAMADA: aparece sola al llegar la hora (las consultas públicas
    // filtran `publishedAt <= ahora`, no hace falta ningún proceso programado).
    publishedAt: { type: Date },
    author: { type: String, trim: true, maxlength: 80 },
  },
  { timestamps: true }
);

// Avance público de cada propuesta (rendición de cuentas)
export const PROPOSAL_PROGRESS = ['planeada', 'en_marcha', 'cumplida'];

const proposalSchema = new Schema(
  {
    number: { type: Number, required: true, unique: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    objective: { type: String, required: true, trim: true, maxlength: 600 },
    image: { type: Schema.Types.ObjectId },
    progress: { type: String, enum: PROPOSAL_PROGRESS, default: 'planeada' },
    progressNote: { type: String, trim: true, maxlength: 200, default: '' },
    published: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const memberSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    role: { type: String, trim: true, maxlength: 100, default: '' },
    degree: { type: String, trim: true, maxlength: 120, default: '' },
    photo: { type: Schema.Types.ObjectId },
    order: { type: Number, default: 0 },
    // Cuenta de acceso del integrante (administrador por defecto; puede ser moderador).
    user: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Ajustes editables desde el panel: licenciaturas, grupos, redes, contacto, etc.
const settingSchema = new Schema({
  key: { type: String, required: true, unique: true },
  value: Schema.Types.Mixed,
});

// Bitácora de acciones del panel. Solo ids y tipo de acción: nunca el contenido de los mensajes. Se conserva un año.
const auditSchema = new Schema({
  at: { type: Date, default: Date.now, index: { expireAfterSeconds: 365 * 24 * 60 * 60 } },
  userId: { type: Schema.Types.ObjectId },
  userName: { type: String, maxlength: 80 },
  action: { type: String, required: true, maxlength: 60 },
  entity: { type: String, maxlength: 40 },
  entityId: { type: String, maxlength: 60 },
  summary: { type: String, maxlength: 300 },
});

messageSchema.index({ deletedAt: 1, createdAt: -1 });

export const User = model('User', userSchema);
export const Message = model('Message', messageSchema);
export const News = model('News', newsSchema);
export const Proposal = model('Proposal', proposalSchema);
export const Member = model('Member', memberSchema);
export const Setting = model('Setting', settingSchema);
export const AuditLog = model('AuditLog', auditSchema);

export const DEFAULT_SETTINGS = {
  degrees: [
    'Licenciatura en Educación Preescolar',
    'Licenciatura en Educación Primaria',
    'Licenciatura en Educación Secundaria',
    'Licenciatura en Educación Física',
    'Licenciatura en Educación Especial',
  ],
  groups: ['A', 'B', 'C', 'D'],
  semesters: ['1', '2', '3', '4', '5', '6', '7', '8'],
  social: { instagram: '', email: '' },
};
