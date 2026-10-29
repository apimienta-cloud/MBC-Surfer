import * as THREE from 'three';
import { Kit } from './kit';

/** Mercado del Puerto: base de ladrillo, techo de hierro, torre con reloj y chimenea de parrilla. Fachada hacia +x. */
export function buildMercadoPuerto(): THREE.BufferGeometry {
  const k = new Kit();
  const brick = '#A0523A';
  const iron = '#3E4F45';
  const dark = '#2E2620';
  k.box(16, 6, 20, brick);
  k.box(16.4, 0.4, 20.4, '#7E3F2C', 0, 6);
  // Arcos en la fachada
  for (const z of [-7, -3.5, 0, 3.5, 7]) {
    k.box(0.2, 3.2, 2.2, dark, 8.02, 0, z);
    k.cylC(1.1, 0.2, dark, 8.02, 3.2, z, 10, { rz: Math.PI / 2 });
  }
  // Estructura de hierro: techo en pirámide truncada con lucernario
  k.add(new THREE.CylinderGeometry(5, 10.5, 3.5, 4, 1), iron, 0, 8.15, 0, { ry: Math.PI / 4, sz: 1.25 });
  k.box(5.5, 1.4, 7, '#56685D', 0, 9.9);
  // Torre del reloj
  k.box(2.4, 4, 2.4, iron, 0, 11.3);
  k.cylC(0.85, 0.15, '#F4F1E6', 1.25, 13.3, 0, 16, { rz: Math.PI / 2 });
  k.cone(1.9, 1.8, iron, 0, 15.3, 0, 4, { ry: Math.PI / 4 });
  // Chimenea de la parrilla (el humo lo emite el chunk)
  k.cyl(0.55, 0.65, 4.5, '#5A4A40', -5, 6, 6, 8);
  return k.build();
}

/** Boca de la chimenea, relativa al landmark (para el emisor de humo). */
export const MERCADO_SMOKE = { x: -5, y: 10.7, z: 6 };

