import * as THREE from 'three';
import { config, laneX, SkinDef } from '../config';
import { Box, makeBox } from './Collision';
import { Birra } from '../models/Birra';

const P = config.player;

export type PlayerEvent = 'jump' | 'land' | 'stumble' | 'roll' | 'roof';

/** La birra: física simple por carril. El modelo y sus animaciones viven en models/Birra. */
export class Player {
  readonly root = new THREE.Group();
  private model: Birra;
  private shadow: THREE.Mesh;
  private shieldMesh: THREE.Mesh;

  lane = 1;
  fromLane = 1;
  x = laneX(1);
  y = 0;
  vy = 0;
  s = 0;
  prevS = 0;
  prevY = 0;
  grounded = true;
  groundY = 0;
  rollTimer = 0;
  private rollOnLand = false;
  private fastFall = false;
  private jumpBuffer = 0;
  stumbleCooldown = 0;
  private stumbleAnim = 0;
  /** Multiplicador de salto (Tapita turbo). */
  jumpBoost = 1;
  /** Tiempo en que los choques no cuentan (después de que el Feriado absorbe uno). */
  invulnerable = 0;
  private onRoof = false;
  /** Eventos del último paso, para partículas y sonido. Los consume el Game. */
  readonly events: PlayerEvent[] = [];

  readonly box: Box = makeBox();
  readonly prevBox: Box = makeBox();

  constructor(skin?: SkinDef) {
    this.model = new Birra(skin);
    // Sombra "blob": círculo oscuro en el piso
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.root.add(this.model.root);
    this.root.add(this.shadow);
    // Burbuja del Feriado (escudo)
    this.shieldMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.05, 2),
      new THREE.MeshBasicMaterial({ color: config.powerups.colors.feriado, transparent: true, opacity: 0.22, depthWrite: false }),
    );
    this.shieldMesh.visible = false;
    this.root.add(this.shieldMesh);
  }

  /** Muestra la burbuja del escudo (titila cuando se está por terminar). */
  setShield(remaining: number, time: number): void {
    const on = remaining > 0 && (remaining > 2 || Math.sin(time * 18) > 0);
    this.shieldMesh.visible = on;
    if (on) {
      this.shieldMesh.position.y = this.rolling ? 0.45 : 0.85;
      this.shieldMesh.scale.setScalar(1 + Math.sin(time * 5) * 0.04);
    }
  }

  /** Cambia el envase (skin) sin tocar la física. */
  setSkin(skin: SkinDef): void {
    this.root.remove(this.model.root);
    this.model = new Birra(skin);
    this.root.add(this.model.root);
  }

  get rolling(): boolean {
    return this.rollTimer > 0;
  }

  get height(): number {
    return this.rolling ? P.rollHeight : P.height;
  }

  get changingLane(): boolean {
    return Math.abs(this.x - laneX(this.lane)) > 0.01;
  }

  /** Altura de la espuma en coordenadas de mundo. */
  get foamWorldY(): number {
    return this.y + (this.rolling ? 0.4 : this.model.foamHeight);
  }

  reset(): void {
    this.lane = this.fromLane = 1;
    this.x = laneX(1);
    this.y = this.vy = this.s = this.prevS = this.prevY = this.groundY = 0;
    this.grounded = true;
    this.rollTimer = this.jumpBuffer = this.stumbleCooldown = this.stumbleAnim = this.invulnerable = 0;
    this.rollOnLand = this.fastFall = this.onRoof = false;
    this.jumpBoost = 1;
    this.events.length = 0;
    this.setSquashed(0);
    this.updateBox();
    this.copyPrevBox();
  }

  moveLane(dir: -1 | 1): void {
    const next = this.lane + dir;
    if (next < 0 || next >= config.lanes.count) return;
    this.fromLane = this.lane;
    this.lane = next;
  }

  /** Rebote al carril de origen tras un choque lateral. */
  bounceBack(): void {
    if (this.fromLane === this.lane) return;
    const l = this.lane;
    this.lane = this.fromLane;
    this.fromLane = l;
  }

  jump(): void {
    this.jumpBuffer = P.inputBuffer;
  }

  roll(): void {
    if (this.grounded) {
      if (!this.rolling) this.events.push('roll');
      this.rollTimer = P.rollDuration;
    } else {
      // En el aire: cae rápido y rueda al tocar el piso
      this.fastFall = true;
      this.rollOnLand = true;
      this.vy = Math.min(this.vy, 0);
    }
  }

  stumble(): void {
    this.stumbleCooldown = P.stumbleCooldown;
    this.stumbleAnim = 0.4;
    this.model.onStumble();
    this.events.push('stumble');
  }

  /** Avanza la física un paso fijo. `support` devuelve la altura del piso bajo la birra. */
  step(dt: number, speed: number, support: (x: number, s: number, y: number) => number): void {
    this.copyPrevBox();
    this.prevS = this.s;
    this.prevY = this.y;
    this.s += speed * dt;

    // Tween lateral a velocidad constante (~changeTime por carril)
    const tx = laneX(this.lane);
    const maxDx = (config.lanes.width / config.lanes.changeTime) * dt;
    const dx = tx - this.x;
    this.x += Math.abs(dx) <= maxDx ? dx : Math.sign(dx) * maxDx;

    if (this.jumpBuffer > 0) this.jumpBuffer -= dt;
    if (this.rollTimer > 0) this.rollTimer -= dt;
    if (this.stumbleCooldown > 0) this.stumbleCooldown -= dt;
    if (this.stumbleAnim > 0) this.stumbleAnim -= dt;
    if (this.invulnerable > 0) this.invulnerable -= dt;

    // Salto (con buffer: si se pidió hace menos de inputBuffer, salta al aterrizar)
    if (this.jumpBuffer > 0 && this.grounded) {
      this.jumpBuffer = 0;
      this.vy = P.jumpVelocity * this.jumpBoost;
      this.grounded = false;
      this.rollTimer = 0;
      this.rollOnLand = this.fastFall = false;
      this.model.onJump();
      this.events.push('jump');
    }

    const ground = support(this.x, this.s, this.y);
    this.groundY = ground;
    if (!this.grounded || this.y > ground) {
      this.vy -= (this.fastFall ? P.fastFallGravity : P.gravity) * dt;
      this.y += this.vy * dt;
      this.grounded = false;
    }
    if (this.y <= ground) {
      this.y = ground;
      if (!this.grounded) {
        if (this.rollOnLand) {
          this.rollTimer = P.rollDuration;
          this.events.push('roll');
        }
        if (this.vy < -4) this.events.push('land');
      }
      this.vy = 0;
      this.grounded = true;
      this.rollOnLand = this.fastFall = false;
    }
    // Subirse al techo de un bondi (para las misiones)
    const roof = this.grounded && ground >= config.obstacles.bondi.height - 0.1;
    if (roof && !this.onRoof) this.events.push('roof');
    this.onRoof = roof;
    this.updateBox();
  }

  private updateBox(): void {
    const b = this.box;
    b.minX = this.x - P.width / 2;
    b.maxX = this.x + P.width / 2;
    b.minY = this.y;
    b.maxY = this.y + this.height;
    b.minS = this.s - P.depth / 2;
    b.maxS = this.s + P.depth / 2;
  }

  private copyPrevBox(): void {
    Object.assign(this.prevBox, this.box);
  }

  /** Sincroniza el modelo con el estado (una vez por frame). */
  render(dt: number, speed: number, chaserNear: boolean, caught: boolean): void {
    this.root.position.set(this.x, this.y, -this.s);
    this.model.animate({
      dt,
      speed,
      grounded: this.grounded,
      vy: this.vy,
      rolling: this.rolling,
      stumbling: this.stumbleAnim > 0,
      laneTilt: THREE.MathUtils.clamp((laneX(this.lane) - this.x) / config.lanes.width, -1, 1),
      chaserNear,
      caught,
    });
    // La sombra se queda en el piso (techo de bondi incluido)
    this.shadow.position.y = this.groundY - this.y + 0.02;
    this.shadow.scale.setScalar(Math.max(0.4, 1 - (this.y - this.groundY) * 0.12));
  }

  /** Para la animación de captura: la birra queda aplastada abajo del Lunes. */
  setSquashed(amount: number): void {
    this.model.root.scale.set(1 + amount * 0.4, 1 - amount * 0.6, 1 + amount * 0.4);
  }
}
