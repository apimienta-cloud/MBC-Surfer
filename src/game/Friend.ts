import * as THREE from 'three';
import { config, laneX, SkinDef } from '../config';
import { Birra, Pose } from '../models/Birra';
import { castShadows } from '../fx/Look';
import type { Obstacles } from '../world/Obstacles';

const F = config.friend;
const P = config.player;

/**
 * La amiga: otra cervecita que corre adelante. Esquiva sola los obstáculos (cambia de carril, salta o rueda).
 * Te acercás corriendo sin tropezar y juntando fichitas; al alcanzarla brindan y ella se vuelve a adelantar.
 */
export class Friend {
  readonly root = new THREE.Group();
  private model: Birra;
  /** Metros que te lleva de ventaja. */
  gap: number = F.startGap;
  meets = 0;
  private lane = 1;
  private x = laneX(1);
  private y = 0;
  private vy = 0;
  private rollTimer = 0;
  private cheer = 0;
  /** Ventaja a la que vuelve después de una juntada (0 = no se está adelantando). */
  private dashTo = 0;
  private dashFrom = 0;
  private dashT = 0;
  private side = 1;

  constructor(skin: SkinDef) {
    this.model = new Birra(skin);
    castShadows(this.model.root);
    this.root.add(this.model.root);
  }

  setSkin(skin: SkinDef): void {
    this.root.remove(this.model.root);
    this.model = new Birra(skin);
    castShadows(this.model.root);
    this.root.add(this.model.root);
  }

  reset(): void {
    this.gap = F.startGap;
    this.meets = 0;
    this.lane = 1;
    this.x = laneX(1);
    this.y = this.vy = this.rollTimer = this.cheer = this.dashTo = 0;
  }

  /** ¿Se está festejando el brindis? */
  get cheering(): boolean {
    return this.cheer > 0;
  }

  /** Tropezaste: se aleja un poco. */
  slip(): void {
    if (!this.dashTo) this.gap = Math.min(F.maxGap, this.gap + F.stumbleSlip);
  }

  /** Fichitas juntadas: te acercan. */
  pull(coins: number): void {
    if (!this.dashTo) this.gap = Math.max(F.meetGap * 0.5, this.gap - F.coinPull * coins);
  }

  /** Avanza un paso de lógica. Devuelve true si en este paso se juntaron. */
  step(dt: number, playerS: number, playerX: number, playerLane: number, obstacles: Obstacles): boolean {
    if (this.cheer > 0) {
      // Brindis: se pone al lado de la birra, mirándola, y van juntas un ratito
      this.cheer = Math.max(0, this.cheer - dt);
      const k = Math.min(1, dt * 9);
      this.gap += (0.1 - this.gap) * k;
      this.x += (playerX + this.side * 0.95 - this.x) * k;
      this.y = Math.max(0, this.y - dt * 4);
      this.vy = 0;
      if (this.cheer === 0) {
        this.dashFrom = this.gap;
        this.dashT = 0;
        this.lane = Math.round((this.x - laneX(0)) / config.lanes.width);
        this.lane = THREE.MathUtils.clamp(this.lane, 0, config.lanes.count - 1);
      }
      return false;
    }
    if (this.dashTo) {
      // Después del brindis se vuelve a adelantar, suave
      this.dashT += dt / F.dashTime;
      const k = Math.min(1, this.dashT);
      this.gap = this.dashFrom + (this.dashTo - this.dashFrom) * k * k * (3 - 2 * k);
      if (k >= 1) this.dashTo = 0;
    } else {
      this.gap -= F.closeRate * dt;
      if (this.gap <= F.meetGap) {
        this.meets++;
        this.cheer = F.cheerTime;
        // Se pone del lado que tenga lugar (hacia el centro)
        this.side = playerLane === config.lanes.count - 1 ? -1 : playerLane === 0 ? 1 : this.x >= playerX ? 1 : -1;
        this.dashTo = Math.min(F.maxGap, F.startGap + this.meets * F.gapGrow);
        return true;
      }
    }
    this.avoid(dt, playerS + this.gap, obstacles);
    return false;
  }

  /** De qué lado de la birra se pone en el brindis (-1 izquierda, 1 derecha). */
  get meetSide(): number {
    return this.side;
  }

  /** Esquiva lo que tenga adelante en su carril. */
  private avoid(dt: number, s: number, obstacles: Obstacles): void {
    const ahead = (lane: number): string | null => {
      const x = laneX(lane);
      for (const o of obstacles.active) {
        const b = o.box;
        if (x < b.minX || x > b.maxX) continue;
        if (b.maxS < s - 0.6 || b.minS > s + 7) continue;
        return o.kind;
      }
      return null;
    };
    const here = ahead(this.lane);
    if (here === 'block' || here === 'bondi' || here === 'taxi') {
      // Pared: al carril libre más cercano (o al menos al que solo pide saltar o rodar)
      const options = [this.lane - 1, this.lane + 1, this.lane - 2, this.lane + 2].filter((l) => l >= 0 && l < config.lanes.count);
      const free = options.find((l) => !ahead(l)) ?? options.find((l) => ahead(l) === 'low' || ahead(l) === 'high');
      if (free !== undefined) this.lane = free;
    }
    const kind = ahead(this.lane);
    const grounded = this.y <= 0 && this.vy <= 0;
    // Salta o rueda cuando lo tiene cerca
    const near = obstacles.active.some((o) => o.kind === kind && laneX(this.lane) >= o.box.minX && laneX(this.lane) <= o.box.maxX && o.box.minS - s < 3.2 && o.box.maxS > s - 0.6);
    if (near && kind === 'low' && grounded) this.vy = P.jumpVelocity;
    if (near && kind === 'high' && grounded) this.rollTimer = P.rollDuration;
    this.rollTimer = Math.max(0, this.rollTimer - dt);

    this.vy -= P.gravity * dt;
    this.y = Math.max(0, this.y + this.vy * dt);
    if (this.y === 0 && this.vy < 0) this.vy = 0;
    const tx = laneX(this.lane);
    const step = F.laneSpeed * dt;
    this.x += THREE.MathUtils.clamp(tx - this.x, -step, step);
  }

  render(dt: number, playerS: number, speed: number, pose: Pose): void {
    this.root.position.set(this.x, this.y, -(playerS + this.gap));
    // En el brindis se da vuelta para chocar las birras
    const yawGoal = this.cheer > 0 ? this.side * (Math.PI / 2) : 0;
    this.root.rotation.y += (yawGoal - this.root.rotation.y) * Math.min(1, dt * 10);
    this.model.animate({
      dt,
      speed: this.cheer > 0 ? 0 : speed,
      grounded: this.y <= 0.001,
      vy: this.vy,
      rolling: this.rollTimer > 0,
      stumbling: false,
      laneTilt: THREE.MathUtils.clamp((laneX(this.lane) - this.x) / config.lanes.width, -1, 1),
      chaserNear: false,
      caught: false,
      pose: this.cheer > 0 ? 'cheer' : pose,
    });
  }
}
