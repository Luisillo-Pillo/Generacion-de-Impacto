// Crea una cuenta de administrador con su ficha de integrante (primer admin o rescate).
// Si el correo ya tiene cuenta pero no ficha de integrante, solo crea la ficha y vincula la cuenta.
// Uso interactivo:  npm run create-admin
// Sin preguntas:    ADMIN_NAME="..." ADMIN_EMAIL="..." ADMIN_PASSWORD="..." npm run create-admin
import readline from 'node:readline/promises';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDb } from './db.js';
import { User, Member } from './models.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// Lee sin mostrar lo que se teclea (la contraseña no debe quedar en pantalla).
async function askHidden(question) {
  const realWrite = rl._writeToOutput;
  rl._writeToOutput = (text) => {
    if (text.startsWith(question)) realWrite.call(rl, text);
  };
  const answer = await rl.question(question);
  rl._writeToOutput = realWrite;
  process.stdout.write('\n');
  return answer;
}

const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

const email = (process.env.ADMIN_EMAIL ?? (await rl.question('Correo: '))).trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Correo no válido.');

await connectDb();
const existing = await User.findOne({ email });

if (existing) {
  rl.close();
  if (await Member.exists({ user: existing._id })) fail('Esa cuenta ya es integrante de la planilla.');
  existing.role = 'admin';
  await existing.save();
  await Member.create({ name: existing.name, user: existing._id, order: await Member.estimatedDocumentCount() });
  console.log(`Cuenta existente vinculada como integrante: ${existing.name} <${email}> (la contraseña no se modificó)`);
} else {
  const name = (process.env.ADMIN_NAME ?? (await rl.question('Nombre completo: '))).trim();
  const password = process.env.ADMIN_PASSWORD ?? (await askHidden('Contraseña (mín. 8 caracteres): '));
  rl.close();
  if (name.length < 2) fail('El nombre es muy corto.');
  if (password.length < 8) fail('La contraseña debe tener al menos 8 caracteres.');
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 10), role: 'admin' });
  await Member.create({ name, user: user._id, order: await Member.estimatedDocumentCount() });
  console.log(`Administrador creado: ${name} <${email}>`);
}

await mongoose.disconnect();
