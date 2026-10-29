import type { ZoneId } from '../../config';
import type { LandmarkId } from '../landmarks';
import type { BuildingStyle } from '../landmarks/Buildings';
import type { PropType } from '../landmarks/Props';

export type GroundKind = 'concrete' | 'grass' | 'sand' | 'water' | 'lot';

/** Franja de terreno a un costado, desde el borde de la vereda hacia afuera. */
export interface Strip {
  kind: GroundKind;
  width: number;
  y?: number;
}

export type Side = -1 | 1;

/**
 * Lo que una zona puede hacer al decorar un chunk. Coordenadas locales del chunk:
 * x lateral (0 = centro de la pista), z de 0 a -L (hacia adelante).
 */
export interface ChunkCtx {
  readonly local: number; // índice del chunk dentro de la zona
  readonly zoneChunks: number;
  readonly L: number;
  readonly roadHalf: number;
  readonly edge: number; // borde exterior de la vereda
  rnd(): number;
  pick<T>(arr: readonly T[]): T;
  /** Terreno de cada lado (izquierda, derecha). */
  sides(left: Strip[], right: Strip[]): void;
  /**
   * Ubica un landmark con la fachada hacia la pista, a `gap` metros de la vereda.
   * `angle` (rad) lo gira hacia la birra que se acerca, para que se lea antes de pasarlo.
   */
  landmark(id: LandmarkId, side: Side, z: number, gap?: number, angle?: number): void;
  /** Llena un lado con edificios en los huecos que dejaron los landmarks. */
  street(side: Side, styles: BuildingStyle | BuildingStyle[], setback?: number): void;
  /** Prop instanciado (mirando a la pista si rotY es el de `face`). */
  prop(type: PropType, x: number, y: number, z: number, rotY?: number, scale?: number, color?: string): void;
  /** Props cada `every` metros a lo largo del chunk, a una distancia x del centro. */
  row(type: PropType, side: Side, x: number, every: number, opts?: { y?: number; offset?: number; colors?: readonly string[]; scale?: number; jitter?: number }): void;
  /** Rotación para que algo del lado `side` mire a la pista. */
  face(side: Side): number;
  /** Pasacalle sobre la pista con un texto. */
  banner(text: string, z: number): void;
  /** Gigantografía con una foto de los locales de MBC, al costado de la pista. */
  billboard(side: Side, z: number): void;
}

export interface ZoneDef {
  id: ZoneId;
  road: 'asphalt' | 'cobble';
  sidewalk: string;
  /** Silueta lejana sin niebla (siempre a la misma distancia de la birra). */
  horizon?: { id: LandmarkId; x: number; z: number; scale?: number; rotY?: number };
  decorate(c: ChunkCtx): void;
}

export const TREE_GREENS = ['#4E8F45', '#5FA052', '#3F7A3A', '#6BAA4F'] as const;
/** Colores de remeras para la gente de las veredas. */
export const SHIRTS = ['#2F6DB5', '#E63946', '#F2F2F2', '#3E8E41', '#1E1E1E', '#EBAB43', '#9B6BD3', '#E07BB0', '#7FC4E8'] as const;
export const AWNINGS = ['#E63946', '#F2B134', '#2F6DB5', '#3E8E41', '#E07BB0', '#F26B1D'] as const;
