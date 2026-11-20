// Paso 0, método A: API oficial de Spotify con client credentials.
// Necesita los secretos SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET. Imprime la respuesta literal.
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.argv[2] || 'evidence/metodo-a';
mkdirSync(out, { recursive: true });
const { SPOTIFY_CLIENT_ID: id, SPOTIFY_CLIENT_SECRET: secret } = process.env;
const informe = { leido_el_utc: new Date().toISOString() };
const fin = (codigo) => { writeFileSync(`${out}/informe.json`, JSON.stringify(informe, null, 2)); console.log(JSON.stringify(informe, null, 2)); process.exit(codigo); };
if (!id || !secret) { informe.resultado = 'sin credenciales: faltan los secretos SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET'; fin(3); }
const tok = await fetch('https://accounts.spotify.com/api/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64') },
  body: 'grant_type=client_credentials',
});
const tokBody = await tok.json().catch(() => null);
informe.token_http = tok.status;
if (!tok.ok) { informe.token_error = tokBody; informe.resultado = 'no se obtuvo token'; fin(4); }
const r = await fetch('https://api.spotify.com/v1/playlists/4N6J83GtmPhWPCPJPVdEUO?fields=followers.total,name', {
  headers: { Authorization: `Bearer ${tokBody.access_token}` },
});
informe.playlist_http = r.status;
informe.respuesta_literal = await r.text();
let total = null;
try { total = JSON.parse(informe.respuesta_literal)?.followers?.total ?? null; } catch {}
informe.followers_total = total;
informe.resultado = total == null ? 'la respuesta NO incluye followers.total' : `followers.total = ${total} (falta comparar con "guardada N veces")`;
fin(total == null ? 5 : 0);
