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
  ig: string; // usuario de Instagram con el que se anotó en el ranking ('' = no se anotó)
  rankToken: string; // secreto de este dispositivo: solo él puede subir puntajes con ese usuario
  rankSent: number; // mejor puntaje ya subido al ranking
  rankMeters: number; // metros de la partida del mejor puntaje
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
  ig: '',
  rankToken: '',
  rankSent: 0,
  rankMeters: 0,
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
