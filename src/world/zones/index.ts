import { config, ObstacleKind, ObstacleVariant, ZoneId } from '../../config';
import type { ZoneDef } from './Zone';
import { CiudadVieja } from './CiudadVieja';
import { Rambla } from './Rambla';
import { Pocitos } from './Pocitos';
import { Centro } from './Centro';
import { TresCruces } from './TresCruces';
import { Puerto } from './Puerto';
import { TristanNarvaja } from './TristanNarvaja';

const ZONES: Record<ZoneId, ZoneDef> = {
  ciudadVieja: CiudadVieja,
  rambla: Rambla,
  pocitos: Pocitos,
  centro: Centro,
  tresCruces: TresCruces,
  puerto: Puerto,
  tristanNarvaja: TristanNarvaja,
};

export interface ChunkInfo {
  zone: ZoneDef;
  next: ZoneDef;
  local: number;
  transition: boolean; // chunk de transición entre `zone` y `next`
}

/**
 * Qué zona hay en cada lugar. Cada zona ocupa `zoneChunks` chunks y después viene uno de transición.
 * El orden de config.zones.order rota y se repite.
 */
export class ZoneSystem {
  readonly L = config.world.chunkLength;
  readonly zoneChunks = Math.max(2, Math.round(config.zones.lengthMeters / this.L));
  private readonly cycle = this.zoneChunks + 1;
  private readonly order = config.zones.order.map((id) => ZONES[id]);

  chunkInfo(k: number): ChunkInfo {
    const kk = Math.max(0, k);
    const zi = Math.floor(kk / this.cycle);
    const local = kk % this.cycle;
    return {
      zone: this.order[zi % this.order.length],
      next: this.order[(zi + 1) % this.order.length],
      local,
      transition: local === this.zoneChunks,
    };
  }

  zoneAt(s: number): ZoneDef {
    return this.chunkInfo(Math.floor(s / this.L)).zone;
  }

  /** Para el cielo: zona actual, siguiente y cuánto avanzó la transición (0..1). */
  blendAt(s: number): { a: ZoneDef; b: ZoneDef; t: number } {
    const k = Math.floor(s / this.L);
    const info = this.chunkInfo(k);
    if (!info.transition) return { a: info.zone, b: info.zone, t: 0 };
    const t = (s - k * this.L) / this.L;
    return { a: info.zone, b: info.next, t: t * t * (3 - 2 * t) };
  }

  /** Pesos de obstáculos con los ajustes de la zona. */
  weightsAt(s: number): Record<ObstacleKind, number> {
    const z = config.zones.obstacles[this.zoneAt(s).id];
    return { ...config.obstacles.weights, ...z.weights };
  }

  /** Variante visual para un obstáculo en esa posición. */
  variantAt(kind: ObstacleKind, s: number, r: number): ObstacleVariant {
    if (kind === 'bondi') return 'bondi';
    const list = config.zones.obstacles[this.zoneAt(s).id].variants[kind];
    return list[Math.floor(r * list.length) % list.length];
  }

  get all(): ZoneDef[] {
    return this.order;
  }
}
