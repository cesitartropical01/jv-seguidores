import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseLecturas, calcularTramos, resumen, parseStreams } from '../src/calculo.mjs';
import { diaDeLectura } from '../scripts/leer.mjs';

// Copia fija de la semilla del encargo: los tests no dependen de las lecturas que se van añadiendo.
const semilla = parseLecturas(readFileSync(new URL('./semilla.csv', import.meta.url), 'utf8'));
const tramos = calcularTramos(semilla, 5);

test('la semilla tiene 8 lecturas y 7 tramos', () => {
  assert.equal(semilla.length, 8);
  assert.equal(tramos.length, 7);
});

test('comprobación del encargo: 18T00:05:06 → 20T11:51:55 = 59,8 h, gasto 12,45, +24', () => {
  const t = tramos.at(-1);
  assert.equal(t.dia, '2026-11-19');
  assert.equal(t.horas.toFixed(1), '59.8');
  assert.equal(t.n_dias, 2.49);
  assert.equal(t.gasto, 12.45);
  assert.equal(t.ganados, 24);
  assert.equal(t.coste_por_guardado, 0.52);
  assert.deepEqual(t.dias, ['2026-11-18', '2026-11-19']);
  assert.match(t.nota, /cubre 59,8 h; faltaron lecturas/);
});

test('primer tramo desde la lectura inicial: día parcial, n_dias 1, sin coste', () => {
  const t = tramos[0];
  assert.equal(t.parcial, true);
  assert.equal(t.n_dias, 1);
  assert.equal(t.gasto, 5);
  assert.equal(t.ganados, 10);
  assert.equal(t.coste_por_guardado, null);
  assert.match(t.nota, /día parcial: 13,1 h/);
});

test('tramos de ~24 h no llevan nota; tramos de 48 h marcan lecturas faltantes', () => {
  for (const t of tramos.slice(1, 4)) assert.equal(t.nota, '', t.dia);
  assert.deepEqual(tramos.map((t) => [t.dia, t.n_dias, t.gasto, t.ganados, t.coste_por_guardado]), [
    ['2026-11-10', 1, 5, 10, null],
    ['2026-11-11', 1, 5, 9, 0.56],
    ['2026-11-12', 1, 5, 6, 0.83],
    ['2026-11-13', 1, 5, 6, 0.83],
    ['2026-11-15', 2, 10, 13, 0.77],
    ['2026-11-17', 2, 10, 17, 0.59],
    ['2026-11-19', 2.49, 12.45, 24, 0.52],
  ]);
  assert.match(tramos[4].nota, /cubre 48,0 h; faltaron lecturas/);
  assert.deepEqual(tramos[4].dias, ['2026-11-14', '2026-11-15']);
});

test('resumen de KPIs', () => {
  const r = resumen(semilla, tramos);
  assert.equal(r.actuales, 489);
  assert.equal(r.ganados_total, 85);
  assert.equal(r.gasto_total, 52.45);
  assert.equal(r.ganados_completos, 75);
  assert.equal(r.coste_medio, 0.63); // 47,45 / 75
});

test('día de la lectura = día natural anterior a la fecha local de Tallin', () => {
  assert.equal(diaDeLectura('2026-11-21T11:53:04+02:00'), '2026-11-20');
  assert.equal(diaDeLectura('2026-11-20T00:05:06+02:00'), '2026-11-19');
  assert.equal(diaDeLectura('2026-12-01T11:53:00+02:00'), '2026-11-30');
});

test('parseStreams lee la cabecera de la pestaña', () => {
  const s = parseStreams('"Fecha","Ruby Candle","Total"\n"2026-11-18","21","67"\n');
  assert.deepEqual(s.columnas, ['Fecha', 'Ruby Candle', 'Total']);
  assert.deepEqual(s.filas, [{ Fecha: '2026-11-18', 'Ruby Candle': 21, Total: 67 }]);
});

test('el CSV real es válido: formato correcto, una fila por día, orden cronológico', () => {
  const reales = parseLecturas(readFileSync(new URL('../data/lecturas.csv', import.meta.url), 'utf8'));
  const dias = reales.filter((l) => l.dia).map((l) => l.dia);
  assert.equal(new Set(dias).size, dias.length, 'hay días repetidos');
  for (let i = 1; i < reales.length; i++) assert.ok(reales[i].ms > reales[i - 1].ms, `fila ${i + 2} fuera de orden`);
  for (const l of reales.filter((x) => x.dia)) assert.equal(diaDeLectura(l.leido_el), l.dia, `dia incoherente en ${l.leido_el}`);
});
