import type * as THREE from 'three';
import { Kit } from './kit';

/** Faro de Punta Carretas: torre blanca sobre las rocas, linterna y cúpula oscura. */
export function buildFaro(): THREE.BufferGeometry {
  const k = new Kit();
  const rock = '#6E6A64';
  // Punta de rocas
  const rocks: [number, number, number][] = [
    [0, 0, 0], [3.5, -1, 2], [-3, 0.5, -2.5], [2.5, 0, -3.5], [-2.8, -0.5, 3], [4.5, -1.5, -1],
  ];
  rocks.forEach(([x, y, z], i) => k.sphere(3 + (i % 3) * 0.8, i % 2 ? rock : '#7D786F', x, y, z, { sy: 0.55 }, 0));
  // Casita del farero
  k.box(4, 3, 5, '#F2EFE8', -2.5, 1.2, 0);
  k.prism(5, 1.4, 4.2, '#A4553A', -2.5, 4.2, 0);
  // Torre
  k.cyl(1.15, 1.6, 15, '#F4F4F0', 0.8, 1.2, 0, 12);
  k.cyl(1.7, 1.7, 0.35, '#2A2A2A', 0.8, 16.2, 0, 12);
  k.cyl(0.95, 0.95, 1.7, '#FFE08A', 0.8, 16.55, 0, 10);
  k.cone(1.15, 1.2, '#2A2A2A', 0.8, 18.25, 0, 10);
  k.cyl(0.06, 0.06, 1, '#2A2A2A', 0.8, 19.4, 0, 4);
  return k.build();
}
