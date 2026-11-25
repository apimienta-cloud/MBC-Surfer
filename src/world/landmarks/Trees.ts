import * as THREE from 'three';
import { Kit } from './kit';

/**
 * Árboles de vereda y palmeras. La parte "tint" (follaje) toma el color de la instancia y lleva
 * sombreado horneado por vértice: más oscuro abajo y adentro, más claro arriba, así la copa tiene volumen.
 */

export type TreeVariant = 'platano' | 'redondo' | 'alto';

function mulberry(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Oscurece por altura (y un poco hacia el centro) y agrega manchas de luz. */
function shade(geo: THREE.BufferGeometry, y0: number, y1: number, lo: number, cx = 0, cz = 0, seed = 1): THREE.BufferGeometry {
  const p = geo.attributes.position;
  const c = geo.attributes.color;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const t = THREE.MathUtils.clamp((y - y0) / (y1 - y0), 0, 1);
    const out = Math.min(1, Math.hypot(x - cx, z - cz) / 2.2);
    const n = Math.sin(x * 4.1 + seed) * Math.sin(y * 3.7 + seed * 2) * Math.sin(z * 4.3 - seed);
    const k = (lo + (1 - lo) * t * t * (3 - 2 * t)) * (0.82 + 0.18 * out) * (0.93 + 0.12 * n);
    c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k);
  }
  return geo;
}

/** Tronco con raíces y ramas que suben hacia la copa. */
function trunk(k: Kit, h: number, r: number, bark: string, branches: [number, number, number][]): void {
  k.cone(r * 1.9, 0.35, bark, 0, 0, 0, 10);
  k.cyl(r * 0.75, r, h, bark, 0, 0, 0, 12);
  for (const [a, tilt, len] of branches) {
    const dx = Math.cos(a) * Math.sin(tilt) * len * 0.5;
    const dz = Math.sin(a) * Math.sin(tilt) * len * 0.5;
    const dy = Math.cos(tilt) * len * 0.5;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize());
    const e = new THREE.Euler().setFromQuaternion(q);
    // La rama arranca en el tronco y sube inclinada
    k.add(new THREE.CylinderGeometry(r * 0.28, r * 0.5, len, 8), bark, dx, h * 0.82 + dy, dz, { rx: e.x, ry: e.y, rz: e.z });
  }
}

/** Copa hecha de muchas masas chicas alrededor de una forma (elipsoide). */
function canopy(k: Kit, cy: number, rx: number, ry: number, count: number, size: number, seed: number): void {
  const r = mulberry(seed);
  // Masa central que tapa los huecos
  k.blob(Math.min(rx, ry) * 0.85, '#ffffff', 0, cy, 0, { sx: rx / Math.min(rx, ry), sy: ry / Math.min(rx, ry), sz: rx / Math.min(rx, ry) }, 0.12, seed, 2);
  for (let i = 0; i < count; i++) {
    // Puntos repartidos sobre la superficie (espiral de Fibonacci con ruido)
    const t = (i + 0.5) / count;
    const phi = Math.acos(1 - 2 * t * 0.85);
    const th = i * 2.399 + r() * 0.6;
    const s = size * (0.75 + r() * 0.5);
    k.blob(
      s,
      '#ffffff',
      Math.sin(phi) * Math.cos(th) * rx * 0.85,
      cy + Math.cos(phi) * ry * 0.8,
      Math.sin(phi) * Math.sin(th) * rx * 0.85,
      undefined,
      0.22,
      seed + i * 3.1,
      2,
    );
  }
}

export function buildTree(v: TreeVariant): { base: THREE.BufferGeometry; tint: THREE.BufferGeometry } {
  const base = new Kit();
  const tint = new Kit();
  let top = 6;
  let bottom = 2.5;
  if (v === 'platano') {
    // Plátano de vereda: tronco alto y claro, copa ancha
    trunk(base, 3.4, 0.22, '#8C7A62', [
      [0.3, 0.6, 1.9],
      [2.4, 0.55, 1.8],
      [4.3, 0.65, 1.9],
    ]);
    canopy(tint, 4.7, 2.2, 1.5, 11, 0.95, 11);
    bottom = 3.2;
    top = 6.4;
  } else if (v === 'redondo') {
    // Copa redonda y más baja (tilo, fresno joven)
    trunk(base, 2.4, 0.18, '#6B4A2E', [
      [1.0, 0.5, 1.4],
      [3.6, 0.5, 1.4],
    ]);
    canopy(tint, 3.7, 1.7, 1.55, 9, 0.85, 23);
    bottom = 2.2;
    top = 5.3;
  } else {
    // Alto y espigado (álamo / casuarina urbana)
    trunk(base, 3.8, 0.17, '#5E4630', [
      [0.8, 0.35, 2.2],
      [3.9, 0.35, 2.1],
    ]);
    canopy(tint, 5.4, 1.3, 2.3, 10, 0.75, 37);
    bottom = 3.1;
    top = 7.8;
  }
  const b = base.build();
  // Corteza más oscura en la base
  shade(b, 0, 3, 0.7, 0, 0, 3);
  return { base: b, tint: shade(tint.build(), bottom, top, 0.42, 0, 0, 7) };
}

/** Palmera: tronco anillado y algo curvo, con hojas arqueadas de folíolos en V. */
export function buildPalm(): { base: THREE.BufferGeometry; tint: THREE.BufferGeometry } {
  const base = new Kit();
  const segs = 9;
  const H = 6.2;
  let x = 0;
  for (let i = 0; i < segs; i++) {
    const t = i / segs;
    const h = H / segs;
    const r = 0.27 - t * 0.09;
    // Leve curva del tronco
    const nx = Math.sin(t * 1.4) * 0.35;
    base.cyl(r * 0.92, r, h * 0.92, i % 2 ? '#8A6A45' : '#7A5C3B', nx, i * h, 0, 10);
    base.cyl(r * 1.03, r * 1.03, h * 0.12, '#6A4E33', nx, i * h + h * 0.86, 0, 10);
    x = nx;
  }
  // Racimo de dátiles y base de las hojas
  base.blob(0.32, '#7A5C3B', x, H + 0.05, 0, { sy: 0.8 }, 0.15, 2);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    base.sphere(0.07, '#C8862B', x + Math.cos(a) * 0.25, H - 0.2, Math.sin(a) * 0.25, undefined, 1);
  }

  const tint = new Kit();
  const fronds = 9;
  for (let f = 0; f < fronds; f++) {
    const a = (f / fronds) * Math.PI * 2 + (f % 2) * 0.2;
    const lift = f % 2 ? 0.55 : 0.25; // unas más paradas, otras más caídas
    const n = 7;
    const len = 2.9;
    let px = x;
    let py = H + 0.15;
    let pz = 0;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      // El ángulo va bajando: la hoja se arquea
      const pitch = lift - t * 1.5;
      const step = len / n;
      const dx = Math.cos(a) * Math.cos(pitch) * step;
      const dy = Math.sin(pitch) * step;
      const dz = Math.sin(a) * Math.cos(pitch) * step;
      const cx = px + dx / 2;
      const cy = py + dy / 2;
      const cz = pz + dz / 2;
      const w = 0.55 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.08));
      // Raquis y dos folíolos inclinados hacia abajo (V)
      tint.add(new THREE.BoxGeometry(step * 1.05, 0.05, 0.05).rotateZ(pitch).rotateY(-a), '#ffffff', cx, cy, cz);
      for (const s of [-1, 1]) {
        const ox = -Math.sin(a) * s * w * 0.5;
        const oz = Math.cos(a) * s * w * 0.5;
        // Se inclina sobre su propio eje antes de orientarse con la hoja
        const leaf = new THREE.BoxGeometry(step * 1.1, 0.02, w).rotateX(s * 0.6).rotateZ(pitch).rotateY(-a);
        tint.add(leaf, '#ffffff', cx + ox, cy - w * 0.18, cz + oz);
      }
      px += dx;
      py += dy;
      pz += dz;
    }
  }
  return { base: base.build(), tint: shade(tint.build(), H - 2, H + 1, 0.55, x, 0, 5) };
}
