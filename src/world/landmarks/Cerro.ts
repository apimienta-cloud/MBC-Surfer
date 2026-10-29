import type * as THREE from 'three';
import { Kit } from './kit';

/** El Cerro con la Fortaleza en la cima, para el horizonte de la Rambla. Mira hacia +z. */
export function buildCerro(): THREE.BufferGeometry {
  const k = new Kit();
  k.cone(70, 34, '#6B7A66', 0, 0, 0, 9, { sz: 0.5 });
  k.cone(40, 22, '#5E6E5B', -45, 0, 6, 7, { sz: 0.6 });
  k.cone(38, 18, '#748370', 42, 0, 4, 7, { sz: 0.6 });
  // Fortaleza General Artigas y su faro
  k.box(12, 3.5, 7, '#C9BFA9', 0, 32.5, 0);
  k.box(4, 2.5, 4, '#BDB3A0', -4, 35.5, 0);
  k.cyl(0.9, 1.1, 5, '#F2EFE8', 4, 35.5, 0, 8);
  return k.build();
}
