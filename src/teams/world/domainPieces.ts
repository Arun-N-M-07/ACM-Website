/**
 * The centrepiece of each domain's room — one abstract sculpture per domain,
 * standing on the room's floor, built procedurally and merged per material:
 *
 *   stone   matte, warm bone plinths and slabs
 *   metal   brushed, fine-drawn structure
 *   glass   frosted panes (the cards' own material, now architecture)
 *   dark    polished dark stone
 *   accent  the domain's tone — used once, where the idea resolves
 *
 * Each is an abstraction of what the domain does, not a picture of it:
 *
 *   web & app        three device-proportioned frames standing in depth, a
 *                    frosted pane in the widest — one interface, many sizes
 *   competitive      a search tree: branches split, some end, and one path
 *   programming      runs from the root to a solution
 *   events           a programme on the floor: stages of different sizes
 *                    stepping along a curve through time; one of them is now
 *   contents         a page as a relief: image, headline, columns, a swatch
 *   & design
 *   hr & logistics   one line tied into a knot — many threads held together
 *   marketing        a basin whose surface ripples outward from one point
 *
 * Geometry is in the piece's own frame: origin on the floor under its centre,
 * +y up, +z towards the room's entrance (the camera).
 */
import {
  BoxGeometry,
  type BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  LatheGeometry,
  Path,
  Quaternion,
  Shape,
  SphereGeometry,
  TorusKnotGeometry,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from '@/lib/random';

export type PieceMaterial = 'stone' | 'metal' | 'glass' | 'dark' | 'accent';
export type PieceParts = Partial<Record<PieceMaterial, BufferGeometry>>;

const UP = new Vector3(0, 1, 0);
const _d = new Vector3();
const _q = new Quaternion();

/** A rod from a to b. */
function rod(a: Vector3, b: Vector3, r: number, seg = 8) {
  _d.subVectors(b, a);
  const g = new CylinderGeometry(r, r, _d.length(), seg, 1);
  _q.setFromUnitVectors(UP, _d.clone().normalize());
  g.applyQuaternion(_q);
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) {
  const g = new BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}

function roundedRect(w: number, h: number, r: number, into?: Shape | Path) {
  const s = into ?? new Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s;
}

/** A thin rounded frame (profile t), `depth` deep, centred. */
function frame(w: number, h: number, r: number, t: number, depth: number) {
  const outer = roundedRect(w, h, r) as Shape;
  outer.holes.push(roundedRect(w - 2 * t, h - 2 * t, Math.max(0.005, r - t), new Path()) as Path);
  const g = new ExtrudeGeometry(outer, { depth, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Merge a list, whatever mix of indexed and non-indexed geometry it holds. */
function merge(list: BufferGeometry[]) {
  if (!list.length) return undefined;
  const mixed = list.some((g) => !g.index);
  const parts = list.map((g) => {
    const out = mixed && g.index ? g.toNonIndexed() : g;
    if (!out.getAttribute('uv')) return out;
    return out;
  });
  const merged = mergeGeometries(parts, false) ?? undefined;
  list.forEach((g) => g.dispose());
  if (mixed) parts.forEach((g) => g.dispose());
  merged?.computeBoundingSphere();
  return merged;
}

function collect() {
  const bins: Record<PieceMaterial, BufferGeometry[]> = { stone: [], metal: [], glass: [], dark: [], accent: [] };
  const done = (): PieceParts => {
    const out: PieceParts = {};
    for (const k of Object.keys(bins) as PieceMaterial[]) {
      const g = merge(bins[k]);
      if (g) out[k] = g;
    }
    return out;
  };
  return { bins, done };
}

// ─── The pieces ──────────────────────────────────────────────────────────────

function webAndApp(): PieceParts {
  const { bins, done } = collect();
  const devices: [number, number, number, number, number, number, number][] = [
    // w, h, corner, x, y (centre), z, rotation
    [1.9, 1.2, 0.05, -0.35, 1.45, -0.55, 0.1],
    [0.95, 1.3, 0.05, 0.62, 1.2, 0.05, -0.2],
    [0.46, 0.96, 0.07, 0.08, 0.95, 0.6, 0.06],
  ];
  devices.forEach(([w, h, r, x, y, z, ry], k) => {
    const f = frame(w, h, r, 0.03, 0.03);
    f.rotateY(ry);
    f.translate(x, y, z);
    bins.metal.push(f);
    // Standing on two fine legs.
    for (const sx of [-0.35, 0.35]) {
      const lx = x + Math.cos(ry) * sx * w;
      const lz = z - Math.sin(ry) * sx * w;
      bins.metal.push(rod(new Vector3(lx, 0, lz), new Vector3(lx, y - h / 2, lz), 0.008, 6));
    }
    if (k === 0) {
      // The widest holds a frosted pane, and a single line in the domain's tone along its foot.
      const pane = box(w - 0.08, h - 0.08, 0.012, 0, 0, 0);
      pane.rotateY(ry);
      pane.translate(x, y, z);
      bins.glass.push(pane);
      const line = box(w * 0.36, 0.012, 0.02, 0, 0, 0);
      line.rotateY(ry);
      line.translate(x - Math.cos(ry) * w * 0.22, y - h / 2 + 0.1, z + Math.sin(ry) * w * 0.22 + 0.02);
      bins.accent.push(line);
    }
  });
  return done();
}

function competitiveProgramming(): PieceParts {
  const { bins, done } = collect();
  const r = rng(303);
  bins.stone.push(box(0.46, 0.5, 0.46, 0, 0.25, 0));
  const root = new Vector3(0, 0.5, 0);
  // The solution: one choice per level, fixed.
  const solution = [0, 1, 1, 0, 1];
  const grow = (from: Vector3, dir: Vector3, depth: number, onPath: boolean, plane: number) => {
    const len = 0.62 * Math.pow(0.8, depth);
    const to = from.clone().addScaledVector(dir, len);
    (onPath ? bins.accent : bins.metal).push(rod(from, to, onPath ? 0.015 : 0.009, 8));
    const node = new SphereGeometry(onPath && depth === solution.length - 1 ? 0.06 : 0.026, 12, 8);
    node.translate(to.x, to.y, to.z);
    (onPath ? bins.accent : bins.metal).push(node);
    if (depth >= solution.length - 1) return;
    // Some branches end here: the search prunes them.
    if (!onPath && depth >= 1 && r() < 0.3) return;
    const spread = 0.5 + r() * 0.12;
    for (let c = 0; c < 2; c++) {
      const side = c === 0 ? -1 : 1;
      const axis = plane % 2 === 0 ? new Vector3(0, 0, 1) : new Vector3(1, 0, 0);
      const nd = dir.clone().applyAxisAngle(axis, side * spread).normalize();
      grow(to, nd, depth + 1, onPath && solution[depth + 1] === c, plane + 1);
    }
  };
  grow(root, new Vector3(0, 1, 0), 0, true, 0);
  return done();
}

function eventsAndFunctioning(): PieceParts {
  const { bins, done } = collect();
  // A programme laid out on the floor: stages of different sizes stepping
  // along a curve through time, joined by one fine line; one of them is now.
  const n = 8;
  const pts: Vector3[] = [];
  // It comes from the far end of the room and turns towards you, clear of the
  // people's pane on the left and of the page's controls below.
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = -1.35 + 1.75 * t + 0.35 * Math.sin(Math.PI * t);
    const z = -2.7 + 3.5 * t;
    const r = 0.14 + 0.13 * Math.abs(Math.sin(i * 1.9 + 0.7));
    const h = 0.04 + 0.2 * Math.abs(Math.sin(i * 1.31 + 0.2));
    const stage = new CylinderGeometry(r, r * 1.02, h, 48, 1);
    stage.translate(x, h / 2, z);
    bins.stone.push(stage);
    pts.push(new Vector3(x, 0.012, z));
    if (i === 5) {
      const now = new CylinderGeometry(r * 0.94, r * 0.94, 0.012, 48, 1);
      now.translate(x, h + 0.006, z);
      bins.accent.push(now);
    }
  }
  for (let i = 0; i < n - 1; i++) bins.metal.push(rod(pts[i], pts[i + 1], 0.008, 6));
  return done();
}

function contentsAndDesign(): PieceParts {
  const { bins, done } = collect();
  const W = 1.5;
  const H = 1.95;
  const cy = 0.42 + H / 2;
  // The sheet, standing on a low foot.
  bins.stone.push(box(W, H, 0.035, 0, cy, 0));
  bins.stone.push(box(W * 0.6, 0.12, 0.3, 0, 0.06, 0));
  bins.metal.push(rod(new Vector3(0, 0.12, 0), new Vector3(0, 0.43, 0), 0.016, 8));
  const L = (x: number, y: number) => [x * W - W / 2, cy + H / 2 - y * H] as const;
  // Image block, headline, two columns of text, a caption — each at its own depth.
  const [ix, iy] = L(0.1, 0.09);
  bins.glass.push(box(W * 0.52, H * 0.34, 0.03, ix + W * 0.26, iy - H * 0.17, 0.04));
  const [hx, hy] = L(0.1, 0.49);
  bins.metal.push(box(W * 0.8, 0.07, 0.02, hx + W * 0.4, hy, 0.05));
  for (let col = 0; col < 2; col++) {
    for (let line = 0; line < 9; line++) {
      const [lx, ly] = L(0.1 + col * 0.42, 0.58 + line * 0.035);
      const w = W * (line === 8 ? 0.2 : 0.36);
      bins.metal.push(box(w, 0.012, 0.012, lx + w / 2, ly, 0.035));
    }
  }
  const [cx2, cy2] = L(0.66, 0.1);
  for (let line = 0; line < 3; line++) bins.metal.push(box(W * 0.24, 0.01, 0.01, cx2 + W * 0.12, cy2 - line * 0.04, 0.035));
  // The swatch.
  const [sx, sy] = L(0.66, 0.31);
  bins.accent.push(box(0.16, 0.16, 0.02, sx + 0.08, sy, 0.06));
  return done();
}

function hrAndLogistics(): PieceParts {
  const { bins, done } = collect();
  bins.stone.push(box(0.56, 0.72, 0.56, 0, 0.36, 0));
  const knot = new TorusKnotGeometry(0.5, 0.042, 260, 14, 2, 3);
  knot.rotateX(0.35);
  knot.translate(0, 0.72 + 0.72, 0);
  bins.metal.push(knot);
  // Where the line is held: a small bead of the domain's tone.
  const bead = new SphereGeometry(0.05, 14, 10);
  bead.translate(0.5, 1.44, 0.18);
  bins.accent.push(bead);
  return done();
}

function marketing(): PieceParts {
  const { bins, done } = collect();
  const plinth = new CylinderGeometry(1.0, 1.04, 0.56, 64, 1);
  plinth.translate(0, 0.28, 0);
  bins.stone.push(plinth);
  // The surface: ripples spreading from one point, weakening as they travel.
  const prof: Vector2[] = [];
  for (let i = 0; i <= 120; i++) {
    const rr = (i / 120) * 0.96;
    prof.push(new Vector2(rr, 0.565 + 0.014 * Math.sin(rr * 30) * Math.exp(-rr * 1.8)));
  }
  prof.push(new Vector2(0.96, 0.555));
  const surface = new LatheGeometry(prof.reverse(), 96);
  bins.dark.push(surface);
  // The source.
  const source = new SphereGeometry(0.03, 12, 8);
  source.translate(0, 0.62, 0);
  bins.accent.push(source);
  bins.accent.push(rod(new Vector3(0, 0.62, 0), new Vector3(0, 1.05, 0), 0.004, 6));
  return done();
}

const BUILDERS: Record<string, () => PieceParts> = {
  'web-and-app-development': webAndApp,
  'competitive-programming-and-technical-development': competitiveProgramming,
  'events-and-functioning': eventsAndFunctioning,
  'contents-and-design': contentsAndDesign,
  'hr-and-logistics': hrAndLogistics,
  marketing,
};

/** The centrepiece for a domain (CORE's room is built differently: its officers are its architecture). */
export function buildCenterpiece(slug: string): PieceParts {
  return BUILDERS[slug]?.() ?? {};
}
