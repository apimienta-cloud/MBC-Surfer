import * as THREE from 'three';
import { config } from '../config';
import { glowEmissive, Kit, kitMaterial } from '../world/landmarks/kit';
import type { Player } from '../game/Player';
import type { Particles } from '../fx/Particles';
import type { Sfx } from '../audio/Audio';

const I = config.intro;
const G = I.graffiti;
const WALL = I.wall;
// Resolución de trabajo del grafiti (la imagen original es 2048x768)
const TEX_W = 1024;
const TEX_H = 384;
const GH = (G.width * TEX_H) / TEX_W; // alto del grafiti en metros
const PX_PER_M = TEX_W / G.width;
const BRUSH = I.brushRadius * PX_PER_M;
const STAND_Z = WALL.z - I.standDistance;

type Phase = 'shake' | 'paint' | 'reveal' | 'outro' | 'done';

/** Punto del recorrido del aerosol, en píxeles de la textura. `paint` = el tramo que llega acá pinta. */
interface PathPoint {
  x: number;
  y: number;
  d: number;
  paint: boolean;
  region: number;
}

/**
 * Cinemática del principio: la birra agita el aerosol y pinta el logo de MBC y "PINTA VERNOS" en el muro
 * que cierra la calle detrás de la largada. El grafiti se revela por donde pasa el chorro (máscara en un canvas).
 * Al final se da vuelta y queda donde arranca el menú; el muro pintado queda de fondo.
 */
export class Intro {
  readonly group = new THREE.Group();
  /** Velocidad de caminata para la animación de piernas. */
  walkSpeed = 0;
  private phase: Phase = 'done';
  private t = 0;
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private mask = document.createElement('canvas');
  private mctx: CanvasRenderingContext2D;
  private dab = document.createElement('canvas');
  private tex: THREE.CanvasTexture;
  private img: HTMLImageElement | null = null;
  private path: PathPoint[] = [];
  private length = 0;
  private painted = 0;
  private dirty = false;
  private sprayTimer = 0;
  private rattleTimer = 0;
  private camX = 0;
  private snapCam = true;
  private tip = new THREE.Vector3();
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private goalPos = new THREE.Vector3();
  private goalLook = new THREE.Vector3();

  constructor(private particles: Particles) {
    this.canvas.width = this.mask.width = TEX_W;
    this.canvas.height = this.mask.height = TEX_H;
    this.ctx = this.canvas.getContext('2d')!;
    this.mctx = this.mask.getContext('2d')!;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;

    // Pincel del aerosol: círculo de borde suave
    const r = Math.ceil(BRUSH);
    this.dab.width = this.dab.height = r * 2;
    const dctx = this.dab.getContext('2d')!;
    const grad = dctx.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.55, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    dctx.fillStyle = grad;
    dctx.fillRect(0, 0, r * 2, r * 2);

    this.buildWall();
    const img = new Image();
    img.onload = () => {
      this.img = img;
      this.buildPath(img);
      if (this.phase === 'done') this.complete();
    };
    // TODO(brand): falta el grafiti; el muro queda liso
    img.onerror = () => console.warn(`[brand] Falta ${G.file}`);
    img.src = G.file;
  }

  get active(): boolean {
    return this.phase !== 'done';
  }

  /** Arranca la cinemática con la birra frente al muro, de espaldas a la cámara. */
  start(p: Player): void {
    this.phase = 'shake';
    this.t = 0;
    this.painted = 0;
    this.sprayTimer = this.rattleTimer = 0;
    this.mctx.clearRect(0, 0, TEX_W, TEX_H);
    this.ctx.clearRect(0, 0, TEX_W, TEX_H);
    this.tex.needsUpdate = true;
    const first = this.path[0];
    p.x = first ? this.wallX(first.x) : 0;
    p.s = p.prevS = -STAND_Z;
    p.y = p.groundY = 0;
    p.yaw = Math.PI;
    p.pose = 'shake';
    this.camX = p.x;
    this.snapCam = true;
  }

  /** Salta al final: grafiti completo. */
  skip(): void {
    this.complete();
    this.phase = 'done';
  }

  /** Avanza la cinemática. Devuelve false cuando terminó. */
  step(dt: number, p: Player, sfx: (s: Sfx) => void): boolean {
    if (this.phase === 'done') return false;
    this.t += dt;
    this.walkSpeed = 0;
    p.y = 0;
    p.grounded = true;
    p.vy = 0;

    if (this.phase === 'shake') {
      this.rattleTimer -= dt;
      if (this.rattleTimer <= 0) {
        this.rattleTimer = 0.38;
        sfx('rattle');
      }
      // Espera a que cargue la imagen (normalmente ya está)
      if (this.t >= I.shakeTime && this.img) this.next('paint');
    } else if (this.phase === 'paint') {
      this.paint(dt, p, sfx);
      if (this.painted >= this.length) {
        this.complete();
        this.next('reveal');
      }
    } else if (this.phase === 'reveal') {
      // Camina para atrás hasta la largada mirando lo que pintó
      p.pose = null;
      const k = 1 - Math.exp(-dt * 2.4);
      const ds = (0 - p.s) * k;
      const dx = (0 - p.x) * k;
      p.s += ds;
      p.x += dx;
      this.walkSpeed = Math.min(9, Math.hypot(ds, dx) / Math.max(dt, 1e-3) * 2);
      if (this.t >= I.revealTime) this.next('outro');
    } else if (this.phase === 'outro') {
      // Se da vuelta y saluda
      p.s = p.prevS = 0;
      p.x = 0;
      const turn = Math.min(1, this.t / 0.45);
      p.yaw = Math.PI * (1 - turn * turn * (3 - 2 * turn));
      p.pose = turn >= 1 ? 'wave' : null;
      if (this.t >= I.outroTime) {
        this.phase = 'done';
        return false;
      }
    }

    if (this.dirty) this.compose();
    return true;
  }

  /**
   * Cámara de la cinemática. `menuPos`/`menuLook` es donde arranca la cámara del menú,
   * para que el final empalme sin salto.
   */
  camera(cam: THREE.PerspectiveCamera, dt: number, p: Player, menuPos: THREE.Vector3, menuLook: THREE.Vector3): void {
    const fit = (w: number, h: number): number => {
      const tv = Math.tan((cam.fov * Math.PI) / 360);
      return Math.max(w / 2 / (tv * cam.aspect), h / 2 / tv);
    };
    let k = 2.4;
    if (this.phase === 'shake') {
      // Por arriba del hombro
      this.goalPos.set(p.x - 1.3, 1.75, STAND_Z - 3.3);
      this.goalLook.set(p.x + 0.3, 1.5, WALL.z);
    } else if (this.phase === 'paint') {
      // Acompaña a la birra a lo largo del muro
      this.camX += (p.x - this.camX) * (1 - Math.exp(-dt * 2));
      const d = fit(5.5, GH + 0.6);
      const cy = G.bottom + GH / 2;
      this.goalPos.set(this.camX * 0.85 - 0.6, cy + 0.2, WALL.z - d);
      this.goalLook.set(this.camX * 0.85, cy, WALL.z);
    } else if (this.phase === 'reveal') {
      // Se aleja para mostrar el grafiti entero
      const cy = G.bottom + GH / 2;
      this.goalPos.set(0, cy + 0.3, WALL.z - fit(G.width + 1.2, GH + 1.6));
      this.goalLook.set(0, cy, WALL.z);
      k = 1.8;
    } else {
      this.goalPos.copy(menuPos);
      this.goalLook.copy(menuLook);
      k = 3;
    }
    if (this.snapCam) {
      this.camPos.copy(this.goalPos);
      this.camLook.copy(this.goalLook);
      this.snapCam = false;
    }
    const a = 1 - Math.exp(-dt * k);
    this.camPos.lerp(this.goalPos, a);
    this.camLook.lerp(this.goalLook, a);
    if (this.phase === 'outro' || this.phase === 'done') {
      // Últimos instantes: termina exactamente en la cámara del menú
      const f = THREE.MathUtils.clamp((this.t - (I.outroTime - 0.6)) / 0.6, 0, 1);
      this.camPos.lerp(menuPos, this.phase === 'done' ? 1 : f);
      this.camLook.lerp(menuLook, this.phase === 'done' ? 1 : f);
    }
    cam.position.copy(this.camPos);
    cam.lookAt(this.camLook);
  }

  // ---------- Pintar ----------

  private next(phase: Phase): void {
    this.phase = phase;
    this.t = 0;
  }

  private paint(dt: number, p: Player, sfx: (s: Sfx) => void): void {
    const from = this.painted;
    this.painted = Math.min(this.length, this.painted + (this.length / I.paintTime) * dt);
    // Toques del pincel a lo largo del tramo recorrido en este frame
    const stepPx = BRUSH * 0.35;
    for (let d = from; d <= this.painted; d += stepPx) {
      const q = this.at(d);
      if (q.paint) this.mctx.drawImage(this.dab, q.x - BRUSH, q.y - BRUSH);
    }
    this.dirty = true;

    const q = this.at(this.painted);
    const tx = this.wallX(q.x);
    const ty = this.wallY(q.y);
    // La birra camina siguiendo el chorro (sin pegarse a los bordes del muro)
    const goal = THREE.MathUtils.clamp(tx, -G.width / 2 + 0.6, G.width / 2 - 0.6);
    const dx = (goal - p.x) * (1 - Math.exp(-dt * 5));
    p.x += dx;
    this.walkSpeed = Math.min(9, (Math.abs(dx) / Math.max(dt, 1e-3)) * 1.6);
    // Lo más alto lo pinta a los saltitos
    const hop = THREE.MathUtils.clamp((ty - I.reach) * 0.7, 0, 1);
    p.y = hop * Math.abs(Math.sin(this.t * 8));
    p.grounded = p.y < 0.02;
    // Brazo apuntando al punto del muro (la birra mira a +z)
    const shoulder = p.y + 0.75;
    p.aim = Math.atan2(I.standDistance, -(ty - shoulder));
    p.pose = 'paint';

    if (q.paint) {
      p.sprayTip(this.tip);
      this.particles.spray(this.tip.x, this.tip.y, this.tip.z, tx, ty, WALL.z - 0.03, G.colors[q.region] ?? '#FFFFFF');
      this.sprayTimer -= dt;
      if (this.sprayTimer <= 0) {
        this.sprayTimer = 0.24;
        sfx('spray');
      }
    }
  }

  /** Posición sobre el recorrido a una distancia d (interpolada). */
  private at(d: number): PathPoint {
    const P = this.path;
    if (!P.length) return { x: 0, y: 0, d: 0, paint: false, region: 0 };
    let lo = 0;
    let hi = P.length - 1;
    if (d >= P[hi].d) return P[hi];
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (P[mid].d <= d) lo = mid;
      else hi = mid;
    }
    const a = P[lo];
    const b = P[hi];
    const f = (d - a.d) / Math.max(1e-6, b.d - a.d);
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, d, paint: b.paint, region: b.region };
  }

  /** Grafiti visible = imagen recortada por la máscara de lo pintado. */
  private compose(): void {
    if (!this.img) return;
    const c = this.ctx;
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, TEX_W, TEX_H);
    c.drawImage(this.mask, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.drawImage(this.img, 0, 0, TEX_W, TEX_H);
    c.globalCompositeOperation = 'source-over';
    this.tex.needsUpdate = true;
    this.dirty = false;
  }

  private complete(): void {
    this.painted = this.length;
    this.dirty = false;
    if (!this.img) return;
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.clearRect(0, 0, TEX_W, TEX_H);
    this.ctx.drawImage(this.img, 0, 0, TEX_W, TEX_H);
    this.mctx.fillStyle = '#fff';
    this.mctx.fillRect(0, 0, TEX_W, TEX_H);
    this.tex.needsUpdate = true;
  }

  /**
   * Recorrido en zigzag por columnas dentro de cada parte (logo, PINTA, VERNOS), solo donde hay pintura.
   * Los traslados entre columnas y partes no pintan.
   */
  private buildPath(img: HTMLImageElement): void {
    const SW = 256;
    const SH = 96;
    const sc = document.createElement('canvas');
    sc.width = SW;
    sc.height = SH;
    const sctx = sc.getContext('2d', { willReadFrequently: true })!;
    sctx.drawImage(img, 0, 0, SW, SH);
    const alpha = sctx.getImageData(0, 0, SW, SH).data;
    const solid = (x: number, y: number): boolean => alpha[(Math.min(SH - 1, y) * SW + Math.min(SW - 1, x)) * 4 + 3] > 40;
    const toTex = TEX_W / SW;

    const pts: Omit<PathPoint, 'd'>[] = [];
    const colStep = BRUSH * 1.5;
    G.regions.forEach(([u0, v0, u1, v1], region) => {
      let down = true;
      for (let cx = u0 * TEX_W + BRUSH * 0.7; cx < u1 * TEX_W; cx += colStep) {
        // Alto ocupado por la pintura en esta franja de columna
        let top = Infinity;
        let bottom = -Infinity;
        const sx0 = Math.floor((cx - colStep / 2) / toTex);
        const sx1 = Math.ceil((cx + colStep / 2) / toTex);
        for (let sy = Math.floor(v0 * SH); sy <= Math.ceil(v1 * SH); sy++) {
          for (let sx = sx0; sx <= sx1; sx++) {
            if (sx < 0 || !solid(sx, sy)) continue;
            top = Math.min(top, sy * toTex);
            bottom = Math.max(bottom, (sy + 1) * toTex);
            break;
          }
        }
        if (top === Infinity) continue;
        const inset = Math.min(BRUSH * 0.45, (bottom - top) / 2);
        const a = top + inset;
        const b = bottom - inset;
        const [y0, y1] = down ? [a, b] : [b, a];
        pts.push({ x: cx, y: y0, paint: false, region }, { x: cx, y: y1, paint: true, region });
        down = !down;
      }
    });
    let d = 0;
    this.path = pts.map((q, i) => {
      if (i > 0) d += Math.hypot(q.x - pts[i - 1].x, q.y - pts[i - 1].y);
      return { ...q, d };
    });
    this.length = d;
  }

  private wallX(px: number): number {
    // El plano mira a -z: la izquierda de la imagen queda en +x (la izquierda de quien mira el muro)
    return -(px / TEX_W - 0.5) * G.width;
  }

  private wallY(py: number): number {
    return G.bottom + GH * (1 - py / TEX_H);
  }

  // ---------- Muro ----------

  private buildWall(): void {
    const th = 0.4;
    const wallTex = makePlaster();
    const wallMat = glowEmissive(new THREE.MeshStandardMaterial({ map: wallTex, emissive: '#FFFFFF', emissiveMap: wallTex, roughness: 1 }), 0, 0.28);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(WALL.width, WALL.height, th), wallMat);
    wall.position.set(0, WALL.height / 2, WALL.z + th / 2);
    this.group.add(wall);

    // Remate de arriba, pilares y dos faroles que iluminan el grafiti de noche
    const k = new Kit();
    k.box(WALL.width + 0.3, 0.18, th + 0.2, '#8F877C', 0, WALL.height, WALL.z + th / 2);
    for (const x of [-WALL.width / 2, WALL.width / 2]) k.box(0.7, WALL.height + 0.35, th + 0.3, '#A79C8C', x, 0, WALL.z + th / 2);
    for (const x of [-2.6, 2.6]) {
      k.box(0.08, 0.08, 0.7, '#2A2A2A', x, WALL.height - 0.25, WALL.z - 0.35);
      k.box(0.36, 0.12, 0.3, '#2A2A2A', x, WALL.height - 0.3, WALL.z - 0.75);
    }
    this.group.add(new THREE.Mesh(k.build(), kitMaterial));
    const bulbMat = glowEmissive(new THREE.MeshStandardMaterial({ color: '#FFF1C9', emissive: '#FFD27A' }), 0.2, 2);
    for (const x of [-2.6, 2.6]) {
      const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.22), bulbMat);
      bulb.position.set(x, WALL.height - 0.33, WALL.z - 0.75);
      this.group.add(bulb);
    }

    const mat = glowEmissive(
      new THREE.MeshStandardMaterial({ map: this.tex, emissive: '#FFFFFF', emissiveMap: this.tex, transparent: true, roughness: 0.9, depthWrite: false }),
      0.05,
      0.6,
    );
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(G.width, GH), mat);
    plane.rotation.y = Math.PI;
    plane.position.set(0, G.bottom + GH / 2, WALL.z - 0.02);
    this.group.add(plane);
  }
}

/** Revoque del muro: manchas, ladrillos a la vista donde se cayó y suciedad abajo. */
function makePlaster(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 288;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = WALL.color;
  ctx.fillRect(0, 0, c.width, c.height);
  let seed = 11;
  const rnd = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '90,80,70'},${0.03 + rnd() * 0.05})`;
    const r = 4 + rnd() * 26;
    ctx.beginPath();
    ctx.arc(rnd() * c.width, rnd() * c.height, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Ladrillos donde se cayó el revoque
  for (let p = 0; p < 6; p++) {
    const x0 = rnd() * (c.width - 120);
    const y0 = rnd() * (c.height - 70);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        if (rnd() < 0.3) continue;
        ctx.fillStyle = ['#A0563A', '#9A4E33', '#AD6244'][Math.floor(rnd() * 3)];
        ctx.fillRect(x0 + col * 26 + (row % 2) * 13, y0 + row * 13, 24, 11);
      }
    }
  }
  const g = ctx.createLinearGradient(0, c.height * 0.7, 0, c.height);
  g.addColorStop(0, 'rgba(60,50,40,0)');
  g.addColorStop(1, 'rgba(60,50,40,0.35)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
