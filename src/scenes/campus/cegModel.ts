/**
 * The CEG "Red Building" — procedural replica.
 *
 * Plan: the exact building footprint from OpenStreetMap (relation 2451721,
 * "Red Building"), rotated into the world frame (see scripts/build-campus.mjs):
 * a closed quadrangle around a long courtyard, east and west wings projecting
 * south to frame the forecourt, and the entrance block + porch projecting from
 * the middle of the south wing under the clock tower.
 *
 * Elevations follow photographs of the building: red-painted plaster, cream
 * rusticated quoins, cream plinth / band course / cornice, white multi-pane
 * windows with small clerestory lights and sunshades, a porch of striped
 * (alternating cream and red voussoir) arches carrying a balustraded balcony,
 * three arched windows under the "COLLEGE OF ENGINEERING GUINDY" sign, and a
 * square clock tower with cream niched corner piers, a heavy cornice, an
 * octagonal drum and a white dome.
 *
 * Repetitive elements (windows, trims, quoins, balusters, voussoirs) are
 * emitted as instances so the whole building is ~20 draw calls.
 */
import {
  BufferGeometry,
  CylinderGeometry,
  Euler,
  ExtrudeGeometry,
  Float32BufferAttribute,
  LatheGeometry,
  Matrix4,
  Path,
  Quaternion,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three';
import { merge, metricBox, place } from '@/systems/geometry/build';

type V2 = [number, number];

// ─── Footprint (world metres, +z = south / front) ─────────────────────────────
export const CEG_OUTER: V2[] = [[4.9, 7.4], [4.8, 15], [3.1, 15], [2.9, 22.7], [-2.9, 22.7], [-2.8, 15], [-4.5, 15], [-4.5, 7.8], [-58.5, 7.7], [-58.6, 24.2], [-74.9, 24.2], [-74.8, -38.6], [-78.2, -38.6], [-78.2, -49.9], [-51.3, -49.8], [-51.3, -53.7], [-36.7, -53.6], [-36.7, -42.8], [-30.3, -42.8], [-30.3, -47.3], [-8.7, -47.2], [-8.7, -55.4], [7.4, -55.3], [7.4, -47], [30.6, -47], [30.6, -41.4], [37, -41.3], [37.1, -51.8], [52.3, -51.7], [52.3, -48.1], [74.3, -48], [74.3, -51.1], [79.2, -51.1], [79.2, -33.9], [75.8, -33.9], [75.6, 23.8], [58.7, 23.8], [58.7, 7.6], [4.9, 7.4]];
export const CEG_INNER: V2[] = [[-59.4, -36.4], [-59.1, -5.4], [54.6, -6.6], [54.5, -9.8], [55.9, -9.9], [59.3, -9.9], [59.2, -19.6], [59, -34.8], [52.2, -34.7], [52.2, -31.5], [41.4, -31.4], [41.4, -29.4], [35.5, -29.3], [35.4, -35.3], [36.8, -35.3], [36.8, -38.2], [30.4, -38.1], [30.4, -35.3], [32.4, -35.3], [32.4, -31.6], [27.3, -31.5], [-27, -30.9], [-27, -30.8], [-31.9, -30.8], [-32, -36.1], [-30.5, -36.2], [-30.5, -39.3], [-36.6, -39.2], [-36.6, -36.8], [-35.4, -36.8], [-35.3, -33.6], [-39, -33.5], [-39, -32.6], [-52.4, -32.5], [-52.4, -36.5], [-59.4, -36.4]];

/** Main mass without the entrance projection (modelled separately). */
const OUTER_MAIN: V2[] = [CEG_OUTER[0], ...CEG_OUTER.slice(7)];

export const CEG_DIMS = {
  floor: 6.4,
  cornice: 12.6,
  wallTop: 12.95,
  parapetTop: 13.75,
  frontZ: 7.6,
  entrance: { x0: -4.5, x1: 4.85, z0: 7.6, z1: 15, top: 15.9 },
  porch: { x0: -2.9, x1: 2.9, z0: 15, z1: 22.7, top: 6.8 },
  tower: { x: 0.2, z: 0.6, size: 8.2, clockY: 20.7, corniceY: 23.7, domeBase: 26.05, domeR: 3.65 },
} as const;

/** Wing rectangles for the hipped roofs [x0, x1, z0, z1]. */
const ROOF_WINGS: [number, number, number, number][] = [
  [-58.5, 58.7, -6.2, 7.6],
  [-74.9, -58.5, -38.6, 24.2],
  [58.7, 75.6, -33.9, 23.8],
  [-78.2, 79.2, -47.2, -31.2],
  [-51.3, -36.7, -53.7, -47.2],
  [-8.7, 7.4, -55.4, -47.2],
  [37.1, 52.3, -51.8, -47.2],
  [-78.2, -74.8, -49.9, -38.6],
];

// ─── Instance batches ──────────────────────────────────────────────────────────

export type BoxCat = 'wall' | 'trim' | 'white' | 'glass' | 'hood' | 'dark' | 'quoin' | 'dome';
export type Batch = Record<BoxCat, number[]>;

const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Euler(0, 0, 0, 'YXZ');
const _p = new Vector3();
const _s = new Vector3();

function batch(): Batch {
  return { wall: [], trim: [], white: [], glass: [], hood: [], dark: [], quoin: [], dome: [] };
}

/** Add a unit box instance: centre, size, rotation (Euler YXZ: facing, tilt, in-plane). */
function box(b: Batch, cat: BoxCat, p: [number, number, number], s: [number, number, number], ry = 0, rx = 0, rz = 0) {
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  _m.compose(_p.set(p[0], p[1], p[2]), _q, _s.set(s[0], s[1], s[2]));
  b[cat].push(..._m.elements);
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

function pointInRing(ring: V2[], x: number, z: number) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

const solid = (x: number, z: number) => pointInRing(CEG_OUTER, x, z) && !pointInRing(CEG_INNER, x, z);

/** A face frame along an edge: origin a, unit direction u, outward normal n, facing yaw. */
interface Face {
  ax: number;
  az: number;
  ux: number;
  uz: number;
  nx: number;
  nz: number;
  len: number;
  ry: number;
}

function faceOf(a: V2, b: V2, outwardTest: (x: number, z: number) => boolean): Face | null {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  if (len < 0.4) return null;
  const ux = dx / len;
  const uz = dz / len;
  let nx = uz;
  let nz = -ux;
  const mx = (a[0] + b[0]) / 2;
  const mz = (a[1] + b[1]) / 2;
  if (!outwardTest(mx + nx * 0.6, mz + nz * 0.6)) {
    nx = -nx;
    nz = -nz;
  }
  return { ax: a[0], az: a[1], ux, uz, nx, nz, len, ry: Math.atan2(nx, nz) };
}

/** World position on a face: s along the edge, y up, off outward from the wall plane. */
const at = (f: Face, s: number, y: number, off: number): [number, number, number] => [f.ax + f.ux * s + f.nx * off, y, f.az + f.uz * s + f.nz * off];

// ─── Windows ──────────────────────────────────────────────────────────────────

interface Detail {
  mullions: boolean;
  clerestory: boolean;
}

function addWindow(b: Batch, f: Face, s: number, sill: number, h: number, w: number, d: Detail, hood = true) {
  box(b, 'glass', at(f, s, sill + h / 2, 0.012), [w - 0.08, h, 0.02], f.ry);
  box(b, 'white', at(f, s - w / 2, sill + h / 2, 0.04), [0.1, h + 0.08, 0.08], f.ry);
  box(b, 'white', at(f, s + w / 2, sill + h / 2, 0.04), [0.1, h + 0.08, 0.08], f.ry);
  box(b, 'white', at(f, s, sill + h, 0.04), [w + 0.1, 0.1, 0.08], f.ry);
  box(b, 'white', at(f, s, sill + 0.02, 0.04), [w + 0.1, 0.08, 0.08], f.ry);
  if (d.mullions) {
    box(b, 'white', at(f, s, sill + h / 2, 0.035), [0.05, h, 0.05], f.ry);
    box(b, 'white', at(f, s, sill + h * 0.64, 0.035), [w, 0.05, 0.05], f.ry);
    box(b, 'white', at(f, s, sill + h * 0.32, 0.035), [w, 0.04, 0.05], f.ry);
  }
  box(b, 'trim', at(f, s, sill - 0.07, 0.1), [w + 0.28, 0.12, 0.26], f.ry);
  if (hood) box(b, 'hood', at(f, s, sill + h + 0.3, 0.3), [w + 0.45, 0.07, 0.62], f.ry, 0.33);
}

function clerestory(b: Batch, f: Face, s: number, y: number) {
  box(b, 'glass', at(f, s, y, 0.012), [0.7, 0.58, 0.02], f.ry);
  box(b, 'white', at(f, s, y + 0.32, 0.035), [0.84, 0.07, 0.07], f.ry);
  box(b, 'white', at(f, s, y - 0.32, 0.035), [0.84, 0.07, 0.07], f.ry);
  box(b, 'white', at(f, s - 0.38, y, 0.035), [0.07, 0.62, 0.07], f.ry);
  box(b, 'white', at(f, s + 0.38, y, 0.035), [0.07, 0.62, 0.07], f.ry);
}

// ─── Wall bands and quoins ─────────────────────────────────────────────────────

function bands(b: Batch, f: Face, top = CEG_DIMS.wallTop, parapetTop = CEG_DIMS.parapetTop, floor = CEG_DIMS.floor) {
  const L = f.len;
  box(b, 'trim', at(f, L / 2, 0.4, 0.07), [L + 0.26, 0.8, 0.26], f.ry);
  box(b, 'trim', at(f, L / 2, floor, 0.07), [L + 0.3, 0.28, 0.3], f.ry);
  box(b, 'trim', at(f, L / 2, top - 0.5, 0.08), [L + 0.4, 0.2, 0.34], f.ry);
  box(b, 'trim', at(f, L / 2, top - 0.2, 0.22), [L + 0.8, 0.42, 0.62], f.ry);
  box(b, 'wall', at(f, L / 2, (top + parapetTop) / 2, -0.05), [L + 0.3, parapetTop - top, 0.3], f.ry);
  box(b, 'trim', at(f, L / 2, parapetTop + 0.05, -0.05), [L + 0.42, 0.12, 0.44], f.ry);
  // Cornice consoles.
  for (let s = 0.6; s < L - 0.3; s += 1.25) box(b, 'trim', at(f, s, top - 0.55, 0.2), [0.16, 0.36, 0.36], f.ry);
}

/** Rusticated quoin stack at a convex corner shared by faces f1 (ending here) and f2 (starting here). */
function quoins(b: Batch, cx: number, cz: number, f1: Face, f2: Face, y0 = 0.85, y1 = 12.3) {
  let i = 0;
  for (let y = y0; y < y1 - 0.25; y += 0.62, i++) {
    const long = i % 2 === 0;
    const l1 = long ? 1.05 : 0.6;
    const l2 = long ? 0.6 : 1.05;
    box(b, 'quoin', [cx - f1.ux * (l1 / 2) + f1.nx * 0.05, y + 0.25, cz - f1.uz * (l1 / 2) + f1.nz * 0.05], [l1, 0.5, 0.14], f1.ry);
    box(b, 'quoin', [cx + f2.ux * (l2 / 2) + f2.nx * 0.05, y + 0.25, cz + f2.uz * (l2 / 2) + f2.nz * 0.05], [l2, 0.5, 0.14], f2.ry);
  }
}

/** Generic facade treatment for a closed ring (outer walls or courtyard walls). */
function facadeRing(b: Batch, ring: V2[], outward: (x: number, z: number) => boolean, d: Detail, skip?: (x: number, z: number) => boolean) {
  const faces: (Face | null)[] = [];
  for (let i = 0; i < ring.length - 1; i++) faces.push(faceOf(ring[i], ring[i + 1], outward));
  faces.forEach((f) => {
    if (!f) return;
    bands(b, f);
    if (f.len < 3.4) return;
    const bays = Math.max(1, Math.round(f.len / 4.3));
    const w = f.len / bays;
    for (let k = 0; k < bays; k++) {
      const s = (k + 0.5) * w;
      const [px, , pz] = at(f, s, 0, 0);
      if (k > 0) box(b, 'wall', at(f, k * w, 6.65, 0.05), [0.55, 11.7, 0.1], f.ry);
      if (skip?.(px, pz)) continue;
      addWindow(b, f, s, 1.3, 2.65, 1.3, d);
      addWindow(b, f, s, 7.35, 2.5, 1.3, d);
      if (d.clerestory) {
        clerestory(b, f, s, 5.05);
        clerestory(b, f, s, 11.35);
      }
    }
  });
  // Quoins on convex corners.
  const n = faces.length;
  for (let i = 0; i < n; i++) {
    const f1 = faces[(i - 1 + n) % n];
    const f2 = faces[i];
    if (!f1 || !f2) continue;
    const [cx, cz] = ring[i];
    const convex = outward(cx + (f1.nx + f2.nx) * 0.35, cz + (f1.nz + f2.nz) * 0.35);
    if (convex && Math.abs(f1.ux * f2.ux + f1.uz * f2.uz) < 0.3) quoins(b, cx, cz, f1, f2);
  }
}

// ─── Entrance block, porch, tower ─────────────────────────────────────────────

function archShape(w: number, spring: number, y0 = 0) {
  const s = new Shape();
  s.moveTo(-w / 2, y0);
  s.lineTo(w / 2, y0);
  s.lineTo(w / 2, spring);
  s.absarc(0, spring, w / 2, 0, Math.PI, false);
  s.lineTo(-w / 2, y0);
  return s;
}

/** A flat wall panel (in its local XY plane) with arched openings, extruded to `t`. */
function arcadedPanel(width: number, height: number, openings: { x: number; w: number; spring: number; y0: number }[], t: number) {
  const s = new Shape();
  s.moveTo(-width / 2, 0);
  s.lineTo(width / 2, 0);
  s.lineTo(width / 2, height);
  s.lineTo(-width / 2, height);
  s.lineTo(-width / 2, 0);
  for (const o of openings) {
    const h = new Path();
    h.moveTo(o.x - o.w / 2, o.y0);
    h.lineTo(o.x + o.w / 2, o.y0);
    h.lineTo(o.x + o.w / 2, o.spring);
    h.absarc(o.x, o.spring, o.w / 2, 0, Math.PI, false);
    h.lineTo(o.x - o.w / 2, o.y0);
    s.holes.push(h);
  }
  return new ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 14 });
}

/** Alternating cream / red voussoirs around an arch (in a face frame). */
function voussoirs(b: Batch, f: Face, s: number, spring: number, r: number, count = 13, depth = 0.62, proud = 0.07) {
  const seg = (Math.PI * r) / count;
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * (i + 0.5)) / count;
    const x = Math.cos(a) * (r + depth / 2);
    const y = spring + Math.sin(a) * (r + depth / 2);
    box(b, i % 2 === 0 ? 'quoin' : 'wall', at(f, s + x, y, proud), [seg * 1.02, depth, 0.16], f.ry, 0, a + Math.PI / 2);
  }
  // Keystone.
  box(b, 'quoin', at(f, s, spring + r + depth / 2 + 0.05, proud + 0.04), [0.34, depth + 0.2, 0.2], f.ry);
}

/** Horizontal rustication bands (cream) across a pier face. */
function rusticate(b: Batch, f: Face, s: number, width: number, y0: number, y1: number) {
  for (let y = y0 + 0.3; y < y1 - 0.1; y += 0.62) box(b, 'quoin', at(f, s, y, 0.05), [width, 0.34, 0.1], f.ry);
}

export interface CegModel {
  batch: Batch;
  mass: BufferGeometry;
  roofs: BufferGeometry;
  porchWalls: BufferGeometry;
  darkShapes: BufferGeometry;
  archivolts: BufferGeometry;
  dome: BufferGeometry;
  drum: BufferGeometry;
  balusters: number[];
  clocks: { position: [number, number, number]; ry: number }[];
  sign: { position: [number, number, number]; width: number; height: number };
}

/** Hipped tile roof over a rectangular wing; UVs in metres (u along the eave, v up the slope). */
function hippedRoof(x0: number, x1: number, z0: number, z1: number, eave: number, pitch = 0.42): BufferGeometry {
  const w = x1 - x0;
  const d = z1 - z0;
  const alongX = w >= d;
  const half = (alongX ? d : w) / 2;
  const rise = half * Math.tan(pitch);
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const pts: number[] = [];
  const uvs: number[] = [];
  const e1 = new Vector3();
  const e2 = new Vector3();
  const tri = (a: number[], bb: number[], c: number[]) => {
    pts.push(...a, ...bb, ...c);
    e1.set(bb[0] - a[0], bb[1] - a[1], bb[2] - a[2]);
    e2.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    const n = e1.cross(e2);
    const facesX = Math.abs(n.x) > Math.abs(n.z);
    for (const p of [a, bb, c]) uvs.push(facesX ? p[2] : p[0], (p[1] - eave) / Math.sin(pitch));
  };
  if (alongX) {
    const r0 = [x0 + half, eave + rise, cz];
    const r1 = [x1 - half, eave + rise, cz];
    const a = [x0, eave, z1];
    const b2 = [x1, eave, z1];
    const c = [x1, eave, z0];
    const dd = [x0, eave, z0];
    tri(a, b2, r1);
    tri(a, r1, r0);
    tri(c, dd, r0);
    tri(c, r0, r1);
    tri(b2, c, r1);
    tri(dd, a, r0);
  } else {
    const r0 = [cx, eave + rise, z0 + half];
    const r1 = [cx, eave + rise, z1 - half];
    const a = [x1, eave, z1];
    const b2 = [x1, eave, z0];
    const c = [x0, eave, z0];
    const dd = [x0, eave, z1];
    tri(b2, a, r1);
    tri(b2, r1, r0);
    tri(dd, c, r0);
    tri(dd, r0, r1);
    tri(a, dd, r1);
    tri(c, b2, r0);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pts, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return g;
}

export function buildCegModel(detail: Detail = { mullions: true, clerestory: true }): CegModel {
  const b = batch();
  const D = CEG_DIMS;
  const E = D.entrance;
  const P = D.porch;
  const T = D.tower;

  // ── Mass: footprint extruded to the cornice ──────────────────────────────
  const shape = new Shape(OUTER_MAIN.map(([x, z]) => new Vector2(x, -z)));
  shape.holes.push(new Path(CEG_INNER.map(([x, z]) => new Vector2(x, -z))));
  const massGeo = new ExtrudeGeometry(shape, { depth: D.wallTop, bevelEnabled: false, curveSegments: 1 });
  massGeo.rotateX(-Math.PI / 2);

  // ── Outer and courtyard facades ─────────────────────────────────────────
  const outsideMain = (x: number, z: number) => !pointInRing(OUTER_MAIN, x, z);
  const intoCourt = (x: number, z: number) => pointInRing(CEG_INNER, x, z);
  const nearEntrance = (x: number, z: number) => x > E.x0 - 1.4 && x < E.x1 + 1.4 && z > 5 && z < 10;
  facadeRing(b, OUTER_MAIN, outsideMain, detail, nearEntrance);
  facadeRing(b, CEG_INNER, intoCourt, { mullions: detail.mullions, clerestory: false });

  // ── Entrance block ──────────────────────────────────────────────────────
  const ew = E.x1 - E.x0;
  const ed = E.z1 - E.z0;
  const ecx = (E.x0 + E.x1) / 2;
  const entranceMass = place(metricBox(ew, E.top - 0.4, ed), { position: [ecx, (E.top - 0.4) / 2, (E.z0 + E.z1) / 2] });
  const front: Face = { ax: E.x0, az: E.z1, ux: 1, uz: 0, nx: 0, nz: 1, len: ew, ry: 0 };
  const left: Face = { ax: E.x0, az: E.z0, ux: 0, uz: 1, nx: -1, nz: 0, len: ed, ry: -Math.PI / 2 };
  const right: Face = { ax: E.x1, az: E.z1, ux: 0, uz: -1, nx: 1, nz: 0, len: ed, ry: Math.PI / 2 };
  for (const f of [front, left, right]) {
    box(b, 'trim', at(f, f.len / 2, 0.4, 0.07), [f.len + 0.26, 0.8, 0.26], f.ry);
    box(b, 'trim', at(f, f.len / 2, D.floor, 0.07), [f.len + 0.3, 0.28, 0.3], f.ry);
    box(b, 'trim', at(f, f.len / 2, 12.7, 0.1), [f.len + 0.5, 0.2, 0.36], f.ry);
    box(b, 'trim', at(f, f.len / 2, 13.05, 0.25), [f.len + 0.9, 0.46, 0.66], f.ry);
    box(b, 'trim', at(f, f.len / 2, E.top - 0.15, 0.1), [f.len + 0.5, 0.3, 0.4], f.ry);
    for (let s = 0.5; s < f.len - 0.3; s += 1.1) box(b, 'trim', at(f, s, 12.55, 0.24), [0.16, 0.34, 0.38], f.ry);
  }
  // Quoins up both front corners and the rear side corners.
  quoins(b, E.x0, E.z1, left, front, 0.85, 12.4);
  quoins(b, E.x1, E.z1, front, right, 0.85, 12.4);
  // Side windows with cream architraves.
  for (const f of [left, right]) {
    for (const [sill, h] of [
      [1.3, 2.6],
      [7.35, 2.5],
    ] as const) {
      addWindow(b, f, f.len / 2, sill, h, 1.2, detail, false);
      box(b, 'trim', at(f, f.len / 2, sill + h / 2, 0.02), [1.55, h + 0.4, 0.05], f.ry);
    }
  }
  // First-floor triple arched windows over the porch (centre taller).
  const dark: BufferGeometry[] = [];
  const archivolts: BufferGeometry[] = [];
  const triple = [
    { x: ecx, w: 1.75, spring: 10.4, y0: 7.55 },
    { x: ecx - 2.55, w: 1.15, spring: 9.9, y0: 7.8 },
    { x: ecx + 2.55, w: 1.15, spring: 9.9, y0: 7.8 },
  ];
  for (const o of triple) {
    const g = new ShapeGeometry(archShape(o.w, o.spring - o.y0), 16);
    g.translate(o.x, o.y0, E.z1 + 0.015);
    dark.push(g);
    // Cream archivolt ring.
    const ring = new Shape();
    const r0 = o.w / 2;
    const r1 = o.w / 2 + 0.24;
    ring.absarc(0, 0, r1, 0, Math.PI, false);
    ring.absarc(0, 0, r0, Math.PI, 0, true);
    const rg = new ExtrudeGeometry(ring, { depth: 0.14, bevelEnabled: false, curveSegments: 18 });
    rg.translate(o.x, o.spring, E.z1);
    archivolts.push(rg);
    // Jambs and white window bars.
    box(b, 'quoin', [o.x - o.w / 2 - 0.12, (o.y0 + o.spring) / 2, E.z1 + 0.07], [0.24, o.spring - o.y0, 0.14]);
    box(b, 'quoin', [o.x + o.w / 2 + 0.12, (o.y0 + o.spring) / 2, E.z1 + 0.07], [0.24, o.spring - o.y0, 0.14]);
    box(b, 'white', [o.x, (o.y0 + o.spring) / 2 + 0.2, E.z1 + 0.04], [0.06, o.spring - o.y0 + 0.4, 0.06]);
    box(b, 'white', [o.x, o.spring - 0.2, E.z1 + 0.04], [o.w, 0.06, 0.06]);
  }
  // Ground-floor doorway inside the porch.
  const door = new ShapeGeometry(archShape(2.2, 3.3), 16);
  door.translate(ecx, 0.2, E.z1 + 0.015);
  dark.push(door);
  // The name board on the attic.
  const sign = { position: [ecx, 14.35, E.z1 + 0.08] as [number, number, number], width: ew - 0.9, height: 1.05 };

  // ── Porch: three arched faces, striped voussoirs, balustraded roof ─────────
  const pw = P.x1 - P.x0;
  const pd = P.z1 - P.z0;
  const pcx = (P.x0 + P.x1) / 2;
  const pt = 0.85;
  const opening = (len: number) => [{ x: 0, w: Math.min(3.3, len - 1.9), spring: 3.35, y0: 0 }];
  const porchFront = arcadedPanel(pw, P.top, opening(pw), pt);
  porchFront.translate(pcx, 0, P.z1 - pt);
  const porchLeft = arcadedPanel(pd, P.top, opening(pd), pt);
  porchLeft.rotateY(-Math.PI / 2);
  porchLeft.translate(P.x0 + pt, 0, (P.z0 + P.z1) / 2);
  const porchRight = arcadedPanel(pd, P.top, opening(pd), pt);
  porchRight.rotateY(Math.PI / 2);
  porchRight.translate(P.x1 - pt, 0, (P.z0 + P.z1) / 2);
  const porchRoof = place(metricBox(pw, 0.35, pd), { position: [pcx, P.top - 0.175, (P.z0 + P.z1) / 2] });
  const pFront: Face = { ax: P.x0, az: P.z1, ux: 1, uz: 0, nx: 0, nz: 1, len: pw, ry: 0 };
  const pLeft: Face = { ax: P.x0, az: P.z0, ux: 0, uz: 1, nx: -1, nz: 0, len: pd, ry: -Math.PI / 2 };
  const pRight: Face = { ax: P.x1, az: P.z1, ux: 0, uz: -1, nx: 1, nz: 0, len: pd, ry: Math.PI / 2 };
  for (const f of [pFront, pLeft, pRight]) {
    const ow = Math.min(3.3, f.len - 1.9);
    voussoirs(b, f, f.len / 2, 3.35, ow / 2);
    // Rusticated piers either side of the arch, and the imposts.
    const pier = (f.len - ow) / 2;
    rusticate(b, f, pier / 2, pier - 0.1, 0.7, 3.35);
    rusticate(b, f, f.len - pier / 2, pier - 0.1, 0.7, 3.35);
    box(b, 'trim', at(f, pier / 2, 3.35, 0.09), [pier + 0.1, 0.22, 0.22], f.ry);
    box(b, 'trim', at(f, f.len - pier / 2, 3.35, 0.09), [pier + 0.1, 0.22, 0.22], f.ry);
    box(b, 'trim', at(f, f.len / 2, 0.35, 0.08), [f.len + 0.2, 0.7, 0.24], f.ry);
    // Entablature and balcony.
    box(b, 'trim', at(f, f.len / 2, 5.75, 0.1), [f.len + 0.3, 0.3, 0.3], f.ry);
    box(b, 'trim', at(f, f.len / 2, P.top - 0.12, 0.18), [f.len + 0.5, 0.26, 0.46], f.ry);
    box(b, 'trim', at(f, f.len / 2, P.top + 0.95, 0.02), [f.len + 0.2, 0.14, 0.34], f.ry);
  }
  quoins(b, P.x0, P.z1, pLeft, pFront, 0.75, 5.5);
  quoins(b, P.x1, P.z1, pFront, pRight, 0.75, 5.5);
  // Balusters along the balcony (front + sides).
  const balusters: number[] = [];
  const balusterAt = (x: number, z: number) => {
    _m.makeTranslation(x, P.top + 0.05, z);
    balusters.push(..._m.elements);
  };
  for (let x = P.x0 + 0.35; x <= P.x1 - 0.3; x += 0.3) balusterAt(x, P.z1 - 0.18);
  for (let z = P.z0 + 0.3; z <= P.z1 - 0.3; z += 0.3) {
    balusterAt(P.x0 + 0.18, z);
    balusterAt(P.x1 - 0.18, z);
  }
  for (const [x, z] of [
    [P.x0 + 0.2, P.z1 - 0.2],
    [P.x1 - 0.2, P.z1 - 0.2],
    [P.x0 + 0.2, P.z0 + 0.25],
    [P.x1 - 0.2, P.z0 + 0.25],
  ])
    box(b, 'quoin', [x, P.top + 0.5, z], [0.42, 1.0, 0.42]);

  // ── Clock tower ─────────────────────────────────────────────────────────
  const S = T.size;
  const h2 = S / 2;
  const towerMass = place(metricBox(S, T.corniceY, S), { position: [T.x, T.corniceY / 2, T.z] });
  const clocks: CegModel['clocks'] = [];
  const faces: Face[] = [
    { ax: T.x - h2, az: T.z + h2, ux: 1, uz: 0, nx: 0, nz: 1, len: S, ry: 0 },
    { ax: T.x + h2, az: T.z + h2, ux: 0, uz: -1, nx: 1, nz: 0, len: S, ry: Math.PI / 2 },
    { ax: T.x + h2, az: T.z - h2, ux: -1, uz: 0, nx: 0, nz: -1, len: S, ry: Math.PI },
    { ax: T.x - h2, az: T.z - h2, ux: 0, uz: 1, nx: -1, nz: 0, len: S, ry: -Math.PI / 2 },
  ];
  const pier = 1.9;
  faces.forEach((f, i) => {
    const next = faces[(i + 1) % 4];
    // Lower stage: quoins at the corners (above the wing roof).
    quoins(b, f.ax + f.ux * f.len, f.az + f.uz * f.len, f, next, 13.9, 17.3);
    box(b, 'trim', at(f, S / 2, 17.45, 0.12), [S + 0.3, 0.32, 0.34], f.ry);
    box(b, 'trim', at(f, S / 2, 13.85, 0.1), [S + 0.2, 0.22, 0.3], f.ry);
    // Clock stage: cream corner piers carrying round-headed niches.
    for (const s of [pier / 2, S - pier / 2]) {
      box(b, 'quoin', at(f, s, 20.55, 0.06), [pier, 6.1, 0.14], f.ry);
      const niche = new ShapeGeometry(archShape(0.78, 2.5), 12);
      niche.rotateY(f.ry);
      const [nx, , nz] = at(f, s, 0, 0.14);
      niche.translate(nx, 18.6, nz);
      dark.push(niche);
      box(b, 'trim', at(f, s, 18.5, 0.16), [1.05, 0.12, 0.14], f.ry);
    }
    clocks.push({ position: at(f, S / 2, T.clockY, 0.03), ry: f.ry });
    // Cornice with consoles, and the blocking course under the drum.
    box(b, 'trim', at(f, S / 2, T.corniceY - 0.1, 0.25), [S + 0.5, 0.25, 0.5], f.ry);
    box(b, 'trim', at(f, S / 2, T.corniceY + 0.35, 0.55), [S + 1.4, 0.55, 1.1], f.ry);
    for (let s = 0.4; s < S; s += 0.72) box(b, 'dark', at(f, s, T.corniceY + 0.02, 0.4), [0.14, 0.3, 0.5], f.ry);
    box(b, 'trim', at(f, S / 2, T.corniceY + 0.95, -0.35), [S - 0.3, 0.7, 0.4], f.ry);
  });

  // Octagonal drum and dome.
  const drum = new CylinderGeometry(T.domeR + 0.18, T.domeR + 0.3, 1.05, 8, 1);
  drum.rotateY(Math.PI / 8);
  drum.translate(T.x, T.domeBase - 0.5, T.z);
  const domeProfile: Vector2[] = [];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * (Math.PI / 2);
    domeProfile.push(new Vector2(Math.cos(a) * T.domeR, Math.sin(a) * T.domeR * 0.98));
  }
  const dome = merge([
    place(new LatheGeometry(domeProfile, 48), { position: [T.x, T.domeBase, T.z] }),
    place(new CylinderGeometry(T.domeR + 0.05, T.domeR + 0.05, 0.22, 48), { position: [T.x, T.domeBase + 0.05, T.z] }),
    place(new SphereGeometry(0.2, 12, 8), { position: [T.x, T.domeBase + T.domeR + 0.12, T.z] }),
    place(new CylinderGeometry(0.06, 0.1, 0.3, 8), { position: [T.x, T.domeBase + T.domeR, T.z] }),
  ]);

  // ── Roofs ───────────────────────────────────────────────────────────────
  const roofs = merge(ROOF_WINGS.map(([x0, x1, z0, z1]) => hippedRoof(x0 + 0.25, x1 - 0.25, z0 + 0.25, z1 - 0.25, D.wallTop + 0.05)));

  return {
    batch: b,
    mass: merge([massGeo, entranceMass, towerMass]),
    roofs,
    porchWalls: merge([porchFront, porchLeft, porchRight, porchRoof]),
    darkShapes: merge(dark),
    archivolts: merge(archivolts),
    dome,
    drum,
    balusters,
    clocks,
    sign,
  };
}

/** Simplified massing (miniature in the core): body, roofs, tower and dome. */
export function buildCegMassing() {
  const m = buildCegModel({ mullions: false, clerestory: false });
  return { mass: m.mass, roofs: m.roofs, dome: merge([m.dome, m.drum]), porch: m.porchWalls };
}
