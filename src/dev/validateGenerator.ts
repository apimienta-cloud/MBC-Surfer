// Chequeo de desarrollo: simula muchas partidas y verifica que siempre exista un camino.
// Uso (con `npm run dev` abierto, en la consola del navegador):
//   const m = await import('/src/dev/validateGenerator.ts'); m.validate(30, 6000)
import { config, laneX } from '../config';
import { Obstacles } from '../world/Obstacles';
import { Collectibles } from '../world/Collectibles';
import { ZoneSystem } from '../world/zones';

const LANES = config.lanes.count;
const HALF = config.player.depth / 2;

/** `tamper` permite romper el generador a propósito para comprobar que el chequeo detecta fallas. */
export function validate(runs = 20, meters = 5000, tamper?: (o: Obstacles) => void): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const coins = new Collectibles();
  const obs = new Obstacles(coins, new ZoneSystem());
  tamper?.(obs);
  const dt = config.physics.fixedDt;
  const SP = config.speed;

  for (let run = 0; run < runs; run++) {
    obs.reset();
    coins.reset();
    let s = 0;
    // Carriles donde la birra puede estar viva; pending = cambio de carril en curso
    let reach = new Set([1]);
    const pending = new Map<number, number>();

    while (s < meters) {
      const speed = SP.max - (SP.max - SP.start) * Math.exp(-s / SP.rampDistance);
      obs.step(dt, s);
      s += speed * dt;
      obs.generate(s + config.world.chunkLength * config.world.chunksAhead, s, speed);

      const wall = (lane: number, at: number): boolean => {
        const x = laneX(lane);
        for (const o of obs.active) {
          const b = o.box;
          if (x < b.minX || x > b.maxX) continue;
          // Bajo y alto se pasan (saltando / rodando). Bloque y bondi son pared (no contamos el techo).
          if (o.kind === 'low' || o.kind === 'high') continue;
          if (at + HALF > b.minS && at - HALF < b.maxS) return true;
        }
        return false;
      };

      const changeSteps = Math.ceil(config.lanes.changeTime / dt);
      const next = new Set<number>();
      for (const l of reach) if (!wall(l, s)) next.add(l);
      // Cambios de carril: el destino tiene que estar libre mientras dura el tween
      for (const [l, left] of [...pending]) {
        if (wall(l, s)) pending.delete(l);
        else if (left <= 1) {
          pending.delete(l);
          next.add(l);
        } else pending.set(l, left - 1);
      }
      for (const l of next)
        for (const n of [l - 1, l + 1])
          if (n >= 0 && n < LANES && !next.has(n) && !pending.has(n) && !wall(n, s)) pending.set(n, changeSteps);
      reach = next;

      if (reach.size === 0 && pending.size === 0) {
        failures.push(`run ${run}: sin camino en s=${s.toFixed(1)}`);
        break;
      }
    }
  }
  const ok = failures.length === 0;
  console.log(ok ? `✓ ${runs} partidas de ${meters} m sin filas imposibles` : failures);
  return { ok, failures };
}
