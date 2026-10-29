import * as THREE from 'three';
import { Kit, kitMaterial } from './kit';

/**
 * Props repetidos (faroles, árboles, sombrillas...) con InstancedMesh: un draw call por tipo para todo el mundo.
 * Cada prop tiene una parte "base" con colores fijos y opcionalmente una parte "tint" que toma el color de la instancia.
 * Los props miran hacia +x (la pista, si están del lado izquierdo).
 */
export type PropType = 'farol' | 'arbol' | 'palmera' | 'sombrilla' | 'pescador' | 'puestoFeria' | 'contenedor' | 'muro';

interface PropDef {
  base: THREE.BufferGeometry;
  tint?: THREE.BufferGeometry;
  emissive?: boolean;
}

function defs(): Record<PropType, PropDef> {
  const W = '#FFFFFF';
  const farol = new Kit()
    .cyl(0.16, 0.22, 0.5, '#2F3B34', 0, 0, 0, 8)
    .cyl(0.08, 0.1, 4.4, '#2F3B34', 0, 0, 0, 8)
    .boxC(1.2, 0.1, 0.1, '#2F3B34', 0.55, 4.3, 0)
    .cone(0.3, 0.35, '#2F3B34', 1.1, 4.05, 0, 6)
    .build();
  const bulb = new Kit().sphere(0.2, W, 1.1, 3.95, 0, undefined, 0).build();

  const arbol = new Kit().cyl(0.18, 0.28, 2.6, '#6B4A2E', 0, 0, 0, 6).build();
  const copa = new Kit().sphere(1.9, W, 0, 3.8, 0, undefined, 0).sphere(1.3, W, 0.8, 4.6, 0.6, undefined, 0).sphere(1.2, W, -0.7, 4.4, -0.6, undefined, 0).build();

  const palmera = new Kit()
    .cyl(0.2, 0.3, 3, '#8A6A45', 0, 0, 0, 6)
    .cyl(0.16, 0.2, 3, '#7A5C3B', 0.15, 3, 0, 6, { rz: -0.05 })
    .build();
  const hojas = new Kit();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    hojas.boxC(2.6, 0.08, 0.5, W, 0.3 + Math.cos(a) * 1.2, 5.8, Math.sin(a) * 1.2, { ry: -a, rz: -0.35 });
  }

  const sombrilla = new Kit().cyl(0.04, 0.04, 2.3, '#DDDDDD', 0, 0, 0, 4).build();
  const tela = new Kit().cone(1.4, 0.6, W, 0, 2.0, 0, 8).build();

  // Pescador sentado en el muro, mirando al agua (-x), con la caña afuera
  const pescador = new Kit()
    .boxC(0.45, 0.6, 0.4, '#3E5C7A', -0.05, 0.3, 0)
    .boxC(0.5, 0.15, 0.4, '#4A4A4A', -0.3, 0.05, 0)
    .boxC(0.15, 0.5, 0.35, '#4A4A4A', -0.55, -0.2, 0)
    .sphere(0.17, '#D9A77E', -0.05, 0.78, 0, undefined, 0)
    .cylC(0.2, 0.08, '#C8402F', -0.05, 0.92, 0, 8)
    .cylC(0.025, 4, '#2A2A2A', -1.6, 1.4, 0, 4, { rz: -1.0 })
    .build();

  const puesto = new Kit()
    .box(2.2, 0.9, 1.2, '#8B6B48', 0, 0, 0)
    .box(0.08, 2.3, 0.08, '#555555', 1.05, 0, 0.55)
    .box(0.08, 2.3, 0.08, '#555555', 1.05, 0, -0.55)
    .box(0.08, 2.5, 0.08, '#555555', -1.05, 0, 0.55)
    .box(0.08, 2.5, 0.08, '#555555', -1.05, 0, -0.55);
  // Mercadería: frutas, plantas y pilas de libros
  const goods = ['#E07A2E', '#D23B2B', '#7CB342', '#F2C230', '#6D4C41', '#3F6E9E'];
  for (let i = 0; i < 6; i++) puesto.sphere(0.18, goods[i], -0.7 + (i % 3) * 0.6, 1.05, -0.3 + Math.floor(i / 3) * 0.6, undefined, 0);
  puesto.box(0.5, 0.35, 0.35, '#3F6E9E', 0.7, 0.9, 0.3).box(0.45, 0.3, 0.3, '#A23B3B', 0.7, 1.25, 0.3);
  const toldo = new Kit().boxC(2.6, 0.08, 1.7, W, 0, 2.45, 0, { rz: 0.12 }).boxC(0.05, 0.35, 1.7, W, 1.3, 2.15, 0).build();

  const contBase = new Kit().box(2.5, 0.2, 6, '#333333', 0, 0, 0).build();
  const cont = new Kit().box(2.45, 2.4, 5.9, W, 0, 0.2, 0);
  for (let z = -2.6; z <= 2.6; z += 0.65) cont.box(2.55, 2.3, 0.12, W, 0, 0.25, z);

  const muro = new Kit().box(0.8, 0.9, 6.02, '#BDB6A6', 0, 0, 0).box(0.95, 0.15, 6.02, '#D6D0C2', 0, 0.9, 0).build();

  return {
    farol: { base: farol, tint: bulb, emissive: true },
    arbol: { base: arbol, tint: copa },
    palmera: { base: palmera, tint: hojas.build() },
    sombrilla: { base: sombrilla, tint: tela },
    pescador: { base: pescador },
    puestoFeria: { base: puesto.build(), tint: toldo },
    contenedor: { base: contBase, tint: cont.build() },
    muro: { base: muro },
  };
}

// Color de la parte teñible cuando la zona no pide uno
const DEFAULT_TINT: Record<PropType, string> = {
  farol: '#FFE6A8',
  arbol: '#4E8F45',
  palmera: '#4F8A3C',
  sombrilla: '#E63946',
  pescador: '#ffffff',
  puestoFeria: '#E63946',
  contenedor: '#C8402F',
  muro: '#ffffff',
};

const PER_SLOT: Record<PropType, number> = {
  farol: 16,
  arbol: 40,
  palmera: 16,
  sombrilla: 24,
  pescador: 6,
  puestoFeria: 44,
  contenedor: 40,
  muro: 12,
};

interface Entry {
  base: THREE.InstancedMesh;
  tint: THREE.InstancedMesh | null;
  counts: number[];
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpP = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const tmpE = new THREE.Euler();
const tmpC = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export class PropInstancer {
  readonly group = new THREE.Group();
  private entries: Record<PropType, Entry>;
  private emissiveMats: THREE.MeshStandardMaterial[] = [];

  constructor(private slots: number) {
    const d = defs();
    const tintMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true });
    this.entries = {} as Record<PropType, Entry>;
    for (const type of Object.keys(d) as PropType[]) {
      const cap = PER_SLOT[type] * slots;
      const def = d[type];
      const base = new THREE.InstancedMesh(def.base, kitMaterial, cap);
      let tint: THREE.InstancedMesh | null = null;
      if (def.tint) {
        let mat = tintMat;
        if (def.emissive) {
          mat = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#FFC86B', emissiveIntensity: 0.2 });
          this.emissiveMats.push(mat);
        }
        tint = new THREE.InstancedMesh(def.tint, mat, cap);
        tint.setColorAt(0, tmpC.set('#ffffff'));
      }
      for (const m of tint ? [base, tint] : [base]) {
        m.frustumCulled = false;
        for (let i = 0; i < cap; i++) m.setMatrixAt(i, ZERO);
        this.group.add(m);
      }
      this.entries[type] = { base, tint, counts: new Array(slots).fill(0) };
    }
  }

  begin(slot: number): void {
    for (const e of Object.values(this.entries)) e.counts[slot] = 0;
  }

  /** Agrega una instancia en coordenadas de mundo. */
  add(slot: number, type: PropType, x: number, y: number, z: number, rotY = 0, scale = 1, color = DEFAULT_TINT[type]): void {
    const e = this.entries[type];
    const n = e.counts[slot];
    if (n >= PER_SLOT[type]) return;
    e.counts[slot] = n + 1;
    const i = slot * PER_SLOT[type] + n;
    tmpQ.setFromEuler(tmpE.set(0, rotY, 0));
    tmpM.compose(tmpP.set(x, y, z), tmpQ, tmpS.setScalar(scale));
    e.base.setMatrixAt(i, tmpM);
    if (e.tint) {
      e.tint.setMatrixAt(i, tmpM);
      e.tint.setColorAt(i, tmpC.set(color));
    }
  }

  /** Esconde las instancias que sobran del slot y marca para subir a GPU. */
  end(slot: number): void {
    for (const [type, e] of Object.entries(this.entries) as [PropType, Entry][]) {
      const per = PER_SLOT[type];
      for (let n = e.counts[slot]; n < per; n++) {
        e.base.setMatrixAt(slot * per + n, ZERO);
        e.tint?.setMatrixAt(slot * per + n, ZERO);
      }
      // Solo se dibuja hasta la última instancia usada (las vacías igual cuestan vértices)
      let count = 0;
      e.counts.forEach((c, s) => {
        if (c > 0) count = s * per + c;
      });
      e.base.count = count;
      if (e.tint) e.tint.count = count;
      e.base.instanceMatrix.needsUpdate = true;
      if (e.tint) {
        e.tint.instanceMatrix.needsUpdate = true;
        if (e.tint.instanceColor) e.tint.instanceColor.needsUpdate = true;
      }
    }
  }

  /** De noche se prenden los faroles. */
  setNight(f: number): void {
    for (const m of this.emissiveMats) m.emissiveIntensity = 0.2 + f * 2.2;
  }

  get slotCount(): number {
    return this.slots;
  }
}
