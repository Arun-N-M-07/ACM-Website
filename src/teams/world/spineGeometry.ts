/**
 * The spine, built procedurally: a column of vertebrae, each assembled from
 * simple parts (a waisted body, an intervertebral disc, a neural arch, two
 * transverse processes, a spinous process, articular knuckles), then the
 * whole surface displaced with smooth noise so no two are alike and the
 * silhouette is irregular and organic.
 *
 * The column tapers (smaller above, heavier below), curves gently (an S in
 * depth), and twists as it descends so that — as the camera orbits — the spine
 * keeps turning its "front" towards the lens, wings spread, like the view in
 * an anatomy plate.
 *
 * Construction is incremental (a few vertebrae per idle slice) and cached for
 * the session, so it never costs a frame while scrolling.
 */
import {
  BufferGeometry,
  ConeGeometry,
  LatheGeometry,
  Matrix4,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from '@/lib/random';
import { SPINE_BOTTOM, SPINE_TOP, STEP, spineAxis } from '../layout';

/** Drop per card in the landscape composition — the twist follows the orbit. */
const TWIST_DROP = 3.2;

/** Centre-line of the column at height y (relative to the world origin). */
export { spineAxis } from '../layout';

/** Vertebra size along the column: finer above, heavier below. */
const sizeAt = (y: number) => 1.32 + 0.3 * Math.cos(y * 0.19);

/** Smooth organic noise (sums of warped sines — cheap, deterministic). */
function organic(x: number, y: number, z: number) {
  const a = Math.sin(x * 1.7 + Math.sin(y * 2.3) * 1.1) * Math.sin(y * 1.9 + Math.sin(z * 1.3) * 1.2) * Math.sin(z * 2.1 + Math.sin(x * 1.5) * 0.9);
  const b = Math.sin(x * 4.3 + y * 1.1) * Math.sin(y * 3.7 - z * 2.2) * Math.sin(z * 4.9 + x * 0.7);
  return a + 0.35 * b;
}

const _m = new Matrix4();
const _q = new Quaternion();
const _s = new Vector3();
const _p = new Vector3();
const _n = new Vector3();
const _axis = new Vector3();
const Y = new Vector3(0, 1, 0);

function place(g: BufferGeometry, pos: [number, number, number], rot: [number, number, number] = [0, 0, 0], scale: [number, number, number] = [1, 1, 1]) {
  g.rotateX(rot[0]);
  g.rotateY(rot[1]);
  g.rotateZ(rot[2]);
  g.scale(...scale);
  g.translate(...pos);
  return g;
}

/** One vertebra in its local frame (y up the column, −z posterior), unit size. */
function vertebra(r: () => number): BufferGeometry[] {
  const R = 0.29;
  const H = 0.3;
  const parts: BufferGeometry[] = [];
  // Body: a waisted drum with rounded rims.
  const prof: Vector2[] = [new Vector2(0, -H / 2)];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const y = -H / 2 + H * t;
    const edge = Math.sin(Math.PI * t);
    const waist = 0.9 + 0.1 * Math.pow(2 * t - 1, 2);
    prof.push(new Vector2(R * waist * (0.82 + 0.18 * Math.pow(edge, 0.35)), y));
  }
  prof.push(new Vector2(0, H / 2));
  parts.push(new LatheGeometry(prof, 26));
  // Neural arch behind the body.
  parts.push(place(new TorusGeometry(R * 0.56, R * 0.17, 10, 18, Math.PI), [0, 0, -R * 0.86], [-Math.PI / 2, 0, 0], [1, 1, 1.15]));
  // Transverse processes: wings out to the sides, swept back and up.
  const wing = 1.85 + (r() - 0.5) * 0.28;
  for (const side of [-1, 1]) {
    parts.push(place(new ConeGeometry(R * 0.2, R * 1.35 * wing, 10, 2), [side * R * 1.2, H * 0.08, -R * 1.02], [0, side * 0.35, -side * (Math.PI / 2 - 0.22)]));
  }
  // Spinous process: long, back and down.
  parts.push(place(new ConeGeometry(R * 0.24, R * 1.7 * (0.85 + r() * 0.35), 10, 2), [0, -H * 0.35, -R * 1.85], [-Math.PI / 2 - 0.62, 0, 0]));
  // Articular knuckles above and below.
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) parts.push(place(new SphereGeometry(R * (0.13 + r() * 0.05), 9, 7), [sx * R * 0.4, sy * H * 0.55, -R * 1.12]));
  return parts;
}

/** Intervertebral disc (slightly glassier in the shader; same geometry family). */
function disc(): BufferGeometry {
  const R = 0.25;
  const H = 0.1;
  const prof: Vector2[] = [new Vector2(0, -H / 2)];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    prof.push(new Vector2(R * (0.86 + 0.14 * Math.sin(Math.PI * t)), -H / 2 + H * t));
  }
  prof.push(new Vector2(0, H / 2));
  return new LatheGeometry(prof, 22);
}

/**
 * Weld seams, then displace along the (smooth) normals with organic noise and
 * recompute normals — welding first means seams move together (no cracks).
 */
function sculpt(g: BufferGeometry, amp: number, freq: number, seed: number) {
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  const w = mergeVertices(g, 1e-4);
  g.dispose();
  w.computeVertexNormals();
  const pos = w.getAttribute('position');
  const nor = w.getAttribute('normal');
  for (let i = 0; i < pos.count; i++) {
    _p.fromBufferAttribute(pos, i);
    _n.fromBufferAttribute(nor, i);
    const d = organic(_p.x * freq + seed, _p.y * freq, _p.z * freq - seed) * amp;
    pos.setXYZ(i, _p.x + _n.x * d, _p.y + _n.y * d, _p.z + _n.z * d);
  }
  w.computeVertexNormals();
  return w;
}

let cached: Promise<BufferGeometry> | null = null;

const idle = (cb: (deadline: { timeRemaining: () => number }) => void) => {
  const w = window as unknown as { requestIdleCallback?: (cb: (d: { timeRemaining: () => number }) => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(cb, { timeout: 120 });
  else setTimeout(() => cb({ timeRemaining: () => 8 }), 16);
};

/** Build (once) and return the spine geometry. */
export function spineGeometry(): Promise<BufferGeometry> {
  if (cached) return cached;
  cached = new Promise((resolve) => {
    const r = rng(20260926);
    const pieces: BufferGeometry[] = [];
    let y = SPINE_TOP;
    let j = 0;
    const step = (deadline: { timeRemaining: () => number }) => {
      do {
        if (y < SPINE_BOTTOM) {
          const merged = mergeGeometries(pieces, false)!;
          pieces.forEach((p) => p.dispose());
          merged.computeBoundingSphere();
          resolve(merged);
          return;
        }
        const s = sizeAt(y) * (0.94 + r() * 0.12);
        const H = 0.3 * s;
        spineAxis(y, _axis);
        // Twist: keep the anterior face turned towards the orbiting camera.
        const twist = (-y / TWIST_DROP) * STEP + (r() - 0.5) * 0.12;
        const tilt = (r() - 0.5) * 0.04;
        _q.setFromAxisAngle(Y, twist);
        _m.compose(_axis, _q, _s.set(s, s, s));
        const parts = vertebra(r).map((g) => {
          g.rotateX(tilt);
          return g.applyMatrix4(_m);
        });
        for (const g of parts) pieces.push(sculpt(g, 0.028 * s, 5.2, j * 1.37));
        // The disc below this vertebra.
        const dy = y - H / 2 - 0.07 * s;
        spineAxis(dy, _axis);
        _m.compose(_axis, _q, _s.set(s, s * (0.9 + r() * 0.3), s));
        pieces.push(sculpt(disc().applyMatrix4(_m), 0.01 * s, 7, j * 2.1));
        y -= H + 0.14 * s;
        j++;
      } while (deadline.timeRemaining() > 4);
      idle(step);
    };
    idle(step);
  });
  return cached;
}

/** A helix wound round the column (the journey's signal thread, continued). */
export function filamentPoints(turns = 6.5, samples = 900): Vector3[] {
  const pts: Vector3[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const y = SPINE_TOP - 0.5 - t * (SPINE_TOP - SPINE_BOTTOM - 1);
    spineAxis(y, _axis);
    const a = t * turns * Math.PI * 2;
    const rad = 0.66 * sizeAt(y) + 0.06 * Math.sin(t * 40);
    pts.push(new Vector3(_axis.x + Math.cos(a) * rad, y, _axis.z + Math.sin(a) * rad));
  }
  return pts;
}
