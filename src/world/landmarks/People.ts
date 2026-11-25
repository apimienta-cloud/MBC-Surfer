import * as THREE from 'three';
import { Kit } from './kit';

/**
 * Gente de las veredas, en cuatro variantes para que no parezcan clones. Miran hacia +x (la pista).
 * Cuerpo con siluetas torneadas (pantorrilla, rodilla, muslo, cintura, pecho y hombros), cara con
 * ojos, cejas, nariz y boca, pelo con volumen y ropa con cuello, mangas y cinturón.
 * La parte "tint" (remera, buzo o saco) toma el color de la instancia; el resto tiene colores fijos.
 */

export type PersonVariant = 'birra' | 'mate' | 'gorra' | 'boina';

type P = [number, number];
const V = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const DOWN = V(0, -1, 0);

/** Pieza torneada: perfil (radio, altura) de abajo hacia arriba. */
function lathe(pts: P[], seg = 12): THREE.BufferGeometry {
  return new THREE.LatheGeometry(
    pts.map(([r, y]) => new THREE.Vector2(r, y)),
    seg,
  );
}

/** Agrega una pieza hecha "hacia abajo" desde su origen, orientada en la dirección `dir`. */
function segment(k: Kit, geo: THREE.BufferGeometry, color: string, from: THREE.Vector3, dir: THREE.Vector3): void {
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(DOWN, dir.clone().normalize()));
  k.add(geo, color, from.x, from.y, from.z);
}

interface Look {
  skin: string;
  hair: string;
  pants: string;
  shoes: string;
  sole: string;
  lips: string;
}

const LOOKS: Record<PersonVariant, Look> = {
  birra: { skin: '#D6A47F', hair: '#2A1E14', pants: '#3B5B8C', shoes: '#F4F4F4', sole: '#C9B48A', lips: '#9A5A4E' },
  mate: { skin: '#EBC4A0', hair: '#7A4524', pants: '#2F4A75', shoes: '#C8402F', sole: '#F2F2F2', lips: '#B5555A' },
  gorra: { skin: '#9C6748', hair: '#151515', pants: '#3C3F44', shoes: '#1E1E1E', sole: '#F2F2F2', lips: '#6E3E35' },
  boina: { skin: '#CC9774', hair: '#C9C9C9', pants: '#B9A47F', shoes: '#4A3426', sole: '#2A1E16', lips: '#8E5248' },
};

// Proporciones (metros): una persona de ~1,75 m
const HIP = 0.9;
const SHOULDER_Y = 1.38;
const SHOULDER_Z = 0.19;
const HEAD_Y = 1.5;

/** Zapatillas: capellada redondeada y suela un poco más ancha. */
function shoes(k: Kit, l: Look): void {
  for (const z of [-0.095, 0.095]) {
    k.add(new THREE.CapsuleGeometry(0.048, 0.13, 3, 10).rotateZ(Math.PI / 2), l.shoes, 0.04, 0.055, z, { sy: 0.78, sz: 1.12 });
    k.add(new THREE.CapsuleGeometry(0.052, 0.15, 2, 10).rotateZ(Math.PI / 2), l.sole, 0.04, 0.022, z, { sy: 0.32, sz: 1.18 });
  }
}

/** Piernas con forma (tobillo, pantorrilla, rodilla, muslo). `bare` = desde la rodilla para abajo se ve la piel. */
function legs(k: Kit, l: Look, bare = false): void {
  const low: P[] = [
    [0.036, 0.07],
    [0.042, 0.11],
    [0.054, 0.22],
    [0.061, 0.33],
    [0.053, 0.45],
    [0.05, 0.5],
  ];
  const up: P[] = [
    [0.052, 0.48],
    [0.062, 0.6],
    [0.074, 0.74],
    [0.086, 0.86],
    [0.084, 0.96],
  ];
  for (const z of [-0.095, 0.095]) {
    k.add(lathe(low, 10), bare ? l.skin : l.pants, 0, 0, z, { sx: 0.92 });
    k.add(lathe(up, 10), l.pants, 0, 0, z, { sx: 0.92 });
    // Botamanga (o calcetín)
    k.add(lathe([[0.046, 0.08], [0.05, 0.1], [0.048, 0.13]], 10), bare ? '#F2F2F2' : l.pants, 0, 0, z);
  }
  // Cadera y cinturón
  k.add(
    lathe([
      [0.12, HIP - 0.06],
      [0.158, HIP],
      [0.164, HIP + 0.07],
      [0.15, HIP + 0.13],
    ]),
    l.pants,
    0,
    0,
    0,
    { sx: 0.72, sz: 1.18 },
  );
  k.add(lathe([[0.153, HIP + 0.075], [0.156, HIP + 0.1], [0.152, HIP + 0.115]]), '#3A2A1E', 0, 0, 0, { sx: 0.72, sz: 1.18 });
  k.boxC(0.012, 0.03, 0.04, '#C8A24A', 0.112, HIP + 0.095, 0);
}

/** Torso de la remera o buzo; `belly` agranda la panza y `slim` lo afina. */
function torso(t: Kit, belly = 0, slim = 1): void {
  const s = slim;
  t.add(
    lathe(
      [
        [0.152 * s, 0.95],
        [0.15 * s, 1.0],
        [(0.152 + belly) * s, 1.08],
        [(0.158 + belly * 0.6) * s, 1.17],
        [0.168 * s, 1.27],
        [0.166 * s, 1.34],
        [0.145 * s, 1.4],
        [0.1, 1.44],
        [0.055, 1.46],
      ],
      14,
    ),
    '#ffffff',
    0,
    0,
    0,
    { sx: 0.7, sz: 1.14 },
  );
  // Hombros redondeados
  for (const z of [-1, 1]) t.sphere(0.056, '#ffffff', 0, SHOULDER_Y - 0.02, z * (SHOULDER_Z - 0.03) * s, { sy: 0.8, sx: 0.9 }, 2);
  // Cuello de la remera
  t.add(new THREE.TorusGeometry(0.056, 0.011, 6, 16).rotateX(Math.PI / 2), '#ffffff', 0, 1.445, 0, { sx: 0.85 });
}

/** Cuello y cabeza con cara. */
function head(k: Kit, l: Look, o: { brows?: string; mustache?: boolean } = {}): void {
  k.add(lathe([[0.046, 1.42], [0.049, 1.48], [0.046, 1.54]], 10), l.skin, 0, 0, 0);
  // Cabeza: mentón más angosto que el cráneo
  k.add(
    lathe(
      [
        [0.001, 0],
        [0.03, 0.006],
        [0.062, 0.032],
        [0.086, 0.074],
        [0.098, 0.12],
        [0.1, 0.165],
        [0.094, 0.205],
        [0.074, 0.238],
        [0.04, 0.257],
        [0.001, 0.262],
      ],
      16,
    ),
    l.skin,
    0,
    HEAD_Y,
    0,
    { sx: 1.04, sz: 0.86 },
  );
  // Orejas
  for (const z of [-1, 1]) k.sphere(0.026, l.skin, -0.005, HEAD_Y + 0.13, z * 0.085, { sz: 0.42, sy: 1.25 }, 1);
  // Ojos: blanco e iris
  for (const z of [-1, 1]) {
    k.sphere(0.015, '#F7F4EE', 0.088, HEAD_Y + 0.143, z * 0.034, { sx: 0.55 }, 1);
    k.sphere(0.009, '#2B1D14', 0.0955, HEAD_Y + 0.142, z * 0.034, { sx: 0.5 }, 1);
    // Ceja
    k.add(new THREE.CapsuleGeometry(0.0055, 0.026, 2, 6).rotateX(Math.PI / 2), o.brows ?? l.hair, 0.095, HEAD_Y + 0.17, z * 0.036, { rx: -z * 0.1 });
  }
  // Nariz y boca
  k.add(new THREE.ConeGeometry(0.014, 0.04, 8).rotateZ(-Math.PI / 2 - 0.35), l.skin, 0.105, HEAD_Y + 0.115, 0, { sz: 0.85 });
  k.add(new THREE.CapsuleGeometry(0.0055, 0.026, 2, 6).rotateX(Math.PI / 2), l.lips, 0.094, HEAD_Y + 0.072, 0);
  if (o.mustache) k.add(new THREE.CapsuleGeometry(0.011, 0.045, 2, 8).rotateX(Math.PI / 2), l.hair, 0.1, HEAD_Y + 0.09, 0);
}

/** Pelo: casquete que deja la frente libre (más bajo atrás, en la nuca). */
function hairCap(k: Kit, color: string, r = 0.115, cover = 0.6, tilt = 1.0): void {
  // Un poco más grande que la cabeza, para que la cubra; el borde de adelante queda en la frente
  const g = new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI * cover).rotateZ(tilt);
  k.add(g, color, -0.008, HEAD_Y + 0.158, 0, { sz: 0.9 });
}

interface ArmPose {
  upper: THREE.Vector3;
  fore: THREE.Vector3;
}

/**
 * Brazo con forma (hombro, codo, muñeca) y mano con pulgar. La manga es tint: corta (`sleeve` = largo
 * desde el hombro) o larga hasta la muñeca. Devuelve dónde quedó la mano.
 */
function arm(b: Kit, t: Kit, l: Look, side: number, pose: ArmPose, sleeve: number | 'long', slim = 1): THREE.Vector3 {
  const sh = V(0, SHOULDER_Y - 0.02, side * SHOULDER_Z * slim);
  const LU = 0.28;
  const LF = 0.25;
  const elbow = sh.clone().addScaledVector(pose.upper.clone().normalize(), LU);
  const wrist = elbow.clone().addScaledVector(pose.fore.clone().normalize(), LF);
  const upperSkin: P[] = [
    [0.04, -LU - 0.01],
    [0.046, -LU * 0.6],
    [0.052, -LU * 0.25],
    [0.05, 0.02],
  ];
  const foreSkin: P[] = [
    [0.03, -LF],
    [0.036, -LF * 0.55],
    [0.042, -LF * 0.15],
    [0.041, 0.01],
  ];
  if (sleeve === 'long') {
    // Manga larga entera (tint) con puño
    segment(t, lathe(upperSkin.map(([r, y]) => [r + 0.012, y] as P), 10), '#ffffff', sh, pose.upper);
    segment(t, lathe(foreSkin.map(([r, y]) => [r + 0.012, y] as P), 10), '#ffffff', elbow, pose.fore);
    segment(t, lathe([[0.04, -LF - 0.005], [0.044, -LF + 0.02], [0.042, -LF + 0.035]], 10), '#ffffff', elbow, pose.fore);
    t.sphere(0.056, '#ffffff', elbow.x, elbow.y, elbow.z, undefined, 1);
  } else {
    segment(b, lathe(upperSkin, 10), l.skin, sh, pose.upper);
    segment(b, lathe(foreSkin, 10), l.skin, elbow, pose.fore);
    segment(t, lathe([[0.063, -sleeve - 0.005], [0.064, -sleeve + 0.02], [0.062, -sleeve * 0.5], [0.06, 0.03]], 10), '#ffffff', sh, pose.upper);
    b.sphere(0.045, l.skin, elbow.x, elbow.y, elbow.z, undefined, 1);
  }
  // Mano: palma ovalada y pulgar
  const fd = pose.fore.clone().normalize();
  const hand = wrist.clone().addScaledVector(fd, 0.045);
  segment(b, new THREE.SphereGeometry(0.042, 12, 8).scale(0.62, 1.15, 1), l.skin, hand, fd);
  const thumb = new THREE.CapsuleGeometry(0.013, 0.028, 2, 6).translate(0, -0.02, 0);
  const tdir = fd.clone().add(V(0.4, 0, side * 0.5)).normalize();
  segment(b, thumb, l.skin, wrist.clone().addScaledVector(V(0.3, 0, side * 0.6).normalize(), 0.025), tdir);
  return hand.addScaledVector(fd, 0.02);
}

export function buildPerson(v: PersonVariant): { base: THREE.BufferGeometry; tint: THREE.BufferGeometry } {
  const l = LOOKS[v];
  const b = new Kit();
  const t = new Kit();
  shoes(b, l);
  if (v === 'birra') {
    // Remera, jean y zapatillas blancas; vaso de birra en la mano
    legs(b, l);
    torso(t);
    head(b, l);
    hairCap(b, l.hair, 0.115, 0.6, 1.0);
    b.sphere(0.035, l.hair, 0.03, HEAD_Y + 0.262, 0.02, { sy: 0.6 }, 1);
    const hand = arm(b, t, l, 1, { upper: V(0.35, -1, 0.12), fore: V(1, 0.3, 0.02) }, 0.13);
    arm(b, t, l, -1, { upper: V(0.06, -1, -0.12), fore: V(0.18, -1, -0.03) }, 0.13);
    b.add(lathe([[0.034, -0.08], [0.044, 0.07], [0.047, 0.08]], 14), '#F2B134', hand.x + 0.01, hand.y + 0.02, hand.z + 0.035);
    b.add(lathe([[0.047, 0.07], [0.05, 0.095], [0.02, 0.11], [0.001, 0.112]], 14), '#FFF8E7', hand.x + 0.01, hand.y + 0.02, hand.z + 0.035);
  } else if (v === 'mate') {
    // Pollera de jean, pelo largo, mate en una mano y termo bajo el brazo
    legs(b, l, true);
    b.add(
      lathe(
        [
          [0.14, 0.52],
          [0.175, 0.56],
          [0.162, 0.76],
          [0.15, 0.95],
          [0.146, 1.0],
        ],
        14,
      ),
      l.pants,
      0,
      0,
      0,
      { sx: 0.8, sz: 1.15 },
    );
    torso(t, 0, 0.92);
    head(b, l);
    hairCap(b, l.hair, 0.118, 0.64, 0.9);
    // Flequillo de costado
    b.sphere(0.05, l.hair, 0.07, HEAD_Y + 0.225, 0.04, { sx: 0.7, sy: 0.55, sz: 1.2 }, 1);
    // Melena larga atrás, hasta los omóplatos
    b.add(
      lathe(
        [
          [0.05, 1.22],
          [0.09, 1.3],
          [0.105, 1.45],
          [0.1, 1.62],
          [0.06, 1.72],
        ],
        12,
      ),
      l.hair,
      -0.055,
      0,
      0,
      { sx: 0.55, sz: 1.05 },
    );
    const hand = arm(b, t, l, 1, { upper: V(0.3, -1, 0.1), fore: V(1, 0.4, -0.12) }, 'long', 0.92);
    const hand2 = arm(b, t, l, -1, { upper: V(0.08, -1, -0.12), fore: V(0.9, -0.15, 0.25) }, 'long', 0.92);
    // Mate (calabaza con virola) y bombilla
    b.add(lathe([[0.001, -0.03], [0.04, -0.015], [0.048, 0.03], [0.036, 0.07], [0.038, 0.08]], 12), '#6B4A2E', hand.x + 0.02, hand.y, hand.z + 0.03);
    b.add(lathe([[0.038, 0.075], [0.04, 0.09]], 12), '#C9C9C9', hand.x + 0.02, hand.y, hand.z + 0.03);
    b.cyl(0.004, 0.004, 0.15, '#D9D9D9', hand.x + 0.03, hand.y + 0.05, hand.z + 0.03, 6, { rz: -0.3 });
    // Termo apoyado contra el cuerpo
    b.add(lathe([[0.04, -0.17], [0.044, -0.15], [0.044, 0.12], [0.034, 0.16], [0.03, 0.2]], 14), '#2E5E4E', hand2.x - 0.04, hand2.y + 0.02, hand2.z - 0.05);
    b.add(lathe([[0.03, 0.19], [0.032, 0.24], [0.001, 0.25]], 14), '#1C1C1C', hand2.x - 0.04, hand2.y + 0.02, hand2.z - 0.05);
  } else if (v === 'gorra') {
    // Buzo con capucha, jogging, gorra y mochila; saluda con una mano
    legs(b, l);
    torso(t, 0.01);
    head(b, l);
    hairCap(b, l.hair, 0.115, 0.58, 1.05);
    // Gorra: copa y visera
    b.add(new THREE.SphereGeometry(0.122, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), '#1E3A5F', -0.008, HEAD_Y + 0.17, 0, { sz: 0.92, sy: 0.9 });
    b.sphere(0.012, '#1E3A5F', -0.008, HEAD_Y + 0.28, 0, undefined, 0);
    b.add(new THREE.CylinderGeometry(0.1, 0.1, 0.012, 16, 1, false, 0, Math.PI), '#1E3A5F', 0.07, HEAD_Y + 0.18, 0, { sx: 0.95, sz: 0.88, rz: -0.12 });
    // Capucha caída en la espalda
    t.add(new THREE.TorusGeometry(0.075, 0.035, 8, 16).rotateX(Math.PI / 2), '#ffffff', -0.05, 1.43, 0, { sx: 0.85, sz: 1.2 });
    // Mochila con correas
    b.add(new THREE.CapsuleGeometry(0.11, 0.18, 3, 10), '#3E8E41', -0.17, 1.17, 0, { sx: 0.62, sz: 1.25 });
    b.boxC(0.05, 0.14, 0.2, '#2F6E33', -0.25, 1.08, 0);
    for (const z of [-0.1, 0.1]) b.add(new THREE.TorusGeometry(0.12, 0.012, 4, 12, Math.PI), '#2F6E33', -0.03, 1.27, z, { rz: Math.PI / 2 + 0.2, sx: 1.1 });
    arm(b, t, l, 1, { upper: V(0.1, 0.35, 1), fore: V(0.08, 1, 0.12) }, 'long');
    arm(b, t, l, -1, { upper: V(0.05, -1, -0.1), fore: V(0.12, -1, -0.02) }, 'long');
  } else {
    // Señor de boina con suéter, pancita, lentes y bigote; manos atrás
    legs(b, l);
    torso(t, 0.035);
    head(b, l, { mustache: true, brows: '#9A9A9A' });
    hairCap(b, l.hair, 0.113, 0.62, 1.1);
    // Boina chata con el cabito
    b.add(new THREE.SphereGeometry(0.128, 18, 8), '#2B2B2B', -0.015, HEAD_Y + 0.255, 0, { sy: 0.28, rz: 0.15 });
    b.cyl(0.006, 0.006, 0.025, '#2B2B2B', -0.01, HEAD_Y + 0.285, 0, 6);
    // Lentes
    for (const z of [-1, 1]) b.add(new THREE.TorusGeometry(0.022, 0.0035, 4, 12).rotateY(Math.PI / 2), '#2A2A2A', 0.1, HEAD_Y + 0.145, z * 0.034);
    b.boxC(0.004, 0.004, 0.024, '#2A2A2A', 0.1, HEAD_Y + 0.148, 0);
    arm(b, t, l, 1, { upper: V(-0.45, -1, 0.12), fore: V(-0.45, -0.15, -0.75) }, 'long');
    arm(b, t, l, -1, { upper: V(-0.45, -1, -0.12), fore: V(-0.45, -0.1, 0.75) }, 'long');
  }
  return { base: b.build(), tint: t.build() };
}
