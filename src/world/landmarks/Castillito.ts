import type * as THREE from 'three';
import { Kit } from './kit';

/** Castillito del Parque Rodó: cuerpo almenado con torre redonda. Fachada hacia +x. */
export function buildCastillito(): THREE.BufferGeometry {
  const k = new Kit();
  const wall = '#D9B48A';
  const trim = '#B8916A';
  k.box(8, 6, 11, wall);
  // Almenas
  for (let z = -5; z <= 5; z += 1.25) {
    k.box(0.7, 0.8, 0.6, trim, 3.7, 6, z);
    k.box(0.7, 0.8, 0.6, trim, -3.7, 6, z);
  }
  for (let x = -3; x <= 3; x += 1.25) {
    k.box(0.6, 0.8, 0.7, trim, x, 6, 5.2);
    k.box(0.6, 0.8, 0.7, trim, x, 6, -5.2);
  }
  // Puerta en arco y ventanitas
  k.box(0.2, 2.6, 1.8, '#4A3A2C', 4.02, 0, 0);
  k.cylC(0.9, 0.2, '#4A3A2C', 4.02, 2.6, 0, 10, { rz: Math.PI / 2 });
  k.windows('x', 4.02, -4, 4, 3.2, 5.6, 4, 1, '#4A3A2C', 0.6, 1.2);
  // Torre redonda con almenas y techito
  k.cyl(2.3, 2.5, 12, wall, 1.5, 0, -4.5, 12);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    k.box(0.6, 0.8, 0.6, trim, 1.5 + Math.cos(a) * 2.3, 12, -4.5 + Math.sin(a) * 2.3);
  }
  k.cone(2.1, 3, '#A4553A', 1.5, 12, -4.5, 10);
  k.windows('x', 3.85, -5, -4, 5, 10.5, 1, 2, '#4A3A2C', 0.6, 1.2);
  return k.build();
}
