// Paso 0, método B: Playwright + Chromium sin sesión. Solo lee; guarda evidencia.
// Uso: node scripts/probe-b.mjs [carpeta_evidencia]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL = 'https://open.spotify.com/playlist/4N6J83GtmPhWPCPJPVdEUO';
const out = process.argv[2] || 'evidence/metodo-b';
mkdirSync(out, { recursive: true });

const PATRONES = [/guardada\s+([\d.,\s]+?)\s+veces/i, /saved\s+([\d.,\s]+?)\s+times/i];
const MUROS = /(captcha|are you a robot|verify you are human|unusual traffic|access denied|tráfico inusual)/i;

const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const ctx = await browser.newContext({ locale: 'es-ES', timezoneId: 'Europe/Tallinn' });
const page = await ctx.newPage();
const respuestas = [];
page.on('response', (r) => {
  const u = r.url();
  if (/spotify\.com|spotifycdn|scdn\.co/.test(u) && r.request().resourceType() === 'document' || /pathfinder|api\.spotify|api-partner/.test(u))
    respuestas.push(`${r.status()} ${u.slice(0, 160)}`);
});

let estado;
try {
  const resp = await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  estado = resp ? resp.status() : 'sin respuesta';
} catch (e) {
  estado = `error navegación: ${e.message}`;
}
await page.waitForTimeout(5000);
const texto = await page.evaluate(() => document.body?.innerText || '');
await page.screenshot({ path: `${out}/captura.png`, fullPage: false });
writeFileSync(`${out}/innerText.txt`, texto);

let cifra = null, coincidencia = null;
for (const p of PATRONES) {
  const m = texto.match(p);
  if (m) { coincidencia = m[0]; cifra = Number(m[1].replace(/[.,\s]/g, '')); break; }
}
const informe = {
  leido_el_utc: new Date().toISOString(),
  url_final: page.url(),
  estado_http_documento: estado,
  titulo: await page.title(),
  coincidencia,
  cifra,
  posibles_muros: (texto.match(MUROS) || []).slice(0, 1),
  respuestas_relevantes: respuestas.slice(0, 30),
  inicio_texto: texto.slice(0, 600),
};
writeFileSync(`${out}/informe.json`, JSON.stringify(informe, null, 2));
console.log(JSON.stringify(informe, null, 2));
await browser.close();
process.exit(cifra == null ? 2 : 0);
