import type * as THREE from 'three';
import { Kit } from './kit';

/** Palacio Salvo: torre escalonada con cúpula y antena. Fachada hacia +x. */
export function buildPalacioSalvo(): THREE.BufferGeometry {
  const k = new Kit();
  const cream = '#D8C7A0';
  const band = '#B9A57D';
  const win = '#4A4036';
  // Cuerpo bajo con bandas por piso y ventanas
  k.box(16, 24, 16, cream);
  for (let y = 3; y < 24; y += 3) k.box(16.4, 0.35, 16.4, band, 0, y);
  k.windows('x', 8.02, -6.5, 6.5, 1, 24, 5, 8, win, 1.1, 1.6);
  k.windows('z', 8.02, -6.5, 6.5, 1, 24, 5, 8, win, 1.1, 1.6);
  // Torrecitas de las esquinas
  for (const sx of [-7, 7]) for (const sz of [-7, 7]) {
    k.cyl(1.3, 1.3, 4, cream, sx, 24, sz, 8);
    k.dome(1.3, band, sx, 28, sz);
  }
  // Escalones hacia arriba
  k.box(11, 10, 11, cream, 0, 24);
  for (let y = 26; y < 34; y += 3) k.box(11.3, 0.3, 11.3, band, 0, y);
  k.windows('x', 5.52, -4, 4, 24.5, 34, 3, 3, win, 1, 1.5);
  k.windows('z', 5.52, -4, 4, 24.5, 34, 3, 3, win, 1, 1.5);
  k.box(7, 6, 7, cream, 0, 34);
  k.windows('x', 3.52, -2.5, 2.5, 34.5, 40, 2, 2, win, 0.9, 1.4);
  // Tambor octogonal, cúpula, linterna y antena
  k.cyl(3, 3.3, 4, band, 0, 40, 0, 8);
  k.dome(3.1, '#C9B68C', 0, 44, 0, { sy: 1.4 });
  k.cyl(0.8, 0.9, 2, cream, 0, 48, 0, 8);
  k.cyl(0.12, 0.2, 11, '#6E6E6E', 0, 50, 0, 6);
  k.sphere(0.35, '#D33F3F', 0, 61, 0);
  return k.build();
}
