import type * as THREE from 'three';
import { Kit } from './kit';

export type BuildingStyle = 'colonial' | 'apartment' | 'office' | 'warehouse' | 'house' | 'corten';

export interface BuildingVariant {
  geo: THREE.BufferGeometry;
  width: number; // a lo largo de la pista (z)
  depth: number; // hacia afuera (x)
  height: number;
}

const PALETTES: Record<BuildingStyle, string[]> = {
  colonial: ['#E8C9A0', '#D98F6B', '#BFD1C4', '#E6D3A3', '#C9A3B5', '#E0B07A', '#A9C4D6'],
  apartment: ['#F2F0EA', '#E8E4DA', '#DCD6C8', '#EDE6D6'],
  office: ['#C9C5BB', '#B7BEC4', '#D6CDB8', '#A8B3BB', '#CDB89A'],
  warehouse: ['#9AA5A8', '#B5674E', '#7F8C8D', '#C7B48F'],
  house: ['#EAD9B8', '#D8B4A0', '#C9D3B8', '#E6E0D0'],
  corten: ['#B5562F', '#A64B28', '#C0612F'],
};

/**
 * Edificio genérico low-poly con la fachada hacia +x (y ventanas también en +z, que es lo que se ve al acercarse).
 * `r` es un random con semilla para que cada variante sea estable.
 */
export function buildBuilding(style: BuildingStyle, r: () => number): BuildingVariant {
  const k = new Kit();
  const pal = PALETTES[style];
  const color = pal[Math.floor(r() * pal.length)];
  const dark = '#3F3A36';
  let w = 10;
  let d = 10;
  let h = 10;

  switch (style) {
    case 'colonial': {
      // 2-3 pisos, balcones, cornisa y pretil
      const floors = 2 + Math.floor(r() * 2);
      w = 7 + Math.floor(r() * 5);
      d = 9;
      h = floors * 3.6 + 1;
      k.box(d, h, w, color);
      k.box(d + 0.4, 0.5, w + 0.4, '#F1E9D8', 0, h - 1.2);
      k.box(d, 0.8, w, color, 0, h - 0.7);
      const cols = Math.max(2, Math.floor(w / 2.4));
      for (let f = 0; f < floors; f++) {
        const y = f * 3.6 + 0.6;
        for (let c = 0; c < cols; c++) {
          const z = -w / 2 + (w * (c + 0.5)) / cols;
          k.box(0.12, 2.3, 1, f === 0 && c === Math.floor(cols / 2) ? '#5A3B28' : dark, d / 2 + 0.02, y, z);
          if (f > 0) k.box(0.7, 0.15, 1.5, '#4A4A4A', d / 2 + 0.35, y - 0.1, z);
        }
      }
      k.windows('z', w / 2 + 0.02, -d / 2 + 1.5, d / 2 - 1.5, 0.6, h - 1.5, 2, floors, dark, 1, 2.2);
      break;
    }
    case 'apartment': {
      // Torres altas blancas frente a la playa: balcones corridos
      const floors = 8 + Math.floor(r() * 8);
      w = 12 + Math.floor(r() * 6);
      d = 12;
      h = floors * 3 + 2;
      k.box(d, h, w, color);
      for (let f = 1; f < floors; f++) {
        k.box(0.9, 0.25, w - 1, '#FFFFFF', d / 2 + 0.45, f * 3, 0);
        k.box(0.1, 1.9, w - 1.6, '#4D6A80', d / 2 + 0.02, f * 3 + 0.35, 0);
      }
      k.windows('z', w / 2 + 0.02, -d / 2 + 1.5, d / 2 - 1.5, 2, h - 2, 3, floors - 1, '#4D6A80', 1.4, 1.6);
      k.box(d - 4, 2, w - 4, '#D8D2C4', 0, h);
      break;
    }
    case 'office': {
      const floors = 5 + Math.floor(r() * 9);
      w = 10 + Math.floor(r() * 6);
      d = 12;
      h = floors * 3.3 + 3;
      k.box(d, h, w, color);
      k.box(d + 0.2, 3, w + 0.2, '#8E8A82', 0, 0);
      k.windows('x', d / 2 + 0.02, -w / 2 + 0.6, w / 2 - 0.6, 3.2, h - 0.5, Math.floor(w / 1.8), floors, '#435565', 1.2, 2);
      k.windows('z', w / 2 + 0.02, -d / 2 + 0.6, d / 2 - 0.6, 3.2, h - 0.5, Math.floor(d / 1.8), floors, '#435565', 1.2, 2);
      break;
    }
    case 'warehouse': {
      w = 16 + Math.floor(r() * 8);
      d = 14;
      h = 6 + r() * 3;
      k.box(d, h, w, color);
      k.prism(w, 2.5, d, color, 0, h, 0);
      for (let z = -w / 2 + 3; z < w / 2 - 2; z += 6) k.box(0.15, 4.2, 3.6, '#5B5F60', d / 2 + 0.02, 0, z);
      break;
    }
    case 'corten': {
      // Cubo de chapa corrugada oxidada con ventanales, como el galpón de MBC
      w = 12 + Math.floor(r() * 6);
      d = 12;
      h = 8 + Math.floor(r() * 4);
      k.box(d, h, w, color);
      for (let y = 0.4; y < h; y += 0.45) {
        k.box(d + 0.06, 0.08, w + 0.06, '#7E3519', 0, y, 0);
      }
      k.box(d + 0.3, 0.35, w + 0.3, '#6E3018', 0, h, 0);
      const bays = Math.max(1, Math.floor(w / 6));
      for (let b = 0; b < bays; b++) {
        const z = -w / 2 + (w * (b + 0.5)) / bays;
        k.box(0.12, h * 0.62, (w / bays) * 0.7, '#3B4A52', d / 2 + 0.05, 0.8, z);
        for (let i = 0; i <= 4; i++) k.box(0.16, h * 0.62, 0.1, '#2A2A2A', d / 2 + 0.08, 0.8, z - (w / bays) * 0.35 + (i * (w / bays) * 0.7) / 4);
      }
      k.windows('z', w / 2 + 0.05, -d / 2 + 2, d / 2 - 2, 0.8, h * 0.7, 2, 1, '#3B4A52', d / 3, h * 0.55);
      break;
    }
    case 'house': {
      w = 8 + Math.floor(r() * 3);
      d = 8;
      h = 6;
      k.box(d, h, w, color);
      k.prism(w + 0.6, 2.4, d + 0.6, '#A4553A', 0, h, 0);
      k.windows('x', d / 2 + 0.02, -w / 2 + 1, w / 2 - 1, 0.8, h - 0.4, 3, 2, dark, 1, 1.5);
      break;
    }
  }
  return { geo: k.build(), width: w, depth: d, height: h };
}
