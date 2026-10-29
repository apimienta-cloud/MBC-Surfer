import * as THREE from 'three';
import { config, color, SkinDef, SkinShape } from '../config';

const BC = config.birra;

/** Proporciones de cada envase. Alturas en metros, desde la base del cuerpo. */
interface Profile {
  bodyR: number;
  bodyH: number;
  shoulderH: number;
  neckR: number;
  neckH: number;
  cap: boolean;
  glass: boolean; // chopp / pinta: vidrio translúcido
  metal: boolean; // lata
  handle?: 'mug' | 'growler';
  taper?: number; // radio de abajo / radio de arriba
  capColor?: string;
}

const PROFILES: Record<SkinShape, Profile> = {
  porron: { bodyR: 0.32, bodyH: 0.72, shoulderH: 0.2, neckR: 0.13, neckH: 0.2, cap: true, glass: false, metal: false },
  litro: { bodyR: 0.3, bodyH: 0.86, shoulderH: 0.22, neckR: 0.12, neckH: 0.26, cap: true, glass: false, metal: false },
  lata: { bodyR: 0.3, bodyH: 0.92, shoulderH: 0.06, neckR: 0.26, neckH: 0.03, cap: false, glass: false, metal: true },
  chopp: { bodyR: 0.34, bodyH: 0.84, shoulderH: 0, neckR: 0.34, neckH: 0, cap: false, glass: true, metal: false, handle: 'mug' },
  pinta: { bodyR: 0.34, bodyH: 0.9, shoulderH: 0, neckR: 0.34, neckH: 0, cap: false, glass: true, metal: false, taper: 0.8 },
  growler: { bodyR: 0.35, bodyH: 0.72, shoulderH: 0.24, neckR: 0.13, neckH: 0.12, cap: true, glass: false, metal: false, handle: 'growler', capColor: '#1E1E1E' },
};

export type Expression = 'run' | 'jump' | 'panic';

export interface BirraAnimState {
  dt: number;
  speed: number;
  grounded: boolean;
  vy: number;
  rolling: boolean;
  stumbling: boolean;
  laneTilt: number; // -1..1 según hacia dónde cambia de carril
  chaserNear: boolean;
  caught: boolean;
}

/**
 * Builder de la birra low-poly + animación procedural (sin rig).
 * Jerarquía: root → spinner (rodar) → layer (acostarse) → squash (base en los pies) → partes.
 */
export class Birra {
  readonly root = new THREE.Group();
  private spinner = new THREE.Group();
  private layer = new THREE.Group();
  private squash = new THREE.Group();
  private foam = new THREE.Group();
  private foamBalls: THREE.Mesh[] = [];
  private legs: THREE.Group[] = [];
  private arms: THREE.Group[] = [];
  private brows: THREE.Mesh[] = [];
  private pupils: THREE.Mesh[] = [];
  private smile!: THREE.Mesh;
  private mouthOpen!: THREE.Mesh;
  private profile: Profile;

  /** Altura del centro del envase (pivote para acostarse). */
  private center: number;
  private topY: number;

  // Estado de animación
  private phase = 0;
  private lay = 0;
  private spin = 0;
  private squashAmt = 0;
  private wobble = 0;
  private glanceTimer = 3;
  private glance = 0;
  private wasGrounded = true;
  private time = 0;

  constructor(skin: SkinDef = config.skins[0]) {
    const pr = (this.profile = PROFILES[skin.shape]);
    const legL = BC.legLength;
    const bodyTop = legL + pr.bodyH;
    this.topY = bodyTop + pr.shoulderH + pr.neckH;
    this.center = legL + (this.topY - legL) / 2;

    this.root.add(this.spinner);
    this.spinner.add(this.layer);
    this.layer.add(this.squash);
    this.squash.position.y = -this.center;

    const bottleMat = new THREE.MeshStandardMaterial({
      color: skin.color,
      roughness: pr.metal ? 0.35 : 0.12,
      metalness: pr.metal ? 0.3 : 0.05,
      transparent: pr.glass,
      opacity: pr.glass ? 0.88 : 1,
    });
    const goldMat = new THREE.MeshStandardMaterial({ color: color('gold'), roughness: 0.3, metalness: 0.6 });
    const foamMat = new THREE.MeshStandardMaterial({ color: color('foam'), roughness: 0.9 });
    const limbMat = new THREE.MeshStandardMaterial({ color: BC.limbColor, roughness: 0.7 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: BC.glovesColor, roughness: 0.8 });
    const darkMat = new THREE.MeshStandardMaterial({ color: '#1A1110', roughness: 0.6 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.4 });

    // Cuerpo
    const body = new THREE.Mesh(new THREE.CylinderGeometry(pr.bodyR, pr.bodyR * (pr.taper ?? 0.97), pr.bodyH, 20), bottleMat);
    body.position.y = legL + pr.bodyH / 2;
    this.squash.add(body);
    if (pr.shoulderH > 0) {
      const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(pr.neckR, pr.bodyR, pr.shoulderH, 20), bottleMat);
      shoulder.position.y = bodyTop + pr.shoulderH / 2;
      this.squash.add(shoulder);
    }
    if (pr.neckH > 0) {
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(pr.neckR, pr.neckR, pr.neckH, 16), bottleMat);
      neck.position.y = bodyTop + pr.shoulderH + pr.neckH / 2;
      this.squash.add(neck);
    }
    if (pr.metal) {
      // Borde de la lata
      const rim = new THREE.Mesh(new THREE.TorusGeometry(pr.neckR, 0.025, 6, 20), goldMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = this.topY;
      this.squash.add(rim);
    }
    if (pr.handle === 'mug') {
      // Manija del chopp (del lado derecho)
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 8, 16, Math.PI), bottleMat);
      handle.rotation.z = -Math.PI / 2;
      handle.position.set(pr.bodyR, legL + pr.bodyH / 2, 0);
      this.squash.add(handle);
    } else if (pr.handle === 'growler') {
      // Asa del botellón, entre el hombro y el cuello
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.04, 8, 16, Math.PI * 1.2), bottleMat);
      handle.rotation.z = -Math.PI * 0.6;
      handle.position.set(pr.bodyR * 0.62, bodyTop + 0.1, 0);
      this.squash.add(handle);
    }

    // Etiqueta: la del producto real si la skin la tiene; si no, banda con el logo (o color liso)
    const eyesY = bodyTop - 0.17;
    const mouthY = eyesY - 0.115;
    const labelTop = Math.min(mouthY - 0.06, legL + pr.bodyH * 0.62);
    this.addLabel(skin, pr, legL, labelTop);

    // Tapita dorada con bordecito dentado, apoyada arriba de la espuma como un sombrerito
    const foamY = this.topY + 0.02;
    this.foam.position.y = foamY;
    this.squash.add(this.foam);
    const foamR = pr.cap ? 0.11 : pr.neckR * 0.55;
    const foamGeo = new THREE.SphereGeometry(1, 10, 8);
    const ballCount = pr.cap ? 5 : 7;
    for (let i = 0; i < ballCount; i++) {
      const a = (i / ballCount) * Math.PI * 2;
      const r = pr.cap ? 0.09 : pr.neckR * 0.55;
      const b = new THREE.Mesh(foamGeo, foamMat);
      b.scale.setScalar(foamR * (0.9 + (i % 2) * 0.25));
      b.position.set(Math.cos(a) * r, (i % 2) * 0.05, Math.sin(a) * r);
      b.userData.base = b.position.clone();
      this.foam.add(b);
      this.foamBalls.push(b);
    }
    const top = new THREE.Mesh(foamGeo, foamMat);
    top.scale.setScalar(foamR * 1.15);
    top.position.y = 0.08;
    top.userData.base = top.position.clone();
    this.foam.add(top);
    this.foamBalls.push(top);
    if (pr.cap) {
      const cap = new THREE.Group();
      const capMat = pr.capColor ? new THREE.MeshStandardMaterial({ color: pr.capColor, roughness: 0.5 }) : goldMat;
      cap.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 18), capMat));
      const tooth = new THREE.BoxGeometry(0.035, 0.06, 0.03);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const t = new THREE.Mesh(tooth, capMat);
        t.position.set(Math.cos(a) * 0.155, -0.012, Math.sin(a) * 0.155);
        t.rotation.y = -a;
        cap.add(t);
      }
      cap.position.y = 0.2;
      cap.rotation.z = 0.25;
      this.foam.add(cap);
    }

    // Cara (al frente = -z)
    const faceZ = (x: number): number => -Math.sqrt(Math.max(0, pr.bodyR * pr.bodyR - x * x)) - 0.01;
    const eyeGeo = new THREE.SphereGeometry(0.085, 14, 10);
    const pupilGeo = new THREE.SphereGeometry(0.04, 10, 8);
    const browGeo = new THREE.BoxGeometry(0.12, 0.028, 0.03);
    for (const sx of [-1, 1]) {
      const x = sx * 0.11;
      const eye = new THREE.Mesh(eyeGeo, whiteMat);
      eye.scale.z = 0.55;
      eye.position.set(x, eyesY, faceZ(x) + 0.01);
      this.squash.add(eye);
      const pupil = new THREE.Mesh(pupilGeo, darkMat);
      pupil.position.set(x + sx * -0.012, eyesY - 0.005, eye.position.z - 0.04);
      this.squash.add(pupil);
      this.pupils.push(pupil);
      const brow = new THREE.Mesh(browGeo, darkMat);
      brow.position.set(x, eyesY + 0.11, faceZ(x) - 0.01);
      brow.userData.sx = sx;
      this.squash.add(brow);
      this.brows.push(brow);
    }
    this.smile = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.016, 6, 12, Math.PI), darkMat);
    this.smile.rotation.z = Math.PI;
    this.smile.position.set(0, mouthY + 0.03, faceZ(0) - 0.005);
    this.squash.add(this.smile);
    this.mouthOpen = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), darkMat);
    this.mouthOpen.scale.set(1, 1, 0.4);
    this.mouthOpen.position.set(0, mouthY, faceZ(0));
    this.squash.add(this.mouthOpen);

    // Brazos y piernas: cápsulas finitas con pivote en hombro / cadera
    const armGeo = new THREE.CapsuleGeometry(0.035, 0.3, 4, 8).translate(0, -0.17, 0);
    const legGeo = new THREE.CapsuleGeometry(0.04, legL - 0.08, 4, 8).translate(0, -(legL - 0.04) / 2, 0);
    const handGeo = new THREE.SphereGeometry(0.06, 10, 8);
    const footGeo = new THREE.SphereGeometry(0.075, 10, 8);
    for (const sx of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(sx * (pr.bodyR + 0.03), legL + pr.bodyH * 0.55, 0);
      arm.add(new THREE.Mesh(armGeo, limbMat));
      const hand = new THREE.Mesh(handGeo, gloveMat);
      hand.position.y = -0.36;
      arm.add(hand);
      arm.rotation.z = sx * 0.35;
      this.squash.add(arm);
      this.arms.push(arm);

      const leg = new THREE.Group();
      leg.position.set(sx * pr.bodyR * 0.45, legL, 0);
      leg.add(new THREE.Mesh(legGeo, limbMat));
      const foot = new THREE.Mesh(footGeo, darkMat);
      foot.scale.set(1, 0.6, 1.5);
      foot.position.set(0, -legL + 0.04, -0.04);
      leg.add(foot);
      this.squash.add(leg);
      this.legs.push(leg);
    }
    this.setExpression('run');
  }

  /**
   * Etiqueta curva alrededor del cuerpo. u=0.25 queda en la espalda (la ve la cámara) y u=0.75 al frente.
   * - 'wrap' (latas): cubre todo el cuerpo con la etiqueta real.
   * - 'print' (vidrio): letras impresas sobre fondo transparente.
   * - sin etiqueta: banda con el logo de la marca, como antes.
   */
  private addLabel(skin: SkinDef, pr: Profile, legL: number, labelTop: number): void {
    let h = 0.3;
    let y = labelTop - h / 2;
    let mat: THREE.MeshStandardMaterial;
    if (skin.label && skin.labelMode === 'wrap') {
      h = pr.bodyH - 0.04;
      y = legL + pr.bodyH / 2;
      mat = new THREE.MeshStandardMaterial({ color: skin.color, roughness: 0.4, metalness: 0.15 });
    } else if (skin.label) {
      if (pr.glass) {
        h = pr.bodyH * 0.86;
        y = legL + pr.bodyH / 2;
      }
      mat = new THREE.MeshStandardMaterial({ transparent: true, alphaTest: 0.35, roughness: 0.5, opacity: 0 });
    } else {
      if (pr.glass) return;
      mat = new THREE.MeshStandardMaterial({ map: makeLabelTexture(), roughness: 0.6 });
    }
    if (skin.label) loadProductTexture(skin.label, mat);
    // El radio de la etiqueta acompaña la forma del cuerpo (las pintas se angostan abajo)
    const tp = pr.taper ?? 0.97;
    const rAt = (yy: number): number => pr.bodyR * (tp + (1 - tp) * ((yy - legL) / pr.bodyH)) + 0.006;
    const label = new THREE.Mesh(new THREE.CylinderGeometry(rAt(y + h / 2), rAt(y - h / 2), h, 28, 1, true, -Math.PI / 2, Math.PI * 2), mat);
    label.position.y = y;
    this.squash.add(label);
  }

  /** Altura del tope (para emitir espuma). */
  get foamHeight(): number {
    return this.topY + 0.1;
  }

  /** Radio del envase (para rodar). */
  get radius(): number {
    return this.profile.bodyR;
  }

  setExpression(e: Expression): void {
    this.smile.visible = e === 'run';
    this.mouthOpen.visible = e !== 'run';
    this.mouthOpen.scale.set(e === 'panic' ? 1.2 : 0.9, e === 'panic' ? 1.5 : 0.9, 0.4);
    for (const b of this.brows) {
      const sx = b.userData.sx as number;
      // Correr: cejas decididas (adentro abajo). Pánico: preocupadas (adentro arriba)
      b.rotation.z = e === 'panic' ? sx * -0.4 : e === 'jump' ? 0 : sx * 0.25;
    }
    for (const p of this.pupils) p.scale.setScalar(e === 'panic' ? 0.6 : 1);
  }

  /** Eventos puntuales de la física. */
  onJump(): void {
    this.squashAmt = 0.22; // se achata al despegar
  }

  onLand(): void {
    this.squashAmt = 0.3; // se achata al caer
  }

  onStumble(): void {
    this.wobble = 0.5;
  }

  animate(s: BirraAnimState): void {
    const dt = s.dt;
    this.time += dt;
    if (s.grounded && !this.wasGrounded) this.onLand();
    this.wasGrounded = s.grounded;

    // Acostarse para rodar como botella
    const layTarget = s.rolling ? 1 : 0;
    this.lay += (layTarget - this.lay) * Math.min(1, dt * 18);
    if (s.rolling) {
      this.spin -= (s.speed * dt) / this.profile.bodyR;
    } else {
      // Vuelve a la vuelta completa más cercana
      const target = Math.round(this.spin / (Math.PI * 2)) * Math.PI * 2;
      this.spin += (target - this.spin) * Math.min(1, dt * 14);
      if (Math.abs(target - this.spin) < 1e-3) this.spin = 0;
    }
    this.spinner.position.y = THREE.MathUtils.lerp(this.center, this.profile.bodyR + 0.02, this.lay);
    this.spinner.rotation.x = this.spin;
    this.layer.rotation.z = (this.lay * Math.PI) / 2;

    // Ciclo de carrera
    const running = s.grounded && !s.rolling && s.speed > 0;
    if (running) this.phase += s.speed * dt * BC.runCycle * 0.42;
    const swing = running ? Math.sin(this.phase) : 0;
    const tuck = 1 - this.lay;
    this.legs[0].rotation.x = swing * 0.9;
    this.legs[1].rotation.x = -swing * 0.9;
    this.arms[0].rotation.x = -swing * 0.8;
    this.arms[1].rotation.x = swing * 0.8;
    if (!s.grounded && !s.rolling) {
      // En el aire: patitas recogidas y bracitos arriba
      this.legs[0].rotation.x = 0.5;
      this.legs[1].rotation.x = -0.3;
      this.arms[0].rotation.x = this.arms[1].rotation.x = Math.PI * 0.8;
    }
    if (s.caught) {
      // Pánico: bracitos agitándose
      this.arms[0].rotation.x = Math.PI * 0.85 + Math.sin(this.time * 30) * 0.3;
      this.arms[1].rotation.x = Math.PI * 0.85 - Math.sin(this.time * 30) * 0.3;
    }
    for (const l of [...this.legs, ...this.arms]) l.scale.setScalar(Math.max(0.001, tuck));

    // Squash & stretch: estirada en el aire según la velocidad vertical, aplastada al despegar/caer
    this.squashAmt = Math.max(0, this.squashAmt - dt * 2.2);
    const stretch = !s.grounded ? Math.min(1, Math.abs(s.vy) / config.player.jumpVelocity) * 0.14 : 0;
    const bounce = running ? Math.abs(Math.sin(this.phase)) * 0.04 : 0;
    const sy = 1 + stretch + bounce - this.squashAmt;
    const sxz = 1 / Math.sqrt(Math.max(0.3, sy));
    this.squash.scale.set(sxz, sy, sxz);

    // Inclinación, tambaleo y miradas para atrás
    this.wobble = Math.max(0, this.wobble - dt);
    const wob = this.wobble > 0 ? Math.sin(this.time * 38) * 0.3 * (this.wobble / 0.5) : 0;
    this.squash.rotation.x = -BC.lean * tuck * (running ? 1 : 0.4);
    this.squash.rotation.z = wob + s.laneTilt * 0.25 * tuck;

    if (s.chaserNear && !s.caught) {
      this.glanceTimer -= dt;
      if (this.glanceTimer <= 0) {
        this.glance = BC.glanceTime;
        const [a, b] = BC.glanceEvery;
        this.glanceTimer = a + Math.random() * (b - a);
      }
    }
    this.glance = Math.max(0, this.glance - dt);
    const turn = s.caught ? Math.PI : this.glance > 0 ? Math.PI * 0.8 * Math.sin((this.glance / BC.glanceTime) * Math.PI) : 0;
    this.squash.rotation.y += (turn - this.squash.rotation.y) * Math.min(1, dt * 14);

    // Expresión
    this.setExpression(s.caught || this.wobble > 0 || this.glance > 0 ? 'panic' : !s.grounded ? 'jump' : 'run');

    // Espuma: se bambolea y se queda atrás con el movimiento vertical
    this.foam.position.y = this.topY + 0.02 - THREE.MathUtils.clamp(s.vy * 0.006, -0.05, 0.05);
    this.foamBalls.forEach((b, i) => {
      const base = b.userData.base as THREE.Vector3;
      const w = Math.sin(this.time * 9 + i * 1.7) * 0.012;
      b.position.set(base.x + w, base.y + Math.abs(w) + bounce * 0.3, base.z - (running ? 0.015 : 0));
    });
  }
}

const productTextures = new Map<string, THREE.Texture>();

/** Carga la etiqueta de un producto (cacheada). Si falta el archivo queda el color de la skin. */
function loadProductTexture(file: string, mat: THREE.MeshStandardMaterial): void {
  const apply = (t: THREE.Texture): void => {
    mat.map = t;
    mat.color.set('#ffffff');
    mat.opacity = 1;
    mat.needsUpdate = true;
  };
  const cached = productTextures.get(file);
  if (cached) return apply(cached);
  new THREE.TextureLoader().load(
    config.productsPath + file,
    (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      productTextures.set(file, t);
      apply(t);
    },
    undefined,
    // TODO(brand): falta la etiqueta del producto en public/assets/brand/productos/
    () => console.warn(`[brand] Falta ${config.productsPath}${file}`),
  );
}

/** Banda de etiqueta: logo de la marca dos veces (frente y espalda) o color liso si no hay logo. */
function makeLabelTexture(): THREE.CanvasTexture {
  const w = 1024;
  const h = 160;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  // Placeholder neutro: etiqueta lisa
  ctx.fillStyle = color('foam');
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = color('gold');
  ctx.fillRect(0, 0, w, 10);
  ctx.fillRect(0, h - 10, w, 10);

  const img = new Image();
  img.onload = () => {
    // Fondo del color del logo (se toma de una esquina) para que la banda quede continua
    const probe = document.createElement('canvas');
    probe.width = probe.height = 1;
    const pctx = probe.getContext('2d')!;
    pctx.drawImage(img, 0, 0, 1, 1, 0, 0, 1, 1);
    const [r, g, b] = pctx.getImageData(0, 0, 1, 1).data;
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, w, h);
    // Recorte central apaisado del logo; u=0.25 queda en la espalda (+z) y u=0.75 al frente
    const srcH = img.naturalHeight * 0.45;
    const srcW = srcH * 2.6;
    const sx = (img.naturalWidth - srcW) / 2;
    const sy = (img.naturalHeight - srcH) / 2;
    const dw = h * 2.6;
    for (const u of [0.25, 0.75]) ctx.drawImage(img, sx, sy, srcW, srcH, u * w - dw / 2, 0, dw, h);
    ctx.fillStyle = color('gold');
    ctx.fillRect(0, 0, w, 8);
    ctx.fillRect(0, h - 8, w, 8);
    tex.needsUpdate = true;
  };
  // TODO(brand): si no existe mbc-logo.png queda la etiqueta lisa
  img.onerror = () => console.warn('[brand] Sin mbc-logo.png: etiqueta lisa.');
  img.src = config.brand.logoUrl;
  return tex;
}
