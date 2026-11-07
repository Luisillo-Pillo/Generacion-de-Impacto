// Panel de mensajes (F2): paginación, búsqueda, contadores, exportación a CSV y notas internas.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.js';
import { csvCell, toCsv } from '../src/csv.js';

let t;
let token;
let mod;

const lista = async (query = '', who = token) => (await t.call('GET', `/messages${query}`, { token: who })).json;

before(async () => {
  t = await startServer();
  await t.createAdmin();
  token = await t.login();
  await t.call('PUT', '/settings/degrees', { token, body: { value: ['Licenciatura en Primaria'] } });
  await t.call('POST', '/members', { token, body: { name: 'Mora', email: 'mod@test.com', password: 'clave-de-moderadora-1', access: 'moderador' } });
  mod = await t.login('mod@test.com', 'clave-de-moderadora-1');

  // 130 mensajes: de 4 tipos, con escalas de tiempo distintas (los más nuevos al final)
  const tipos = ['queja', 'propuesta', 'pregunta', 'problema'];
  const base = Date.now() - 200 * 60 * 1000;
  await t.models.Message.collection.insertMany(
    Array.from({ length: 130 }, (_, i) => ({
      type: tipos[i % 4], anonymous: true, subject: `Asunto número ${i}`, body: i === 7 ? 'El comedor necesita más sillas' : `Cuerpo del mensaje ${i}`,
      status: i < 10 ? 'archivado' : i < 40 ? 'leido' : 'nuevo', review: i % 5 === 0 ? 'completado' : 'pendiente', createdAt: new Date(base + i * 60000), updatedAt: new Date(base + i * 60000),
    }))
  );
});
after(() => t.stop());

test('sin ?page= la lista sigue siendo un arreglo (compatibilidad)', async () => {
  const r = await lista();
  assert.ok(Array.isArray(r));
  assert.equal(r.length, 130);
});

test('con ?page= responde { items, total, page, pages } de 20 en 20, lo más reciente primero', async () => {
  const r = await lista('?page=1');
  assert.deepEqual([r.items.length, r.total, r.page, r.pages], [20, 130, 1, 7]);
  assert.equal(r.items[0].subject, 'Asunto número 129');
  const ultima = await lista('?page=7');
  assert.equal(ultima.items.length, 10);
  assert.equal(ultima.items.at(-1).subject, 'Asunto número 0');
  const vistos = new Set();
  for (let p = 1; p <= 7; p++) for (const m of (await lista(`?page=${p}`)).items) vistos.add(m._id);
  assert.equal(vistos.size, 130, 'ningún mensaje se repite ni se pierde entre páginas');
});

test('limit y page fuera de rango se acomodan (máximo 100 por página)', async () => {
  assert.equal((await lista('?page=1&limit=1000')).items.length, 100);
  assert.equal((await lista('?page=1&limit=5')).items.length, 5);
  assert.equal((await lista('?page=1&limit=abc')).items.length, 20);
  assert.equal((await lista('?page=99')).page, 7, 'una página inexistente cae en la última');
  assert.equal((await lista('?page=-3')).page, 1);
  assert.equal((await lista('?page=abc')).page, 1);
});

test('los filtros se combinan con la paginación', async () => {
  const r = await lista('?page=1&limit=100&status=nuevo&type=queja');
  assert.ok(r.items.length > 0 && r.items.every((m) => m.status === 'nuevo' && m.type === 'queja'));
  assert.equal(r.total, r.items.length);
});

test('búsqueda por palabra en el asunto o en el mensaje, sin importar mayúsculas', async () => {
  const r = await lista('?page=1&q=COMEDOR');
  assert.equal(r.total, 1);
  assert.equal(r.items[0].subject, 'Asunto número 7');
  assert.equal((await lista('?page=1&q=n%C3%BAmero%20129')).total, 1);
  assert.equal((await lista('?page=1&q=no-existe-nada')).total, 0);
  assert.equal((await lista('?page=1&q=sillas', mod)).total, 1, 'el moderador también busca');
});

test('la búsqueda trata lo escrito como texto, nunca como patrón (sin inyección)', async () => {
  for (const q of ['.*', '^Asunto', '(a|b)', '[a-z]+', '\\', '(', '$', 'a{1,2}']) {
    const r = await t.call('GET', `/messages?page=1&q=${encodeURIComponent(q)}`, { token });
    assert.equal(r.status, 200, `q=${q}`);
    assert.equal(r.json.total, 0, `q=${q} no debe coincidir como expresión regular`);
  }
  // También con operadores de MongoDB en la consulta
  const r = await t.call('GET', '/messages?page=1&q[$ne]=x', { token });
  assert.ok(r.status === 200 && r.json.total === 130, 'un objeto en q se ignora');
});

test('contadores: nuevos, pendientes, total y por tipo (sin contar la papelera)', async () => {
  const s = (await t.call('GET', '/messages/stats', { token })).json;
  assert.deepEqual(s.porTipo, { queja: 33, propuesta: 33, pregunta: 32, problema: 32 });
  assert.equal(s.total, 130);
  assert.equal(s.nuevos, 90);
  const [uno] = (await lista('?page=1&limit=1&status=nuevo')).items;
  await t.call('DELETE', `/messages/${uno._id}`, { token });
  const despues = (await t.call('GET', '/messages/stats', { token })).json;
  assert.equal(despues.nuevos, 89);
  assert.equal(despues.total, 129);
  assert.equal((await t.call('GET', '/messages/stats', { token: mod })).status, 200);
  assert.equal((await t.call('GET', '/messages/stats')).status, 401);
});

test('csvCell neutraliza las fórmulas y escapa comillas, comas y saltos de línea', () => {
  for (const peligro of ['=HYPERLINK("http://malo.com","clic")', '+1+1', '-2+3', '@SUM(A1)', '\tcmd', '\rcmd', '=cmd|\' /C calc\'!A0']) {
    assert.ok(csvCell(peligro).startsWith(`"'${peligro[0]}`), peligro);
  }
  assert.equal(csvCell('hola, "mundo"\nlínea 2'), '"hola, ""mundo""\nlínea 2"');
  assert.equal(csvCell(undefined), '""');
  assert.equal(csvCell(5512345678), '"5512345678"');
  assert.equal(csvCell('texto normal'), '"texto normal"');
  assert.equal(toCsv(['a', 'b'], [['1', '2']]), '"a","b"\r\n"1","2"');
});

test('exportar a CSV: solo administradores, con BOM, filtros, fórmulas neutralizadas y queda en la bitácora', async () => {
  await t.call('POST', '/messages', { body: { type: 'queja', anonymous: true, subject: '=HYPERLINK("http://malo.com")', body: '@SUM(1+1) de prueba, con coma' } });
  assert.equal((await t.call('GET', '/messages/export', { token: mod })).status, 403);
  assert.equal((await t.call('GET', '/messages/export')).status, 401);

  const res = await t.call('GET', '/messages/export?q=HYPERLINK', { token });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/csv/);
  assert.ok(res.text.startsWith('﻿"Fecha (UTC)","Tipo"'), 'BOM + encabezados');
  assert.ok(res.text.includes(`"'=HYPERLINK(""http://malo.com"")"`), 'asunto neutralizado');
  assert.ok(res.text.includes(`"'@SUM(1+1) de prueba, con coma"`), 'cuerpo neutralizado y con su coma');
  assert.equal(res.text.trim().split('\r\n').length, 2, 'encabezado + 1 fila (filtró por q)');

  const todos = await t.call('GET', '/messages/export', { token });
  assert.ok(todos.text.trim().split('\r\n').length > 100);
  const log = (await t.call('GET', '/audit', { token })).json.items;
  assert.ok(log.some((e) => e.action === 'mensaje.exportar' && /Exportó 1 mensaje/.test(e.summary)));
});

test('notas internas: el equipo las agrega, quedan con su autor y la bitácora no guarda su texto', async () => {
  const [msg] = (await lista('?page=1&limit=1')).items;
  assert.equal((await t.call('POST', `/messages/${msg._id}/notes`, { token: mod, body: { text: '  Hablé con el director.  ' } })).status, 201);
  const res = await t.call('POST', `/messages/${msg._id}/notes`, { token, body: { text: 'Pendiente de confirmar fecha' } });
  assert.equal(res.json.notes.length, 2);
  assert.deepEqual(res.json.notes.map((n) => [n.authorName, n.text]), [['Mora', 'Hablé con el director.'], ['Ana Prueba', 'Pendiente de confirmar fecha']]);
  assert.ok(res.json.notes.every((n) => n.at));

  assert.equal((await t.call('POST', `/messages/${msg._id}/notes`, { token, body: { text: '   ' } })).status, 400);
  assert.equal((await t.call('POST', `/messages/${msg._id}/notes`, { token, body: { text: 'x'.repeat(1001) } })).status, 400);
  assert.equal((await t.call('POST', `/messages/${msg._id}/notes`, { body: { text: 'hola' } })).status, 401);
  assert.equal((await t.call('POST', '/messages/000000000000000000000000/notes', { token, body: { text: 'hola' } })).status, 404);

  assert.equal((await lista('?page=1&limit=1')).items[0].notes.length, 2, 'se ven en la lista');
  const log = JSON.stringify((await t.call('GET', '/audit', { token })).json.items);
  assert.ok(log.includes('mensaje.nota') && !log.includes('director'));
});
