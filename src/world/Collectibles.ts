import * as THREE from 'three';
import { config, color } from '../config';
import type { Player } from '../game/Player';

const C = config.coins;

/** Fichitas MBC con InstancedMesh y pool fijo. */
export class Collectibles {
  readonly mesh: THREE.InstancedMesh;
  private xs: Float32Array;
  private ys: Float32Array;
  private ss: Float32Array;
  private alive: Uint8Array;
  private free: number[] = [];
  private dummy = new THREE.Object3D();
  private angle = 0;

  constructor() {
    const n = C.poolSize;
    const geo = new THREE.CylinderGeometry(C.radius, C.radius, C.thickness, 20);
    // Las tapas miran hacia la cámara (eje del disco en z)
    geo.rotateX(Math.PI / 2);
    uprightCaps(geo);
    const tex = makeFichaTexture();
    // Algo de emisivo para que el logo se lea aunque la ficha quede de perfil a la luz
    const face = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35, roughness: 0.35 });
    const rim = new THREE.MeshStandardMaterial({ color: color('gold'), roughness: 0.3, metalness: 0.5 });
    // Grupos del cilindro: 0 = lateral (borde), 1 y 2 = tapas
    this.mesh = new THREE.InstancedMesh(geo, [rim, face, face], n);
    this.mesh.frustumCulled = false;
    this.xs = new Float32Array(n);
    this.ys = new Float32Array(n);
    this.ss = new Float32Array(n);
    this.alive = new Uint8Array(n);
    this.reset();
  }

  reset(): void {
    this.free.length = 0;
    this.alive.fill(0);
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    for (let i = C.poolSize - 1; i >= 0; i--) {
      this.free.push(i);
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  spawn(x: number, s: number, y: number): void {
    const i = this.free.pop();
    if (i === undefined) return; // pool lleno: se saltea
    this.xs[i] = x;
    this.ys[i] = y;
    this.ss[i] = s;
    this.alive[i] = 1;
  }

  private kill(i: number): void {
    this.alive[i] = 0;
    this.free.push(i);
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(i, this.dummy.matrix);
  }

  /** Recoge fichitas que toca la birra y recicla las que quedaron atrás. Devuelve cuántas juntó. */
  step(p: Player, dt: number, magnet: boolean, onPick?: (x: number, y: number, s: number) => void): number {
    let got = 0;
    const cy = p.y + p.height / 2;
    const MG = config.powerups.happyHour;
    for (let i = 0; i < C.poolSize; i++) {
      if (!this.alive[i]) continue;
      let ds = this.ss[i] - p.s;
      if (ds < -6) {
        this.kill(i);
        continue;
      }
      // Happy Hour: las fichitas cercanas vuelan hacia la birra
      if (magnet && ds < MG.range && ds > -2) {
        const k = Math.min(1, (MG.pullSpeed * dt) / Math.max(0.5, Math.hypot(ds, this.xs[i] - p.x, this.ys[i] - cy)));
        this.xs[i] += (p.x - this.xs[i]) * k;
        this.ys[i] += (cy - this.ys[i]) * k;
        this.ss[i] += (p.s - this.ss[i]) * k;
        ds = this.ss[i] - p.s;
      }
      if (Math.abs(ds) < C.pickupRadius && Math.abs(this.xs[i] - p.x) < C.pickupRadius && Math.abs(this.ys[i] - cy) < C.pickupRadius + p.height / 2) {
        onPick?.(this.xs[i], this.ys[i], this.ss[i]);
        this.kill(i);
        got++;
      }
    }
    return got;
  }

  render(dt: number): void {
    this.angle += C.spinSpeed * dt;
    const d = this.dummy;
    d.rotation.set(0, this.angle, 0);
    d.scale.setScalar(1);
    for (let i = 0; i < C.poolSize; i++) {
      if (!this.alive[i]) continue;
      d.position.set(this.xs[i], this.ys[i], -this.ss[i]);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/**
 * Las tapas del cilindro traen la textura girada 90°: se remapean las UV para que "MBC" quede derecho,
 * y la de atrás espejada para que también se lea bien cuando la ficha muestra el dorso al girar.
 */
function uprightCaps(geo: THREE.BufferGeometry): void {
  const pos = geo.getAttribute('position');
  const nor = geo.getAttribute('normal');
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    const nz = nor.getZ(i);
    if (Math.abs(nz) < 0.5) continue; // borde
    const u = pos.getX(i) / C.radius;
    uv.setXY(i, 0.5 + 0.5 * (nz > 0 ? u : -u), 0.5 + 0.5 * (pos.getY(i) / C.radius));
  }
  uv.needsUpdate = true;
}

/**
 * Cara de la fichita. Prioridad: ficha-mbc.png → mbc-logo.png → disco ámbar con "MBC" en texto.
 * Nunca se dibuja un logo inventado: el fallback es solo texto plano.
 */
function makeFichaTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const drawBase = (): void => {
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = color('amber');
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawFallback = (): void => {
    drawBase();
    ctx.fillStyle = color('foam');
    ctx.font = `bold ${size * 0.3}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(config.brand.name, size / 2, size / 2 + 4);
    tex.needsUpdate = true;
  };

  const drawImage = (img: HTMLImageElement): void => {
    drawBase();
    // Recorte cuadrado centrado: sirve tanto para un logo apaisado como para una ficha cuadrada
    const side = Math.min(img.naturalWidth, img.naturalHeight) * config.brand.fichaCropScale;
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    ctx.restore();
    // Bordecito interior
    ctx.strokeStyle = color('gold');
    ctx.lineWidth = size * 0.05;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.stroke();
    tex.needsUpdate = true;
  };

  drawFallback();
  const sources = [config.brand.fichaUrl, config.brand.logoUrl];
  const tryNext = (): void => {
    const src = sources.shift();
    if (!src) {
      // TODO(brand): falta ficha-mbc.png y mbc-logo.png en public/assets/brand/
      console.warn('[brand] No se encontró ficha ni logo de MBC: se usa placeholder de texto.');
      return;
    }
    const img = new Image();
    img.onload = () => drawImage(img);
    img.onerror = tryNext;
    img.src = src;
  };
  tryNext();
  return tex;
}
