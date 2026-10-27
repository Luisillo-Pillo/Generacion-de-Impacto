import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
  },
  { timestamps: true }
);

// Los datos personales (name, degree, semester, group) solo existen si el mensaje NO es anónimo.
const messageSchema = new Schema(
  {
    type: { type: String, enum: ['queja', 'propuesta', 'pregunta', 'problema'], required: true },
    anonymous: { type: Boolean, default: true },
    name: { type: String, trim: true, maxlength: 120 },
    degree: { type: String, trim: true, maxlength: 120 },
    semester: { type: String, trim: true, maxlength: 20 },
    group: { type: String, trim: true, maxlength: 20 },
    subject: { type: String, required: true, trim: true, maxlength: 140 },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    status: { type: String, enum: ['nuevo', 'leido', 'archivado'], default: 'nuevo' },
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
    published: { type: Boolean, default: false },
    publishedAt: { type: Date },
    author: { type: String, trim: true, maxlength: 80 },
  },
  { timestamps: true }
);

const proposalSchema = new Schema(
  {
    number: { type: Number, required: true, unique: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    objective: { type: String, required: true, trim: true, maxlength: 600 },
    image: { type: Schema.Types.ObjectId },
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
    // Cuenta de acceso del integrante; todo integrante con cuenta es administrador.
    user: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Ajustes editables desde el panel: licenciaturas, grupos, redes, contacto, etc.
const settingSchema = new Schema({
  key: { type: String, required: true, unique: true },
  value: Schema.Types.Mixed,
});

export const User = model('User', userSchema);
export const Message = model('Message', messageSchema);
export const News = model('News', newsSchema);
export const Proposal = model('Proposal', proposalSchema);
export const Member = model('Member', memberSchema);
export const Setting = model('Setting', settingSchema);

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
  social: { instagram: '', facebook: '', tiktok: '', email: '' },
};
