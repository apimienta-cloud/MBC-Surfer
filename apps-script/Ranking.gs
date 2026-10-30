/**
 * Ranking de "Escapale al Lunes" en Google Sheets.
 *
 * Instalación: en la planilla, Extensiones → Apps Script, pegar este archivo y
 * Implementar → Nueva implementación → Aplicación web (ejecutar como: yo, acceso: cualquier usuario).
 * La URL que termina en /exec va en config.ranking.endpoint del juego.
 *
 * Hojas:
 *   - "Jugadores": una fila por usuario de Instagram (la escribe el script; se puede borrar una fila para liberar un usuario).
 *   - "Top": el ranking ordenado, para mirarlo o exportarlo (es una fórmula, no se edita).
 */

const SHEET = 'Jugadores';
const TOP_SHEET = 'Top';
const HEAD = ['usuario', 'puntaje', 'metros', 'actualizado', 'creado', 'token_hash'];
const CACHE_KEY = 'top200';
const CACHE_SECONDS = 20;
const HANDLE = /^[a-z0-9._]{1,30}$/;

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ error: 'bad_json' });
  }
  switch (body.action) {
    case 'top':
      return json({ list: top(Number(body.limit) || 50, String(body.handle || '')) });
    case 'claim':
      return json({ result: claim(String(body.handle || ''), String(body.token || '')) });
    case 'submit':
      return json({ pos: submit(String(body.handle || ''), String(body.token || ''), Number(body.score), Number(body.meters)) });
    default:
      return json({ error: 'unknown_action' });
  }
}

function doGet() {
  return json({ ok: true, game: 'Escapale al Lunes' });
}

/** Anota un usuario para un dispositivo: 'ok' (nuevo o ya era suyo), 'taken' o 'invalid'. */
function claim(handle, token) {
  if (!validHandle(handle) || token.length < 32) return 'invalid';
  const th = hash(token);
  return withLock(() => {
    const sh = sheet();
    const i = findRow(sh, handle);
    if (i < 0) {
      const now = new Date();
      sh.appendRow([handle, 0, 0, now, now, th]);
      return 'ok';
    }
    return sh.getRange(i, 6).getValue() === th ? 'ok' : 'taken';
  });
}

/** Guarda el puntaje si mejora el anterior y devuelve el puesto; -1 si el token no corresponde o no es creíble. */
function submit(handle, token, score, meters) {
  if (!validHandle(handle) || !isFinite(score) || !isFinite(meters)) return -1;
  score = Math.floor(score);
  meters = Math.floor(meters);
  // Puntaje = metros × multiplicador (x2 como máximo) + fichitas: no puede pasar de ~3 por metro
  if (score < 0 || meters < 0 || meters > 200000 || score > meters * 3 + 200) return -1;
  const th = hash(token);
  return withLock(() => {
    const sh = sheet();
    const i = findRow(sh, handle);
    if (i < 0) return -1;
    const row = sh.getRange(i, 1, 1, 6).getValues()[0];
    if (row[5] !== th) return -1;
    let best = Number(row[1]) || 0;
    if (score > best) {
      sh.getRange(i, 2, 1, 3).setValues([[score, meters, new Date()]]);
      best = score;
      CacheService.getScriptCache().remove(CACHE_KEY);
    }
    let pos = 1;
    for (const r of rows(sh)) if (Number(r[1]) > best) pos++;
    return pos;
  });
}

/** Top N (máximo 200) y, si quedó afuera, la fila del usuario pedido. */
function top(limit, handle) {
  limit = Math.max(1, Math.min(200, limit));
  const cache = CacheService.getScriptCache();
  let ranked = null;
  const hit = cache.get(CACHE_KEY);
  if (hit) ranked = JSON.parse(hit);
  if (!ranked) {
    ranked = rankAll(rows(sheet())).slice(0, 200);
    cache.put(CACHE_KEY, JSON.stringify(ranked), CACHE_SECONDS);
  }
  const list = ranked.slice(0, limit);
  if (handle && !list.some((r) => r.handle === handle)) {
    const mine = rankAll(rows(sheet())).find((r) => r.handle === handle);
    if (mine) list.push(mine);
  }
  return list;
}

// ---------- Ayudantes ----------

function rankAll(data) {
  const list = data
    .filter((r) => Number(r[1]) > 0)
    .map((r) => ({ handle: String(r[0]), score: Number(r[1]), meters: Number(r[2]), t: new Date(r[3]).getTime() || 0 }))
    .sort((a, b) => b.score - a.score || a.t - b.t);
  let pos = 0;
  return list.map((r, i) => {
    if (i === 0 || r.score < list[i - 1].score) pos = i + 1;
    return { pos: pos, handle: r.handle, score: r.score, meters: r.meters };
  });
}

function sheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange('A:A').setNumberFormat('@'); // usuarios como "1234" quedan como texto
    sh.hideColumns(6);
  }
  if (!ss.getSheetByName(TOP_SHEET)) {
    const t = ss.insertSheet(TOP_SHEET, 0);
    // El separador de argumentos depende del idioma de la planilla (";" en español, "," en inglés)
    const cell = t.getRange('A1');
    for (const sep of [';', ',']) {
      cell.setFormula('=QUERY(' + SHEET + '!A:C' + sep + ' "select A, B, C where B > 0 order by B desc"' + sep + ' 1)');
      SpreadsheetApp.flush();
      if (cell.getDisplayValue().indexOf('#ERROR') !== 0) break;
    }
    t.setFrozenRows(1);
  }
  return sh;
}

function rows(sh) {
  const n = sh.getLastRow() - 1;
  return n > 0 ? sh.getRange(2, 1, n, 6).getValues() : [];
}

/** Número de fila (1-based) del usuario, o -1. */
function findRow(sh, handle) {
  const data = rows(sh);
  for (let i = 0; i < data.length; i++) if (String(data[i][0]) === handle) return i + 2;
  return -1;
}

function validHandle(h) {
  return HANDLE.test(h) && h[0] !== '.' && h[h.length - 1] !== '.';
}

function hash(t) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, t)
    .map((b) => ((b + 256) % 256).toString(16).padStart(2, '0'))
    .join('');
}

function withLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Correr una vez desde el editor para crear las hojas y autorizar el script. */
function setup() {
  sheet();
}
