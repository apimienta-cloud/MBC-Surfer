import type * as THREE from 'three';
import { Kit } from './kit';

/** Monumento ecuestre a Artigas (Plaza Independencia): pedestal de granito y jinete de bronce. */
export function buildArtigas(): THREE.BufferGeometry {
  const k = new Kit();
  const granite = '#8C8A85';
  const bronze = '#4F5D4A';
  k.box(7, 0.6, 9, '#A9A49A');
  k.box(4.5, 5, 6.5, granite, 0, 0.6);
  k.box(5, 0.5, 7, '#7A7873', 0, 5.6);
  const y = 6.1;
  // Caballo (mirando a +z)
  k.boxC(1.3, 1.5, 3.4, bronze, 0, y + 2.4, 0);
  k.boxC(0.8, 1.6, 0.9, bronze, 0, y + 3.5, 1.7, { rx: -0.5 });
  k.boxC(0.6, 0.6, 1.3, bronze, 0, y + 4.2, 2.4, { rx: 0.3 });
  for (const lx of [-0.45, 0.45]) for (const lz of [-1.3, 1.3]) k.cylC(0.18, 1.8, bronze, lx, y + 0.9, lz, 6);
  k.boxC(0.3, 1.3, 0.3, bronze, 0, y + 2.1, -1.9, { rx: 0.4 });
  // Jinete
  k.boxC(0.8, 1.4, 0.7, bronze, 0, y + 3.8, -0.1);
  k.sphere(0.35, bronze, 0, y + 4.8, 0);
  k.cylC(0.4, 0.25, bronze, 0, y + 5.15, 0, 8);
  return k.build();
}
