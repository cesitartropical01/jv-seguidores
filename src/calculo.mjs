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
