import * as THREE from 'three';
import { Kit } from './kit';

/**
 * Gente de las veredas, en cuatro variantes para que no parezcan clones. Miran hacia +x (la pista).
 * La parte "tint" (remera o buzo) toma el color de la instancia; el resto tiene colores fijos.
 */

export type PersonVariant = 'birra' | 'mate' | 'gorra' | 'boina';

/** Cápsula liviana (se ven chicas: no hacen falta muchos segmentos). */
function cap(k: Kit, r: number, len: number, color: string, x: number, y: number, z: number, o?: Parameters<Kit['add']>[5]): void {
  k.add(new THREE.CapsuleGeometry(r, len, 2, 8), color, x, y, z, o);
}

interface Look {
  skin: string;
  hair: string;
  pants: string;
  shoes: string;
}

const LOOKS: Record<PersonVariant, Look> = {
  birra: { skin: '#D2A27E', hair: '#2A1E14', pants: '#2B3A55', shoes: '#F2F2F2' },
  mate: { skin: '#E6BE9A', hair: '#6B3E1F', pants: '#4A6FA5', shoes: '#C8402F' },
  gorra: { skin: '#9A6646', hair: '#151515', pants: '#3A3A3A', shoes: '#1E1E1E' },
  boina: { skin: '#C99271', hair: '#BDBDBD', pants: '#B7A27E', shoes: '#4A3426' },
};

/** Cuerpo común: zapatillas, piernas, cadera, cuello y cabeza con cara. */
function body(k: Kit, l: Look, o: { legs?: boolean } = {}): void {
  // Zapatillas con suela
  for (const z of [-0.1, 0.1]) {
    cap(k, 0.065, 0.12, l.shoes, 0.05, 0.065, z, { rz: Math.PI / 2, sy: 1, sz: 1.1 });
    k.boxC(0.28, 0.025, 0.13, '#EDEDED', 0.05, 0.012, z);
  }
  if (o.legs !== false) {
    // Piernas (pantalón) un poco más anchas arriba
    for (const z of [-0.1, 0.1]) {
      cap(k, 0.068, 0.36, l.pants, 0, 0.36, z);
      cap(k, 0.08, 0.3, l.pants, 0, 0.72, z * 0.95);
    }
    cap(k, 0.13, 0.12, l.pants, 0, 0.92, 0, { rx: Math.PI / 2, sx: 0.75 });
  }
  // Cuello y cabeza
  k.cyl(0.05, 0.055, 0.12, l.skin, 0, 1.48, 0, 8);
  k.sphere(0.118, l.skin, 0, 1.68, 0, { sy: 1.12, sx: 0.95 }, 2);
  // Orejas, nariz y ojitos
  for (const z of [-0.115, 0.115]) k.sphere(0.028, l.skin, -0.005, 1.67, z, { sz: 0.5 }, 0);
  k.sphere(0.022, l.skin, 0.118, 1.665, 0, undefined, 0);
  for (const z of [-0.042, 0.042]) k.sphere(0.016, '#1A1110', 0.104, 1.705, z, undefined, 0);
}

/** Brazo: manga (tint) arriba y antebrazo con la mano (piel) abajo. */
function arm(base: Kit, tint: Kit, l: Look, z: number, o: { rz?: number; rx?: number; long?: boolean } = {}): void {
  const sh = new THREE.Vector3(0, 1.37, z);
  const rz = o.rz ?? 0;
  const rx = o.rx ?? 0;
  const dir = new THREE.Vector3(0, -1, 0).applyEuler(new THREE.Euler(rx, 0, rz));
  const at = (d: number): THREE.Vector3 => sh.clone().addScaledVector(dir, d);
  const sleeve = o.long ? 0.5 : 0.2;
  const m = at(sleeve / 2);
  cap(tint, 0.058, sleeve, '#ffffff', m.x, m.y, m.z, { rz, rx });
  if (!o.long) {
    const f = at(0.2 + 0.17);
    cap(base, 0.045, 0.26, l.skin, f.x, f.y, f.z, { rz, rx });
  }
  const h = at(0.6);
  base.sphere(0.048, l.skin, h.x, h.y, h.z, undefined, 1);
}

function torso(tint: Kit, belly = 0): void {
  cap(tint, 0.19, 0.3, '#ffffff', 0, 1.18, 0, { sx: 0.62 });
  for (const z of [-0.17, 0.17]) tint.sphere(0.075, '#ffffff', 0, 1.36, z, undefined, 1);
  if (belly) tint.sphere(belly, '#ffffff', 0.06, 1.08, 0, { sx: 0.9 }, 1);
}

export function buildPerson(v: PersonVariant): { base: THREE.BufferGeometry; tint: THREE.BufferGeometry } {
  const l = LOOKS[v];
  const base = new Kit();
  const tint = new Kit();
  body(base, l);
  if (v === 'birra') {
    torso(tint);
    // Pelo corto
    base.sphere(0.125, l.hair, -0.02, 1.74, 0, { sy: 0.62, sx: 1.02 }, 1);
    // Brazo con el vaso adelante y el otro colgando
    arm(base, tint, l, 0.22, { rz: 1.25, rx: -0.15 });
    arm(base, tint, l, -0.22, { rx: 0.08 });
    base.cyl(0.05, 0.04, 0.15, '#F2B134', 0.58, 1.1, 0.26, 8);
    base.cyl(0.052, 0.052, 0.03, '#FFF8E7', 0.58, 1.25, 0.26, 8);
  } else if (v === 'mate') {
    torso(tint);
    // Pelo largo con raya: casquete y melena atrás hasta los hombros
    base.sphere(0.13, l.hair, -0.015, 1.72, 0, { sy: 0.85 }, 1);
    cap(base, 0.11, 0.24, l.hair, -0.06, 1.5, 0, { sz: 1.15, sx: 0.7 });
    // Mate con bombilla en una mano y termo bajo el otro brazo
    arm(base, tint, l, 0.22, { rz: 1.2, rx: -0.2 });
    arm(base, tint, l, -0.22, { rz: 0.15, rx: 0.35 });
    base.sphere(0.055, '#6B4A2E', 0.57, 1.21, 0.28, { sy: 1.15 }, 1);
    base.cyl(0.006, 0.006, 0.14, '#D9D9D9', 0.57, 1.23, 0.28, 6, { rz: -0.25 });
    base.cyl(0.045, 0.045, 0.34, '#2E5E4E', 0.02, 1.0, -0.33, 8, { rx: 0.25 });
    base.cyl(0.035, 0.045, 0.06, '#1C1C1C', 0.02, 1.33, -0.25, 8, { rx: 0.25 });
  } else if (v === 'gorra') {
    // Buzo de manga larga y mochila
    torso(tint);
    base.sphere(0.122, l.hair, -0.02, 1.72, 0, { sy: 0.6 }, 1);
    base.sphere(0.128, '#1E3A5F', -0.01, 1.76, 0, { sy: 0.55 }, 1);
    base.boxC(0.14, 0.02, 0.2, '#1E3A5F', 0.12, 1.75, 0, { rz: -0.15 });
    base.boxC(0.16, 0.36, 0.3, '#3E8E41', -0.2, 1.2, 0);
    base.boxC(0.05, 0.16, 0.26, '#2F6E33', -0.29, 1.12, 0);
    for (const z of [-0.12, 0.12]) base.boxC(0.18, 0.03, 0.03, '#2F6E33', -0.08, 1.33, z, { rz: 0.6 });
    // Saludando con una mano arriba
    arm(base, tint, l, 0.22, { rz: 0.35, rx: -2.6, long: true });
    arm(base, tint, l, -0.22, { rx: 0.1, long: true });
  } else {
    // Señor con boina, pancita y manos atrás
    torso(tint, 0.17);
    base.sphere(0.12, l.hair, -0.03, 1.68, 0, { sy: 0.75 }, 1);
    base.cylC(0.14, 0.04, '#2B2B2B', 0, 1.79, 0, 10, { rz: 0.12 });
    base.sphere(0.02, '#2B2B2B', 0, 1.82, 0, undefined, 0);
    // Bigote
    cap(base, 0.012, 0.06, l.hair, 0.115, 1.635, 0, { rx: Math.PI / 2 });
    arm(base, tint, l, 0.22, { rz: -0.3, rx: -0.1 });
    arm(base, tint, l, -0.22, { rz: -0.3, rx: 0.1 });
  }
  return { base: base.build(), tint: tint.build() };
}
