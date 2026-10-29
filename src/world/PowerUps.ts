import * as THREE from 'three';
import { config, laneX, PowerUpType } from '../config';
import { Kit, kitMaterial } from './landmarks/kit';
import type { Player } from '../game/Player';

const PU = config.powerups;
const TYPES: PowerUpType[] = ['feriado', 'happyHour', 'choppDoble', 'tapitaTurbo'];

/** Modelos de los íconos 3D, centrados en el origen (~1 m). */
function buildIcon(type: PowerUpType): THREE.BufferGeometry {
  const k = new Kit();
  switch (type) {
    case 'feriado':
      // Hoja de calendario tachada
      k.boxC(0.8, 0.9, 0.08, '#FFFFFF', 0, 0, 0);
      k.boxC(0.8, 0.22, 0.1, '#E63946', 0, 0.36, 0);
      k.boxC(0.95, 0.12, 0.12, '#E63946', 0, -0.05, 0.05, { rz: 0.75 });
      k.boxC(0.95, 0.12, 0.12, '#E63946', 0, -0.05, 0.05, { rz: -0.75 });
      break;
    case 'happyHour':
      // Reloj con un chopp adelante
      k.cylC(0.42, 0.1, '#FFFFFF', 0, 0.05, 0, 20, { rx: Math.PI / 2 });
      k.add(new THREE.TorusGeometry(0.42, 0.05, 6, 20), '#1E3A5F', 0, 0.05, 0);
      k.boxC(0.05, 0.28, 0.04, '#1E3A5F', 0, 0.17, 0.07);
      k.boxC(0.2, 0.05, 0.04, '#1E3A5F', 0.09, 0.05, 0.07);
      k.cylC(0.15, 0.32, '#F2B134', 0.32, -0.28, 0.12, 10);
      k.sphere(0.13, '#FFF8E7', 0.32, -0.1, 0.12, { sy: 0.6 }, 0);
      break;
    case 'choppDoble':
      // Dos choppitos
      for (const x of [-0.22, 0.24]) {
        k.cylC(0.17, 0.5, '#F2B134', x, -0.05, 0, 10);
        k.sphere(0.17, '#FFF8E7', x, 0.24, 0, { sy: 0.6 }, 0);
        k.add(new THREE.TorusGeometry(0.1, 0.03, 4, 8, Math.PI), '#F2B134', x + (x < 0 ? -0.17 : 0.17), -0.05, 0, { rz: x < 0 ? Math.PI / 2 : -Math.PI / 2 });
      }
      break;
    case 'tapitaTurbo':
      // Tapita con alitas
      k.cylC(0.3, 0.12, '#F2B134', 0, 0, 0, 16, { rx: Math.PI / 2 });
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        k.boxC(0.07, 0.07, 0.14, '#D99A1E', Math.cos(a) * 0.31, Math.sin(a) * 0.31, 0);
      }
      for (const sx of [-1, 1]) {
        k.boxC(0.45, 0.08, 0.04, '#FFFFFF', sx * 0.5, 0.12, 0, { rz: sx * 0.35 });
        k.boxC(0.35, 0.08, 0.04, '#FFFFFF', sx * 0.48, 0.02, 0, { rz: sx * 0.15 });
        k.boxC(0.25, 0.08, 0.04, '#FFFFFF', sx * 0.45, -0.08, 0, { rz: sx * -0.05 });
      }
      break;
  }
  return k.build();
}

interface Pickup {
  type: PowerUpType;
  alive: boolean;
  x: number;
  y: number;
  s: number;
  group: THREE.Group;
}

export interface ActivePower {
  type: PowerUpType;
  remaining: number;
  total: number;
}

/** Power-ups: los íconos que flotan en la pista y los efectos activos. */
export class PowerUps {
  readonly group = new THREE.Group();
  private pickups: Pickup[] = [];
  private geos = new Map<PowerUpType, THREE.BufferGeometry>();
  private bubbleGeo = new THREE.IcosahedronGeometry(0.75, 1);
  private bubbleMats = new Map<PowerUpType, THREE.Material>();

  // Efectos
  timers: Record<PowerUpType, number> = { feriado: 0, happyHour: 0, choppDoble: 0, tapitaTurbo: 0 };
  /** Un Feriado guardado para activar con doble tap / E. */
  stored = false;

  reset(): void {
    for (const p of this.pickups) {
      p.alive = false;
      p.group.visible = false;
    }
    for (const t of TYPES) this.timers[t] = 0;
    this.stored = false;
  }

  get magnet(): boolean {
    return this.timers.happyHour > 0;
  }
  get shield(): boolean {
    return this.timers.feriado > 0;
  }
  get multiplier(): number {
    return this.timers.choppDoble > 0 ? PU.choppDoble.multiplier : 1;
  }
  get jumpBoost(): number {
    return this.timers.tapitaTurbo > 0 ? PU.tapitaTurbo.jumpBoost : 1;
  }

  /** Lista para el HUD. */
  active(): ActivePower[] {
    return TYPES.filter((t) => this.timers[t] > 0).map((t) => ({ type: t, remaining: this.timers[t], total: PU[t].duration }));
  }

  /** Tipo al azar según los pesos de config. */
  randomType(): PowerUpType {
    let r = Math.random() * TYPES.reduce((a, t) => a + PU.weights[t], 0);
    for (const t of TYPES) {
      r -= PU.weights[t];
      if (r <= 0) return t;
    }
    return 'happyHour';
  }

  spawn(type: PowerUpType, lane: number, s: number): void {
    let p = this.pickups.find((q) => !q.alive && q.type === type);
    if (!p) {
      const g = new THREE.Group();
      let geo = this.geos.get(type);
      if (!geo) this.geos.set(type, (geo = buildIcon(type)));
      g.add(new THREE.Mesh(geo, kitMaterial));
      let mat = this.bubbleMats.get(type);
      if (!mat) {
        mat = new THREE.MeshBasicMaterial({ color: PU.colors[type], transparent: true, opacity: 0.28, depthWrite: false });
        this.bubbleMats.set(type, mat);
      }
      g.add(new THREE.Mesh(this.bubbleGeo, mat));
      this.group.add(g);
      p = { type, alive: false, x: 0, y: 0, s: 0, group: g };
      this.pickups.push(p);
    }
    p.alive = true;
    p.x = laneX(lane);
    p.y = PU.height;
    p.s = s;
    p.group.visible = true;
  }

  /** Activa el efecto de un power-up. El Feriado se guarda si no hay otro guardado. */
  apply(type: PowerUpType): 'stored' | 'active' {
    if (type === 'feriado' && !this.stored && !this.shield) {
      this.stored = true;
      return 'stored';
    }
    this.timers[type] = PU[type].duration;
    return 'active';
  }

  /** Usa el Feriado guardado. Devuelve true si había uno. */
  useStored(): boolean {
    if (!this.stored) return false;
    this.stored = false;
    this.timers.feriado = PU.feriado.duration;
    return true;
  }

  /** El escudo absorbió un choque. */
  consumeShield(): void {
    this.timers.feriado = 0;
  }

  /** Avanza timers y detecta si la birra agarró algún power-up. */
  step(dt: number, p: Player, onPick: (type: PowerUpType) => void): void {
    for (const t of TYPES) if (this.timers[t] > 0) this.timers[t] = Math.max(0, this.timers[t] - dt);
    const cy = p.y + p.height / 2;
    for (const q of this.pickups) {
      if (!q.alive) continue;
      const ds = q.s - p.s;
      if (ds < -8) {
        q.alive = false;
        q.group.visible = false;
        continue;
      }
      if (Math.abs(ds) < PU.pickupRadius && Math.abs(q.x - p.x) < PU.pickupRadius && Math.abs(q.y - cy) < PU.pickupRadius + p.height / 2) {
        q.alive = false;
        q.group.visible = false;
        onPick(q.type);
      }
    }
  }

  render(time: number): void {
    for (const q of this.pickups) {
      if (!q.alive) continue;
      q.group.position.set(q.x, q.y + Math.sin(time * 3 + q.s) * 0.15, -q.s);
      q.group.rotation.y = Math.sin(time * 2) * 0.6;
      const pulse = 1 + Math.sin(time * 6) * 0.06;
      q.group.children[1].scale.setScalar(pulse);
    }
  }
}
