import type * as THREE from 'three';
import { Kit } from './kit';

/** Palacio Legislativo, al fondo de la avenida (horizonte). Mira hacia +z. */
export function buildPalacioLegislativo(): THREE.BufferGeometry {
  const k = new Kit();
  const marble = '#E6DDC8';
  const shade = '#CDBFA2';
  // Alas laterales
  k.box(76, 15, 28, marble);
  k.box(77, 1, 29, shade, 0, 15);
  for (let x = -36; x <= 36; x += 3) if (Math.abs(x) > 14) k.box(1, 13, 0.6, shade, x, 1, 14.2);
  // Cuerpo central más alto con pórtico y frontón
  k.box(28, 24, 30, marble, 0, 0, 1);
  for (let i = 0; i < 8; i++) k.cyl(0.8, 0.9, 18, '#F2ECDD', -10.5 + i * 3, 2, 17.5, 10);
  k.box(28, 2, 6, marble, 0, 0, 17.5);
  k.box(27, 3, 5, shade, 0, 20, 17.5);
  k.prism(27, 5, 5, marble, 0, 23, 17.5, { ry: Math.PI / 2 });
  // Ático escalonado
  k.box(20, 6, 18, marble, 0, 24, 0);
  k.box(14, 6, 12, shade, 0, 30, 0);
  k.box(8, 5, 8, marble, 0, 36, 0);
  k.box(4, 3, 4, shade, 0, 41, 0);
  return k.build();
}
