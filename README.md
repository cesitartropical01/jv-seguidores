# Seguidores Jingle Vibes

Mide cada día los “seguidores” (= “guardada N veces”) de la playlist
[Christmas Hits & Cozy Classics](https://open.spotify.com/playlist/4N6J83GtmPhWPCPJPVdEUO),
los cruza con un gasto fijo (`src/config.mjs`) y con los streams de la hoja de Google, y lo muestra en `index.html`.

| Pieza | Archivo |
|---|---|
| Lecturas (fuente de verdad) | `data/lecturas.csv` |
| Cálculo (compartido tests + página) | `src/calculo.mjs` |
| Constantes (gasto, moneda, ids) | `src/config.mjs` |
| Lector diario (método B) | `scripts/leer.mjs` |
| Pruebas del paso 0 | `scripts/probe-a.mjs` (API), `scripts/probe-b.mjs` (página) |
| Tests | `test/calculo.test.mjs` → `npm test` |
| Workflow diario 11:53 Tallin | `.github/workflows/lectura-diaria.yml` |
| Workflow paso 0 (manual) | `.github/workflows/paso0.yml` |
| Dashboard | `index.html` |

## Puesta en marcha

1. Crear el repositorio en GitHub y subir esta carpeta.
2. (Opcional, método A) Secretos del repo en *Settings → Secrets and variables → Actions*:
   `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`.
3. *Actions → Paso 0 → Run workflow* y revisar el resumen y el artefacto `evidencia-paso0`.
4. Si el método B funciona en el runner: *Actions → Lectura diaria → Run workflow* para la primera lectura real.
5. Dashboard: *Settings → Pages → Deploy from a branch → main / (root)* (solo repos públicos en GitHub Free).

## Reglas

- Nunca se escribe una fila vacía, estimada o interpolada. Si la lectura falla, el run termina en rojo.
- Una fila por `dia`. `dia` = día natural anterior a la fecha local (Tallin) de `leido_el`.
- Si la cifra es < la mitad o > el doble de la última lectura, no se escribe.
- El dashboard muestra días naturales enteros (00:00–24:00 Tallin). Entre dos lecturas reales se supone
  ritmo constante (media) y se reparte en proporción al tiempo; esos días van marcados con ≈ y rayado.
  El CSV solo guarda lecturas reales; el reparto se calcula al mostrar la página.
