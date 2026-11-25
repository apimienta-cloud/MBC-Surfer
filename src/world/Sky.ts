import * as THREE from 'three';
import { config, ZoneId } from '../config';
import { getLandmark } from './landmarks';
import type { ZoneSystem } from './zones';

const Z = config.zones;
const CL = config.clock;

/** Minuto en que llega el lunes, contando desde el primer día a las 00:00. */
const MONDAY = CL.days.length * 24 * 60;

/**
 * Minutos del reloj (desde el jueves 00:00) según la distancia. Lo que falta para el lunes se reduce
 * a la mitad cada `halfLifeMeters`: el reloj se va frenando y nunca llega.
 */
export function clockMinutes(distance: number): number {
  return MONDAY - (MONDAY - CL.startMinutes) * Math.pow(2, -distance / CL.halfLifeMeters);
}

const pad = (n: number): string => String(n).padStart(2, '0');

export function clockText(distance: number): string {
  const m = clockMinutes(distance);
  // Nunca se muestra el lunes, aunque el redondeo lo pida
  const sec = Math.min(Math.floor(m * 60), MONDAY * 60 - 1);
  const day = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const min = Math.floor((sec % 3600) / 60);
  const secs = MONDAY - m < CL.secondsUnderMinutes ? `:${pad(sec % 60)}` : '';
  return `${CL.days[day]} ${pad(h)}:${pad(min)}${secs}`;
}

/** 1 de día, 0 de noche, con amanecer y atardecer suaves. */
function daylight(minutes: number): number {
  const h = (minutes / 60) % 24;
  const ramp = (a: number, b: number): number => {
    const x = Math.min(1, Math.max(0, (h - a) / (b - a)));
    return x * x * (3 - 2 * x);
  };
  return ramp(CL.dawn[0], CL.dawn[1]) * (1 - ramp(CL.dusk[0], CL.dusk[1]));
}

interface HorizonItem {
  zone: ZoneId;
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  x: number;
  z: number;
}

/**
 * Cielo con degradé por zona (atardecer en la Rambla), niebla del mismo color que el horizonte,
 * siluetas lejanas sin niebla (el Cerro, el Legislativo, la Torre de Antel) y la noche que va cayendo.
 */
export class Sky {
  readonly group = new THREE.Group();
  readonly hemi = new THREE.HemisphereLight(0xffffff, 0x8a7a66, config.graphics.hemi);
  readonly sun = new THREE.DirectionalLight(0xfff1d6, config.graphics.sun);
  private dome: THREE.Mesh;
  private skyline: THREE.Mesh;
  private skyU = {
    near: { value: new THREE.Color() },
    far: { value: new THREE.Color() },
    sea: { value: 0 },
    night: { value: 0 },
  };
  private uniforms = {
    top: { value: new THREE.Color() },
    horizon: { value: new THREE.Color() },
    bottom: { value: new THREE.Color() },
    cloudLit: { value: new THREE.Color() },
    cloudShade: { value: new THREE.Color() },
    cloudOffset: { value: new THREE.Vector2() },
    night: { value: 0 },
  };
  private horizon: HorizonItem[] = [];
  private top = new THREE.Color();
  private hor = new THREE.Color();
  private tmp = new THREE.Color();
  private tmp2 = new THREE.Color();
  private nightTop = new THREE.Color(Z.night.top);
  private nightHor = new THREE.Color(Z.night.horizon);
  private warm = new THREE.Color('#fff1d6');
  private twilight = new THREE.Color(Z.night.twilight);
  /** 0 = de día, maxDarkness = de noche. */
  darkness = 0;

  constructor(private zones: ZoneSystem) {
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(380, 48, 24),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          uniform vec3 top;
          uniform vec3 horizon;
          uniform vec3 bottom;
          uniform vec3 cloudLit;
          uniform vec3 cloudShade;
          uniform vec2 cloudOffset;
          uniform float night;
          varying vec3 vDir;
          float hash12(vec2 p) {
            vec3 p3 = fract(vec3(p.xyx) * 0.1031);
            p3 += dot(p3, p3.yzx + 33.33);
            return fract((p3.x + p3.y) * p3.z);
          }
          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
          }
          float fbm(vec2 p) {
            float s = 0.0;
            float a = 0.5;
            for (int i = 0; i < 5; i++) {
              s += noise(p) * a;
              p = p * 2.03 + vec2(1.7, 9.2);
              a *= 0.5;
            }
            return s;
          }
          void main() {
            vec3 d = normalize(vDir);
            float h = d.y;
            vec3 c = h > 0.0 ? mix(horizon, top, pow(min(1.0, h * 2.2), 0.7)) : mix(horizon, bottom, min(1.0, -h * 4.0));
            if (h > 0.0) {
              // Estrellas de noche (solo arriba del horizonte)
              vec2 sp = d.xz / (h + 0.3) * 260.0;
              float st = hash12(floor(sp));
              float tw = smoothstep(0.35, 0.0, length(fract(sp) - 0.5));
              c += vec3(0.9, 0.92, 1.0) * step(0.985, st) * tw * night * smoothstep(0.05, 0.3, h);
              // Nubes: ruido proyectado sobre un plano alto, más chatas cerca del horizonte
              vec2 p = d.xz / (h + 0.12) * 1.4 + cloudOffset;
              float n = fbm(p);
              float cover = smoothstep(0.5, 0.78, n) * smoothstep(0.02, 0.22, h);
              float body = smoothstep(0.5, 0.95, fbm(p * 1.9 + 3.1));
              vec3 cl = mix(cloudLit, cloudShade, body * 0.8 + 0.2 * (1.0 - h));
              c = mix(c, cl, cover * 0.88);
            }
            gl_FragColor = vec4(c, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }),
    );
    this.dome.renderOrder = -1;
    this.group.add(this.dome);

    // Silueta de ciudad lejana alrededor (tapa el horizonte); del lado del mar se apaga
    this.skyline = new THREE.Mesh(
      new THREE.CylinderGeometry(340, 340, 160, 160, 1, true).translate(0, 50, 0),
      new THREE.ShaderMaterial({
        uniforms: this.skyU,
        side: THREE.BackSide,
        fog: false,
        vertexShader: `
          varying vec3 vP;
          void main() {
            vP = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          uniform vec3 near;
          uniform vec3 far;
          uniform float sea;
          uniform float night;
          varying vec3 vP;
          float h11(float x) { return fract(sin(x * 127.1) * 43758.5453); }
          float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          void main() {
            vec2 d = normalize(vP.xz);
            float u = (atan(d.y, d.x) / 6.2831853 + 0.5);
            // Dos capas de edificios: atrás más altos y claros (bruma), adelante más bajos y oscuros
            float u1 = u * 150.0;
            float u2 = u * 95.0 + 0.37;
            float hN = 10.0 + 34.0 * pow(h11(floor(u1)), 2.2);
            float hF = 22.0 + 60.0 * pow(h11(floor(u2) + 57.0), 1.6);
            // Algunas torres con antena
            float ant = step(0.93, h11(floor(u2) + 13.0)) * step(abs(fract(u2) - 0.5), 0.04) * 18.0;
            float k = 1.0 - sea * smoothstep(-0.05, -0.4, d.x);
            hN *= k;
            hF = (hF + ant) * k;
            float y = vP.y;
            if (y > max(hN, hF)) discard;
            bool isNear = y < hN;
            vec3 c = isNear ? near : far;
            // Ventanitas prendidas de noche
            vec2 cell = vec2((isNear ? u1 : u2) * 6.0, y / 3.0);
            float w = step(0.35, fract(cell.x)) * step(fract(cell.x), 0.75) * step(0.3, fract(cell.y)) * step(fract(cell.y), 0.75);
            float lit = step(0.72, h21(floor(cell) + (isNear ? 0.0 : 31.0)));
            c += vec3(1.0, 0.8, 0.5) * w * lit * night * (isNear ? 0.55 : 0.35);
            gl_FragColor = vec4(c, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }),
    );
    this.skyline.renderOrder = -1;
    this.group.add(this.skyline);
    this.sun.position.set(-6, 12, 4);

    for (const zone of zones.all) {
      if (!zone.horizon) continue;
      const h = zone.horizon;
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 0, roughness: 1 });
      const mesh = new THREE.Mesh(getLandmark(h.id).geo, mat);
      mesh.scale.setScalar(h.scale ?? 1);
      mesh.rotation.y = h.rotY ?? 0;
      mesh.visible = false;
      this.group.add(mesh);
      this.horizon.push({ zone: zone.id, mesh, mat, x: h.x, z: h.z });
    }
  }

  update(camera: THREE.Camera, playerS: number, fog: THREE.Fog): void {
    const { a, b, t } = this.zones.blendAt(playerS);
    const sa = Z.sky[a.id];
    const sb = Z.sky[b.id];
    this.top.set(sa.top).lerp(this.tmp.set(sb.top), t);
    this.hor.set(sa.horizon).lerp(this.tmp.set(sb.horizon), t);

    // Días y noches según el reloj; al amanecer y al atardecer el horizonte se pone naranja
    const day = daylight(clockMinutes(playerS));
    this.darkness = (1 - day) * Z.night.maxDarkness;
    this.hor.lerp(this.twilight, 4 * day * (1 - day) * 0.55);
    this.top.lerp(this.nightTop, this.darkness);
    this.hor.lerp(this.nightHor, this.darkness);

    this.uniforms.top.value.copy(this.top);
    this.uniforms.horizon.value.copy(this.hor);
    this.uniforms.bottom.value.copy(this.hor).multiplyScalar(0.8);
    // Nubes: claras y cálidas de día, teñidas por el horizonte; oscuras de noche
    const nightK = this.darkness / Z.night.maxDarkness;
    this.uniforms.night.value = nightK;
    this.uniforms.cloudLit.value.set('#FFFFFF').lerp(this.hor, 0.35).lerp(this.tmp.copy(this.top).multiplyScalar(1.6), nightK);
    this.uniforms.cloudShade.value.copy(this.top).lerp(this.hor, 0.5).multiplyScalar(0.82);
    // Se mueven con el viento y "pasan" a medida que la birra avanza
    this.uniforms.cloudOffset.value.set(performance.now() * 0.00001, -playerS * 0.0009);
    fog.color.copy(this.hor);
    this.dome.position.copy(camera.position);
    this.skyline.position.set(camera.position.x, 0, camera.position.z);
    // Siluetas: la de atrás casi del color de la bruma, la de adelante un poco más oscura y fría
    this.skyU.far.value.copy(this.hor).lerp(this.top, 0.12).multiplyScalar(0.9);
    this.skyU.near.value.copy(this.hor).lerp(this.top, 0.3).multiplyScalar(0.74);
    this.skyU.night.value = this.darkness / Z.night.maxDarkness;
    const seaOf = (z: { backdrop?: { left?: boolean } }): number => (z.backdrop?.left === false ? 1 : 0);
    this.skyU.sea.value = seaOf(a) + (seaOf(b) - seaOf(a)) * t;

    this.hemi.intensity = config.graphics.hemi * (1 - 0.45 * this.darkness);
    this.hemi.color.copy(this.tmp.set('#ffffff').lerp(this.top, 0.25));
    this.sun.intensity = config.graphics.sun * (1 - 0.75 * this.darkness);
    this.sun.color.copy(this.warm).lerp(this.tmp2.copy(this.hor), 0.45);

    // Siluetas del horizonte: aparecen y desaparecen con la zona, teñidas por la bruma
    for (const h of this.horizon) {
      const target = (h.zone === a.id ? 1 - t : 0) + (h.zone === b.id && a !== b ? t : 0);
      h.mat.opacity += (target - h.mat.opacity) * 0.05;
      h.mesh.visible = h.mat.opacity > 0.01;
      h.mat.color.set('#ffffff').lerp(this.hor, 0.4);
      h.mesh.position.set(camera.position.x * 0.3 + h.x, 0, -playerS + h.z);
    }
  }
}
