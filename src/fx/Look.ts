import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import type { N8AOPass } from 'n8ao';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { config } from '../config';

const G = config.graphics;
const SH = G.shadows;
const mobile = matchMedia('(pointer: coarse)').matches;

/** Todo lo sólido de un modelo hace y recibe sombra (lo transparente y lo sin luz, no). */
export function castShadows(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const solid = mats.every((x) => !x.transparent && !(x as THREE.MeshBasicMaterial).isMeshBasicMaterial);
    m.castShadow = m.receiveShadow = solid;
  });
}

/** Viñeta y un toque de contraste y saturación (en espacio lineal, antes del tono). */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    vignette: { value: G.post.vignette },
    saturation: { value: G.post.saturation },
    contrast: { value: G.post.contrast },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float vignette;
    uniform float saturation;
    uniform float contrast;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, saturation);
      // Contraste alrededor del gris medio lineal
      c.rgb = max(vec3(0.0), (c.rgb - 0.18) * contrast + 0.18);
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - vignette * smoothstep(0.25, 0.85, dot(d, d) * 2.2);
      gl_FragColor = c;
    }`,
};

/**
 * Look "pro": tono neutro (respeta los colores de marca), reflejos de estudio, sombras reales del sol
 * que siguen a la birra, y posproceso con antialias, brillo en las luces y viñeta.
 */
export class Look {
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private render3d: RenderPass | null = null;
  private ao: N8AOPass | null = null;
  private smaa: SMAAPass | null = null;
  private sunTarget = new THREE.Object3D();
  private dir = new THREE.Vector3(...SH.sunDir).normalize();
  private texel = 0;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private sun: THREE.DirectionalLight,
  ) {
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = G.exposure;

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = G.envIntensity;
    pmrem.dispose();

    if (SH.enabled) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      const size = mobile ? SH.mapSizeMobile : SH.mapSize;
      sun.castShadow = true;
      sun.shadow.mapSize.set(size, size);
      const c = sun.shadow.camera;
      c.left = c.bottom = -SH.half;
      c.right = c.top = SH.half;
      c.near = 1;
      c.far = 120;
      c.updateProjectionMatrix();
      sun.shadow.bias = -0.0004;
      sun.shadow.normalBias = 0.03;
      sun.shadow.radius = SH.softness;
      this.texel = (SH.half * 2) / size;
    }
    sun.target = this.sunTarget;
    scene.add(this.sunTarget);

    if (G.post.enabled) {
      const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: G.post.samples });
      this.composer = new EffectComposer(renderer, rt);
      this.render3d = new RenderPass(scene, camera);
      this.composer.addPass(this.render3d);
      const B = G.post.bloom;
      this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), B.strength, B.radius, B.threshold);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new ShaderPass(GradeShader));
      this.composer.addPass(new OutputPass());
      // La oclusión ambiental es cara y pesa ~150 kB: solo en compu, y se baja aparte
      if (G.post.ao.enabled && !mobile) void this.loadAO();
    }
  }

  private async loadAO(): Promise<void> {
    const [{ N8AOPass }, { SMAAPass }] = await Promise.all([
      import('n8ao'),
      import('three/examples/jsm/postprocessing/SMAAPass.js'),
    ]);
    const composer = this.composer!;
    const AO = G.post.ao;
    this.ao = new N8AOPass(this.scene, this.camera, 1, 1);
    this.ao.setQualityMode('Medium');
    Object.assign(this.ao.configuration, {
      aoRadius: AO.radius,
      distanceFalloff: AO.falloff,
      intensity: AO.intensity,
      gammaCorrection: false,
    });
    // La oclusión reemplaza al render normal (dibuja la escena ella misma)
    composer.insertPass(this.ao, 1);
    this.render3d!.enabled = false;
    // Con oclusión el MSAA no sirve: se usa SMAA al final
    for (const t of [composer.renderTarget1, composer.renderTarget2]) {
      t.samples = 0;
      t.dispose();
    }
    this.smaa = new SMAAPass();
    composer.addPass(this.smaa);
    const size = this.renderer.getSize(new THREE.Vector2());
    this.setSize(size.x, size.y);
  }

  /** El sol (y su cuadro de sombras) acompaña a la birra, corrido hacia adelante. */
  follow(x: number, s: number): void {
    const t = this.sunTarget.position.set(x * 0.5, 0, -s - SH.ahead);
    // Se ajusta a la grilla de texels para que las sombras no titilen al avanzar
    if (this.texel > 0) {
      t.x = Math.round(t.x / this.texel) * this.texel;
      t.z = Math.round(t.z / this.texel) * this.texel;
    }
    this.sun.position.copy(t).addScaledVector(this.dir, 60);
    this.sunTarget.updateMatrixWorld();
  }

  setSize(w: number, h: number): void {
    if (!this.composer) return;
    const pr = this.renderer.getPixelRatio();
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    // El brillo ya trabaja a media resolución; en celular, a un cuarto
    if (mobile) this.bloom!.setSize(w * pr * 0.5, h * pr * 0.5);
  }

  /**
   * Si el equipo no da más (ya con la resolución al mínimo), apaga lo más caro: primero la oclusión
   * ambiental y después el brillo. Devuelve false si ya no queda nada por apagar.
   */
  degrade(): boolean {
    if (this.ao?.enabled) {
      this.ao.enabled = false;
      this.render3d!.enabled = true;
      return true;
    }
    if (this.bloom?.enabled) {
      this.bloom.enabled = false;
      return true;
    }
    return false;
  }

  /** Más brillo de noche, cuando se prenden faroles y carteles. */
  setNight(f: number): void {
    if (this.bloom) this.bloom.strength = G.post.bloom.strength * (0.6 + 0.8 * f);
  }

  render(): void {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
