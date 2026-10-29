import * as THREE from 'three';
import { config, ObstacleVariant } from '../config';
import { Kit } from './landmarks/kit';

const O = config.obstacles;
const B = O.bondi;

/**
 * Modelos de obstáculos (todos originales, sin marcas). Cada uno respeta la caja de colisión de su tipo:
 * centrado en x y z, apoyado en y = 0. Los ómnibus tienen el frente hacia +z.
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
    // ---------- Bondi ----------
    case 'bondi': {
      const lv = config.colors.bondiLiveries[livery % config.colors.bondiLiveries.length];
      const L = B.length;
      const W = B.width;
      k.box(W, B.height - 0.35, L, lv.body, 0, 0.35);
      k.box(W + 0.02, 0.45, L, lv.stripe, 0, 0.75);
      // Ventanillas a los costados
      for (const x of [-W / 2 - 0.01, W / 2 + 0.01]) k.box(0.04, 1.0, L - 2.4, '#2F3E4A', x, 1.6, -0.6);
      // Parabrisas (frente +z), luneta y cartel de recorrido
      k.box(W - 0.3, 1.25, 0.06, '#2F3E4A', 0, 1.35, L / 2);
      k.box(W - 0.6, 0.35, 0.06, '#F2B134', 0, 2.6, L / 2 + 0.01);
      k.box(W - 0.5, 0.9, 0.06, '#2F3E4A', 0, 1.7, -L / 2);
      for (const x of [-0.85, 0.85]) {
        k.box(0.3, 0.18, 0.06, '#FFF4C2', x, 0.55, L / 2 + 0.02);
        k.box(0.3, 0.18, 0.06, '#C8402F', x, 0.55, -L / 2 - 0.02);
      }
      k.box(W - 0.1, 0.18, 0.2, '#3A3A3A', 0, 0.3, L / 2);
      k.box(W - 0.1, 0.18, 0.2, '#3A3A3A', 0, 0.3, -L / 2);
      // Ruedas
      for (const z of [-L / 2 + 2, L / 2 - 2.2]) for (const x of [-W / 2 + 0.1, W / 2 - 0.1]) k.cylC(0.48, 0.32, '#1E1E1E', x, 0.48, z, 12, { rz: Math.PI / 2 });
      // Techo con equipo de aire
      k.box(W - 0.4, 0.05, L - 0.6, '#D9D9D9', 0, B.height);
      k.box(1.4, 0.3, 2.2, '#BFBFBF', 0, B.height, -2);
      break;
    }
  }
  return k.build();
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
