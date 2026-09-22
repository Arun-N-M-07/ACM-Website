/**
 * Geometry building blocks. Static architecture is authored as many small
 * primitives, then merged per material so each scene costs a handful of draw
 * calls. UVs are in metres so tiling textures read at a consistent scale.
 */
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  Euler,
  Matrix4,
  Quaternion,
  Vector3,
  type ColorRepresentation,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Box whose UVs are measured in metres (u,v = face width,height in m). */
export function metricBox(w: number, h: number, d: number): BoxGeometry {
  const g = new BoxGeometry(w, h, d);
  const uv = g.getAttribute('uv') as BufferAttribute;
  // BoxGeometry face order: +x, −x, +y, −y, +z, −z (4 verts each with 1 segment).
  const spans: [number, number][] = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * spans[f][0], uv.getY(i) * spans[f][1]);
    }
  }
  uv.needsUpdate = true;
  return g;
}

const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _p = new Vector3();
const _s = new Vector3();

export interface Placement {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}

/** Bake a transform into a geometry (mutates and returns it). */
export function place<T extends BufferGeometry>(g: T, { position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] }: Placement): T {
  _q.setFromEuler(_e.set(rotation[0], rotation[1], rotation[2]));
  _m.compose(_p.set(...position), _q, _s.set(...scale));
  g.applyMatrix4(_m);
  return g;
}

/** Fill a vertex colour attribute with a single colour (mutates and returns). */
export function paint<T extends BufferGeometry>(g: T, color: ColorRepresentation): T {
  const c = new Color(color);
  const n = g.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new BufferAttribute(arr, 3));
  return g;
}

/**
 * Merge geometries that may differ in index / uv presence by normalising them
 * first (non-indexed, position + normal + uv [+ color]).
 */
export function merge(geos: BufferGeometry[], withColor = false): BufferGeometry {
  const prepared = geos.map((g) => {
    let x = g.index ? g.toNonIndexed() : g;
    if (!x.getAttribute('uv')) {
      x.setAttribute('uv', new BufferAttribute(new Float32Array(x.getAttribute('position').count * 2), 2));
    }
    if (!x.getAttribute('normal')) x.computeVertexNormals();
    if (withColor && !x.getAttribute('color')) x = paint(x, '#ffffff');
    for (const name of Object.keys(x.attributes)) {
      if (!['position', 'normal', 'uv', ...(withColor ? ['color'] : [])].includes(name)) x.deleteAttribute(name);
    }
    return x;
  });
  const merged = mergeGeometries(prepared, false);
  prepared.forEach((g, i) => {
    if (g !== geos[i]) g.dispose();
  });
  geos.forEach((g) => g.dispose());
  if (!merged) throw new Error('[geometry] merge failed — attribute mismatch');
  merged.computeBoundingSphere();
  return merged;
}
