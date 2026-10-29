// AABB en "espacio de pista": x lateral, y altura, s distancia recorrida (s = -z en el mundo).

export interface Box {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minS: number;
  maxS: number;
}

export function makeBox(): Box {
  return { minX: 0, maxX: 0, minY: 0, maxY: 0, minS: 0, maxS: 0 };
}

/** Solapamiento 1D (negativo si no se tocan). */
export function overlap(aMin: number, aMax: number, bMin: number, bMax: number): number {
  return Math.min(aMax, bMax) - Math.max(aMin, bMin);
}

export function intersects(a: Box, b: Box): boolean {
  return (
    overlap(a.minX, a.maxX, b.minX, b.maxX) > 0 &&
    overlap(a.minY, a.maxY, b.minY, b.maxY) > 0 &&
    overlap(a.minS, a.maxS, b.minS, b.maxS) > 0
  );
}

export type HitResult = 'none' | 'stumble' | 'crash';
