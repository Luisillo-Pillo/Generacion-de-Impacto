// Carga contenido inicial (propuestas y la primera noticia). Es idempotente: no duplica nada.
import fs from 'node:fs';
import mongoose from 'mongoose';
import { Readable } from 'node:stream';
import { connectDb, getBucket } from './db.js';
import { News, Proposal, Setting, DEFAULT_SETTINGS } from './models.js';

// La propuesta #7 aún no está definida; se agrega desde el panel cuando exista.
const proposals = [
  [1, 'Jornadas de activación física y convivencia', 'Promover espacios periódicos de movimiento, recreación y convivencia.'],
  [2, 'Conferencia mensual para la formación docente y personal', 'Complementar la formación profesional y humana de los futuros docentes.'],
  [3, 'Mesas de diálogo con jefes de grupo y Consejo Estudiantil', 'Que los estudiantes puedan estar en comunicación para radicar con problemas e inquietudes generadas.'],
  [4, 'Academia de representantes de grupo', 'Crear un espacio periódico de coordinación con jefes y docentes.'],
  [5, 'Concientización del cuidado de baños, áreas verdes y espacios comunes', 'Fomentar el uso responsable y el cuidado compartido de las instalaciones.'],
  [6, 'Programa de orientación y acompañamiento estudiantil', 'Brindar apoyo y orientación a los estudiantes que enfrenten dificultades académicas o situaciones con docentes, personal administrativo o directivos.'],
  [8, 'Campañas solidarias', 'Fomentar la participación de la comunidad estudiantil en acciones solidarias que beneficien a distintos sectores de la sociedad.'],
  [9, 'Red de tutorías y asesorías entre estudiantes', 'Facilitar apoyo académico voluntario en asignaturas que representen dificultad por parte de los estudiantes a estudiantes.'],
  [10, 'Buzón digital permanente', 'Recibir de manera continua sugerencias, inquietudes y propuestas de los estudiantes.'],
];

async function uploadFile(path, filename, contentType) {
  const stream = getBucket().openUploadStream(filename, { metadata: { contentType } });
  await new Promise((resolve, reject) => {
    Readable.from(fs.readFileSync(path)).pipe(stream).on('finish', resolve).on('error', reject);
  });
  return stream.id;
}

await connectDb();

for (const [number, title, objective] of proposals) {
  await Proposal.updateOne({ number }, { $setOnInsert: { number, title, objective } }, { upsert: true });
}

for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
  await Setting.updateOne({ key }, { $setOnInsert: { key, value } }, { upsert: true });
}

if (!(await News.exists({ slug: 'reto-impacto-tapitas-con-causa' }))) {
  const cover = await uploadFile(new URL('../seed/reto-impacto.jpg', import.meta.url), 'reto-impacto.jpg', 'image/jpeg');
  await News.create({
    title: 'Reto Impacto: Tapitas con Causa',
    slug: 'reto-impacto-tapitas-con-causa',
    excerpt: 'Del 27 al 30 de octubre, todos los grupos de la ENSFA juntan tapitas para el CRIT Aguascalientes (Teletón). El grupo que más reúna, gana.',
    body:
      'Propuesta #8: Campañas solidarias.\n\n' +
      'Del 27 al 30 de octubre participan todos los grupos de la ENSFA en el Reto Impacto: Tapitas con Causa. ' +
      'Las tapitas reunidas serán entregadas al CRIT Aguascalientes (Teletón).\n\n' +
      '¡El grupo que más tapitas reúna, gana! Habrá premio para el grupo ganador.\n\n' +
      'Pequeñas tapitas, grandes cambios.',
    coverImage: cover,
    published: true,
    publishedAt: new Date(),
    author: 'Generación de Impacto',
  });
}

console.log('Seed completado');
await mongoose.disconnect();
