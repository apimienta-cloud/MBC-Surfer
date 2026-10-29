import * as THREE from 'three';
import { config, color, palette } from '../config';

const CH = config.chaser;

// Posiciones en la hoja como fracción desde arriba (coinciden con la textura)
const BAND = 0.14;
const BROWS_F = 0.39;
const EYES_F = 0.49;
const MOUTH_F = 0.67;

export interface LunesAnimState {
  dt: number;
  speed: number;
  airborne: boolean;
  shouting: boolean;
}

/**
 * Builder del Lunes: bloque de calendario de pared con anillas, cara enojada, bracitos y piernas.
 * El frente (la hoja que dice LUNES) mira hacia +z, o sea hacia la cámara.
 */
export class Lunes {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private legs: THREE.Group[] = [];
  private arms: THREE.Group[] = [];
  private mouth: THREE.Group;
  private phase = 0;
  private time = 0;

  constructor() {
    const W = CH.sheetWidth;
    const H = CH.sheetHeight;
    const D = 0.32;
    const legL = CH.legLength;
    const top = legL + H;
    const fy = (f: number): number => top - f * H;

    this.root.add(this.body);

    const white = new THREE.MeshStandardMaterial({ color: '#F4F1EA', roughness: 0.9 });
    const back = new THREE.MeshStandardMaterial({ color: '#B9A890', roughness: 0.95 });
    const red = new THREE.MeshStandardMaterial({ color: color('lunesRed'), roughness: 0.6 });
    const front = new THREE.MeshStandardMaterial({ map: makeSheetTexture(), roughness: 0.85 });
    const metal = new THREE.MeshStandardMaterial({ color: '#9AA3AD', roughness: 0.3, metalness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: '#1A1110', roughness: 0.6 });
    const whiteGloss = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.4 });
    const tongue = new THREE.MeshStandardMaterial({ color: '#D9465A', roughness: 0.7 });

    // Bloque de hojas: material por cara [+x, -x, +y, -y, +z (frente), -z]
    const block = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), [white, white, red, white, front, back]);
    block.position.y = legL + H / 2;
    this.body.add(block);
    // Cantos de las hojas de abajo (rayitas) para que se lea como taco
    for (let i = 1; i <= 3; i++) {
      const page = new THREE.Mesh(new THREE.BoxGeometry(W * 0.98, 0.012, D + 0.01), new THREE.MeshBasicMaterial({ color: '#D8D2C6' }));
      page.position.y = legL + 0.06 * i;
      this.body.add(page);
    }

    // Anillas metálicas arriba
    const ringGeo = new THREE.TorusGeometry(0.11, 0.025, 8, 16);
    for (const sx of [-1, 1]) {
      const ring = new THREE.Mesh(ringGeo, metal);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(sx * W * 0.27, top + 0.02, 0);
      this.body.add(ring);
    }

    // Cara enojada en el frente
    const z = D / 2 + 0.02;
    const eyeGeo = new THREE.SphereGeometry(0.15, 14, 10);
    const pupilGeo = new THREE.SphereGeometry(0.065, 10, 8);
    const browGeo = new THREE.BoxGeometry(0.34, 0.075, 0.05);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, whiteGloss);
      eye.scale.z = 0.4;
      eye.position.set(sx * 0.29, fy(EYES_F), z);
      this.body.add(eye);
      const pupil = new THREE.Mesh(pupilGeo, dark);
      pupil.position.set(sx * 0.26, fy(EYES_F) - 0.02, z + 0.06);
      this.body.add(pupil);
      // Cejas en V: el extremo de adentro más abajo
      const brow = new THREE.Mesh(browGeo, dark);
      brow.position.set(sx * 0.28, fy(BROWS_F), z + 0.04);
      brow.rotation.z = sx * 0.45;
      this.body.add(brow);
    }
    // Boca gritona: óvalo oscuro con lengua y dientes
    this.mouth = new THREE.Group();
    const hole = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 10), dark);
    hole.scale.set(1.25, 0.8, 0.25);
    this.mouth.add(hole);
    const tng = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), tongue);
    tng.scale.set(1.3, 0.6, 0.3);
    tng.position.set(0, -0.08, 0.02);
    this.mouth.add(tng);
    const teeth = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.04), whiteGloss);
    teeth.position.set(0, 0.13, 0.03);
    this.mouth.add(teeth);
    this.mouth.position.set(0, fy(MOUTH_F), z);
    this.body.add(this.mouth);

    // Bracitos y piernas
    const armGeo = new THREE.CapsuleGeometry(0.05, 0.5, 4, 8).translate(0, -0.3, 0);
    const legGeo = new THREE.CapsuleGeometry(0.06, legL - 0.1, 4, 8).translate(0, -(legL - 0.06) / 2, 0);
    const glove = new THREE.SphereGeometry(0.1, 10, 8);
    const shoe = new THREE.SphereGeometry(0.11, 10, 8);
    for (const sx of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(sx * (W / 2 + 0.03), fy(0.45), 0);
      arm.add(new THREE.Mesh(armGeo, dark));
      const hand = new THREE.Mesh(glove, whiteGloss);
      hand.position.y = -0.62;
      arm.add(hand);
      this.body.add(arm);
      this.arms.push(arm);

      const leg = new THREE.Group();
      leg.position.set(sx * W * 0.24, legL, 0);
      leg.add(new THREE.Mesh(legGeo, dark));
      const foot = new THREE.Mesh(shoe, red);
      foot.scale.set(1, 0.6, 1.6);
      foot.position.set(0, -legL + 0.06, -0.06);
      leg.add(foot);
      this.root.add(leg);
      this.legs.push(leg);
    }
  }

  /** Altura de la cabeza, para ubicar los globos de diálogo. */
  get headHeight(): number {
    return CH.legLength + CH.sheetHeight + 0.2;
  }

  animate(s: LunesAnimState): void {
    this.time += s.dt;
    // Zancadas exageradas
    if (!s.airborne) this.phase += s.speed * s.dt * 0.75;
    const sw = s.airborne ? 0.6 : Math.sin(this.phase);
    this.legs[0].rotation.x = s.airborne ? -0.9 : sw * 1.1;
    this.legs[1].rotation.x = s.airborne ? 0.7 : -sw * 1.1;
    this.body.position.y = s.airborne ? 0 : Math.abs(Math.cos(this.phase)) * 0.12;
    this.body.rotation.z = Math.sin(this.phase) * 0.06;
    // Bracitos sacudiéndose arriba, enojado
    const shake = Math.sin(this.time * 16);
    this.arms[0].rotation.z = -2.3 + shake * 0.35;
    this.arms[1].rotation.z = 2.3 - shake * 0.35;
    this.arms[0].rotation.x = this.arms[1].rotation.x = s.airborne ? -0.6 : 0;
    // Boca gritando
    const open = s.shouting ? 0.75 + Math.abs(Math.sin(this.time * 14)) * 0.5 : 0.55;
    this.mouth.scale.set(1, open, 1);
  }
}

/** Número del día: el próximo lunes, o el fijo de config. */
export function lunesDayNumber(): number {
  if (CH.dayNumber !== 'auto') return CH.dayNumber;
  const d = new Date();
  const add = (8 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + add);
  return d.getDate();
}

/** Hoja del calendario en CanvasTexture: franja roja, "LUNES" y el número del día. */
function makeSheetTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = Math.round((w * CH.sheetHeight) / CH.sheetWidth);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const draw = (): void => {
    ctx.fillStyle = '#F4F1EA';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = color('lunesRed');
    ctx.fillRect(0, 0, w, h * BAND);
    // Agujeritos de las anillas
    ctx.fillStyle = '#5A1218';
    for (const fx of [0.23, 0.77]) {
      ctx.beginPath();
      ctx.arc(w * fx, h * BAND * 0.45, 9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color('lunesRed');
    ctx.font = `800 ${Math.round(h * 0.17)}px 'Baloo 2', 'Arial Black', sans-serif`;
    ctx.fillText('LUNES', w / 2, h * 0.245);
    ctx.fillStyle = palette.deepBlue;
    ctx.font = `800 ${Math.round(h * 0.14)}px 'Baloo 2', 'Arial Black', sans-serif`;
    ctx.fillText(String(lunesDayNumber()), w / 2, h * 0.885);
    tex.needsUpdate = true;
  };
  draw();
  // Redibuja cuando carga la fuente display
  document.fonts?.load(`800 40px 'Baloo 2'`).then(draw).catch(() => undefined);
  return tex;
}
