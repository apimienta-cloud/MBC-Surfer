import * as THREE from 'three';

/**
 * Ciudad de fondo: dos filas de edificios altos detrás de las cuadras, para que no se vea el horizonte
 * vacío. Son cajas instanciadas (un draw call) con ventanas dibujadas por shader en coordenadas del
 * mundo, que de noche se prenden al azar.
 */

const PER_SLOT = 40;
const COLORS = ['#D9CFC0', '#C9B9A0', '#E6DED2', '#B8AFA4', '#A9B4BC', '#CFC6B8', '#8F969E', '#E3D3B5', '#C7B49A', '#9FA7AD'];

const night = { value: 0 };

function facadeMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = night;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;\nvarying float vSeed;')
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        mat4 im_ = modelMatrix * instanceMatrix;
        vWP = (im_ * vec4(transformed, 1.0)).xyz;
        vWN = normalize(mat3(im_) * objectNormal);
        vSeed = fract(sin(dot(im_[3].xz, vec2(12.9898, 78.233))) * 43758.5453);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uNight;
        varying vec3 vWP;
        varying vec3 vWN;
        varying float vSeed;
        float win_;
        float lit_;
        float h21_(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float roof = step(0.5, vWN.y);
          float u = abs(vWN.x) > 0.5 ? vWP.z : vWP.x;
          vec2 cell = vec2(u / 3.2, (vWP.y - 0.6) / 3.1);
          vec2 f = fract(cell);
          float upper = step(4.2, vWP.y);
          win_ = step(0.2, f.x) * step(f.x, 0.8) * step(0.28, f.y) * step(f.y, 0.86) * upper * (1.0 - roof);
          // Planta baja: vidriera corrida
          float shop = step(0.4, vWP.y) * step(vWP.y, 3.4) * (1.0 - roof);
          // Algunos edificios con fajas horizontales (balcones corridos)
          float band = step(0.5, vSeed) * step(0.86, f.y) * upper * (1.0 - roof);
          lit_ = step(0.58, h21_(floor(cell) + vSeed * 91.0));
          diffuseColor.rgb *= 1.0 - band * 0.18;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.17, 0.22), max(win_, shop) * 0.85);
          diffuseColor.rgb *= 1.0 - roof * 0.2;
          win_ = max(win_, shop);
        }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.2, win_);',
      )
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.78, 0.45) * win_ * lit_ * uNight * 1.4;',
      );
  };
  m.customProgramCacheKey = () => 'backdrop-facade';
  return m;
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpP = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const tmpC = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);

export class Backdrop {
  readonly mesh: THREE.InstancedMesh;
  private counts: number[];

  constructor(private slots: number) {
    const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    this.mesh = new THREE.InstancedMesh(geo, facadeMaterial(), slots * PER_SLOT);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    for (let i = 0; i < slots * PER_SLOT; i++) this.mesh.setMatrixAt(i, ZERO);
    this.mesh.setColorAt(0, tmpC.set('#ffffff'));
    this.counts = new Array(slots).fill(0);
  }

  private put(slot: number, x: number, z: number, w: number, d: number, h: number, color: string, y = 0): void {
    const n = this.counts[slot];
    if (n >= PER_SLOT) return;
    this.counts[slot] = n + 1;
    const i = slot * PER_SLOT + n;
    tmpM.compose(tmpP.set(x, y, z), tmpQ.setFromAxisAngle(UP, 0), tmpS.set(d, h, w));
    this.mesh.setMatrixAt(i, tmpM);
    this.mesh.setColorAt(i, tmpC.set(color));
  }

  /**
   * Llena el fondo de un chunk. `start` es la distancia al centro desde donde puede haber edificios
   * de cada lado (null = nada, por ejemplo del lado del mar). z0 es el inicio del chunk en el mundo.
   */
  fill(slot: number, z0: number, L: number, start: [number | null, number | null], height: number, rnd: () => number): void {
    this.counts[slot] = 0;
    [-1, 1].forEach((side, si) => {
      const s0 = start[si];
      if (s0 === null) return;
      // Dos filas: una más cerca y más baja, otra atrás y más alta
      for (const row of [0, 1]) {
        const xBase = s0 + row * 22;
        let z = -rnd() * 4;
        while (z > -L) {
          const w = 9 + rnd() * 10;
          const d = 10 + rnd() * 8;
          const h = (row ? 22 + rnd() * 30 : 12 + rnd() * 18) * height;
          const x = side * (xBase + d / 2 + rnd() * 3);
          const zc = z0 + z - w / 2;
          const color = COLORS[Math.floor(rnd() * COLORS.length)];
          this.put(slot, x, zc, w, d, h, color);
          // A veces un volumen más angosto arriba (torre retranqueada)
          if (rnd() < 0.35) this.put(slot, x, zc, w * 0.6, d * 0.6, h * (0.25 + rnd() * 0.35), color, h);
          z -= w + 0.5 + rnd() * 2.5;
        }
      }
    });
    const per = PER_SLOT;
    for (let n = this.counts[slot]; n < per; n++) this.mesh.setMatrixAt(slot * per + n, ZERO);
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  setNight(f: number): void {
    night.value = f;
  }

  get slotCount(): number {
    return this.slots;
  }
}
