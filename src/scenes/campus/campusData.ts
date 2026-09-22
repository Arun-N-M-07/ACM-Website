/**
 * Loads public/data/campus.json (generated from OpenStreetMap by
 * scripts/build-campus.mjs) once, shared by every consumer.
 */
export interface CampusBuilding {
  p: [number, number][];
  holes?: [number, number][][];
  h: number;
  /** Stable 0..1 variation seed. */
  v: number;
  n?: string;
}
export interface CampusRoad {
  p: [number, number][];
  w: number;
  k: string;
}
export interface CampusArea {
  p: [number, number][];
  k: 'track' | 'stadium' | 'pitch' | 'pool' | 'garden' | 'park' | 'grass' | 'water' | 'wood' | 'parking';
}
export interface CampusData {
  buildings: CampusBuilding[];
  roads: CampusRoad[];
  areas: CampusArea[];
}

let promise: Promise<CampusData | null> | null = null;

export function loadCampus(): Promise<CampusData | null> {
  if (!promise) {
    promise = fetch('/data/campus.json')
      .then((r) => (r.ok ? (r.json() as Promise<CampusData>) : null))
      .catch(() => null);
  }
  return promise;
}

export function pointInRing(ring: [number, number][], x: number, z: number) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Uniform grid index of axis-aligned boxes for fast point queries. */
export class GridIndex<T> {
  private cells = new Map<string, T[]>();
  constructor(private size: number) {}
  private key(i: number, j: number) {
    return `${i},${j}`;
  }
  insert(item: T, x0: number, z0: number, x1: number, z1: number) {
    for (let i = Math.floor(x0 / this.size); i <= Math.floor(x1 / this.size); i++)
      for (let j = Math.floor(z0 / this.size); j <= Math.floor(z1 / this.size); j++) {
        const k = this.key(i, j);
        const list = this.cells.get(k);
        if (list) list.push(item);
        else this.cells.set(k, [item]);
      }
  }
  query(x: number, z: number): T[] {
    return this.cells.get(this.key(Math.floor(x / this.size), Math.floor(z / this.size))) ?? [];
  }
}
