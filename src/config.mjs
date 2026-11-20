// Constantes del proyecto. GASTO_DIARIO NO se lee de Meta: es un valor fijo.
// MONEDA pendiente de confirmar (€ o $).
export const GASTO_DIARIO = 5;
export const MONEDA = '€';
export const ZONA = 'Europe/Tallinn';
export const PLAYLIST_ID = '4N6J83GtmPhWPCPJPVdEUO';
export const PLAYLIST_URL = `https://open.spotify.com/playlist/${PLAYLIST_ID}`;
export const HOJA_ID = '1hKnoBj_CqKK81hRGxa-GLR-LvOtDDrgjDT3y3gSzzUg';
export const HOJA_PESTANA = 'Diario JV Navidad';
// Lectura anónima vía gviz: solo funciona mientras la hoja esté compartida "cualquiera con el enlace".
export const HOJA_CSV_URL =
  `https://docs.google.com/spreadsheets/d/${HOJA_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(HOJA_PESTANA)}&range=A2:J`;
