// «Mis mensajes en este dispositivo» (frontend/src/myMessages.js): guarda solo en el navegador y tolera que no haya almacenamiento.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { listSaved, saveCode, forgetCode, forgetAll } from '../../frontend/src/myMessages.js';

// localStorage falso con la misma interfaz
let almacen;
let falla;
beforeEach(() => {
  almacen = new Map();
  falla = false;
  globalThis.localStorage = {
    getItem: (k) => { if (falla) throw new Error('bloqueado'); return almacen.has(k) ? almacen.get(k) : null; },
    setItem: (k, v) => { if (falla) throw new Error('bloqueado'); almacen.set(k, v); },
    removeItem: (k) => { if (falla) throw new Error('bloqueado'); almacen.delete(k); },
  };
});

const codigo = (n) => `GI-${String(n).padStart(5, '2')}-ABCDE`;

test('guarda el código con su asunto y lo lista, el más reciente primero', () => {
  saveCode({ code: 'GI-AAAAA-BBBBB', subject: 'Primero' });
  saveCode({ code: 'GI-CCCCC-DDDDD', subject: 'Segundo' });
  assert.deepEqual(listSaved().map((i) => [i.code, i.subject]), [['GI-CCCCC-DDDDD', 'Segundo'], ['GI-AAAAA-BBBBB', 'Primero']]);
  assert.ok(!Number.isNaN(Date.parse(listSaved()[0].savedAt)));
});

test('guardar el mismo código otra vez no lo duplica', () => {
  saveCode({ code: 'GI-AAAAA-BBBBB', subject: 'Uno' });
  saveCode({ code: 'GI-AAAAA-BBBBB', subject: 'Uno otra vez' });
  assert.equal(listSaved().length, 1);
});

test('conserva como máximo los 20 más recientes y recorta asuntos larguísimos', () => {
  for (let i = 0; i < 25; i++) saveCode({ code: codigo(i), subject: 'x'.repeat(500) });
  const lista = listSaved();
  assert.equal(lista.length, 20);
  assert.equal(lista[0].code, codigo(24));
  assert.ok(lista.every((i) => i.subject.length <= 140));
});

test('olvidar uno y olvidar todos', () => {
  saveCode({ code: 'GI-AAAAA-BBBBB', subject: 'A' });
  saveCode({ code: 'GI-CCCCC-DDDDD', subject: 'B' });
  forgetCode('GI-AAAAA-BBBBB');
  assert.deepEqual(listSaved().map((i) => i.code), ['GI-CCCCC-DDDDD']);
  forgetAll();
  assert.deepEqual(listSaved(), []);
});

test('ignora datos dañados o con forma inválida en el almacenamiento (no se rompe nada)', () => {
  almacen.set('gi_mis_mensajes', '{no es json');
  assert.deepEqual(listSaved(), []);
  almacen.set('gi_mis_mensajes', JSON.stringify({ no: 'es lista' }));
  assert.deepEqual(listSaved(), []);
  almacen.set('gi_mis_mensajes', JSON.stringify([{ code: 'GI-AAAAA-BBBBB', subject: 'ok' }, { code: '<script>', subject: 'x' }, null, { subject: 'sin código' }, { code: 5 }]));
  assert.deepEqual(listSaved().map((i) => i.code), ['GI-AAAAA-BBBBB']);
});

test('sin almacenamiento disponible (modo privado o bloqueado) nada falla: simplemente no se recuerda', () => {
  falla = true;
  assert.doesNotThrow(() => saveCode({ code: 'GI-AAAAA-BBBBB', subject: 'A' }));
  assert.doesNotThrow(() => forgetCode('GI-AAAAA-BBBBB'));
  assert.doesNotThrow(() => forgetAll());
  assert.deepEqual(listSaved(), []);
});
