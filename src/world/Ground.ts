import * as THREE from 'three';

/**
 * Materiales del piso con texturas generadas (sin archivos): asfalto con grano, baldosas de vereda
 * montevideanas, pasto, arena con ondas, hormigón y agua con olas que se mueven.
 * Todas usan coordenadas del mundo, así no se estiran en las franjas anchas y no hay costuras entre chunks.
 */

// ---------- Ruido periódico (para que las texturas se repitan sin costura) ----------

function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Ruido de valor suave con período `p` celdas. u, v en [0, 1). */
function vnoise(u: number, v: number, p: number, seed: number): number {
  const x = u * p;
  const y = v * p;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const m = (a: number): number => ((a % p) + p) % p;
  const a = hash(m(x0), m(y0), seed);
  const b = hash(m(x0 + 1), m(y0), seed);
  const c = hash(m(x0), m(y0 + 1), seed);
  const d = hash(m(x0 + 1), m(y0 + 1), seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm(u: number, v: number, p: number, seed: number, oct = 4): number {
  let s = 0;
  let amp = 0.5;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    s += vnoise(u, v, p << i, seed + i * 17) * amp;
    norm += amp;
    amp *= 0.5;
  }
  return s / norm;
}

// ---------- Horneado de texturas ----------

interface Baked {
  map: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
}

/** Recorre cada pixel: `fn` devuelve color (0..1) y altura (0..1). */
function bake(size: number, fn: (u: number, v: number, x: number, y: number) => [number, number, number, number]): Baked {
  const mk = (): [HTMLCanvasElement, CanvasRenderingContext2D, ImageData] => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    return [c, ctx, ctx.createImageData(size, size)];
  };
  const [cc, cctx, cimg] = mk();
  const [hc, hctx, himg] = mk();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, h] = fn(x / size, y / size, x, y);
      const i = (y * size + x) * 4;
      cimg.data[i] = Math.max(0, Math.min(255, r * 255));
      cimg.data[i + 1] = Math.max(0, Math.min(255, g * 255));
      cimg.data[i + 2] = Math.max(0, Math.min(255, b * 255));
      cimg.data[i + 3] = 255;
      const hv = Math.max(0, Math.min(255, h * 255));
      himg.data[i] = himg.data[i + 1] = himg.data[i + 2] = hv;
      himg.data[i + 3] = 255;
    }
  }
  cctx.putImageData(cimg, 0, 0);
  hctx.putImageData(himg, 0, 0);
  const tex = (c: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture => {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  };
  return { map: tex(cc, true), bump: tex(hc, false) };
}

/** Asfalto: base con manchas grandes, piedritas claras y poros oscuros. */
function asphalt(): Baked {
  return bake(512, (u, v, x, y) => {
    const big = fbm(u, v, 4, 3);
    const mid = fbm(u, v, 24, 5, 3);
    const n = hash(x, y, 11);
    let g = 0.3 + big * 0.1 + mid * 0.06;
    let h = 0.45 + mid * 0.2;
    if (n > 0.9) {
      g += 0.08 + (n - 0.9) * 1.2;
      h += 0.35;
    } else if (n < 0.07) {
      g -= 0.09;
      h -= 0.35;
    }
    return [g, g, g * 1.05, h];
  });
}

/** Baldosas de vereda de 40 cm con 3x3 panes (como las de Montevideo), sobre gris claro para teñir por zona. */
function baldosa(): Baked {
  const N = 512;
  const tiles = 3;
  const ts = N / tiles;
  return bake(N, (u, v, x, y) => {
    const tx = Math.floor(x / ts);
    const ty = Math.floor(y / ts);
    const lx = x - tx * ts;
    const ly = y - ty * ts;
    const stain = 0.9 + 0.1 * fbm(u, v, 3, 21);
    const grain = (hash(x, y, 4) - 0.5) * 0.06;
    // Junta entre baldosas
    const joint = Math.min(lx, ly, ts - lx, ts - ly);
    if (joint < 2.2) return [0.5 * stain, 0.49 * stain, 0.47 * stain, 0.05];
    // Panes: canaletas entre los 9 cuadraditos
    const ps = ts / 3;
    const px = lx % ps;
    const py = ly % ps;
    const edge = Math.min(px, py, ps - px, ps - py);
    const tint = 0.95 + (hash(tx, ty, 9) - 0.5) * 0.08;
    const bevel = Math.min(1, edge / 5);
    const top = (0.72 + 0.24 * bevel) * tint * stain + grain;
    return [top, top * 0.985, top * 0.96, 0.25 + 0.75 * bevel];
  });
}

/** Pasto: verdes variados con briznas claras y oscuras. */
function grass(): Baked {
  const dark = [0.29, 0.47, 0.22];
  const light = [0.47, 0.64, 0.3];
  return bake(256, (u, v, x, y) => {
    const f = fbm(u, v, 4, 31);
    const blade = hash(x, y >> 1, 33);
    const k = Math.min(1, Math.max(0, f * 1.2 - 0.1 + (blade - 0.5) * 0.5));
    const c = dark.map((d, i) => d + (light[i] - d) * k);
    return [c[0], c[1], c[2], 0.3 + blade * 0.6];
  });
}

/** Arena: grano fino y ondas que deja el viento. */
function sand(): Baked {
  return bake(256, (u, v, x, y) => {
    const warp = fbm(u, v, 3, 41) * 2;
    const rip = 0.5 + 0.5 * Math.sin((v * 9 + warp) * Math.PI * 2);
    const g = (hash(x, y, 43) - 0.5) * 0.08;
    const s = 0.93 + rip * 0.06 + g;
    return [0.89 * s, 0.81 * s, 0.62 * s, rip * 0.7 + 0.15 + g];
  });
}

/** Hormigón: losas de 1,5 m con juntas y manchas suaves, gris claro para teñir. */
function concrete(): Baked {
  return bake(256, (u, v, x, y) => {
    const lx = x % 128;
    const ly = y % 128;
    const joint = Math.min(lx, ly, 128 - lx, 128 - ly) < 1.5;
    const s = 0.86 + fbm(u, v, 6, 51) * 0.14 + (hash(x, y, 53) - 0.5) * 0.05;
    if (joint) return [s * 0.7, s * 0.7, s * 0.7, 0.1];
    return [s, s, s, 0.6 + (s - 0.86)];
  });
}

/** Mapa de normales de olas (para el agua), repetible. */
function waves(): THREE.CanvasTexture {
  const N = 256;
  const h = new Float32Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = x / N;
      const v = y / N;
      h[y * N + x] =
        Math.sin((u * 3 + v * 2) * Math.PI * 2) * 0.3 +
        Math.sin((u * -2 + v * 5) * Math.PI * 2 + 1.3) * 0.2 +
        fbm(u, v, 8, 61) * 1.2;
    }
  }
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(N, N);
  const at = (x: number, y: number): number => h[((y + N) % N) * N + ((x + N) % N)];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 6;
      const dy = (at(x, y + 1) - at(x, y - 1)) * 6;
      const inv = 1 / Math.hypot(dx, dy, 1);
      const i = (y * N + x) * 4;
      img.data[i] = (-dx * inv * 0.5 + 0.5) * 255;
      img.data[i + 1] = (dy * inv * 0.5 + 0.5) * 255;
      img.data[i + 2] = (inv * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ---------- Coordenadas del mundo ----------

const time = { value: 0 };

/**
 * Hace que el material use las coordenadas xz del mundo (cada `meters` metros se repite la textura).
 * Se resta el origen del objeto redondeado para no perder precisión lejos del inicio.
 */
function worldUV<T extends THREE.MeshStandardMaterial>(mat: T, meters: number, water = false): T {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWorldScale = { value: 1 / meters };
    shader.uniforms.uTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWorldScale;')
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
        vec2 wuv_ = (modelMatrix * vec4(position, 1.0)).xz * uWorldScale - floor(modelMatrix[3].xz * uWorldScale);
        #ifdef USE_MAP
          vMapUv = wuv_;
        #endif
        #ifdef USE_BUMPMAP
          vBumpMapUv = wuv_;
        #endif
        #ifdef USE_NORMALMAP
          vNormalMapUv = wuv_;
        #endif`,
      );
    if (water) {
      // Dos capas de olas que se cruzan y se mueven
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          'vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;',
          `vec3 n1_ = texture2D( normalMap, vNormalMapUv + vec2( uTime * 0.021, uTime * 0.013 ) ).xyz * 2.0 - 1.0;
          vec3 n2_ = texture2D( normalMap, vNormalMapUv * 2.3 + vec2( -uTime * 0.017, uTime * 0.027 ) ).xyz * 2.0 - 1.0;
          vec3 mapN = normalize( vec3( n1_.xy + n2_.xy * 0.6, n1_.z * n2_.z ) );`,
        );
    }
  };
  mat.customProgramCacheKey = () => (water ? 'worldUV-water' : 'worldUV');
  return mat;
}

/** Avanza las olas. */
export function tickGround(dt: number): void {
  time.value += dt;
}

export interface GroundMaterials {
  asphalt: THREE.MeshStandardMaterial;
  cobble: THREE.MeshStandardMaterial;
  concrete: THREE.MeshStandardMaterial;
  grass: THREE.MeshStandardMaterial;
  sand: THREE.MeshStandardMaterial;
  water: THREE.MeshStandardMaterial;
  lot: THREE.MeshStandardMaterial;
  /** Vereda teñida con el color de la zona. */
  sidewalk: (color: string) => THREE.MeshStandardMaterial;
}

/** Arma todos los materiales del piso (una sola vez). */
export function makeGround(cobbleMap: THREE.Texture): GroundMaterials {
  const a = asphalt();
  const b = baldosa();
  const g = grass();
  const s = sand();
  const c = concrete();
  const sidewalks = new Map<string, THREE.MeshStandardMaterial>();
  return {
    asphalt: worldUV(new THREE.MeshStandardMaterial({ map: a.map, bumpMap: a.bump, bumpScale: 1.2, roughness: 0.92 }), 5),
    cobble: new THREE.MeshStandardMaterial({ map: cobbleMap, bumpMap: cobbleMap, bumpScale: 2.5, roughness: 0.85 }),
    concrete: worldUV(new THREE.MeshStandardMaterial({ color: '#B4AEA4', map: c.map, bumpMap: c.bump, bumpScale: 0.8, roughness: 1 }), 3),
    grass: worldUV(new THREE.MeshStandardMaterial({ map: g.map, bumpMap: g.bump, bumpScale: 1.5, roughness: 1 }), 1.6),
    sand: worldUV(new THREE.MeshStandardMaterial({ map: s.map, bumpMap: s.bump, bumpScale: 1, roughness: 1 }), 2.5),
    water: worldUV(
      new THREE.MeshStandardMaterial({
        color: '#2C6A8A',
        roughness: 0.1,
        metalness: 0.15,
        envMapIntensity: 0.7,
        normalMap: waves(),
        normalScale: new THREE.Vector2(0.55, 0.55),
      }),
      9,
      true,
    ),
    lot: worldUV(new THREE.MeshStandardMaterial({ color: '#8C8880', map: c.map, bumpMap: c.bump, bumpScale: 0.8, roughness: 1 }), 3),
    sidewalk: (color) => {
      let m = sidewalks.get(color);
      if (!m) {
        // La textura es gris claro: se aclara un poco el color para que quede como antes
        const tint = new THREE.Color(color).multiplyScalar(1.12);
        m = worldUV(new THREE.MeshStandardMaterial({ color: tint, map: b.map, bumpMap: b.bump, bumpScale: 1.4, roughness: 0.95 }), 1.2);
        sidewalks.set(color, m);
      }
      return m;
    },
  };
}
