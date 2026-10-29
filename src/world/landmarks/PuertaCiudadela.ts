import type * as THREE from 'three';
import { Kit } from './kit';

/** Puerta de la Ciudadela: portón de piedra con arco, pilastras y remate. Fachada hacia +x. */
export function buildPuertaCiudadela(): THREE.BufferGeometry {
  const k = new Kit();
  const stone = '#C2AB7E';
  const dark = '#3B3226';
  const trim = '#A8915F';
  // Restos de muralla a los costados
  k.box(3, 5, 5, '#B39C6E', 0, 0, -8.5);
  k.box(3, 5, 5, '#B39C6E', 0, 0, 8.5);
  // Cuerpo principal
  k.box(3.4, 8, 12, stone);
  // Arco: vano rectangular + medio punto
  k.box(0.3, 4.5, 3.8, dark, 1.6, 0, 0);
  k.cylC(1.9, 0.3, dark, 1.6, 4.5, 0, 14, { rz: Math.PI / 2 });
  // Pilastras
  for (const z of [-4.6, -3, 3, 4.6]) k.box(0.5, 7.4, 0.8, trim, 1.85, 0, z);
  // Cornisa, ático y frontón
  k.box(4, 0.6, 12.8, trim, 0, 8);
  k.box(3, 1.8, 7, stone, 0, 8.6);
  k.prism(6.4, 1.6, 2.6, trim, 0, 10.7, 0);
  k.box(3.2, 0.3, 7.4, trim, 0, 10.4);
  return k.build();
}

