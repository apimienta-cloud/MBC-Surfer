import * as THREE from 'three';
import { config, color } from '../config';

const PC = config.particles;

/** Pool de partículas sobre un InstancedMesh: nada se crea ni se destruye por frame. */
class Pool {
  readonly mesh: THREE.InstancedMesh;
  private pos: Float32Array;
  private vel: Float32Array;
  private rot: Float32Array;
  private spin: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private size: Float32Array;
  private next = 0;
  private dummy = new THREE.Object3D();

  constructor(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    private n: number,
    private gravity: number,
    private drag: number,
  ) {
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    this.mesh.frustumCulled = false;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.rot = new Float32Array(n * 3);
    this.spin = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.maxLife = new Float32Array(n);
    this.size = new Float32Array(n);
    this.clear();
  }

  clear(): void {
    this.life.fill(0);
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    for (let i = 0; i < this.n; i++) this.mesh.setMatrixAt(i, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Emite una partícula (si el pool está lleno pisa la más vieja). */
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, spin = 0): void {
    const i = this.next;
    this.next = (this.next + 1) % this.n;
    const k = i * 3;
    this.pos[k] = x;
    this.pos[k + 1] = y;
    this.pos[k + 2] = z;
    this.vel[k] = vx;
    this.vel[k + 1] = vy;
    this.vel[k + 2] = vz;
    this.rot[k] = Math.random() * 6;
    this.rot[k + 1] = Math.random() * 6;
    this.rot[k + 2] = Math.random() * 6;
    this.spin[k] = (Math.random() - 0.5) * spin;
    this.spin[k + 1] = (Math.random() - 0.5) * spin;
    this.spin[k + 2] = (Math.random() - 0.5) * spin;
    this.life[i] = this.maxLife[i] = life;
    this.size[i] = size;
  }

  update(dt: number): void {
    const d = this.dummy;
    const damp = Math.exp(-this.drag * dt);
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const k = i * 3;
      if (this.life[i] <= 0) {
        d.scale.setScalar(0);
      } else {
        this.vel[k + 1] -= this.gravity * dt;
        for (let a = 0; a < 3; a++) {
          this.vel[k + a] *= damp;
          this.pos[k + a] += this.vel[k + a] * dt;
          this.rot[k + a] += this.spin[k + a] * dt;
        }
        // Achica al final de la vida
        const t = this.life[i] / this.maxLife[i];
        d.scale.setScalar(this.size[i] * Math.min(1, t * 3));
        d.position.set(this.pos[k], this.pos[k + 1], this.pos[k + 2]);
        d.rotation.set(this.rot[k], this.rot[k + 1], this.rot[k + 2]);
      }
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Espuma, hojas de calendario y brillos. Coordenadas de mundo. */
export class Particles {
  readonly group = new THREE.Group();
  private foam: Pool;
  private sheets: Pool;
  private sparkles: Pool;
  private smokePuffs: Pool;

  constructor() {
    this.foam = new Pool(
      new THREE.SphereGeometry(1, 8, 6),
      new THREE.MeshStandardMaterial({ color: color('foam'), roughness: 0.9 }),
      PC.foamPool,
      9,
      1.5,
    );
    this.sheets = new Pool(
      new THREE.PlaneGeometry(0.42, 0.42),
      new THREE.MeshStandardMaterial({ map: makeMiniSheet(), side: THREE.DoubleSide, roughness: 0.9 }),
      PC.sheetPool,
      2.5,
      1.2,
    );
    this.sparkles = new Pool(
      new THREE.OctahedronGeometry(1, 0),
      new THREE.MeshBasicMaterial({ color: color('gold') }),
      PC.sparklePool,
      0,
      4,
    );
    // Humo de parrilla: sube despacio (gravedad negativa)
    this.smokePuffs = new Pool(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ color: '#CFCAC4', roughness: 1, transparent: true, opacity: 0.75, depthWrite: false }),
      PC.smokePool,
      -0.6,
      0.6,
    );
    this.group.add(this.foam.mesh, this.sheets.mesh, this.sparkles.mesh, this.smokePuffs.mesh);
  }

  clear(): void {
    this.foam.clear();
    this.sheets.clear();
    this.sparkles.clear();
    this.smokePuffs.clear();
  }

  /** Bocanada de humo (parrilla del Mercado del Puerto). */
  smoke(x: number, y: number, z: number): void {
    this.smokePuffs.emit(x + (Math.random() - 0.5) * 0.4, y, z, (Math.random() - 0.5) * 0.6, 1.2 + Math.random() * 0.6, 0.4, 3 + Math.random(), 0.6 + Math.random() * 0.5, 1);
  }

  /** Puf de espuma al saltar. */
  foamPuff(x: number, y: number, z: number, n: number = PC.foamOnJump): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.foam.emit(x, y, z, Math.cos(a) * 1.4, 1 + Math.random() * 2, Math.sin(a) * 1.4 + 2, 0.5 + Math.random() * 0.3, 0.06 + Math.random() * 0.05);
    }
  }

  /** Chorrito de espuma al tropezar: sale para arriba y hacia atrás. */
  foamSquirt(x: number, y: number, z: number): void {
    for (let i = 0; i < PC.foamOnStumble; i++) {
      this.foam.emit(
        x + (Math.random() - 0.5) * 0.1,
        y,
        z,
        (Math.random() - 0.5) * 1.5,
        4 + Math.random() * 3,
        3 + Math.random() * 3,
        0.7 + Math.random() * 0.4,
        0.05 + Math.random() * 0.06,
      );
    }
  }

  /** Hojas de calendario que vuelan detrás del Lunes. */
  sheet(x: number, y: number, z: number): void {
    this.sheets.emit(
      x + (Math.random() - 0.5) * 1.2,
      y,
      z,
      (Math.random() - 0.5) * 3,
      1.5 + Math.random() * 2,
      4 + Math.random() * 3,
      1.4 + Math.random() * 0.6,
      1,
      9,
    );
  }

  /** Brillito al juntar una fichita. */
  sparkle(x: number, y: number, z: number): void {
    for (let i = 0; i < PC.sparklesOnCoin; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * Math.PI - Math.PI / 2;
      const v = 2.5 + Math.random() * 2;
      this.sparkles.emit(x, y, z, Math.cos(a) * Math.cos(b) * v, Math.sin(b) * v + 1, Math.sin(a) * Math.cos(b) * v, 0.35, 0.07, 12);
    }
  }

  update(dt: number): void {
    this.foam.update(dt);
    this.sheets.update(dt);
    this.sparkles.update(dt);
    this.smokePuffs.update(dt);
  }
}

/** Hojita de calendario chiquita para las partículas. */
function makeMiniSheet(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#F4F1EA';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = color('lunesRed');
  ctx.fillRect(0, 0, 64, 14);
  ctx.fillStyle = '#B8B2A6';
  for (let y = 24; y < 60; y += 9) ctx.fillRect(8, y, 48, 3);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
