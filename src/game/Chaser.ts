import * as THREE from 'three';
import { config } from '../config';
import { Lunes } from '../models/Lunes';
import type { Particles } from '../fx/Particles';

const CH = config.chaser;
const LINES = config.texts.chaserLines;

/**
 * El Lunes. Arranca pegado y en ~3 s se queda atrás. Si tropezás vuelve ~6 s;
 * un segundo tropiezo mientras está cerca = te agarra.
 */
export class Chaser {
  readonly root = new THREE.Group();
  readonly model = new Lunes();
  gap: number = CH.nearGap;
  private introTimer = 0;
  private nearTimer = 0;
  private x = 0;
  private y = 0;

  // Captura
  private catching = false;
  private catchT = 0;
  private catchFromGap = 0;

  // Globos de diálogo
  bubbleText: string | null = null;
  private bubbleTimer = 0;
  private bubbleCooldown = 0;
  private lastLine = -1;

  private sheetAcc = 0;

  constructor() {
    this.root.add(this.model.root);
  }

  /** Está lo bastante cerca como para agarrarte si tropezás. */
  get isNear(): boolean {
    return this.introTimer > 0 || this.nearTimer > 0;
  }

  get visible(): boolean {
    return this.catching || this.gap < CH.farGap - 1;
  }

  private get catchTotal(): number {
    return CH.catchRunTime + CH.catchJumpTime + CH.catchHoldTime;
  }

  get catchDone(): boolean {
    return this.catching && this.catchT >= this.catchTotal;
  }

  /** 0..1: cuánto aplastó a la birra al caerle encima. */
  get squashAmount(): number {
    if (!this.catching) return 0;
    const landAt = CH.catchRunTime + CH.catchJumpTime * 0.85;
    return THREE.MathUtils.clamp((this.catchT - landAt) / 0.12, 0, 1);
  }

  /** Posición de la cabeza en mundo, para ubicar el globo. */
  headWorld(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.root.position.x, this.root.position.y + this.model.headHeight, this.root.position.z);
  }

  reset(x: number): void {
    this.gap = CH.nearGap;
    this.introTimer = CH.introTime;
    this.nearTimer = 0;
    this.x = x + (x > 0.1 ? -1 : 1) * CH.sideOffset;
    this.y = 0;
    this.catching = false;
    this.catchT = 0;
    this.bubbleText = null;
    this.bubbleTimer = 0;
    this.bubbleCooldown = 0.6;
    this.sheetAcc = 0;
  }

  /** Tropiezo de la birra. Devuelve true si te agarró. */
  onStumble(): boolean {
    if (this.isNear) return true;
    this.nearTimer = CH.nearTime;
    this.bubbleCooldown = 0.2;
    return false;
  }

  /** Feriado: se aleja de golpe (Fase 4). */
  pushAway(): void {
    this.introTimer = this.nearTimer = 0;
  }

  /** Arranca la animación de captura (game over). */
  startCatch(): void {
    this.catching = true;
    this.catchT = 0;
    this.catchFromGap = Math.min(this.gap, 9);
    this.bubbleText = config.texts.chaserCatchLine;
    this.bubbleTimer = 99;
  }

  /** Lógica a paso fijo durante la partida. */
  step(dt: number): void {
    if (this.introTimer > 0) this.introTimer -= dt;
    if (this.nearTimer > 0) this.nearTimer -= dt;
    const target = this.isNear ? CH.nearGap : CH.farGap;
    this.gap += (target - this.gap) * Math.min(1, CH.approachRate * dt);

    // Globos random mientras está cerca
    if (this.bubbleTimer > 0) {
      this.bubbleTimer -= dt;
      if (this.bubbleTimer <= 0) {
        this.bubbleText = null;
        this.bubbleCooldown = CH.bubbleCooldown;
      }
    } else if (this.isNear && this.gap < CH.nearGap + 3) {
      this.bubbleCooldown -= dt;
      if (this.bubbleCooldown <= 0) {
        let i = Math.floor(Math.random() * LINES.length);
        if (i === this.lastLine) i = (i + 1) % LINES.length;
        this.lastLine = i;
        this.bubbleText = LINES[i];
        this.bubbleTimer = CH.bubbleTime;
      }
    } else if (!this.isNear) {
      this.bubbleText = null;
    }
  }

  render(dt: number, playerX: number, playerS: number, playerY: number, speed: number, particles: Particles): void {
    let airborne = false;
    if (this.catching) {
      // Alcanza a la birra, salta y le cae encima
      this.catchT += dt;
      const t = this.catchT;
      if (t < CH.catchRunTime) {
        const u = t / CH.catchRunTime;
        this.gap = THREE.MathUtils.lerp(this.catchFromGap, 2, u * u);
        this.y = playerY;
      } else {
        const u = Math.min(1, (t - CH.catchRunTime) / CH.catchJumpTime);
        this.gap = THREE.MathUtils.lerp(2, 0, u);
        this.y = playerY + CH.catchJumpHeight * 4 * u * (1 - u) + u * 0.45;
        airborne = u < 1;
      }
    }
    // Corre un poco al costado (hacia el centro de la calle) para no tapar a la birra
    const side = playerX > 0.1 ? -1 : 1;
    const tx = this.catching && this.catchT > CH.catchRunTime ? playerX : playerX + side * CH.sideOffset;
    this.x += (tx - this.x) * Math.min(1, (this.catching ? 12 : 5) * dt);
    this.root.position.set(this.x, this.y, -(playerS - this.gap));
    this.root.visible = this.visible;
    if (!this.root.visible) return;

    const moving = !this.catching || this.catchT < CH.catchRunTime + CH.catchJumpTime;
    this.model.animate({ dt, speed: moving ? speed : 0, airborne, shouting: this.bubbleText !== null || this.catching });

    // Hojas de calendario volando detrás
    if (moving) {
      this.sheetAcc += dt * CH.sheetParticlesPerSecond;
      while (this.sheetAcc >= 1) {
        this.sheetAcc -= 1;
        particles.sheet(this.x, this.y + this.model.headHeight - 0.3, this.root.position.z + 0.3);
      }
    }
  }
}
