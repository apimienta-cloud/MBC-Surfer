import * as THREE from 'three';
import { Kit } from './kit';

/**
 * Estadio Centenario con la Torre de los Homenajes. La torre queda del lado +x (hacia la pista).
 * El centro del estadio está en el origen; el radio exterior es ~30 m.
 */
export function buildCentenario(): THREE.BufferGeometry {
  const k = new Kit();
  const concrete = '#B8B4AA';
  // Tribunas: perfil girado (lathe) con forma de tazón
  const profile = [
    new THREE.Vector2(17, 0),
    new THREE.Vector2(30, 0),
    new THREE.Vector2(30, 11),
    new THREE.Vector2(28.8, 11),
    new THREE.Vector2(17.5, 1.2),
  ];
  k.add(new THREE.LatheGeometry(profile, 28), concrete);
  // Gradas (anillos más oscuros) y cancha
  for (let i = 1; i < 5; i++) {
    const r = 17.5 + i * 2.3;
    k.add(new THREE.TorusGeometry(r, 0.18, 3, 28), '#8F8B82', 0, 1.2 + i * 2.05, 0, { rx: Math.PI / 2 });
  }
  k.cyl(17, 17, 0.1, '#4E8F45', 0, 0, 0, 24);
  // Torre de los Homenajes: fuste blanco con nervaduras verticales
  const tx = 27;
  const th = 32;
  k.box(4, th, 4, '#EFEDE6', tx, 0, 0);
  for (const [dx, dz] of [[2.4, 0], [-2.4, 0], [0, 2.4], [0, -2.4]] as const) {
    k.box(dx ? 0.8 : 1.6, th - 3, dz ? 0.8 : 1.6, '#E2DFD5', tx + dx, 0, dz);
  }
  for (let y = 6; y < th - 2; y += 3.5) k.box(0.15, 2.2, 0.9, '#7F8A94', tx + 2.05, y, 0);
  k.box(5, 1.2, 5, '#D8D4C8', tx, th);
  k.cone(2.2, 4, '#EFEDE6', tx, th + 1.2, 0, 4, { ry: Math.PI / 4 });
  k.cyl(0.08, 0.08, 5, '#6E6E6E', tx, th + 5.2, 0, 4);
  k.box(0.05, 1.2, 1.8, '#7FC4E8', tx, th + 8.6, 0.9);
  return k.build();
}
