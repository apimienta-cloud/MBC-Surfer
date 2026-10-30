import * as THREE from 'three';
import { config, ObstacleVariant } from '../config';
import { glowEmissive, Kit } from './landmarks/kit';
import { cartelDisc } from './landmarks/LocalesMBC';

const O = config.obstacles;
const B = O.bondi;
const T = O.taxi;
const TAXI_W = 1.75;
const LINES = config.colors.bondiLines;
const SIGN = config.colors.bondiSign;
const TC = config.colors.taxi;

/**
 * Modelos de obstáculos (todos originales, sin marcas). Cada uno respeta la caja de colisión de su tipo:
 * centrado en x y z, apoyado en y = 0. Los ómnibus y el taxi tienen el frente hacia +z.
 */
export function buildObstacleModel(variant: ObstacleVariant, livery = 0): THREE.BufferGeometry {
  const k = new Kit();
  switch (variant) {
    // ---------- Bajos (se saltan) ----------
    case 'contenedor': {
      const c = livery % 2 ? '#7A8288' : '#2F7D4A';
      k.box(1.8, 0.8, 0.85, c, 0, 0.1);
      k.box(1.9, 0.08, 0.95, '#1F2A24', 0, 0.9);
      for (const x of [-0.7, 0.7]) k.cylC(0.1, 0.1, '#222222', x, 0.1, 0.3, 8, { rx: Math.PI / 2, sz: 1 });
      k.box(0.06, 0.4, 0.05, '#DDDDDD', 0, 0.35, 0.43);
      break;
    }
    case 'cajon': {
      // Dos cajones de cerveza genéricos con botellitas ámbar
      for (const x of [-0.48, 0.48]) {
        k.box(0.9, 0.55, 0.8, '#E8B923', x, 0);
        k.box(0.92, 0.06, 0.82, '#C99A12', x, 0.25);
        for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
          k.cyl(0.08, 0.1, 0.35, '#8E5A1E', x - 0.28 + i * 0.28, 0.55, -0.18 + j * 0.36, 6);
          k.cyl(0.05, 0.05, 0.05, '#F2B134', x - 0.28 + i * 0.28, 0.9, -0.18 + j * 0.36, 6);
        }
      }
      break;
    }
    case 'conitos': {
      for (const x of [-0.7, 0, 0.7]) {
        k.box(0.5, 0.06, 0.5, '#222222', x, 0);
        k.cone(0.24, 0.9, '#F26B1D', x, 0.05, 0, 10);
        k.cyl(0.13, 0.17, 0.14, '#FFFFFF', x, 0.45, 0, 10);
      }
      k.boxC(1.6, 0.08, 0.04, '#F2D21D', 0, 0.62, 0);
      break;
    }
    case 'mateTermo': {
      // Mate gigante (calabaza + bombilla) y termo tirado
      k.sphere(0.45, '#7B5A33', -0.45, 0.45, 0, { sy: 0.95 });
      k.cyl(0.32, 0.3, 0.12, '#C9B28A', -0.45, 0.82, 0, 12);
      k.cyl(0.26, 0.26, 0.04, '#5E8F3A', -0.45, 0.9, 0, 12);
      k.cylC(0.03, 0.8, '#D8D8D8', -0.32, 1.15, 0, 6, { rz: -0.35 });
      k.cylC(0.27, 1.0, '#3E8E41', 0.45, 0.27, 0, 12, { rz: Math.PI / 2 });
      k.cylC(0.2, 0.18, '#2A2A2A', 1.04, 0.27, 0, 10, { rz: Math.PI / 2 });
      k.cylC(0.28, 0.1, '#BFC5C9', -0.1, 0.27, 0, 12, { rz: Math.PI / 2 });
      break;
    }
    // ---------- Altos (se ruedan por abajo) ----------
    case 'vallaElevada': {
      const top = O.high.bottom + O.high.height;
      for (const x of [-1.2, 1.2]) k.box(0.12, top + 0.2, 0.12, '#555555', x, 0);
      for (let i = 0; i < 6; i++) k.box(0.4, O.high.height * 0.8, 0.12, i % 2 ? '#FFFFFF' : '#F26B1D', -1 + i * 0.4, O.high.bottom + 0.1);
      break;
    }
    case 'cartel': {
      // Pórtico con cartel colgante (flechas de desvío, sin texto de marcas)
      const bar = 3.2;
      for (const x of [-1.25, 1.25]) k.box(0.15, bar, 0.15, '#4A4A4A', x, 0);
      k.box(2.65, 0.15, 0.15, '#4A4A4A', 0, bar);
      for (const x of [-0.7, 0.7]) k.box(0.04, bar - O.high.bottom - O.high.height, 0.04, '#333333', x, O.high.bottom + O.high.height);
      k.box(2.2, O.high.height, 0.12, '#1E5AA8', 0, O.high.bottom);
      k.box(2.0, O.high.height - 0.2, 0.13, '#FFFFFF', 0, O.high.bottom + 0.1);
      k.box(1.7, O.high.height - 0.35, 0.14, '#1E5AA8', 0, O.high.bottom + 0.175);
      k.prism(0.6, 0.45, 0.15, '#FFFFFF', 0.55, O.high.bottom + 0.22, 0, { rz: -Math.PI / 2, ry: Math.PI / 2 });
      k.box(0.6, 0.18, 0.15, '#FFFFFF', 0.05, O.high.bottom + 0.36);
      break;
    }
    case 'gaviotas': {
      // Bandada volando bajo
      const birds: [number, number, number][] = [[-0.9, 1.45, 0], [0, 1.75, 0.15], [0.85, 1.5, -0.1], [-0.4, 2.0, -0.15], [0.45, 2.05, 0.1]];
      for (const [x, y, z] of birds) {
        k.sphere(0.16, '#FFFFFF', x, y, z, { sz: 1.9 }, 0);
        k.sphere(0.09, '#FFFFFF', x, y + 0.05, z + 0.3, undefined, 0);
        k.cone(0.03, 0.12, '#F2B134', x, y + 0.03, z + 0.42, 4, { rx: Math.PI / 2 });
        k.boxC(0.5, 0.03, 0.18, '#B8BEC4', x - 0.28, y + 0.08, z, { rz: 0.35 });
        k.boxC(0.5, 0.03, 0.18, '#B8BEC4', x + 0.28, y + 0.08, z, { rz: -0.35 });
        k.boxC(0.12, 0.03, 0.18, '#2A2A2A', x - 0.55, y + 0.17, z, { rz: 0.35 });
        k.boxC(0.12, 0.03, 0.18, '#2A2A2A', x + 0.55, y + 0.17, z, { rz: -0.35 });
      }
      break;
    }
    // ---------- Bloques (hay que cambiar de carril) ----------
    case 'puesto': {
      // Puesto de feria con toldo a rayas
      k.box(2.2, 1.0, 1.4, '#8B6B48', 0, 0);
      for (const x of [-1.05, 1.05]) for (const z of [-0.7, 0.7]) k.box(0.08, 2.4, 0.08, '#555555', x, 0, z);
      const stripes = ['#E63946', '#FFFFFF'];
      for (let i = 0; i < 8; i++) k.box(0.3, 0.12, 1.7, stripes[i % 2], -1.05 + i * 0.3, 2.4);
      k.box(2.4, 0.3, 0.05, '#E63946', 0, 2.15, 0.85);
      k.box(2.2, 1.2, 0.05, '#C8B89A', 0, 1.0, -0.7);
      const fruit = ['#E07A2E', '#D23B2B', '#7CB342', '#F2C230'];
      for (let i = 0; i < 8; i++) k.sphere(0.16, fruit[i % 4], -0.8 + (i % 4) * 0.52, 1.15, -0.25 + Math.floor(i / 4) * 0.5, undefined, 0);
      break;
    }
    case 'chorizos': {
      // Carrito de chorizos con parrilla y sombrilla
      k.box(2.0, 1.0, 1.2, '#B9C2C8', 0, 0.3);
      for (const x of [-0.75, 0.75]) k.cylC(0.3, 0.12, '#222222', x, 0.3, 0.62, 10, { rx: Math.PI / 2 });
      k.box(1.8, 0.08, 1.0, '#333333', 0, 1.3);
      for (let i = 0; i < 6; i++) k.cylC(0.07, 0.6, '#8C3B22', -0.6 + i * 0.24, 1.42, 0, 6, { rx: Math.PI / 2 });
      k.box(0.06, 1.3, 0.06, '#DDDDDD', 0, 1.3);
      k.cone(1.15, 0.5, '#E63946', 0, 2.1, 0, 8);
      k.box(0.6, 0.6, 0.3, '#F2B134', -1.0, 0.3, -0.45);
      break;
    }
    case 'vallaObra': {
      // Vallas de obra completas con cartel naranja (sin texto)
      for (const x of [-1.1, 1.1]) k.box(0.1, 2.6, 0.1, '#777777', x, 0);
      k.box(2.3, 0.1, 0.1, '#777777', 0, 0.05);
      k.box(2.3, 0.1, 0.1, '#777777', 0, 2.5);
      for (let x = -1.0; x <= 1.0; x += 0.2) k.box(0.03, 2.4, 0.03, '#9A9A9A', x, 0.1);
      for (let y = 0.4; y < 2.5; y += 0.4) k.box(2.2, 0.03, 0.03, '#9A9A9A', 0, y);
      k.box(0.8, 0.8, 0.06, '#F26B1D', 0, 1.2, 0.05, { rz: Math.PI / 4 });
      for (const x of [-1.1, 1.1]) k.box(0.5, 0.15, 0.7, '#4A4A4A', x, 0);
      break;
    }
    // ---------- MBC (Paseo MBC) ----------
    case 'barriles': {
      // Dos barriles de metal (como las mesas de los patios) con latitas arriba
      for (const x of [-0.5, 0.5]) {
        k.cyl(0.42, 0.44, 0.92, '#7A5232', x, 0, 0, 14);
        for (const y of [0.18, 0.72]) k.cyl(0.45, 0.45, 0.05, '#4A4A4A', x, y, 0, 14);
        k.cyl(0.43, 0.43, 0.03, '#9B6B3E', x, 0.92, 0, 14);
      }
      const cans = ['#F2AE14', '#9BCB2E', '#C8322A'];
      cans.forEach((c, i) => k.cyl(0.05, 0.05, 0.16, c, -0.62 + i * 0.25, 0.95, 0.1, 8));
      break;
    }
    case 'mesaPicnic': {
      // Mesa de picnic de madera atravesada en el carril
      const wood = '#8B5E3C';
      const dark = '#5A3B24';
      k.box(1.9, 0.08, 0.8, wood, 0, 0.78);
      for (const z of [-0.6, 0.6]) k.box(1.9, 0.06, 0.28, wood, 0, 0.45, z);
      for (const x of [-0.75, 0.75]) {
        k.boxC(0.08, 0.95, 0.08, dark, x, 0.42, -0.28, { rx: -0.5 });
        k.boxC(0.08, 0.95, 0.08, dark, x, 0.42, 0.28, { rx: 0.5 });
        k.box(0.08, 0.06, 1.6, dark, x, 0.4, 0);
      }
      k.cyl(0.04, 0.05, 0.16, '#F2AE14', -0.3, 0.86, 0.1, 8);
      k.cyl(0.04, 0.05, 0.16, '#9BCB2E', 0.35, 0.86, -0.1, 8);
      break;
    }
    case 'cartelColgante': {
      // Pórtico con tablón colgante y el cartel MBC (la cara va en los extras)
      const top = O.high.bottom + O.high.height;
      for (const x of [-1.25, 1.25]) k.box(0.15, 3.3, 0.15, '#3A2E26', x, 0, 0);
      k.box(2.65, 0.15, 0.15, '#3A2E26', 0, 3.3, 0);
      for (const x of [-0.8, 0.8]) k.box(0.04, 3.3 - top, 0.04, '#222222', x, top, 0);
      k.box(2.3, O.high.height, 0.1, '#8B5E3C', 0, O.high.bottom, 0);
      for (let i = 0; i < 7; i++) k.box(2.3, 0.03, 0.11, '#6E4A2E', 0, O.high.bottom + 0.1 + i * 0.12, 0);
      break;
    }
    case 'barraMBC': {
      // Barra móvil con canillas y cartel arriba (la cara del cartel va en los extras)
      k.box(2.3, 1.1, 0.9, '#3B2A20', 0, 0, 0.35);
      k.box(2.4, 0.08, 1.0, '#B9C2C8', 0, 1.1, 0.35);
      k.box(2.3, 2.5, 0.25, '#B5562F', 0, 0, -0.55);
      for (let y = 0.3; y < 2.5; y += 0.25) k.box(2.31, 0.04, 0.26, '#8E3F22', 0, y, -0.55);
      k.box(2.0, 0.14, 0.14, '#C9CED3', 0, 1.55, -0.3);
      for (let i = 0; i < 8; i++) {
        const x = -0.85 + i * 0.243;
        k.cyl(0.03, 0.03, 0.25, '#C9CED3', x, 1.3, -0.25, 6);
        k.cyl(0.03, 0.035, 0.22, '#111111', x, 1.62, -0.3, 6);
      }
      for (let i = 0; i < 5; i++) k.cyl(0.07, 0.06, 0.2, '#F2D58A', -0.8 + i * 0.4, 1.18, 0.55, 8);
      break;
    }
    // ---------- Bondi ----------
    case 'bondi': {
      const lv = LINES[livery % LINES.length];
      const L = B.length;
      const W = B.width;
      k.box(W, B.height - 0.35, L, lv.body, 0, 0.35);
      // Pollera (azul en los blancos) con el filete arriba
      k.box(W + 0.02, lv.skirtHeight, L + 0.02, lv.skirt, 0, 0.35);
      k.box(W + 0.03, 0.07, L + 0.03, lv.line, 0, 0.35 + lv.skirtHeight);
      for (const sx of [-1, 1]) {
        const x = sx * (W / 2 + 0.01);
        // Ventanillas a los costados, con parantes del color de la carrocería
        k.box(0.04, 1.0, L - 2.4, '#2F3E4A', x, 1.6, -0.6);
        for (let z = -L / 2 + 0.6; z < L / 2 - 1.7; z += 1.35) k.box(0.06, 1.0, 0.12, lv.body, x, 1.6, z);
        // Franjas del techo alternadas
        for (let j = 0; lv.roof.length && j * 1.1 < L - 1.2; j++) k.box(0.05, 0.2, 0.8, lv.roof[j % lv.roof.length], x, 2.72, -L / 2 + 0.7 + j * 1.1);
      }
      // Parabrisas (frente +z), caja del cartel de recorrido y luneta con su cartelito de número
      k.box(W - 0.3, 1.25, 0.06, '#2F3E4A', 0, 1.3, L / 2);
      k.box(W - 0.4, 0.42, 0.08, SIGN.bg, 0, 2.56, L / 2);
      k.box(W - 0.5, 0.9, 0.06, '#2F3E4A', 0, 1.6, -L / 2);
      k.box(1.1, 0.36, 0.08, SIGN.bg, 0, 2.56, -L / 2);
      for (const x of [-0.85, 0.85]) {
        k.box(0.3, 0.18, 0.06, '#FFF4C2', x, 0.55, L / 2 + 0.02);
        k.box(0.3, 0.18, 0.06, '#C8402F', x, 0.55, -L / 2 - 0.02);
      }
      // Rayas inclinadas de colores en la trompa
      lv.accent.forEach((c, i) => k.boxC(0.16, 0.5, 0.03, c, -0.75 + i * 0.2, 0.95, L / 2 + 0.03, { rz: -0.6 }));
      k.box(W - 0.1, 0.18, 0.2, '#3A3A3A', 0, 0.3, L / 2);
      k.box(W - 0.1, 0.18, 0.2, '#3A3A3A', 0, 0.3, -L / 2);
      // Ruedas
      for (const z of [-L / 2 + 2, L / 2 - 2.2]) for (const x of [-W / 2 + 0.1, W / 2 - 0.1]) k.cylC(0.48, 0.32, '#1E1E1E', x, 0.48, z, 12, { rz: Math.PI / 2 });
      // Techo con equipo de aire
      k.box(W - 0.4, 0.05, L - 0.6, '#D9D9D9', 0, B.height);
      k.box(1.4, 0.3, 2.2, '#BFBFBF', 0, B.height, -2);
      break;
    }
    // ---------- Taxi ----------
    case 'taxi': {
      const L = T.depth;
      const W = TAXI_W;
      const glass = '#2F3E4A';
      // Carrocería de sedán: perfil (z, y) de atrás para adelante, extruido a lo ancho
      k.add(profile([[-2.2, 0.28], [-2.2, 0.86], [-1.55, 0.92], [-0.95, T.height], [0.55, T.height], [1.2, 0.92], [2.2, 0.8], [2.2, 0.28]], W), TC.body, -W / 2);
      for (const sx of [-1, 1]) {
        const x = sx * (W / 2);
        // Ventanillas con el parante del medio
        k.add(profile([[-1.42, 0.97], [-0.92, 1.38], [0.5, 1.38], [1.05, 0.97]], 0.02), glass, sx > 0 ? x : x - 0.02);
        k.box(0.05, 0.42, 0.1, TC.body, x + sx * 0.02, 0.96, -0.2);
        // Franja amarilla y damero sobre la rueda de atrás
        k.box(0.03, 0.24, 3.3, TC.band, x + sx * 0.005, 0.56, -0.15);
        for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) k.box(0.03, 0.07, 0.1, (i + j) % 2 ? TC.band : TC.check, x + sx * 0.006, 0.78 + j * 0.07, -2.05 + i * 0.1);
        // Ruedas con tazas
        for (const z of [-1.35, 1.35]) {
          k.cylC(0.32, 0.24, '#1E1E1E', x - sx * 0.1, 0.32, z, 12, { rz: Math.PI / 2 });
          k.cylC(0.19, 0.26, '#C9CED3', x - sx * 0.1, 0.32, z, 10, { rz: Math.PI / 2 });
        }
      }
      // Parabrisas y luneta inclinados
      k.boxC(W - 0.3, 0.03, 0.8, glass, 0, 1.19, 0.88, { rx: Math.atan2(0.53, 0.65) });
      k.boxC(W - 0.3, 0.03, 0.76, glass, 0, 1.19, -1.25, { rx: -Math.atan2(0.53, 0.6) });
      // Franja amarilla en el capó
      k.boxC(W - 0.2, 0.03, 0.2, TC.band, 0, 0.88, 1.95, { rx: 0.12 });
      // Ópticas, parrilla y paragolpes
      for (const x of [-0.6, 0.6]) {
        k.box(0.36, 0.14, 0.04, '#FFF4C2', x, 0.6, L / 2);
        k.box(0.36, 0.14, 0.04, '#C8402F', x, 0.66, -L / 2);
      }
      k.box(0.6, 0.12, 0.04, '#222222', 0, 0.45, L / 2);
      k.box(W + 0.04, 0.16, 0.12, '#3A3A3A', 0, 0.26, L / 2 - 0.03);
      k.box(W + 0.04, 0.16, 0.12, '#3A3A3A', 0, 0.26, -L / 2 + 0.03);
      // Copete de TAXI en el techo (las letras van en los extras)
      for (const x of [-0.25, 0.25]) k.box(0.12, 0.04, 0.28, '#333333', x, T.height, -0.2);
      k.box(0.74, 0.24, 0.24, '#FFFFFF', 0, T.height + 0.04, -0.2);
      break;
    }
  }
  return k.build();
}

/** Partes con textura que no entran en la geometría fusionada (se crean por obstáculo). */
export function obstacleExtras(variant: ObstacleVariant, livery = 0): THREE.Object3D | null {
  if (variant === 'bondi') {
    // Cartel de recorrido adelante ("526  MALVIN") y el número atrás
    const lv = LINES[livery % LINES.length];
    const front = new THREE.Mesh(new THREE.PlaneGeometry(B.width - 0.5, 0.34), signMaterial(`${lv.number}  ${lv.dest}`));
    front.position.set(0, 2.77, B.length / 2 + 0.045);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.28), signMaterial(lv.number));
    back.position.set(0, 2.74, -B.length / 2 - 0.045);
    back.rotation.y = Math.PI;
    return new THREE.Group().add(front, back);
  }
  if (variant === 'taxi') {
    const g = new THREE.Group();
    const roof = new THREE.PlaneGeometry(0.66, 0.2);
    for (const sz of [1, -1]) {
      const m = new THREE.Mesh(roof, taxiMaterial('roof'));
      m.position.set(0, T.height + 0.16, -0.2 + sz * 0.125);
      m.rotation.y = sz > 0 ? 0 : Math.PI;
      g.add(m);
    }
    const door = new THREE.PlaneGeometry(1.1, 0.22);
    for (const sx of [1, -1]) {
      const m = new THREE.Mesh(door, taxiMaterial('door'));
      m.position.set(sx * (TAXI_W / 2 + 0.025), 0.68, -0.2);
      m.rotation.y = sx * (Math.PI / 2);
      g.add(m);
    }
    return g;
  }
  if (variant === 'cartelColgante') {
    const d = cartelDisc(0.62);
    d.rotation.y = -Math.PI / 2;
    d.position.set(0, O.high.bottom + O.high.height / 2, 0.12);
    return d;
  }
  if (variant === 'barraMBC') {
    const d = cartelDisc(0.55);
    d.rotation.y = -Math.PI / 2;
    d.position.set(0, 2.6 + 0.35, -0.45);
    return d;
  }
  return null;
}

/** Rampa para subirse al techo del bondi: cuña que sube hacia -z, origen al comienzo de la rampa. */
export function buildRamp(): THREE.BufferGeometry {
  const k = new Kit();
  const w = B.width * 0.9;
  const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(B.rampLength, 0), new THREE.Vector2(B.rampLength, B.height)]);
  const g = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
  g.rotateY(Math.PI / 2);
  g.translate(-w / 2, 0, 0);
  k.add(g, '#8E979D');
  // Franjas de seguridad al pie de la rampa
  for (let i = 0; i < 5; i++) k.box(w / 5, 0.04, 0.4, i % 2 ? '#2A2A2A' : '#F2C230', -w / 2 + w / 10 + (i * w) / 5, 0.0, -0.2);
  return k.build();
}

/** Perfil lateral (puntos z, y) extruido a lo ancho, de x = 0 a x = `width`. */
function profile(pts: [number, number][], width: number): THREE.BufferGeometry {
  // En el plano de la forma x = -z: al rotar π/2 en y, x pasa a ser z y la extrusión queda a lo largo de x
  const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(-z, y)));
  return new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false }).rotateY(Math.PI / 2);
}

const signMats = new Map<string, THREE.Material>();

/** Cartel de recorrido de leds naranja: el texto a lo ancho con una grilla de puntos encima. */
function signMaterial(text: string): THREE.Material {
  let m = signMats.get(text);
  if (m) return m;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 80;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = SIGN.bg;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.font = 'bold 62px "Arial Narrow", Arial, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const w = ctx.measureText(text).width;
  ctx.save();
  ctx.translate(c.width / 2, c.height / 2 + 3);
  ctx.scale(Math.min(1, (c.width - 24) / w), 1);
  ctx.shadowColor = SIGN.led;
  ctx.shadowBlur = 8;
  ctx.fillStyle = SIGN.led;
  ctx.fillText(text, 0, 0);
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  for (let x = 0; x < c.width; x += 5) ctx.fillRect(x, 0, 1.5, c.height);
  for (let y = 0; y < c.height; y += 5) ctx.fillRect(0, y, c.width, 1.5);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  // Basic: los leds se ven prendidos también de noche
  m = new THREE.MeshBasicMaterial({ map: tex });
  signMats.set(text, m);
  return m;
}

const taxiMats: Partial<Record<'roof' | 'door', THREE.Material>> = {};

/** Letras TAXI: negras sobre blanco en el copete (se prende de noche) y sobre la franja amarilla en las puertas. */
function taxiMaterial(kind: 'roof' | 'door'): THREE.Material {
  const cached = taxiMats[kind];
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = kind === 'roof' ? 78 : 52;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = kind === 'roof' ? '#FFFFFF' : TC.band;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#111111';
  ctx.font = `bold ${Math.round(c.height * 0.8)}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TAXI', c.width / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m =
    kind === 'roof'
      ? glowEmissive(new THREE.MeshStandardMaterial({ map: tex, emissive: '#FFFFFF', emissiveMap: tex, roughness: 0.6 }), 0, 0.8)
      : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });
  taxiMats[kind] = m;
  return m;
}
