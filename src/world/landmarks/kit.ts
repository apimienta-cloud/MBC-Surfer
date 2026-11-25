import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Kit para armar modelos low-poly con primitivas y colores por vértice.
 * Todo se fusiona en UNA geometría: un solo draw call por modelo, con un material compartido.
 */

export interface PartOpts {
  rx?: number;
  ry?: number;
  rz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
  /** 0 = mate, 1 = vidrio que refleja (ventanas, vidrieras). */
  gloss?: number;
}

const tmpColor = new THREE.Color();
const tmpEuler = new THREE.Euler();
const tmpQuat = new THREE.Quaternion();
const tmpMat = new THREE.Matrix4();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();

export class Kit {
  private parts: THREE.BufferGeometry[] = [];

  /** Agrega una geometría con color plano, centrada en (x, y, z). */
  add(geo: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0, o: PartOpts = {}): this {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    tmpEuler.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
    tmpQuat.setFromEuler(tmpEuler);
    tmpMat.compose(tmpPos.set(x, y, z), tmpQuat, tmpScale.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1));
    g.applyMatrix4(tmpMat);
    tmpColor.set(color);
    const n = g.attributes.position.count;
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      c[i * 3] = tmpColor.r;
      c[i * 3 + 1] = tmpColor.g;
      c[i * 3 + 2] = tmpColor.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    g.setAttribute('gloss', new THREE.BufferAttribute(new Float32Array(n).fill(o.gloss ?? 0), 1));
    this.parts.push(g);
    geo.dispose();
    return this;
  }

  /** Caja apoyada en el piso: y es la base. */
  box(w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0, o?: PartOpts): this {
    return this.add(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z, o);
  }

  /** Caja centrada en (x, y, z). */
  boxC(w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0, o?: PartOpts): this {
    return this.add(new THREE.BoxGeometry(w, h, d), color, x, y, z, o);
  }

  /** Cilindro apoyado: y es la base. */
  cyl(rTop: number, rBot: number, h: number, color: string, x = 0, y = 0, z = 0, seg = 20, o?: PartOpts): this {
    return this.add(new THREE.CylinderGeometry(rTop, rBot, h, seg), color, x, y + h / 2, z, o);
  }

  /** Cilindro centrado (útil rotado). */
  cylC(r: number, h: number, color: string, x = 0, y = 0, z = 0, seg = 20, o?: PartOpts): this {
    return this.add(new THREE.CylinderGeometry(r, r, h, seg), color, x, y, z, o);
  }

  /** Cápsula vertical centrada (piernas, brazos, torsos redondeados). `len` es el tramo recto. */
  capsule(r: number, len: number, color: string, x = 0, y = 0, z = 0, o?: PartOpts): this {
    return this.add(new THREE.CapsuleGeometry(r, len, 4, 12), color, x, y, z, o);
  }

  cone(r: number, h: number, color: string, x = 0, y = 0, z = 0, seg = 20, o?: PartOpts): this {
    return this.add(new THREE.ConeGeometry(r, h, seg), color, x, y + h / 2, z, o);
  }

  sphere(r: number, color: string, x = 0, y = 0, z = 0, o?: PartOpts, detail = 2): this {
    return this.add(new THREE.IcosahedronGeometry(r, detail), color, x, y, z, o);
  }

  /**
   * Esfera irregular y suave (copas de árboles, arbustos, rocas): se deforma con ruido
   * según la posición, así las costuras quedan cerradas y el sombreado es continuo.
   */
  blob(r: number, color: string, x = 0, y = 0, z = 0, o?: PartOpts, bump = 0.14, seed = 0, detail = 3): this {
    const g = mergeVertices(new THREE.IcosahedronGeometry(r, detail).deleteAttribute('normal').deleteAttribute('uv'));
    const p = g.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      const n =
        Math.sin(v.x * 3.1 + seed) * Math.sin(v.y * 2.7 + seed * 1.7) * Math.sin(v.z * 3.4 + seed * 0.6) +
        0.5 * Math.sin(v.x * 7.3 - seed) * Math.sin(v.y * 6.1 + seed) * Math.sin(v.z * 6.7);
      v.multiplyScalar(r * (1 + bump * n));
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return this.add(g, color, x, y, z, o);
  }

  /** Media esfera (cúpula) apoyada en y. */
  dome(r: number, color: string, x = 0, y = 0, z = 0, o?: PartOpts): this {
    return this.add(new THREE.SphereGeometry(r, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), color, x, y, z, o);
  }

  /**
   * Prisma triangular (frontón / techo a dos aguas) apoyado en y: base w a lo largo de z,
   * alto h, profundidad d a lo largo de x. Con ry = π/2 queda con la base a lo largo de x.
   */
  prism(w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0, o: PartOpts = {}): this {
    const shape = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]);
    const g = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
    g.rotateY(Math.PI / 2);
    g.translate(-d / 2, 0, 0);
    return this.add(g, color, x, y, z, o);
  }

  /** Grilla de ventanas sobre una cara. axis 'x' = cara que mira a +x, 'z' = cara que mira a +z. */
  windows(
    axis: 'x' | 'z',
    face: number,
    from: number,
    to: number,
    y0: number,
    y1: number,
    cols: number,
    rows: number,
    color: string,
    ww = 0.9,
    wh = 1.4,
    frame?: string,
  ): this {
    const span = to - from;
    const fh = (y1 - y0) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const t = from + (span * (c + 0.5)) / cols;
        const y = y0 + fh * r + (fh - wh) / 2;
        this.pane(axis, face, t, y, ww, wh, color, frame);
      }
    }
    return this;
  }

  /**
   * Una ventana: vidrio que refleja y, si hay color de marco, marco y alféizar salientes.
   * `t` es la posición a lo largo de la cara e `y` la base.
   */
  pane(axis: 'x' | 'z', face: number, t: number, y: number, ww: number, wh: number, glass: string, frame?: string): this {
    // Planos (2 triángulos) para el vidrio: de las ventanas solo se ve el frente
    const at = (off: number, yy: number, tt = t): [number, number, number] => (axis === 'x' ? [face + off, yy, tt] : [tt, yy, face + off]);
    const rot = axis === 'x' ? Math.PI / 2 : 0;
    this.add(new THREE.PlaneGeometry(ww, wh), glass, ...at(0.03, y + wh / 2), { ry: rot, gloss: 1 });
    if (!frame) return this;
    const fw = 0.09;
    const dep = 0.1;
    // Marco: dos parantes, dintel y alféizar más ancho
    for (const s of [-1, 1]) this.add(new THREE.BoxGeometry(fw, wh + fw, dep), frame, ...at(dep / 2, y + wh / 2, t + s * (ww / 2 + fw / 2)), { ry: rot });
    this.add(new THREE.BoxGeometry(ww + fw * 2, fw, dep), frame, ...at(dep / 2, y + wh + fw / 2), { ry: rot });
    this.add(new THREE.BoxGeometry(ww + fw * 3, 0.08, dep * 2.2), frame, ...at(dep * 1.1, y - 0.04), { ry: rot });
    // Travesaño en las ventanas altas
    if (wh > 1.3) this.add(new THREE.BoxGeometry(0.05, wh, 0.04), frame, ...at(0.05, y + wh / 2), { ry: rot });
    return this;
  }

  build(): THREE.BufferGeometry {
    const g = mergeGeometries(this.parts, false);
    if (!g) throw new Error('Kit vacío');
    for (const p of this.parts) p.dispose();
    this.parts = [];
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

/**
 * Material compartido para todo lo armado con el Kit (colores por vértice, sombreado suave).
 * El atributo `gloss` por vértice vuelve brillantes y reflejantes las partes de vidrio, sin otro material.
 */
export const kitMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 });
kitMaterial.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float gloss;\nvarying float vGloss;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGloss = gloss;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vGloss;')
    .replace(
      '#include <metalnessmap_fragment>',
      '#include <metalnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.06, vGloss);\nmetalnessFactor = mix(metalnessFactor, 0.55, vGloss);',
    );
};

// ---------- Cosas que se prenden de noche (guirnaldas, carteles, ventanales) ----------

interface Glow {
  mat: THREE.Material & { emissiveIntensity?: number; opacity: number };
  prop: 'emissiveIntensity' | 'opacity';
  day: number;
  night: number;
}
const glowing: Glow[] = [];

/** Registra un material emisivo: su intensidad va de `day` a `night` según cae la noche. */
export function glowEmissive<T extends THREE.MeshStandardMaterial>(mat: T, day: number, night: number): T {
  mat.emissiveIntensity = day;
  glowing.push({ mat, prop: 'emissiveIntensity', day, night });
  return mat;
}

/** Registra un material transparente (bañados de luz): su opacidad va de `day` a `night`. */
export function glowOpacity<T extends THREE.Material>(mat: T, day: number, night: number): T {
  mat.transparent = true;
  mat.opacity = day;
  glowing.push({ mat: mat as Glow['mat'], prop: 'opacity', day, night });
  return mat;
}

/** 0 = tarde, 1 = noche cerrada. Lo llama el ChunkManager con la oscuridad del cielo. */
export function setNightGlow(f: number): void {
  for (const g of glowing) g.mat[g.prop] = g.day + (g.night - g.day) * f;
}
