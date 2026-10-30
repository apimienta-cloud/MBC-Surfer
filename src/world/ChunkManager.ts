import * as THREE from 'three';
import { config } from '../config';
import { Kit, kitMaterial, setNightGlow } from './landmarks/kit';
import { buildGigantografia } from './landmarks/LocalesMBC';
import { getLandmark, LandmarkId } from './landmarks';
import { buildBuilding, BuildingStyle, BuildingVariant } from './landmarks/Buildings';
import { PropInstancer, PropType } from './landmarks/Props';
import { ZoneSystem } from './zones';
import type { ChunkCtx, GroundKind, Side, Strip, ZoneDef } from './zones/Zone';
import type { Particles } from '../fx/Particles';

const W = config.world;
const L = W.chunkLength;
const ROAD_W = config.lanes.count * config.lanes.width + 0.6;
const ROAD_HALF = ROAD_W / 2;
const EDGE = ROAD_HALF + W.sidewalkWidth;
const MAX_STRIPS = 3;
const VARIANTS_PER_STYLE = 8;
const SMOKE_PER_SECOND = 5;
const FLUFF = config.particles.fluff;
// Las pelusas aparecen en este tramo delante de la birra (m)
const FLUFF_AHEAD: [number, number] = [2, 55];

interface Slot {
  index: number;
  group: THREE.Group;
  road: THREE.Mesh;
  sidewalks: THREE.Mesh[];
  strips: THREE.Mesh[][]; // [lado][franja]
  decor: THREE.Group;
  smoke: THREE.Vector3[];
  smokeAcc: number;
  fluff: boolean;
  fluffAcc: number;
}

/**
 * Mundo por chunks de ~60 m que se reciclan. Cada chunk lo decora la zona que le toca
 * (o es de transición entre dos zonas). Los props repetidos van instanciados.
 */
export class ChunkManager {
  readonly group = new THREE.Group();
  readonly props: PropInstancer;
  private slots: Slot[] = [];
  private roadMats: Record<ZoneDef['road'], THREE.Material>;
  private groundMats: Record<GroundKind, THREE.Material>;
  private sidewalkMats = new Map<string, THREE.Material>();
  private buildings = new Map<BuildingStyle, BuildingVariant[]>();
  private bannerGeo: THREE.BufferGeometry;
  private bannerMats = new Map<string, THREE.Material>();
  private bannerPlane = new THREE.PlaneGeometry(9, 1.5);

  constructor(
    readonly zones: ZoneSystem,
    private particles: Particles,
  ) {
    const count = W.chunksAhead + W.chunksBehind + 1;
    this.props = new PropInstancer(count);
    this.group.add(this.props.group);

    this.roadMats = {
      asphalt: new THREE.MeshStandardMaterial({ map: makeAsphalt(), roughness: 0.95 }),
      cobble: new THREE.MeshStandardMaterial({ map: makeCobble(), roughness: 0.9 }),
    };
    this.groundMats = {
      concrete: new THREE.MeshStandardMaterial({ color: '#A39C90', roughness: 1 }),
      grass: new THREE.MeshStandardMaterial({ color: '#6E9F55', roughness: 1 }),
      sand: new THREE.MeshStandardMaterial({ color: '#E3CF9E', roughness: 1 }),
      water: new THREE.MeshStandardMaterial({ color: '#4A86A8', roughness: 0.25, metalness: 0.2 }),
      lot: new THREE.MeshStandardMaterial({ color: '#7D7A74', roughness: 1 }),
    };

    // Geometrías compartidas por todos los chunks
    const road = new THREE.PlaneGeometry(ROAD_W, L).rotateX(-Math.PI / 2).translate(0, 0, -L / 2);
    const side = new THREE.BoxGeometry(W.sidewalkWidth, 0.16, L).translate(0, 0.08, -L / 2);
    const strip = new THREE.PlaneGeometry(1, L).rotateX(-Math.PI / 2).translate(0.5, 0, -L / 2);
    const lines = new Kit();
    for (let lane = 1; lane < config.lanes.count; lane++) {
      const x = (lane - config.lanes.count / 2) * config.lanes.width;
      for (let z = 2; z < L; z += 6) lines.box(0.12, 0.02, 3, config.colors.laneLine, x, 0.005, -z);
    }
    const linesGeo = lines.build();
    this.bannerGeo = new Kit()
      .box(0.25, 7.2, 0.25, '#4A4A4A', -(ROAD_HALF + 0.8), 0, 0)
      .box(0.25, 7.2, 0.25, '#4A4A4A', ROAD_HALF + 0.8, 0, 0)
      .box(ROAD_W + 1.9, 0.25, 0.25, '#4A4A4A', 0, 7.2, 0)
      .build();

    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      const roadMesh = new THREE.Mesh(road, this.roadMats.asphalt);
      g.add(roadMesh, new THREE.Mesh(linesGeo, kitMaterial));
      const sidewalks = [-1, 1].map((sx) => {
        const m = new THREE.Mesh(side, this.groundMats.concrete);
        m.position.x = sx * (ROAD_HALF + W.sidewalkWidth / 2);
        g.add(m);
        return m;
      });
      const strips = [0, 1].map(() =>
        Array.from({ length: MAX_STRIPS }, () => {
          const m = new THREE.Mesh(strip, this.groundMats.concrete);
          m.visible = false;
          g.add(m);
          return m;
        }),
      );
      const decor = new THREE.Group();
      g.add(decor);
      this.group.add(g);
      this.slots.push({ index: -999, group: g, road: roadMesh, sidewalks, strips, decor, smoke: [], smokeAcc: 0, fluff: false, fluffAcc: 0 });
    }
  }

  reset(): void {
    for (const s of this.slots) s.index = -999;
  }

  /** Asegura los chunks alrededor de la birra (reciclando) y emite humo de parrillas cercanas y pelusas. */
  update(playerS: number, dt = 0): void {
    const cur = Math.floor(playerS / L);
    const lo = cur - W.chunksBehind;
    const hi = cur + W.chunksAhead;
    const wanted: number[] = [];
    for (let k = lo; k <= hi; k++) if (!this.slots.some((s) => s.index === k)) wanted.push(k);
    this.slots.forEach((s, i) => {
      if (s.index >= lo && s.index <= hi) return;
      const k = wanted.shift();
      if (k !== undefined) this.setup(s, i, k);
    });

    if (dt > 0) {
      for (const s of this.slots) {
        if (!s.smoke.length) continue;
        s.smokeAcc += dt * SMOKE_PER_SECOND;
        while (s.smokeAcc >= 1) {
          s.smokeAcc -= 1;
          for (const p of s.smoke) if (Math.abs(-p.z - playerS) < 160) this.particles.smoke(p.x, p.y, p.z);
        }
      }
      for (const s of this.slots) {
        if (!s.fluff) continue;
        // Solo la parte del chunk que cae en el tramo de adelante
        const a = Math.max(s.index * L, playerS + FLUFF_AHEAD[0]);
        const b = Math.min((s.index + 1) * L, playerS + FLUFF_AHEAD[1]);
        if (b <= a) continue;
        s.fluffAcc += dt * FLUFF.perSecond * ((b - a) / (FLUFF_AHEAD[1] - FLUFF_AHEAD[0]));
        while (s.fluffAcc >= 1) {
          s.fluffAcc -= 1;
          // Más cerca de la pista que de los costados
          const x = (Math.random() - 0.5) * (Math.random() < 0.7 ? ROAD_W + 4 : 26);
          this.particles.fluff(x, 0.3 + Math.random() * 4.2, -(a + Math.random() * (b - a)));
        }
      }
    }
  }

  setNight(f: number): void {
    this.props.setNight(f);
    setNightGlow(f);
  }

  private sidewalkMat(color: string): THREE.Material {
    let m = this.sidewalkMats.get(color);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: 1 });
      this.sidewalkMats.set(color, m);
    }
    return m;
  }

  private buildingVariants(style: BuildingStyle): BuildingVariant[] {
    let list = this.buildings.get(style);
    if (!list) {
      const r = mulberry32(style.length * 7919);
      list = Array.from({ length: VARIANTS_PER_STYLE }, () => buildBuilding(style, r));
      this.buildings.set(style, list);
    }
    return list;
  }

  private bannerMat(text: string, sign: boolean): THREE.Material {
    const key = (sign ? 's:' : 'b:') + text;
    let m = this.bannerMats.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ map: makeBannerTexture(text, sign), side: THREE.DoubleSide, roughness: 0.8 });
      this.bannerMats.set(key, m);
    }
    return m;
  }

  private setup(slot: Slot, slotIdx: number, k: number): void {
    slot.index = k;
    slot.group.position.z = -k * L;
    slot.decor.clear();
    slot.smoke.length = 0;
    slot.fluff = false;
    const info = this.zones.chunkInfo(k);
    const zone = info.zone;
    slot.road.material = this.roadMats[zone.road];
    for (const s of slot.sidewalks) s.material = this.sidewalkMat(zone.sidewalk);

    this.props.begin(slotIdx);
    const ctx = new Builder(this, slot, slotIdx, k, info.local);
    if (info.transition) {
      // Transición: cartel con el nombre de la zona que viene
      ctx.sides([{ kind: 'concrete', width: 80 }], [{ kind: 'concrete', width: 80 }]);
      ctx.banner(config.zones.names[info.next.id], -L / 2, true);
      ctx.row('arbol', -1, -(ROAD_HALF + 1.4), 12, { colors: ['#4E8F45', '#5FA052'] });
      ctx.row('arbol', 1, ROAD_HALF + 1.4, 12, { offset: 6, colors: ['#4E8F45', '#5FA052'] });
      ctx.street(-1, 'colonial', 2);
      ctx.street(1, 'colonial', 2);
    } else {
      zone.decorate(ctx);
    }
    this.props.end(slotIdx);
  }

  // Acceso para el Builder
  _strips(slot: Slot, side: Side, strips: Strip[]): void {
    const meshes = slot.strips[side < 0 ? 0 : 1];
    let x = EDGE;
    meshes.forEach((m, i) => {
      const s = strips[i];
      m.visible = !!s;
      if (!s) return;
      m.material = this.groundMats[s.kind];
      m.scale.x = s.width;
      m.position.y = s.y ?? 0;
      // La geometría va de 0 a 1 en x: del lado izquierdo se espeja
      m.rotation.y = side < 0 ? Math.PI : 0;
      m.position.x = side * x;
      if (side < 0) m.position.z = -L; // al rotar π, el plano queda del otro lado en z
      else m.position.z = 0;
      x += s.width;
    });
  }

  _buildings(style: BuildingStyle): BuildingVariant[] {
    return this.buildingVariants(style);
  }

  _banner(slot: Slot, text: string, z: number, sign: boolean): void {
    const post = new THREE.Mesh(this.bannerGeo, kitMaterial);
    post.position.z = z;
    const board = new THREE.Mesh(this.bannerPlane, this.bannerMat(text, sign));
    board.position.set(0, 6.4, z + 0.15);
    slot.decor.add(post, board);
  }
}

/** Implementación del ChunkCtx que usan las zonas para decorar. */
class Builder implements ChunkCtx {
  readonly zoneChunks: number;
  readonly L = L;
  readonly roadHalf = ROAD_HALF;
  readonly edge = EDGE;
  private reserved: [number, number][][] = [[], []];
  private r: () => number;

  constructor(
    private cm: ChunkManager,
    private slot: Slot,
    private slotIdx: number,
    private k: number,
    readonly local: number,
  ) {
    this.zoneChunks = cm.zones.zoneChunks;
    this.r = mulberry32(k * 9973 + 17);
  }

  rnd(): number {
    return this.r();
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.r() * arr.length)];
  }

  face(side: Side): number {
    return side < 0 ? 0 : Math.PI;
  }

  sides(left: Strip[], right: Strip[]): void {
    this.cm._strips(this.slot, -1, left);
    this.cm._strips(this.slot, 1, right);
  }

  private reserve(side: Side, a: number, b: number): void {
    this.reserved[side < 0 ? 0 : 1].push([Math.min(a, b), Math.max(a, b)]);
  }

  private isFree(side: Side, a: number, b: number): boolean {
    return !this.reserved[side < 0 ? 0 : 1].some(([r0, r1]) => a < r1 && b > r0);
  }

  landmark(id: LandmarkId, side: Side, z: number, gap = 3, angle = 0): void {
    const lm = getLandmark(id);
    const bb = lm.geo.boundingBox!;
    const mesh = new THREE.Mesh(lm.geo, kitMaterial);
    const x = side < 0 ? -(EDGE + gap) - bb.max.x : EDGE + gap + bb.max.x;
    mesh.position.set(x, 0, z);
    mesh.rotation.y = this.face(side) + side * angle;
    if (lm.extras) mesh.add(lm.extras.clone());
    this.slot.decor.add(mesh);
    const z0 = side < 0 ? z + bb.min.z : z - bb.max.z;
    const z1 = side < 0 ? z + bb.max.z : z - bb.min.z;
    // Los landmarks grandes quedan en una plaza: sin edificios de ese lado en todo el chunk, así se ven de lejos
    if (lm.width > 10) this.reserve(side, -L - 1, 1);
    else this.reserve(side, z0 - 1, z1 + 1);
    for (const p of lm.smoke ?? []) {
      const lx = side < 0 ? p.x : -p.x;
      const lz = side < 0 ? p.z : -p.z;
      this.slot.smoke.push(new THREE.Vector3(x + lx, p.y, -this.k * L + z + lz));
    }
  }

  street(side: Side, styles: BuildingStyle | BuildingStyle[], setback = 1): void {
    const list = Array.isArray(styles) ? styles : [styles];
    let z = -this.r() * 2;
    let guard = 0;
    while (z > -L && guard++ < 40) {
      const v = this.pick(this.cm._buildings(this.pick(list)));
      const z0 = z - v.width;
      if (z0 < -L) break;
      if (!this.isFree(side, z0, z)) {
        z -= 2;
        continue;
      }
      const mesh = new THREE.Mesh(v.geo, kitMaterial);
      mesh.position.set(side * (EDGE + setback + v.depth / 2), 0, z - v.width / 2);
      mesh.rotation.y = this.face(side);
      this.slot.decor.add(mesh);
      z = z0 - 0.3 - this.r() * 1.5;
    }
  }

  prop(type: PropType, x: number, y: number, z: number, rotY = 0, scale = 1, color?: string): void {
    this.cm.props.add(this.slotIdx, type, x, y, -this.k * L + z, rotY, scale, color);
  }

  row(type: PropType, side: Side, x: number, every: number, opts: { y?: number; offset?: number; colors?: readonly string[]; scale?: number; jitter?: number } = {}): void {
    for (let z = -(opts.offset ?? 0) - every / 2; z > -L; z -= every) {
      const zz = z + (opts.jitter ? (this.r() - 0.5) * opts.jitter * 2 : 0);
      const color = opts.colors ? this.pick(opts.colors) : undefined;
      this.prop(type, x, opts.y ?? 0, zz, this.face(side), opts.scale ?? 1, color);
    }
  }

  banner(text: string, z: number, sign = false): void {
    this.cm._banner(this.slot, text, z, sign);
  }

  fluff(): void {
    this.slot.fluff = true;
  }

  billboard(side: Side, z: number): void {
    const photos = config.brand.locales.billboards;
    if (!photos.length) return;
    const g = buildGigantografia(this.pick(photos));
    g.position.set(side * (EDGE + 2.2), 0, z);
    // Girada hacia la birra que se acerca, para que la foto se vea de lejos
    g.rotation.y = this.face(side) + side * 0.6;
    this.slot.decor.add(g);
    this.reserve(side, z - 6, z + 6);
  }
}

// ---------- Texturas generadas ----------

function canvasTex(size: number, draw: (ctx: CanvasRenderingContext2D) => void, repeat: [number, number]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 4;
  return t;
}

function makeAsphalt(): THREE.CanvasTexture {
  const r = mulberry32(42);
  return canvasTex(
    128,
    (ctx) => {
      ctx.fillStyle = '#5E5E66';
      ctx.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 900; i++) {
        const g = 70 + Math.floor(r() * 40);
        ctx.fillStyle = `rgb(${g},${g},${g + 6})`;
        ctx.fillRect(r() * 128, r() * 128, 2, 2);
      }
    },
    [2, L / 6],
  );
}

function makeCobble(): THREE.CanvasTexture {
  const r = mulberry32(7);
  return canvasTex(
    256,
    (ctx) => {
      ctx.fillStyle = '#4A443C';
      ctx.fillRect(0, 0, 256, 256);
      const n = 8;
      const s = 256 / n;
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const g = 120 + Math.floor(r() * 50);
          ctx.fillStyle = `rgb(${g},${g - 10},${g - 25})`;
          const ox = (y % 2) * (s / 2);
          ctx.beginPath();
          ctx.roundRect(x * s + ox + 2 - (ox && x === n - 1 ? 256 : 0), y * s + 2, s - 4, s - 4, 6);
          ctx.fill();
          if (ox && x === n - 1) {
            ctx.beginPath();
            ctx.roundRect(-s / 2 + 2, y * s + 2, s - 4, s - 4, 6);
            ctx.fill();
          }
        }
      }
    },
    [ROAD_W / 2.4, L / 2.4],
  );
}

function makeBannerTexture(text: string, sign: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 170;
  const ctx = c.getContext('2d')!;
  if (sign) {
    // Cartel vial genérico: verde con letras blancas
    ctx.fillStyle = '#1F6B45';
    ctx.fillRect(0, 0, 1024, 170);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, 1004, 150);
  } else {
    // Pasacalle de feria a rayas
    const cols = ['#E63946', '#F2B134', '#2F6DB5', '#3E8E41'];
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = cols[i % cols.length];
      ctx.fillRect(i * 64, 0, 64, 170);
    }
    ctx.fillStyle = 'rgba(255,248,231,0.92)';
    ctx.fillRect(40, 25, 944, 120);
  }
  ctx.fillStyle = sign ? '#FFFFFF' : '#1E3A5F';
  ctx.font = `800 ${sign ? 84 : 78}px 'Baloo 2', 'Arial Black', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(sign ? `→ ${text}` : text, 512, 92, 960);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** PRNG chico con semilla, para que cada chunk sea estable. */
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
