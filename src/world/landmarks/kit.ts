import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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
  cyl(rTop: number, rBot: number, h: number, color: string, x = 0, y = 0, z = 0, seg = 12, o?: PartOpts): this {
    return this.add(new THREE.CylinderGeometry(rTop, rBot, h, seg), color, x, y + h / 2, z, o);
  }

  /** Cilindro centrado (útil rotado). */
  cylC(r: number, h: number, color: string, x = 0, y = 0, z = 0, seg = 12, o?: PartOpts): this {
    return this.add(new THREE.CylinderGeometry(r, r, h, seg), color, x, y, z, o);
  }

  cone(r: number, h: number, color: string, x = 0, y = 0, z = 0, seg = 12, o?: PartOpts): this {
    return this.add(new THREE.ConeGeometry(r, h, seg), color, x, y + h / 2, z, o);
  }

  sphere(r: number, color: string, x = 0, y = 0, z = 0, o?: PartOpts, detail = 1): this {
    return this.add(new THREE.IcosahedronGeometry(r, detail), color, x, y, z, o);
  }

  /** Media esfera (cúpula) apoyada en y. */
  dome(r: number, color: string, x = 0, y = 0, z = 0, o?: PartOpts): this {
    return this.add(new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), color, x, y, z, o);
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
  ): this {
    const span = to - from;
    const fh = (y1 - y0) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const t = from + (span * (c + 0.5)) / cols;
        const y = y0 + fh * r + (fh - wh) / 2;
        // Planos (2 triángulos) en vez de cajas: de las ventanas solo se ve el frente
        if (axis === 'x') this.add(new THREE.PlaneGeometry(ww, wh), color, face + 0.03, y + wh / 2, t, { ry: Math.PI / 2 });
        else this.add(new THREE.PlaneGeometry(ww, wh), color, t, y + wh / 2, face + 0.03);
      }
    }
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

/** Material compartido para todo lo armado con el Kit (colores por vértice, sombreado plano). */
export const kitMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
