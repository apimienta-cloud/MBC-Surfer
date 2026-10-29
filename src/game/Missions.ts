import { config, MissionDef, MissionStat } from '../config';
import type { SaveData } from '../storage/Save';

const M = config.missions;
// Estas se miden por partida (el máximo), las demás se acumulan en el día
const MAX_STATS: MissionStat[] = ['runMeters', 'centenario'];

export interface MissionView {
  id: string;
  text: string;
  progress: number;
  target: number;
  done: boolean;
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Misiones diarias: 3 del pool elegidas según la fecha, progreso guardado en el día. */
export class Missions {
  private list: MissionDef[] = [];

  constructor(private data: SaveData) {
    this.refresh();
  }

  /** Si cambió el día, arranca misiones nuevas. */
  refresh(): void {
    const day = today();
    if (this.data.missions.day !== day) this.data.missions = { day, progress: {}, done: [] };
    // Elección estable por fecha
    let seed = [...day].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
    const pool = [...M.pool];
    this.list = [];
    while (this.list.length < Math.min(M.perDay, M.pool.length)) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      this.list.push(pool.splice(seed % pool.length, 1)[0]);
    }
  }

  view(): MissionView[] {
    const m = this.data.missions;
    return this.list.map((d) => ({
      id: d.id,
      text: d.text.replace('{n}', String(d.target)),
      progress: Math.min(d.target, Math.floor(m.progress[d.id] ?? 0)),
      target: d.target,
      done: m.done.includes(d.id),
    }));
  }

  /**
   * Suma (o toma el máximo, según la estadística) y devuelve los textos de las misiones que se cumplieron.
   * La recompensa se acredita en las fichitas acumuladas.
   */
  track(stat: MissionStat, value: number): string[] {
    const m = this.data.missions;
    const completed: string[] = [];
    for (const d of this.list) {
      if (d.stat !== stat || m.done.includes(d.id)) continue;
      const cur = m.progress[d.id] ?? 0;
      m.progress[d.id] = MAX_STATS.includes(stat) ? Math.max(cur, value) : cur + value;
      if (m.progress[d.id] >= d.target) {
        m.done.push(d.id);
        this.data.coinsTotal += M.reward;
        completed.push(d.text.replace('{n}', String(d.target)));
      }
    }
    return completed;
  }
}
