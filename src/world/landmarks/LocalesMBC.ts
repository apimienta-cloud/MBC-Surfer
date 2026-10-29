import * as THREE from 'three';
import { config } from '../../config';
import { Kit, glowEmissive, glowOpacity, kitMaterial } from './kit';

/**
 * Locales de MBC basados en las fotos de la marca:
 * - Casa MBC: casona blanca de dos pisos con patio cervecero, guirnaldas y luces de color.
 * - Galpón MBC: cubo de chapa corten con ventanales y el cartel redondo.
 * - Escenario MBC: tablado con las letras luminosas.
 * - Gigantografías con fotos de los locales.
 * Las imágenes salen de public/assets/brand/locales/ (recortes de fotos de la marca, nunca logos dibujados).
 * Todos miran hacia +x (la pista, del lado izquierdo). Cada uno devuelve la geometría fusionada
 * y un grupo de "extras" (texturas y luces) que se clona en cada aparición.
 */

const LC = config.brand.locales;
const loader = new THREE.TextureLoader();
const texCache = new Map<string, THREE.Texture>();

/** Carga una textura de marca; si falta el archivo el material queda con su color liso. */
function brandMaterial(file: string, fallback: string, opts: THREE.MeshStandardMaterialParameters = {}, emissive = false): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color: fallback, roughness: 0.7, ...opts });
  const apply = (t: THREE.Texture): void => {
    mat.map = t;
    if (emissive) {
      mat.emissiveMap = t;
      mat.emissive.set('#ffffff');
    }
    mat.color.set('#ffffff');
    mat.needsUpdate = true;
  };
  const cached = texCache.get(file);
  if (cached) apply(cached);
  else
    loader.load(
      LC.path + file,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        texCache.set(file, t);
        apply(t);
      },
      undefined,
      // TODO(brand): falta la imagen en public/assets/brand/locales/
      () => console.warn(`[brand] Falta ${LC.path}${file}: se usa color liso.`),
    );
  return mat;
}

let cartelMat: THREE.MeshStandardMaterial | null = null;
/** Cara del cartel redondo MBC (recorte de la foto del cartel del poste). */
function cartelMaterial(): THREE.MeshStandardMaterial {
  cartelMat ??= glowEmissive(brandMaterial(LC.cartel, '#3A332C', { transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }, true), 0.15, 0.85);
  return cartelMat;
}

/** Disco del cartel redondo con la foto en las dos caras, mirando a +x. */
export function cartelDisc(radius: number): THREE.Group {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.03, radius * 1.03, 0.22, 28), new THREE.MeshStandardMaterial({ color: '#2B2622', roughness: 0.6 }));
  rim.rotation.z = Math.PI / 2;
  g.add(rim);
  const face = new THREE.CircleGeometry(radius, 32);
  for (const sx of [1, -1]) {
    const m = new THREE.Mesh(face, cartelMaterial());
    m.position.x = sx * 0.12;
    m.rotation.y = sx * (Math.PI / 2);
    g.add(m);
  }
  return g;
}

/** Textura de degradé radial para los bañados de luz de color. */
let washTex: THREE.CanvasTexture | null = null;
function washTexture(): THREE.CanvasTexture {
  if (washTex) return washTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  washTex = new THREE.CanvasTexture(c);
  return washTex;
}

/** Plano de luz de color sobre una fachada (aditivo, más fuerte de noche). */
function wash(color: string, w: number, h: number, x: number, y: number, z: number): THREE.Mesh {
  const mat = glowOpacity(
    new THREE.MeshBasicMaterial({ map: washTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
    0.12,
    0.9,
  );
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z);
  m.rotation.y = Math.PI / 2;
  return m;
}

const bulbMat = glowEmissive(new THREE.MeshStandardMaterial({ color: '#FFE2A0', emissive: '#FFC56B' }), 0.4, 2.4);

/** Guirnalda de lamparitas entre dos puntos, con caída en el medio. Agrega cable al kit y lamparitas a `bulbs`. */
function stringLights(k: Kit, bulbs: Kit, a: THREE.Vector3, b: THREE.Vector3, sag: number, n = 9): void {
  let prev = a.clone();
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const p = a.clone().lerp(b, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    const mid = prev.clone().add(p).multiplyScalar(0.5);
    const len = prev.distanceTo(p);
    const seg = new THREE.BoxGeometry(0.03, 0.03, len);
    seg.lookAt(p.clone().sub(prev));
    k.add(seg, '#1C1C1C', mid.x, mid.y, mid.z);
    if (i < n) bulbs.sphere(0.09, '#ffffff', p.x, p.y - 0.12, p.z, undefined, 0);
    prev = p;
  }
}

/** Mesa de picnic de madera (larga a lo largo de z). */
function picnicTable(k: Kit, x: number, z: number): void {
  const wood = '#8B5E3C';
  const dark = '#5A3B24';
  k.box(0.95, 0.08, 2.2, wood, x, 0.78, z);
  for (const sx of [-0.75, 0.75]) k.box(0.32, 0.06, 2.2, wood, x + sx, 0.45, z);
  for (const sz of [-0.85, 0.85]) {
    k.boxC(0.08, 0.95, 0.08, dark, x - 0.3, 0.42, sz + z, { rz: 0.5 });
    k.boxC(0.08, 0.95, 0.08, dark, x + 0.3, 0.42, sz + z, { rz: -0.5 });
    k.box(1.8, 0.06, 0.08, dark, x, 0.4, z + sz);
  }
}

/** Barril/tacho de metal usado como mesa. */
function barrel(k: Kit, x: number, z: number): void {
  k.cyl(0.38, 0.4, 1.0, '#7A5232', x, 0, z, 12);
  for (const y of [0.2, 0.8]) k.cyl(0.41, 0.41, 0.05, '#4A4A4A', x, y, z, 12);
  k.cyl(0.39, 0.39, 0.03, '#9B6B3E', x, 1.0, z, 12);
}

/** Reja de barrotes oscuros a lo largo de z entre z0 y z1, en x. */
function fence(k: Kit, x: number, z0: number, z1: number, h = 1.9): void {
  const c = '#2B2124';
  k.box(0.08, 0.08, z1 - z0, c, x, 0.15, (z0 + z1) / 2);
  k.box(0.08, 0.08, z1 - z0, c, x, h, (z0 + z1) / 2);
  for (let z = z0 + 0.1; z < z1; z += 0.16) k.box(0.04, h, 0.04, c, x, 0.1, z);
}

export interface LocalModel {
  geo: THREE.BufferGeometry;
  extras: THREE.Object3D;
}

// ---------- Casa MBC ----------

/** Casona blanca de dos pisos (foto de la fachada iluminada) con patio cervecero adelante. */
export function buildCasaMBC(): LocalModel {
  const k = new Kit();
  const bulbs = new Kit();
  const extras = new THREE.Group();
  const white = '#EDE8DD';
  const trim = '#D9D2C2';
  const dark = '#2E3B33';
  const fx = -1; // plano de la fachada

  // Casa: cuerpo, bandas, cornisa con modillones y pretil
  k.box(11, 10, 18, white, -6.5, 0, 0);
  k.box(11.3, 0.4, 18.3, trim, -6.5, 4.6, 0);
  k.box(11.9, 0.55, 18.9, trim, -6.5, 9.35, 0);
  for (let z = -8.6; z <= 8.6; z += 0.9) k.box(0.5, 0.35, 0.3, trim, fx + 0.3, 9.0, z);
  k.box(11.4, 0.9, 18.4, white, -6.5, 9.9, 0);
  // Ventanas: marco claro y vidrio oscuro; abajo con rejas
  k.windows('x', fx - 0.02, -8, 1.5, 5.3, 8.9, 4, 1, trim, 1.6, 3.0);
  k.windows('x', fx, -8, 1.5, 5.3, 8.9, 4, 1, dark, 1.15, 2.6);
  k.windows('x', fx - 0.02, -8, 1.5, 0.8, 4.2, 3, 1, trim, 1.6, 2.8);
  k.windows('x', fx, -8, 1.5, 0.8, 4.2, 3, 1, '#1F2620', 1.15, 2.4);
  for (let z = -7.4; z < 1.5; z += 0.25) k.box(0.05, 2.4, 0.04, '#222222', fx + 0.08, 1.0, z);
  // Balcón con plantas colgando
  k.box(1.1, 0.2, 3.4, trim, fx + 0.5, 5.0, -4.6);
  for (let i = 0; i < 9; i++) {
    const z = -6 + i * 0.36;
    k.box(0.15, 0.8 + (i % 3) * 0.4, 0.22, i % 2 ? '#3E6B35' : '#4F8A3C', fx + 0.95, 4.2 - (i % 3) * 0.4, z);
    k.sphere(0.28, '#4F8A3C', fx + 0.75, 5.35, z, undefined, 0);
  }
  // Pórtico de entrada con columnas y techito de tejas
  const pz = 5.2;
  k.box(0.2, 3, 1.8, '#3B2E26', fx + 0.02, 0, pz);
  for (const z of [pz - 1.6, pz + 1.6]) k.cyl(0.22, 0.25, 3.4, white, fx + 1.8, 0, z, 10);
  k.box(2.4, 0.35, 4, trim, fx + 1.1, 3.4, pz);
  k.prism(4.4, 0.9, 2.6, '#A4553A', fx + 1.1, 3.75, pz);
  // Apliques de pared (lamparitas cálidas)
  for (const z of [-7.5, -2.5, 2, 7.5]) bulbs.box(0.18, 0.3, 0.18, '#ffffff', fx + 0.12, 3.6, z);

  // Patio cervecero: piso, mesas, barriles, reja con pilares blancos y portón
  k.box(8.4, 0.06, 18, '#5A4F46', 3.2, 0, 0);
  for (const x of [1.6, 4.6]) for (const z of [-7, -3.2, 0.6]) picnicTable(k, x, z);
  barrel(k, 6.2, -5.2);
  barrel(k, 6.2, 1.5);
  barrel(k, 1.2, 8);
  fence(k, 7.4, -9, 3.6);
  fence(k, 7.4, 6.8, 9);
  for (const z of [-9, -2.7, 3.6, 6.8, 9]) k.box(0.6, 2.4, 0.6, '#F1EEE8', 7.4, 0, z);
  // Pérgola de caños oxidados (como en la foto) y postes de las guirnaldas
  for (const z of [-8.6, 0, 8.6]) k.box(0.18, 4.4, 0.18, '#6E3F28', 6.9, 0, z);
  k.box(0.16, 0.16, 17.4, '#6E3F28', 6.9, 4.4, 0);
  for (let z = -8; z <= 8; z += 4) {
    stringLights(k, bulbs, new THREE.Vector3(fx + 0.1, 7.2, z), new THREE.Vector3(6.9, 4.4, z + 1.5), 0.9);
  }
  stringLights(k, bulbs, new THREE.Vector3(6.9, 4.4, -8.6), new THREE.Vector3(6.9, 4.4, 8.6), 0.6, 14);

  // Cartel redondo en poste, junto a la reja
  k.cyl(0.11, 0.13, 5.4, '#5B3A28', 7.9, 0, -8.2, 8);
  const sign = cartelDisc(1.25);
  sign.position.set(7.9, 6.5, -8.2);
  extras.add(sign);

  // Luces de color sobre la fachada (verde a la derecha, cálida a la izquierda, como en la foto)
  extras.add(wash('#35E3A1', 10, 9, fx + 0.06, 6, -4.5));
  extras.add(wash('#FFC46B', 8, 7, fx + 0.07, 3.8, 4));
  // Nombre en la fachada (texto, no logo)
  extras.add(facadeName(fx + 0.1, 6.9, -4.6));

  extras.add(new THREE.Mesh(bulbs.build(), bulbMat));
  return { geo: k.build(), extras };
}

/** "MONTEVIDEO BEER COMPANY" en letras de relieve sobre la fachada (texto en CanvasTexture). */
function facadeName(x: number, y: number, z: number): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 176;
  const ctx = c.getContext('2d')!;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 64px Georgia, 'Times New Roman', serif`;
  ctx.fillStyle = 'rgba(30,60,50,0.35)';
  const [l1, l2] = LC.facadeName;
  ctx.fillText(l1, 259, 52);
  ctx.fillText(l2, 259, 130);
  ctx.fillStyle = '#F2FFF8';
  ctx.fillText(l1, 256, 48);
  ctx.fillText(l2, 256, 126);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = glowEmissive(new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#B8FFE0', transparent: true, alphaTest: 0.3 }), 0.1, 0.8);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.85), mat);
  m.position.set(x, y, z);
  m.rotation.y = Math.PI / 2;
  return m;
}

// ---------- Patio cervecero ----------

/**
 * Patio al aire libre de MBC (como el de la foto con mesas de picnic): piso de adoquín intertrabado,
 * mesas, barriles con banquetas, guirnaldas entre postes, reja baja con pilares blancos y el cartel redondo.
 */
export function buildPatioMBC(): LocalModel {
  const k = new Kit();
  const bulbs = new Kit();
  const extras = new THREE.Group();
  const D = 9;
  const W = 16;
  // Piso de intertrabado (gris con juntas verdes de pasto)
  k.box(D, 0.06, W, '#8A8580', -D / 2 + 0.5, 0, 0);
  for (let z = -W / 2 + 1; z < W / 2; z += 1.2) k.box(D, 0.07, 0.08, '#6E8F55', -D / 2 + 0.5, 0, z);
  // Muro de fondo con plantas
  k.box(0.5, 2.6, W, '#EDE8DD', -D + 0.5, 0, 0);
  for (let z = -W / 2 + 0.6; z < W / 2; z += 1.4) k.sphere(0.6, '#4F8A3C', -D + 1, 2.7, z, { sy: 0.8 }, 0);
  for (const [x, z] of [[-2.2, -5.2], [-2.2, -1.2], [-2.2, 2.8], [-6, -3.2], [-6, 0.8]] as const) picnicTable(k, x, z);
  for (const z of [5.4, 6.8]) {
    barrel(k, -1.6, z);
    for (const dz of [-0.55, 0.55]) k.box(0.32, 0.75, 0.32, '#2A2A2A', -0.9, 0, z + dz);
  }
  // Postes y guirnaldas en zigzag
  const posts: [number, number][] = [[-0.2, -7.6], [-8.2, -7.6], [-0.2, 7.6], [-8.2, 7.6], [-4.2, 0]];
  for (const [x, z] of posts) k.cyl(0.07, 0.09, 4.4, '#3A2E26', x, 0, z, 6);
  const top = (x: number, z: number): THREE.Vector3 => new THREE.Vector3(x, 4.4, z);
  stringLights(k, bulbs, top(-0.2, -7.6), top(-8.2, 7.6), 0.9, 14);
  stringLights(k, bulbs, top(-8.2, -7.6), top(-0.2, 7.6), 0.9, 14);
  stringLights(k, bulbs, top(-0.2, -7.6), top(-0.2, 7.6), 0.7, 12);
  stringLights(k, bulbs, top(-8.2, -7.6), top(-8.2, 7.6), 0.7, 12);
  // Reja baja hacia la vereda con portón y pilares
  fence(k, 0.4, -W / 2, -1.6, 1.3);
  fence(k, 0.4, 1.6, W / 2, 1.3);
  for (const z of [-W / 2, -1.6, 1.6, W / 2]) k.box(0.5, 1.7, 0.5, '#F1EEE8', 0.4, 0, z);
  extras.add(new THREE.Mesh(bulbs.build(), bulbMat));
  // Cartel redondo sobre el portón
  k.box(0.12, 3.6, 0.12, '#5B3A28', 0.4, 0, -1.6);
  k.box(0.12, 3.6, 0.12, '#5B3A28', 0.4, 0, 1.6);
  k.box(0.14, 0.14, 3.3, '#5B3A28', 0.4, 3.6, 0);
  const sign = cartelDisc(1.0);
  sign.position.set(0.4, 4.7, 0);
  extras.add(sign);
  return { geo: k.build(), extras };
}

// ---------- Galpón MBC ----------

/** Chapa corrugada oxidada (corten) en CanvasTexture. */
function cortenTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < 256; y += 8) {
    const g = ctx.createLinearGradient(0, y, 0, y + 8);
    g.addColorStop(0, '#9C4A26');
    g.addColorStop(0.45, '#C9693A');
    g.addColorStop(1, '#7A3519');
    ctx.fillStyle = g;
    ctx.fillRect(0, y, 64, 8);
  }
  // Manchas de óxido
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(${90 + Math.random() * 60},${40 + Math.random() * 30},20,0.25)`;
    ctx.fillRect(Math.random() * 64, Math.random() * 256, 2 + Math.random() * 6, 6 + Math.random() * 30);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Mural de carteles retro (paneles de colores con formas, sin textos ni marcas de terceros). */
function muralTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  const panels: [number, number, number, number, string][] = [
    [0, 0, 300, 330, '#E9C64A'],
    [300, 0, 212, 170, '#8DB495'],
    [300, 170, 212, 342, '#9C6A4A'],
    [0, 330, 150, 182, '#B23A3A'],
    [150, 330, 150, 182, '#D97F8E'],
  ];
  for (const [x, y, w, h, col] of panels) {
    ctx.fillStyle = col;
    ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
  }
  // Rayos de sol y un chopp gigante en el panel amarillo
  ctx.save();
  ctx.translate(150, 170);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 16; i++) {
    ctx.rotate(Math.PI / 8);
    ctx.fillRect(0, -6, 160, 12);
  }
  ctx.restore();
  ctx.fillStyle = '#F2B134';
  ctx.fillRect(105, 120, 90, 130);
  ctx.strokeStyle = '#3A2A1A';
  ctx.lineWidth = 8;
  ctx.strokeRect(105, 120, 90, 130);
  ctx.beginPath();
  ctx.arc(205, 185, 28, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.fillStyle = '#FFF8E7';
  ctx.beginPath();
  ctx.ellipse(150, 118, 55, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  // Ondas en el verde, rombos en el marrón
  ctx.strokeStyle = '#F4F1EA';
  ctx.lineWidth = 6;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    for (let x = 310; x < 505; x += 4) ctx.lineTo(x, 40 + i * 30 + Math.sin(x / 14) * 8);
    ctx.stroke();
  }
  ctx.fillStyle = '#2B2B2B';
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    const cx = 406;
    const cy = 210 + i * 60;
    ctx.moveTo(cx, cy - 22);
    ctx.lineTo(cx + 40, cy);
    ctx.lineTo(cx, cy + 22);
    ctx.lineTo(cx - 40, cy);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Cubo de chapa corten con ventanales (foto del local), cartel redondo y mural al costado. */
export function buildGalponMBC(): LocalModel {
  const k = new Kit();
  const extras = new THREE.Group();
  const frame = '#2A2A2A';
  const D = 14;
  const H = 10.5;
  const W = 20;

  // Cuerpo de chapa (textura corrugada)
  const corten = cortenTexture();
  corten.repeat.set(4, 6);
  const body = new THREE.Mesh(new THREE.BoxGeometry(D, H, W), new THREE.MeshStandardMaterial({ map: corten, roughness: 0.85 }));
  body.position.set(-D / 2, H / 2, 0);
  extras.add(body);
  k.box(D + 0.4, 0.4, W + 0.4, '#6E3018', -D / 2, H, 0);

  // Ventanales: vidrio (se prende de noche) y parteluces
  const glass = glowEmissive(new THREE.MeshStandardMaterial({ color: '#3B4A52', roughness: 0.2, metalness: 0.3, emissive: '#FFB45A' }), 0.05, 1.1);
  const bays: [number, number][] = [
    [-5.5, 7],
    [4.5, 7.5],
  ];
  for (const [zc, bw] of bays) {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(bw, 7.5), glass);
    pane.position.set(0.03, 4.4, zc);
    pane.rotation.y = Math.PI / 2;
    extras.add(pane);
    k.box(0.25, 0.3, bw + 0.4, frame, 0.1, 0.55, zc);
    k.box(0.25, 0.3, bw + 0.4, frame, 0.1, 8.15, zc);
    for (let i = 0; i <= 5; i++) k.box(0.22, 7.6, 0.14, frame, 0.1, 0.6, zc - bw / 2 + (bw * i) / 5);
    for (const y of [2.6, 4.6, 6.4]) k.box(0.2, 0.08, bw, frame, 0.1, y, zc);
  }
  // Ventanal sobre la cara que mira a la birra que se acerca (+z)
  const side = new THREE.Mesh(new THREE.PlaneGeometry(9, 7.5), glass);
  side.position.set(-D / 2, 4.4, W / 2 + 0.03);
  extras.add(side);
  k.box(9.4, 0.3, 0.25, frame, -D / 2, 0.55, W / 2 + 0.1);
  k.box(9.4, 0.3, 0.25, frame, -D / 2, 8.15, W / 2 + 0.1);
  for (let i = 0; i <= 6; i++) k.box(0.14, 7.6, 0.22, frame, -D / 2 - 4.5 + i * 1.5, 0.6, W / 2 + 0.1);

  // Cartel redondo en la chapa (como en la foto) y otro en poste
  const wallSign = cartelDisc(1.9);
  wallSign.position.set(0.25, 6.6, -9.4 + 2.2);
  extras.add(wallSign);
  k.cyl(0.13, 0.16, 6.2, '#5B3A28', 2.6, 0, 9.4, 8);
  const pole = cartelDisc(1.35);
  pole.position.set(2.6, 7.4, 9.4);
  extras.add(pole);

  // Plantas puntiagudas adelante
  for (let z = -9.2; z <= 9.2; z += 1.2) {
    for (let j = 0; j < 4; j++) {
      const a = j * 1.6 + z;
      k.cone(0.12, 1.1 + (j % 2) * 0.4, j % 2 ? '#5E8F3E' : '#4C7A34', 1.0 + Math.cos(a) * 0.25, 0, z + Math.sin(a) * 0.25, 4, { rz: Math.cos(a) * 0.4, rx: Math.sin(a) * 0.4 });
    }
  }

  // Muro con mural al costado (detrás, en -z)
  k.box(8, 8.5, 0.8, '#8E8C88', -6, 0, -W / 2 - 5);
  k.box(8, 0.3, 10, '#7A7874', -6, 0, -W / 2 - 5);
  const mural = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 7.6), new THREE.MeshStandardMaterial({ map: muralTexture(), roughness: 0.9 }));
  mural.position.set(-6, 4.3, -W / 2 - 4.58);
  extras.add(mural);
  k.box(0.6, 8.5, 9, '#8E8C88', -10, 0, -W / 2 - 4.6);
  return { geo: k.build(), extras };
}

// ---------- Escenario MBC ----------

let letrasMat: THREE.MeshStandardMaterial | null = null;
function letrasMaterial(): THREE.MeshStandardMaterial {
  letrasMat ??= glowEmissive(
    brandMaterial(LC.letras, '#F28C1F', { transparent: true, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.5 }, true),
    0.55,
    1.5,
  );
  return letrasMat;
}

/** Tablado con banda, cerco verde y las letras luminosas MBC (recorte de la foto del escenario). */
export function buildEscenarioMBC(): LocalModel {
  const k = new Kit();
  const lights = new Kit();
  const extras = new THREE.Group();
  const black = '#1E1E22';
  const truss = '#9AA0A6';

  k.box(7, 1.2, 13, black, -3.5, 0, 0);
  k.box(0.6, 6, 14, '#2F4A2C', -7.2, 0, 0);
  for (const z of [-6.6, 6.6]) for (const x of [-0.3, -6.7]) k.box(0.35, 7.5, 0.35, truss, x, 0, z);
  for (const x of [-0.3, -6.7]) k.box(0.3, 0.3, 13.6, truss, x, 7.5, 0);
  for (const z of [-6.6, 6.6]) k.box(6.7, 0.3, 0.3, truss, -3.5, 7.5, z);
  // Parlantes, batería y pies de micrófono
  for (const z of [-5.4, 5.4]) {
    k.box(1.2, 1.8, 1.2, '#111111', -1.4, 1.2, z);
    k.box(1.2, 1.4, 1.2, '#111111', -1.4, 3.0, z);
  }
  k.cylC(0.55, 0.45, '#C8C8C8', -4.5, 1.75, 0, 14, { rx: Math.PI / 2 });
  k.cyl(0.35, 0.35, 0.5, '#B23A3A', -4, 1.2, -1.2, 12);
  k.cyl(0.35, 0.35, 0.5, '#B23A3A', -4, 1.2, 1.2, 12);
  k.cyl(0.55, 0.55, 0.03, '#D9B24A', -4.8, 2.7, -1.6, 14);
  k.cyl(0.03, 0.03, 1.5, '#555555', -4.8, 1.2, -1.6, 4);
  for (const z of [-2.5, 0.5, 3.2]) {
    k.cyl(0.03, 0.03, 1.6, '#555555', -0.9, 1.2, z, 4);
    k.sphere(0.07, '#222222', -0.9, 2.85, z, undefined, 0);
  }
  // Tachos de luz en la parrilla
  for (let z = -5.5; z <= 5.5; z += 2.2) lights.cyl(0.2, 0.25, 0.4, '#ffffff', -0.5, 7.0, z, 8);
  extras.add(new THREE.Mesh(lights.build(), bulbMat));

  // Letras grandes adelante (cara frente a la pista) y un cartel chico en el cerco
  const big = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.56), letrasMaterial());
  big.position.set(1.4, 1.95, 0);
  big.rotation.y = Math.PI / 2;
  extras.add(big);
  k.box(0.5, 0.25, 6, black, 1.3, 0, 0);
  const small = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2), letrasMaterial());
  small.position.set(-6.85, 4.6, 0);
  small.rotation.y = Math.PI / 2;
  extras.add(small);
  return { geo: k.build(), extras };
}

// ---------- Gigantografías ----------

let billboardGeo: THREE.BufferGeometry | null = null;
let billboardLights: THREE.BufferGeometry | null = null;
const photoMats = new Map<string, THREE.MeshStandardMaterial>();

/** Cartel publicitario con una foto de los locales: estructura + foto + cartel redondo en la esquina. */
export function buildGigantografia(file: string): THREE.Group {
  const W = 8.4;
  const H = 4.2;
  const base = 3.6;
  if (!billboardGeo) {
    const k = new Kit();
    for (const z of [-2.6, 2.6]) k.box(0.35, base + 0.2, 0.35, '#5F6368', -0.4, 0, z);
    k.box(0.3, H + 0.4, W + 0.4, '#26282B', -0.15, base - 0.2, 0);
    k.box(0.8, 0.1, W, '#5F6368', 0.2, base - 0.3, 0);
    for (const z of [-2.8, 0, 2.8]) {
      k.box(0.9, 0.08, 0.08, '#3A3D40', 0.35, base + H + 0.3, z);
    }
    billboardGeo = k.build();
    const l = new Kit();
    for (const z of [-2.8, 0, 2.8]) l.boxC(0.35, 0.18, 0.6, '#ffffff', 0.8, base + H + 0.22, z);
    billboardLights = l.build();
  }
  let mat = photoMats.get(file);
  if (!mat) {
    mat = glowEmissive(brandMaterial(file, '#3A332C', { roughness: 0.6 }, true), 0.05, 0.55);
    photoMats.set(file, mat);
  }
  const g = new THREE.Group();
  g.add(new THREE.Mesh(billboardGeo, kitMaterial));
  g.add(new THREE.Mesh(billboardLights!, bulbMat));
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat);
  photo.position.set(0.02, base + H / 2, 0);
  photo.rotation.y = Math.PI / 2;
  g.add(photo);
  const sign = cartelDisc(1.05);
  sign.position.set(0.35, base + H - 0.15, W / 2 - 0.5);
  g.add(sign);
  return g;
}
