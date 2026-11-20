// Lector diario (método B: página pública con Chromium sin sesión).
// Nunca escribe una fila vacía ni estimada: si algo falla, sale con código ≠ 0 y el motivo.
// Uso: node scripts/leer.mjs [--tipo diaria|manual] [--evidencia carpeta]
import { execFileSync } from 'node:child_process';
import { readFileSync, appendFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseLecturas, sumarDias } from '../src/calculo.mjs';
import { PLAYLIST_URL, ZONA } from '../src/config.mjs';

const CSV = fileURLToPath(new URL('../data/lecturas.csv', import.meta.url));
const PATRONES = [/guardada\s+([\d.,   ]+?)\s+veces/i, /saved\s+([\d.,   ]+?)\s+times/i];
const SENALES_BLOQUEO = /(captcha|are you a robot|verify you are human|unusual traffic|access denied|tráfico inusual)/i;

// leido_el está en hora local de Tallin (con offset); el día que cierra es el natural anterior.
export const diaDeLectura = (leidoEl) => sumarDias(leidoEl.slice(0, 10), -1);

const ahoraTallin = () => execFileSync('date', ['-Iseconds'], { env: { ...process.env, TZ: ZONA } }).toString().trim();

async function intentoLectura(n, carpeta) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
  try {
    const ctx = await browser.newContext({ locale: 'es-ES', timezoneId: ZONA });
    const page = await ctx.newPage();
    const resp = await page.goto(PLAYLIST_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(5000);
    const texto = await page.evaluate(() => document.body?.innerText || '');
    writeFileSync(`${carpeta}/intento-${n}-innerText.txt`, texto);
    await page.screenshot({ path: `${carpeta}/intento-${n}.png` }).catch(() => {});
    for (const p of PATRONES) {
      const m = texto.match(p);
      if (m) {
        const cifra = Number(m[1].replace(/[^\d]/g, ''));
        if (Number.isInteger(cifra)) return { cifra, literal: m[0], http: resp?.status(), url: page.url() };
      }
    }
    const bloqueo = texto.match(SENALES_BLOQUEO);
    throw new Error(
      `no aparece "guardada N veces" (HTTP ${resp?.status()}, url ${page.url()}` +
        (bloqueo ? `, posible bloqueo: "${bloqueo[0]}"` : '') + ')',
    );
  } finally {
    await browser.close();
  }
}

function fallo(motivo) {
  console.error(`ERROR: ${motivo}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### ❌ Lectura fallida\n\n${motivo}\n`);
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const tipo = args.includes('--tipo') ? args[args.indexOf('--tipo') + 1] : 'diaria';
  const carpeta = args.includes('--evidencia') ? args[args.indexOf('--evidencia') + 1] : 'evidencia-run';
  mkdirSync(carpeta, { recursive: true });

  const lecturas = parseLecturas(readFileSync(CSV, 'utf8'));
  const ultima = [...lecturas].sort((a, b) => a.ms - b.ms).at(-1);

  let lectura, leidoEl;
  const errores = [];
  for (let n = 1; n <= 3 && !lectura; n++) {
    try {
      lectura = await intentoLectura(n, carpeta);
      leidoEl = ahoraTallin(); // hora real, tomada justo tras leer la cifra
    } catch (e) {
      errores.push(`intento ${n}: ${e.message}`);
      console.error(errores.at(-1));
      if (n < 3) await new Promise((r) => setTimeout(r, 20000));
    }
  }
  if (!lectura) fallo(`no se pudo leer la cifra tras 3 intentos.\n${errores.join('\n')}`);

  const dia = diaDeLectura(leidoEl);
  console.log(`Leído: "${lectura.literal}" → ${lectura.cifra} a las ${leidoEl} (cierra ${dia})`);

  if (lectura.cifra < ultima.guardados / 2 || lectura.cifra > ultima.guardados * 2)
    fallo(`cifra ${lectura.cifra} fuera de rango respecto a la última lectura (${ultima.guardados} el ${ultima.leido_el}). No se escribe.`);

  if (lecturas.some((l) => l.dia === dia)) {
    console.log(`Ya existe una fila para ${dia}; no se añade otra.`);
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Ya existía fila para ${dia}; leído ${lectura.cifra}, no se añade.\n`);
    return;
  }

  const texto = readFileSync(CSV, 'utf8');
  appendFileSync(CSV, `${texto.endsWith('\n') ? '' : '\n'}${dia},${leidoEl},${lectura.cifra},${tipo}\n`);
  console.log(`Fila añadida: ${dia},${leidoEl},${lectura.cifra},${tipo}`);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `### ✅ Lectura\n\n| dia | leido_el | guardados | literal |\n|---|---|---|---|\n| ${dia} | ${leidoEl} | ${lectura.cifra} | ${lectura.literal} |\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
