import * as THREE from 'three';
import { config, ZoneId } from '../config';
import { getLandmark } from './landmarks';
import type { ZoneSystem } from './zones';

const Z = config.zones;
const CL = config.clock;

/** Minutos del reloj del HUD según la distancia: domingo 18:00 → 23:59 y ahí se queda. */
export function clockMinutes(distance: number): number {
  return Math.min(CL.endMinutes, CL.startMinutes + Math.floor(distance / CL.metersPerMinute));
}

export function clockText(distance: number): string {
  const m = clockMinutes(distance);
  return `${CL.dayName} ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
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
  readonly hemi = new THREE.HemisphereLight(0xffffff, 0x8a7a66, 1.5);
  readonly sun = new THREE.DirectionalLight(0xfff1d6, 1.7);
  private dome: THREE.Mesh;
  private uniforms = {
    top: { value: new THREE.Color() },
    horizon: { value: new THREE.Color() },
    bottom: { value: new THREE.Color() },
  };
  private horizon: HorizonItem[] = [];
  private top = new THREE.Color();
  private hor = new THREE.Color();
  private tmp = new THREE.Color();
  private tmp2 = new THREE.Color();
  private nightTop = new THREE.Color(Z.night.top);
  private nightHor = new THREE.Color(Z.night.horizon);
  private warm = new THREE.Color('#fff1d6');
  /** 0 = tarde, hasta maxDarkness a las 23:59. */
  darkness = 0;

  constructor(private zones: ZoneSystem) {
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(380, 24, 12),
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
          varying vec3 vDir;
          void main() {
            float h = vDir.y;
            vec3 c = h > 0.0 ? mix(horizon, top, pow(min(1.0, h * 2.2), 0.7)) : mix(horizon, bottom, min(1.0, -h * 4.0));
            gl_FragColor = vec4(c, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    );
    this.dome.renderOrder = -1;
    this.group.add(this.dome);
    this.sun.position.set(-6, 12, 4);

    for (const zone of zones.all) {
      if (!zone.horizon) continue;
      const h = zone.horizon;
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, fog: false, transparent: true, opacity: 0, roughness: 1 });
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

    // Va cayendo la noche con el reloj (nunca del todo)
    const p = (clockMinutes(playerS) - CL.startMinutes) / (CL.endMinutes - CL.startMinutes);
    this.darkness = p * p * (3 - 2 * p) * Z.night.maxDarkness;
    this.top.lerp(this.nightTop, this.darkness);
    this.hor.lerp(this.nightHor, this.darkness);

    this.uniforms.top.value.copy(this.top);
    this.uniforms.horizon.value.copy(this.hor);
    this.uniforms.bottom.value.copy(this.hor).multiplyScalar(0.8);
    fog.color.copy(this.hor);
    this.dome.position.copy(camera.position);

    this.hemi.intensity = 1.5 * (1 - 0.55 * this.darkness);
    this.hemi.color.copy(this.tmp.set('#ffffff').lerp(this.top, 0.25));
    this.sun.intensity = 1.7 * (1 - 0.75 * this.darkness);
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
