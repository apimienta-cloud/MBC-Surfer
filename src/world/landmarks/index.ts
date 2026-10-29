import type * as THREE from 'three';
import { buildPalacioSalvo } from './PalacioSalvo';
import { buildArtigas } from './Artigas';
import { buildPuertaCiudadela } from './PuertaCiudadela';
import { buildTeatroSolis } from './TeatroSolis';
import { buildMercadoPuerto, MERCADO_SMOKE } from './MercadoPuerto';
import { buildFaro } from './FaroPuntaCarretas';
import { buildCerro } from './Cerro';
import { buildLetrasMontevideo } from './LetrasMontevideo';
import { buildCastillito } from './Castillito';
import { buildPalacioMunicipal } from './PalacioMunicipal';
import { buildFuenteCandados } from './FuenteCandados';
import { buildPalacioLegislativo } from './PalacioLegislativo';
import { buildCentenario } from './Centenario';
import { buildTorreAntel } from './TorreAntel';
import { buildGrua } from './GruaPortuaria';

export type LandmarkId =
  | 'palacioSalvo'
  | 'artigas'
  | 'puertaCiudadela'
  | 'teatroSolis'
  | 'mercadoPuerto'
  | 'faro'
  | 'cerro'
  | 'letrasMontevideo'
  | 'castillito'
  | 'palacioMunicipal'
  | 'fuenteCandados'
  | 'palacioLegislativo'
  | 'centenario'
  | 'torreAntel'
  | 'grua';

export interface Landmark {
  geo: THREE.BufferGeometry;
  /** Extensión a lo largo de la pista (z) y hacia afuera (x), centrado en el origen. */
  width: number;
  depth: number;
  /** Emisores de humo relativos al landmark (fachada hacia +x). */
  smoke?: { x: number; y: number; z: number }[];
}

// Cada builder se puede reemplazar por un .glb sin tocar la lógica de las zonas
const BUILDERS: Record<LandmarkId, () => THREE.BufferGeometry> = {
  palacioSalvo: buildPalacioSalvo,
  artigas: buildArtigas,
  puertaCiudadela: buildPuertaCiudadela,
  teatroSolis: buildTeatroSolis,
  mercadoPuerto: buildMercadoPuerto,
  faro: buildFaro,
  cerro: buildCerro,
  letrasMontevideo: buildLetrasMontevideo,
  castillito: buildCastillito,
  palacioMunicipal: buildPalacioMunicipal,
  fuenteCandados: buildFuenteCandados,
  palacioLegislativo: buildPalacioLegislativo,
  centenario: buildCentenario,
  torreAntel: buildTorreAntel,
  grua: buildGrua,
};

const cache = new Map<LandmarkId, Landmark>();

/** Geometría cacheada del landmark: se arma una sola vez y se comparte entre chunks. */
export function getLandmark(id: LandmarkId): Landmark {
  let lm = cache.get(id);
  if (!lm) {
    const geo = BUILDERS[id]();
    const bb = geo.boundingBox!;
    lm = { geo, width: bb.max.z - bb.min.z, depth: bb.max.x - bb.min.x };
    if (id === 'mercadoPuerto') lm.smoke = [MERCADO_SMOKE];
    cache.set(id, lm);
  }
  return lm;
}
