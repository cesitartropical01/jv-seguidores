// Cálculo compartido por los tests (Node) y el dashboard (navegador). Sin dependencias.

export const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

// CSV sencillo con comillas opcionales (suficiente para lecturas.csv y el CSV de gviz).
export function parseCSV(texto) {
  const filas = [];
  let fila = [], campo = '', comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo); filas.push(fila); fila = []; campo = '';
    } else campo += c;
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.filter((f) => f.some((v) => v.trim() !== ''));
}

export function parseLecturas(texto) {
  const [cab, ...filas] = parseCSV(texto);
  const esperada = ['dia', 'leido_el', 'guardados', 'tipo'];
  if (cab.join(',') !== esperada.join(',')) throw new Error(`Cabecera inesperada: ${cab.join(',')}`);
  return filas.map((f, i) => {
    const [dia, leido_el, guardados, tipo] = f;
    const ms = Date.parse(leido_el);
    const n = Number(guardados);
    if (!Number.isFinite(ms)) throw new Error(`Fila ${i + 2}: leido_el inválido "${leido_el}"`);
    if (!Number.isInteger(n)) throw new Error(`Fila ${i + 2}: guardados inválido "${guardados}"`);
    if (!['inicial', 'diaria', 'manual'].includes(tipo)) throw new Error(`Fila ${i + 2}: tipo inválido "${tipo}"`);
    return { dia: dia || null, leido_el, ms, guardados: n, tipo };
  });
}

// Suma un número de días a una fecha YYYY-MM-DD (aritmética de calendario, sin zona).
export function sumarDias(fecha, n) {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Tramos entre lecturas consecutivas (apartado 4 del encargo).
export function calcularTramos(lecturas, gastoDiario) {
  const ord = [...lecturas].sort((a, b) => a.ms - b.ms);
  const tramos = [];
  for (let i = 1; i < ord.length; i++) {
    const antes = ord[i - 1], ahora = ord[i];
    if (!ahora.dia) continue;
    const horas = (ahora.ms - antes.ms) / 3600000;
    const parcial = !antes.dia;
    const n_dias = parcial ? 1 : r2(horas / 24);
    const ganados = ahora.guardados - antes.guardados;
    const gasto = r2(gastoDiario * n_dias);
    const coste_por_guardado = !parcial && ganados > 0 ? r2(gasto / ganados) : null;
    // Días naturales que cierra el tramo: del día siguiente al anterior `dia` hasta ahora.dia.
    const dias = [];
    if (parcial) dias.push(ahora.dia);
    else for (let d = sumarDias(antes.dia, 1); d <= ahora.dia; d = sumarDias(d, 1)) dias.push(d);
    const notas = [];
    if (parcial) notas.push(`día parcial: ${fmtHoras(horas)} desde la lectura inicial`);
    else if (Math.abs(horas - 24) >= 0.05) {
      notas.push(`cubre ${fmtHoras(horas)}`);
      if (horas > 25) notas.push('faltaron lecturas');
    }
    tramos.push({
      dia: ahora.dia, dias, desde: antes.leido_el, hasta: ahora.leido_el,
      horas, n_dias, parcial, guardados: ahora.guardados, ganados, gasto, coste_por_guardado,
      nota: notas.join('; '),
    });
  }
  return tramos;
}

export const fmtHoras = (h) => `${h.toFixed(1).replace('.', ',')} h`;

export const r1 = (x) => Math.round((x + Number.EPSILON) * 10) / 10;

// Desfase (ms) de una zona horaria en un instante dado, vía Intl (funciona en Node y navegador).
function desfaseMs(zona, ms) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: zona, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]),
  );
  return Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000;
}

// Instante (ms) de las 00:00 locales de `fecha` (YYYY-MM-DD) en `zona`.
export function medianoche(fecha, zona) {
  const utc = Date.parse(`${fecha}T00:00:00Z`);
  return utc - desfaseMs(zona, utc - desfaseMs(zona, utc));
}

// Días naturales enteros (00:00–24:00 en `zona`). Entre dos lecturas reales se supone ritmo
// constante (media), así que la cifra a medianoche se reparte en proporción al tiempo.
// Solo se calculan días cuyo final ya está cubierto por una lectura real (nunca se extrapola).
export function calcularDias(lecturas, gastoDiario, zona) {
  const ord = [...lecturas].sort((a, b) => a.ms - b.ms);
  const primera = ord[0], ultima = ord.at(-1);
  const MARGEN = 30 * 60000; // a menos de 30 min de una lectura real se considera lectura directa
  const valorEn = (t) => {
    const i = ord.findIndex((l) => l.ms >= t);
    const b = ord[i];
    if (b.ms === t || i === 0) return { v: b.guardados, a: b, b };
    const a = ord[i - 1];
    return { v: a.guardados + ((b.guardados - a.guardados) * (t - a.ms)) / (b.ms - a.ms), a, b };
  };
  const cerca = (p, t) => Math.min(Math.abs(p.a.ms - t), Math.abs(p.b.ms - t)) <= MARGEN;
  const dias = [];
  for (let d = primera.leido_el.slice(0, 10); ; d = sumarDias(d, 1)) {
    const fin = medianoche(sumarDias(d, 1), zona);
    if (fin > ultima.ms) break;
    const parcial = medianoche(d, zona) < primera.ms;
    const ini = parcial ? primera.ms : medianoche(d, zona);
    const A = valorEn(ini), B = valorEn(fin);
    const ganados = B.v - A.v;
    const media = !(cerca(A, ini) && cerca(B, fin));
    // Lecturas reales en las que se apoya el día (la cercana si está a menos de 30 min).
    const desde = Math.abs(A.b.ms - ini) <= MARGEN ? A.b : A.a;
    const hasta = Math.abs(B.a.ms - fin) <= MARGEN ? B.a : B.b;
    const corta = (iso) => `${+iso.slice(8, 10)}/${+iso.slice(5, 7)} ${iso.slice(11, 16)}`;
    const nota = parcial
      ? 'día parcial: desde la lectura inicial'
      : media ? `media entre lecturas ${corta(desde.leido_el)} y ${corta(hasta.leido_el)}` : '';
    dias.push({
      dia: d, parcial, media,
      guardados_fin: r1(B.v), ganados: r1(ganados), gasto: gastoDiario,
      coste_por_guardado: !parcial && ganados > 0 ? r2(gastoDiario / ganados) : null,
      desde: desde.leido_el, hasta: hasta.leido_el, nota,
    });
  }
  return dias;
}

export function resumen(lecturas, tramos) {
  const ord = [...lecturas].sort((a, b) => a.ms - b.ms);
  const ultima = ord[ord.length - 1];
  const primera = ord[0];
  const gasto_total = r2(tramos.reduce((s, t) => s + t.gasto, 0));
  const completos = tramos.filter((t) => !t.parcial);
  const gasto_completos = r2(completos.reduce((s, t) => s + t.gasto, 0));
  const ganados_completos = completos.reduce((s, t) => s + t.ganados, 0);
  return {
    actuales: ultima.guardados,
    ultima_lectura: ultima.leido_el,
    ultima_ms: ultima.ms,
    ganados_total: ultima.guardados - primera.guardados,
    gasto_total,
    // Coste medio sobre tramos completos (el día parcial inicial no tiene coste por guardado).
    coste_medio: ganados_completos > 0 ? r2(gasto_completos / ganados_completos) : null,
    gasto_completos, ganados_completos,
  };
}

// Streams: CSV de la pestaña (cabecera Fecha, artistas..., Total, Acumulado).
export function parseStreams(texto) {
  const [cab, ...filas] = parseCSV(texto);
  if (cab[0] !== 'Fecha') throw new Error(`Cabecera de streams inesperada: ${cab.join(',')}`);
  const columnas = cab.filter((c) => c !== '');
  return {
    columnas,
    filas: filas
      .filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f[0]))
      .map((f) => Object.fromEntries(columnas.map((c, i) => [c, i === 0 ? f[0] : f[i] === '' ? null : Number(f[i])]))),
  };
}
