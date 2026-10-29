import type * as THREE from 'three';
import { Kit } from './kit';

/** Grúa pórtico del puerto: patas, viga y pluma que avanza hacia +x. */
export function buildGrua(): THREE.BufferGeometry {
  const k = new Kit();
  const red = '#C8402F';
  const white = '#ECE8E0';
  for (const x of [-5, 5]) for (const z of [-4, 4]) k.box(0.9, 20, 0.9, red, x, 0, z);
  for (const x of [-5, 5]) k.box(1, 1, 9, white, x, 8, 0);
  for (const z of [-4, 4]) k.box(11, 1.2, 1, red, 0, 20, z);
  // Sala de máquinas y pluma
  k.box(9, 4, 7, white, -1, 21.2, 0);
  k.box(34, 1.4, 2, red, 12, 25.2, 0);
  k.box(16, 1, 1.6, red, -12, 25.4, 0);
  k.box(0.6, 7, 0.6, white, 0, 26.6, 0);
  // Tensores (barras finitas inclinadas)
  k.boxC(0.25, 0.25, 18, '#333333', 9, 29, 0, { ry: Math.PI / 2, rz: -0.16 });
  k.boxC(0.25, 0.25, 12, '#333333', -6, 28.6, 0, { ry: Math.PI / 2, rz: 0.2 });
  // Cable con el gancho
  k.box(0.08, 8, 0.08, '#333333', 20, 17, 0);
  k.box(0.8, 0.6, 0.8, '#F2B134', 20, 16.4, 0);
  return k.build();
}
