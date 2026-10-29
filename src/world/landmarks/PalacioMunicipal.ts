import type * as THREE from 'three';
import { Kit } from './kit';

/** Palacio Municipal (Intendencia): basamento ancho y torre-placa con nervaduras. Fachada hacia +x. */
export function buildPalacioMunicipal(): THREE.BufferGeometry {
  const k = new Kit();
  const stone = '#CFC6B4';
  const rib = '#B3A992';
  const win = '#4C5560';
  // Basamento con columnata
  k.box(16, 9, 32, stone);
  k.box(16.4, 0.6, 32.4, rib, 0, 9);
  for (let z = -13; z <= 13; z += 2.6) k.box(0.7, 7, 0.7, rib, 8.1, 0, z);
  k.windows('x', 8.02, -14, 14, 1, 8, 10, 2, win, 1.6, 2.4);
  // Torre
  k.box(11, 40, 18, stone, -1, 9.6);
  k.windows('x', 4.52, -8, 8, 10.5, 49, 7, 12, win, 1.4, 2);
  for (let z = -8.5; z <= 8.5; z += 2.4) k.box(0.5, 40, 0.4, rib, 4.8, 9.6, z);
  k.windows('z', 9.02, -6, 4, 10.5, 49, 4, 12, win, 1.4, 2);
  // Remate
  k.box(8, 3, 12, rib, -1, 49.6);
  k.cyl(0.15, 0.15, 6, '#6E6E6E', -1, 52.6, 0, 6);
  return k.build();
}
