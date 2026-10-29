import * as THREE from 'three';
import { Kit } from './kit';

const LOCKS = ['#E63946', '#F2B134', '#7FC4E8', '#3E8E41', '#E07BB0', '#F4F1EA', '#9B6BD3'];

/** Fuente de los Candados: pileta redonda, columna central y candaditos de colores en el borde. */
export function buildFuenteCandados(): THREE.BufferGeometry {
  const k = new Kit();
  k.cyl(2.4, 2.5, 0.7, '#A9A49A', 0, 0, 0, 20);
  k.cyl(2.05, 2.05, 0.05, '#5FA8D3', 0, 0.62, 0, 20);
  k.cyl(0.35, 0.45, 2.2, '#B8B2A6', 0, 0, 0, 10);
  k.cyl(0.9, 0.5, 0.35, '#B8B2A6', 0, 2.2, 0, 10);
  // Barandita y candados
  k.add(new THREE.TorusGeometry(2.35, 0.04, 4, 32), '#555555', 0, 1.15, 0, { rx: Math.PI / 2 });
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    k.box(0.14, 0.18, 0.14, LOCKS[i % LOCKS.length], Math.cos(a) * 2.35, 0.95 + (i % 3) * 0.05, Math.sin(a) * 2.35);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    k.cyl(0.04, 0.04, 0.5, '#555555', Math.cos(a) * 2.35, 0.7, Math.sin(a) * 2.35, 4);
  }
  return k.build();
}

