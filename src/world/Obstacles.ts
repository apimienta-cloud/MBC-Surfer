import * as THREE from 'three';
import { config, laneX, ObstacleKind, ObstacleVariant } from '../config';
import { Box, HitResult, intersects, makeBox, overlap } from '../game/Collision';
import type { Player } from '../game/Player';
import type { Collectibles } from './Collectibles';
import type { ZoneSystem } from './zones';
import { buildObstacleModel, buildRamp, obstacleExtras } from './ObstacleModels';
import { kitMaterial } from './landmarks/kit';

const O = config.obstacles;
const B = O.bondi;
const LANES = config.lanes.count;

export interface Obstacle {
  kind: ObstacleKind;
  /** Clave del pool: variante visual (y livery para los bondis). */
  key: string;
  lane: number;
  box: Box;
  prevBox: Box;
  ramp: boolean; // solo bondis: rampa adelante para subirse al techo
  moving: boolean; // solo bondis: viene de frente
  hit: boolean; // ya causó un tropiezo, se ignora
  bob: boolean; // gaviotas: suben y bajan
  mesh: THREE.Object3D;
  rampMesh: THREE.Mesh | null;
}

/** Tipo de celda en una fila: null = carril libre. */
type Cell = ObstacleKind | null;

/** Intervalo en s donde un carril está ocupado por un bondi (cuerpo + rampa). */
interface Busy {
  from: number;
  to: number;
  ramp: boolean;
}

/** Se puede pasar por este carril sin cambiarse (saltando, rodando o derecho). */
function passable(c: Cell): boolean {
  return c === null || c === 'low' || c === 'high';
}

export class Obstacles {
  readonly group = new THREE.Group();
  readonly active: Obstacle[] = [];
  private pool = new Map<string, Obstacle[]>();
  private geos = new Map<string, THREE.BufferGeometry>();
  private rampGeo = buildRamp();

  // Estado del generador
  private nextRowS = 0;
  private prevRowS = 0;
  private reach = new Set<number>();
  private busy: (Busy | null)[] = [];
  private coinLane = 1;
  private nextPowerS = 0;
  /** Lo llama el generador cuando toca poner un power-up (carril alcanzable y libre). */
  powerSpawner: ((lane: number, s: number) => void) | null = null;
  /** Obstáculo del último choque (para que el escudo lo pueda anular). */
  lastHit: Obstacle | null = null;

  constructor(
    private coins: Collectibles,
    private zones: ZoneSystem,
  ) {
    this.reset();
  }

  reset(): void {
    while (this.active.length) this.release(this.active.pop()!);
    this.nextRowS = config.world.spawnStart;
    this.prevRowS = 0;
    this.reach = new Set([0, 1, 2].filter((l) => l < LANES));
    this.busy = new Array(LANES).fill(null);
    this.coinLane = Math.floor(LANES / 2);
    this.nextPowerS = config.powerups.firstAt;
    this.lastHit = null;
  }

  // ---------- Pooling ----------

  private geoFor(variant: ObstacleVariant, livery: number): THREE.BufferGeometry {
    const key = `${variant}:${livery}`;
    let g = this.geos.get(key);
    if (!g) {
      g = buildObstacleModel(variant, livery);
      this.geos.set(key, g);
    }
    return g;
  }

  private acquire(kind: ObstacleKind, variant: ObstacleVariant, livery: number): Obstacle {
    const key = `${variant}:${livery}`;
    let o = this.pool.get(key)?.pop();
    if (!o) {
      const mesh = new THREE.Mesh(this.geoFor(variant, livery), kitMaterial);
      const extras = obstacleExtras(variant);
      if (extras) mesh.add(extras);
      this.group.add(mesh);
      let rampMesh: THREE.Mesh | null = null;
      if (kind === 'bondi') {
        rampMesh = new THREE.Mesh(this.rampGeo, kitMaterial);
        this.group.add(rampMesh);
      }
      o = { kind, key, lane: 0, box: makeBox(), prevBox: makeBox(), ramp: false, moving: false, hit: false, bob: variant === 'gaviotas', mesh, rampMesh };
    }
    o.mesh.visible = true;
    o.hit = false;
    this.active.push(o);
    return o;
  }

  private release(o: Obstacle): void {
    o.mesh.visible = false;
    if (o.rampMesh) o.rampMesh.visible = false;
    let list = this.pool.get(o.key);
    if (!list) this.pool.set(o.key, (list = []));
    list.push(o);
  }

  place(kind: ObstacleKind, lane: number, s: number, opts: { ramp?: boolean; moving?: boolean } = {}): Obstacle {
    // La variante visual depende de la zona (contenedor en Ciudad Vieja, gaviotas en la Rambla...)
    const variant = this.zones.variantAt(kind, s, Math.random());
    const livery = kind === 'bondi' ? Math.floor(Math.random() * config.colors.bondiLiveries.length) : 0;
    const o = this.acquire(kind, variant, livery);
    o.lane = lane;
    o.ramp = !!opts.ramp;
    o.moving = !!opts.moving;
    const x = laneX(lane);
    const b = o.box;
    o.mesh.rotation.y = 0;
    switch (kind) {
      case 'low':
        setBox(b, x, O.low.width, 0, O.low.height, s, O.low.depth);
        break;
      case 'high':
        setBox(b, x, O.high.width, O.high.bottom, O.high.height, s, O.high.depth);
        break;
      case 'block':
        setBox(b, x, O.block.width, 0, O.block.height, s, O.block.depth);
        break;
      case 'bondi': {
        // s es el frente del conjunto; si tiene rampa, el cuerpo arranca después
        const bodyStart = s + (o.ramp ? B.rampLength : 0);
        setBox(b, x, B.width, 0, B.height, bodyStart + B.length / 2, B.length);
        if (o.rampMesh) o.rampMesh.visible = o.ramp;
        // El que viene de frente muestra la trompa; el estacionado, la cola
        o.mesh.rotation.y = o.moving ? 0 : Math.PI;
        break;
      }
    }
    Object.assign(o.prevBox, b);
    this.syncMesh(o);
    return o;
  }

  private syncMesh(o: Obstacle): void {
    const b = o.box;
    o.mesh.position.set((b.minX + b.maxX) / 2, 0, -(b.minS + b.maxS) / 2);
    if (o.rampMesh && o.ramp) o.rampMesh.position.set(o.mesh.position.x, 0, -(b.minS - B.rampLength));
  }

  // ---------- Generación ----------

  /** Genera filas hasta `untilS`, garantizando siempre un camino posible. */
  generate(untilS: number, distance: number, speed: number): void {
    while (this.nextRowS < untilS) {
      this.generateRow(this.nextRowS, distance, speed);
      const d = Math.min(1, distance / O.difficultyDistance);
      const gapTime = O.rowGapTimeStart + (O.rowGapTimeMin - O.rowGapTimeStart) * d;
      this.prevRowS = this.nextRowS;
      this.nextRowS += Math.max(O.rowGapMinMeters, speed * gapTime) * (0.9 + Math.random() * 0.3);
    }
  }

  private isBusyAt(lane: number, s: number): boolean {
    const b = this.busy[lane];
    return !!b && s >= b.from && s <= b.to;
  }

  private generateRow(s: number, distance: number, speed: number): void {
    const prev = this.prevRowS;
    // Metros mínimos para poder meterse en un carril (reacción + tween)
    const minMove = Math.max(3, speed * 0.35);

    // 1) Carriles donde se puede llegar vivo antes de esta fila (expandiendo el alcance)
    const enterable = (l: number): boolean => {
      const b = this.busy[l];
      if (!b || b.from > s) return true;
      return s - Math.max(prev, b.to) >= minMove;
    };
    const expanded = new Set<number>();
    const stack = [...this.reach];
    // Quien venía por el techo de un bondi con rampa cae en ese carril al terminar
    for (let l = 0; l < LANES; l++) {
      const b = this.busy[l];
      if (b && b.ramp && b.to <= s - minMove && b.to > prev - B.length) stack.push(l);
    }
    while (stack.length) {
      const l = stack.pop()!;
      if (expanded.has(l) || !enterable(l)) continue;
      expanded.add(l);
      if (l > 0) stack.push(l - 1);
      if (l < LANES - 1) stack.push(l + 1);
    }

    // 2) Fila aleatoria según dificultad
    const d = Math.min(1, distance / O.difficultyDistance);
    const fill = O.fillChanceStart + (O.fillChanceMax - O.fillChanceStart) * d;
    const weights = this.zones.weightsAt(s);
    const row: Cell[] = new Array(LANES).fill(null);
    const blockedByBusy: boolean[] = [];
    for (let l = 0; l < LANES; l++) {
      blockedByBusy[l] = this.isBusyAt(l, s) || this.isBusyAt(l, s + 2);
      if (blockedByBusy[l]) continue;
      if (Math.random() < fill) row[l] = pickWeighted(weights);
    }

    // 3) Validación: cada grupo conectado de carriles alcanzables necesita un carril pasable
    for (const comp of components(expanded)) {
      const ok = comp.some((l) => !blockedByBusy[l] && passable(row[l]));
      if (ok) continue;
      const candidates = comp.filter((l) => !blockedByBusy[l]);
      // Siempre hay candidatos: los carriles alcanzables no están ocupados en la fila
      const l = candidates[Math.floor(Math.random() * candidates.length)] ?? comp[0];
      row[l] = Math.random() < 0.5 ? null : Math.random() < 0.5 ? 'low' : 'high';
    }

    // 4) Instanciar obstáculos
    for (let l = 0; l < LANES; l++) {
      const c = row[l];
      if (!c || blockedByBusy[l]) continue;
      if (c === 'bondi') this.placeBondi(l, s, speed);
      else this.place(c, l, s);
    }

    // 5) Nuevo alcance = alcanzables que se pueden pasar en esta fila
    const next = new Set<number>();
    for (const l of expanded) if (!blockedByBusy[l] && passable(row[l])) next.add(l);
    this.reach = next;

    // 6) Fichitas: una línea por el carril "guía" con arcos sobre obstáculos bajos
    this.placeCoins(prev, s, row, next);

    // 7) Power-up entre esta fila y la anterior, en un carril alcanzable
    if (this.powerSpawner && s >= this.nextPowerS && next.size) {
      const sp = (prev + s) / 2;
      const lanes = [...next].filter((l) => !this.isBusyAt(l, sp));
      if (lanes.length && sp > prev + 3) {
        this.powerSpawner(lanes[Math.floor(Math.random() * lanes.length)], sp);
        const PU = config.powerups;
        this.nextPowerS = s + PU.spacingMin + Math.random() * (PU.spacingMax - PU.spacingMin);
      }
    }
  }

  private placeBondi(lane: number, s: number, speed: number): void {
    const ramp = Math.random() < B.rampChance;
    const moving = Math.random() < B.movingChance;
    // Si viene de frente lo ubicamos más adelante: lo que recorra hasta cruzarse con la birra
    // (calculado con la velocidad actual, que es la mínima de acá en adelante) cae dentro del intervalo ocupado.
    const travel = moving ? (B.activateDistance * B.movingSpeed) / (speed + B.movingSpeed) + 2 : 0;
    const start = s + travel;
    this.place('bondi', lane, start, { ramp, moving });
    const to = start + (ramp ? B.rampLength : 0) + B.length;
    this.busy[lane] = { from: s, to, ramp };
    // Fichitas subiendo por la rampa y sobre el techo (solo bondis estacionados)
    if (ramp && !moving && Math.random() < config.coins.roofChance) {
      const x = laneX(lane);
      const bodyStart = start + B.rampLength;
      for (let cs = start + 1; cs < bodyStart; cs += config.coins.spacing)
        this.coins.spawn(x, cs, ((cs - start) / B.rampLength) * B.height + config.coins.height);
      for (let cs = bodyStart; cs < to - 1; cs += config.coins.spacing) this.coins.spawn(x, cs, B.height + config.coins.height);
    }
  }

  private placeCoins(prev: number, s: number, row: Cell[], reach: Set<number>): void {
    const C = config.coins;
    if (reach.size === 0) return;
    const from = this.coinLane;
    if (!reach.has(this.coinLane) || Math.random() < C.laneChangeChance) {
      // Preferimos un carril vecino para que la línea pueda cruzar en zigzag
      const arr = [...reach];
      const near = arr.filter((q) => Math.abs(q - this.coinLane) === 1);
      const pool = near.length && Math.random() < 0.8 ? near : arr;
      this.coinLane = pool[Math.floor(Math.random() * pool.length)];
    }
    if (Math.random() > C.lineChance) return;
    const l = this.coinLane;
    const cell = row[l];
    const arc = 3.2; // medio largo del arco sobre obstáculos bajos
    const start = Math.max(prev + 3, s - 14);
    // Zigzag: si el carril guía cambió a uno vecino, la línea cruza en diagonal entre filas
    // (solo si ninguno de los dos carriles tiene un bondi en ese tramo)
    const weaveLen = Math.min(C.zigzagLength, s - 4 - start);
    let weave = from !== l && Math.abs(from - l) === 1 && weaveLen > 3;
    for (let cs = start; weave && cs < start + weaveLen; cs += 1) {
      if (this.isBusyAt(from, cs) || this.isBusyAt(l, cs)) weave = false;
    }
    for (let cs = start; cs <= s + (cell === 'low' ? arc : 0); cs += C.spacing) {
      let x = laneX(l);
      if (weave && cs < start + weaveLen) {
        const t = (cs - start) / weaveLen;
        x = laneX(from) + (laneX(l) - laneX(from)) * t * t * (3 - 2 * t);
      } else if (this.isBusyAt(l, cs)) continue;
      let y = C.height;
      if (cell === 'low' && cs > s - arc) {
        const t = (cs - s) / arc; // -1..1
        y = C.height + 1.6 * (1 - t * t);
      } else if (cell === 'high' && Math.abs(cs - s) < 1.5) {
        y = 0.5;
      }
      this.coins.spawn(x, cs, y);
    }
  }

  // ---------- Simulación ----------

  /** Mueve bondis que vienen de frente y recicla lo que quedó atrás. */
  step(dt: number, playerS: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const o = this.active[i];
      Object.assign(o.prevBox, o.box);
      if (o.moving) {
        const front = o.box.minS - (o.ramp ? B.rampLength : 0);
        if (front - playerS < B.activateDistance) {
          const ds = B.movingSpeed * dt;
          o.box.minS -= ds;
          o.box.maxS -= ds;
        }
      }
      if (o.box.maxS < playerS - 12) {
        this.active.splice(i, 1);
        this.release(o);
      }
    }
  }

  /** Altura del piso bajo (x, s): techos, rampas y tapas de obstáculos sobre los que se puede caer. */
  supportAt(x: number, s: number, y: number): number {
    const step = config.player.stepUp;
    let ground = 0;
    for (const o of this.active) {
      const b = o.box;
      if (x < b.minX + 0.1 || x > b.maxX - 0.1) continue;
      if (o.kind !== 'high' && s >= b.minS && s <= b.maxS && b.maxY <= y + step) ground = Math.max(ground, b.maxY);
      if (o.ramp) {
        const r0 = b.minS - B.rampLength;
        if (s >= r0 && s < b.minS) {
          const h = ((s - r0) / B.rampLength) * B.height;
          if (h <= y + step) ground = Math.max(ground, h);
        }
      }
    }
    return ground;
  }

  /** Choques: frontal = game over, lateral o roce = tropiezo. */
  collide(p: Player): HitResult {
    const pb = p.box;
    const ppb = p.prevBox;
    // Margen para no chocar con la superficie donde está parada
    const feet = { ...pb, minY: pb.minY + 0.05 };
    let result: HitResult = 'none';
    this.lastHit = null;
    for (const o of this.active) {
      if (o.hit) continue;
      const b = o.box;
      if (!intersects(feet, b)) continue;
      this.lastHit = o;
      // Cayendo desde arriba sobre algo alto (supersalto): se pasa de largo
      if (o.kind === 'high' && ppb.minY >= b.maxY - 0.05) {
        o.hit = true;
        continue;
      }
      // Casi a la altura de la tapa (fin de rampa, caída tardía): se sube, no choca
      if (o.kind !== 'high' && b.maxY - pb.minY <= config.player.stepUp) continue;
      const enteredFront = overlap(ppb.minS, ppb.maxS, o.prevBox.minS, o.prevBox.maxS) <= 0;
      if (!enteredFront) {
        // Entró de costado (cambio de carril contra algo): rebota y tropieza
        p.bounceBack();
        if (p.stumbleCooldown <= 0) result = 'stumble';
        continue;
      }
      const xOver = overlap(pb.minX, pb.maxX, b.minX, b.maxX);
      const graze = xOver < O.grazeOverlap || (o.kind === 'low' && b.maxY - pb.minY < O.lowGrazeHeight);
      if (graze) {
        o.hit = true;
        if (p.changingLane) p.bounceBack();
        if (p.stumbleCooldown <= 0) result = 'stumble';
        continue;
      }
      return 'crash';
    }
    return result;
  }

  /** Sincroniza mallas con el estado (una vez por frame). */
  render(time: number): void {
    for (const o of this.active) {
      if (o.moving) this.syncMesh(o);
      // Las gaviotas suben y bajan un poquito (sin salirse de su caja de colisión)
      else if (o.bob) o.mesh.position.y = Math.sin(time * 3 + o.lane * 1.7) * 0.06;
    }
  }
}

function setBox(b: Box, x: number, w: number, y: number, h: number, s: number, depth: number): void {
  b.minX = x - w / 2;
  b.maxX = x + w / 2;
  b.minY = y;
  b.maxY = y + h;
  b.minS = s - depth / 2;
  b.maxS = s + depth / 2;
}

function pickWeighted(w: Record<ObstacleKind, number>): ObstacleKind {
  const entries = Object.entries(w) as [ObstacleKind, number][];
  let r = Math.random() * entries.reduce((a, [, v]) => a + v, 0);
  for (const [k, v] of entries) {
    r -= v;
    if (r <= 0) return k;
  }
  return entries[0][0];
}

/** Grupos de carriles contiguos dentro del conjunto. */
function components(set: Set<number>): number[][] {
  const out: number[][] = [];
  let cur: number[] = [];
  for (let l = 0; l < LANES; l++) {
    if (set.has(l)) cur.push(l);
    else if (cur.length) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}
