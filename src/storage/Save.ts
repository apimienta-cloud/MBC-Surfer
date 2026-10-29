// Guardado local. Todo envuelto en try/catch: si localStorage falla, el juego sigue sin guardar.

const KEY = 'escapale-al-lunes:v1';

export interface MissionsSave {
  day: string; // YYYY-MM-DD
  progress: Record<string, number>;
  done: string[];
}

export interface SaveData {
  best: number; // mejor distancia (m)
  bestScore: number;
  coinsTotal: number; // fichitas acumuladas para gastar en skins
  muted: boolean;
  skins: string[]; // skins compradas (la primera es gratis)
  skin: string; // skin elegida
  ageOk: boolean; // respondió que es mayor de 18
  missions: MissionsSave;
}

const DEFAULTS: SaveData = {
  best: 0,
  bestScore: 0,
  coinsTotal: 0,
  muted: false,
  skins: [],
  skin: '',
  ageOk: false,
  missions: { day: '', progress: {}, done: [] },
};

export function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const data = JSON.parse(raw) as Partial<SaveData>;
    return { ...structuredClone(DEFAULTS), ...data };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function save(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // sin guardado, no pasa nada
  }
}
