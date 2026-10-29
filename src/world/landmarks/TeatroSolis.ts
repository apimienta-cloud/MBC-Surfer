import type * as THREE from 'three';
import { Kit } from './kit';

/** Teatro Solís: fachada neoclásica con pórtico de columnas. Fachada hacia +x. */
export function buildTeatroSolis(): THREE.BufferGeometry {
  const k = new Kit();
  const wall = '#E9E1CF';
  const trim = '#CFC4AA';
  const win = '#5B5346';
  k.box(14, 10, 28, wall);
  k.box(14.4, 0.5, 28.4, trim, 0, 10);
  k.box(12, 2.5, 18, wall, 0, 10.5);
  k.box(12.3, 0.4, 18.3, trim, 0, 13);
  k.windows('x', 7.02, -13, -8, 1.5, 9.5, 2, 2, win, 1.2, 2.4);
  k.windows('x', 7.02, 8, 13, 1.5, 9.5, 2, 2, win, 1.2, 2.4);
  // Pórtico: escalinata, 8 columnas y entablamento con balaustrada
  k.box(4, 0.8, 18, trim, 8.5, 0);
  for (let i = 0; i < 8; i++) k.cyl(0.45, 0.5, 7.6, '#F3EEE2', 9, 0.8, -7 + i * 2, 10);
  k.box(4, 1.3, 17.5, wall, 8.8, 8.4);
  k.box(4.2, 0.3, 17.8, trim, 8.8, 9.7);
  for (let z = -8; z <= 8; z += 0.8) k.box(0.25, 0.7, 0.25, trim, 10.6, 10, z);
  k.box(0.4, 0.2, 17.6, trim, 10.6, 10.7);
  // Puertas al fondo del pórtico
  for (const z of [-3, 0, 3]) k.box(0.15, 3.2, 1.6, '#3E3328', 7.05, 0.8, z);
  // Techo de chapa
  k.prism(26, 3, 9, '#7E8A8C', -1.5, 13.4, 0, { ry: 0 });
  return k.build();
}
