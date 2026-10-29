import * as THREE from 'three';
import { Kit } from './kit';

/**
 * Torre de Antel: silueta triangular escalonada de vidrio azul. Vista de canto desde +x.
 * El perfil se arma en el plano (z, y) y se extruye a lo largo de x.
 */
export function buildTorreAntel(): THREE.BufferGeometry {
  const k = new Kit();
  const glass = '#355C80';
  const light = '#6E95B8';
  const profile = (scale: number): THREE.Shape =>
    new THREE.Shape(
      [
        [-12, 0], [12, 0], [12, 18], [9, 18], [9, 38], [6, 38], [6, 58], [3, 58], [0.5, 92], [-2, 70], [-6, 46], [-9.5, 22],
      ].map(([z, y]) => new THREE.Vector2(z * scale, y * scale)),
    );
  const body = new THREE.ExtrudeGeometry(profile(1), { depth: 12, bevelEnabled: false });
  body.rotateY(Math.PI / 2);
  body.translate(-6, 0, 0);
  k.add(body, glass);
  // Cara de adelante un poco más clara para que se lea el escalonado
  const front = new THREE.ExtrudeGeometry(profile(0.985), { depth: 0.3, bevelEnabled: false });
  front.rotateY(Math.PI / 2);
  front.translate(6, 0.3, 0);
  k.add(front, light);
  // Basamento y antena
  k.box(20, 3, 32, '#8796A3', 0, 0, 0);
  k.cyl(0.18, 0.3, 14, '#C9CED3', 0, 88, -0.5, 6);
  return k.build();
}
