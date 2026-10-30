import { config } from '../config';

// Ranking por usuario de Instagram. Online con Supabase (funciones de supabase/ranking.sql);
// si no está configurado, un ranking local de este dispositivo para que la pantalla funcione igual.

const R = config.ranking;
const LOCAL_KEY = 'escapale-al-lunes:ranking';

export interface RankEntry {
  pos: number;
  handle: string;
  score: number;
  meters: number;
}

export type ClaimResult = 'ok' | 'taken' | 'invalid' | 'error';

export const isOnline = (): boolean => Boolean(R.supabaseUrl && R.supabaseAnonKey);

/** "@Usuario", "instagram.com/usuario/" o " usuario " → "usuario". null si no es un usuario válido de IG. */
export function normalizeHandle(raw: string): string | null {
  let h = raw.trim().toLowerCase();
  const m = h.match(/instagram\.com\/([^/?#]+)/);
  if (m) h = m[1];
  h = h.replace(/^@+/, '');
  return /^[a-z0-9._]{1,30}$/.test(h) && !h.startsWith('.') && !h.endsWith('.') ? h : null;
}

/** Secreto aleatorio del dispositivo (el servidor guarda solo su hash). */
export function newToken(): string {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

async function rpc<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${R.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: R.supabaseAnonKey, Authorization: `Bearer ${R.supabaseAnonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${fn}: ${res.status}`);
  return (await res.json()) as T;
}

// ---------- Ranking local (sin servidor) ----------

type LocalRow = Omit<RankEntry, 'pos'>;

function localRows(): LocalRow[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]') as LocalRow[];
  } catch {
    return [];
  }
}

function localSave(rows: LocalRow[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(rows));
  } catch {
    // sin guardado, no pasa nada
  }
}

const sorted = (rows: LocalRow[]): RankEntry[] => [...rows].sort((a, b) => b.score - a.score).map((r, i) => ({ ...r, pos: i + 1 }));

// ---------- API ----------

/** Reserva el usuario para este dispositivo. Si ya es suyo (mismo token) también da 'ok'. */
export async function claim(handle: string, token: string): Promise<ClaimResult> {
  if (!isOnline()) {
    const rows = localRows();
    if (!rows.some((r) => r.handle === handle)) localSave([...rows, { handle, score: 0, meters: 0 }]);
    return 'ok';
  }
  try {
    return await rpc<ClaimResult>('register_player', { p_handle: handle, p_token: token });
  } catch {
    return 'error';
  }
}

/** Sube un puntaje (el servidor se queda con el mejor). Devuelve el puesto, o null si falló. */
export async function submit(handle: string, token: string, score: number, meters: number): Promise<number | null> {
  if (!isOnline()) {
    const rows = localRows();
    const row = rows.find((r) => r.handle === handle);
    if (row) {
      if (score > row.score) Object.assign(row, { score, meters: Math.floor(meters) });
    } else {
      rows.push({ handle, score, meters: Math.floor(meters) });
    }
    localSave(rows);
    return sorted(rows).find((r) => r.handle === handle)!.pos;
  }
  try {
    const pos = await rpc<number>('submit_score', { p_handle: handle, p_token: token, p_score: Math.floor(score), p_meters: Math.floor(meters) });
    return pos > 0 ? pos : null;
  } catch {
    return null;
  }
}

/** Top N, más la fila del usuario si quedó afuera del top. null si no se pudo cargar. */
export async function top(handle: string): Promise<RankEntry[] | null> {
  if (!isOnline()) {
    const all = sorted(localRows().filter((r) => r.score > 0));
    const list = all.slice(0, R.top);
    const mine = all.find((r) => r.handle === handle);
    if (mine && mine.pos > R.top) list.push(mine);
    return list;
  }
  try {
    return await rpc<RankEntry[]>('get_ranking', { p_limit: R.top, p_handle: handle || null });
  } catch {
    return null;
  }
}
