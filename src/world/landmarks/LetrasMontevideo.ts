import type * as THREE from 'three';
import { Kit } from './kit';

// Letras en bloques sobre una grilla de 3 x 5. Cada trazo es [x0, y0, x1, y1].
type Stroke = [number, number, number, number];
const GLYPHS: Record<string, Stroke[]> = {
  M: [[0, 0, 0.7, 5], [2.3, 0, 3, 5], [0.7, 3.2, 1.2, 4.4], [1.2, 2.5, 1.8, 3.6], [1.8, 3.2, 2.3, 4.4]],
  O: [[0, 0, 3, 0.7], [0, 4.3, 3, 5], [0, 0, 0.7, 5], [2.3, 0, 3, 5]],
  N: [[0, 0, 0.7, 5], [2.3, 0, 3, 5], [0.7, 3, 1.25, 4.3], [1.2, 1.9, 1.8, 3.1], [1.75, 0.7, 2.3, 2]],
  T: [[0, 4.3, 3, 5], [1.15, 0, 1.85, 4.3]],
  E: [[0, 0, 0.7, 5], [0.7, 0, 3, 0.7], [0.7, 2.15, 2.5, 2.85], [0.7, 4.3, 3, 5]],
  V: [[0, 1.6, 0.7, 5], [2.3, 1.6, 3, 5], [0.55, 0.6, 1.3, 1.9], [1.7, 0.6, 2.45, 1.9], [1.1, 0, 1.9, 0.9]],
  I: [[0.6, 0, 2.4, 0.7], [0.6, 4.3, 2.4, 5], [1.15, 0, 1.85, 5]],
  D: [[0, 0, 0.7, 5], [0.7, 0, 2.2, 0.7], [0.7, 4.3, 2.2, 5], [2.3, 0.8, 3, 4.2], [2, 0.35, 2.6, 1.05], [2, 3.95, 2.6, 4.65]],
};

const COLORS = ['#F4F1EA', '#7FC4E8', '#F4F1EA', '#F2B134', '#F4F1EA', '#E63946', '#F4F1EA', '#7FC4E8', '#F4F1EA', '#F2B134'];

/** Letras grandes de MONTEVIDEO de la rambla de Pocitos. Se leen desde +x (la pista). */
export function buildLetrasMontevideo(): THREE.BufferGeometry {
  const k = new Kit();
  const word = 'MONTEVIDEO';
  const u = 0.62; // metros por unidad de grilla
  const depth = 0.7;
  const adv = 3.6 * u;
  const total = word.length * adv;
  // Base de hormigón
  k.box(1.6, 0.5, total + 1.5, '#9A958C');
  [...word].forEach((ch, i) => {
    // Visto desde +x, "a la derecha" es -z
    const z0 = total / 2 - i * adv;
    for (const [x0, y0, x1, y1] of GLYPHS[ch]) {
      const w = (x1 - x0) * u;
      const h = (y1 - y0) * u;
      k.box(depth, h, w, COLORS[i], 0, 0.5 + y0 * u, z0 - (x0 * u + w / 2));
    }
  });
  return k.build();
}
