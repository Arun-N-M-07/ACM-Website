/**
 * A camera move as one smooth curve through authored keys.
 *
 * Position and look target each follow a centripetal Catmull-Rom spline
 * through the keys, and each is traversed by ARC LENGTH: a monotone cubic
 * (Fritsch–Carlson) maps the beat to the distance travelled along the curve,
 * passing through every key at exactly its beat. So the camera's speed —
 * metres per beat, and the look target's too — is continuous everywhere,
 * across every key: it eases out of a key the way it eased in, never
 * overshoots, never lurches, and stops only where the keys ask it to (a key
 * repeated, or the ends). (Stepping the spline's own parameter evenly per key
 * instead would make the speed jump at every key where a short segment meets
 * a long one — the camera would lurch as a hold gives way to a move.)
 *
 * The lens and roll follow C1 monotone cubics through their key values.
 */
import { CatmullRomCurve3, Vector3 } from 'three';
import type { Vec3 } from '@/config/world';

export interface PathKey {
  t: number;
  pos: Vec3;
  look: Vec3;
  fov: number;
  roll?: number;
}

export interface PathSample {
  pos: Vector3;
  look: Vector3;
  fov: number;
  roll: number;
}

export const makeSample = (): PathSample => ({ pos: new Vector3(), look: new Vector3(), fov: 45, roll: 0 });

/**
 * A monotone C1 cubic through (xs[i], ys[i]) — Fritsch–Carlson tangents,
 * zero at both ends (starts from rest, arrives at rest).
 */
class MonotoneCubic {
  private m: number[];
  constructor(
    private xs: number[],
    private ys: number[],
  ) {
    const n = xs.length;
    const slopes: number[] = [];
    for (let i = 0; i < n - 1; i++) slopes.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    const m: number[] = new Array(n).fill(0);
    for (let i = 1; i < n - 1; i++) m[i] = slopes[i - 1] * slopes[i] <= 0 ? 0 : (2 * slopes[i - 1] * slopes[i]) / (slopes[i - 1] + slopes[i]);
    for (let i = 0; i < n - 1; i++) {
      if (slopes[i] === 0) {
        m[i] = 0;
        m[i + 1] = 0;
        continue;
      }
      const a = m[i] / slopes[i];
      const b = m[i + 1] / slopes[i];
      const h = a * a + b * b;
      if (h > 9) {
        const k = 3 / Math.sqrt(h);
        m[i] = k * a * slopes[i];
        m[i + 1] = k * b * slopes[i];
      }
    }
    this.m = m;
  }

  at(x: number) {
    const { xs, ys, m } = this;
    const n = xs.length;
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let k = 0;
    while (k < n - 2 && x > xs[k + 1]) k++;
    const h = xs[k + 1] - xs[k];
    const u = (x - xs[k]) / h;
    const u2 = u * u;
    const u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * ys[k] + (u3 - 2 * u2 + u) * h * m[k] + (-2 * u3 + 3 * u2) * ys[k + 1] + (u3 - u2) * h * m[k + 1];
  }
}

/** Samples per key segment for the arc-length tables. */
const DIVS = 96;

/** A curve through the keys, with each key's arc-length fraction and the beat → arc-length warp. */
function arcCurve(points: Vector3[], ts: number[]) {
  const curve = new CatmullRomCurve3(points, false, 'centripetal');
  const n = points.length;
  curve.arcLengthDivisions = (n - 1) * DIVS;
  const lengths = curve.getLengths((n - 1) * DIVS);
  const total = lengths[lengths.length - 1];
  // Key i sits at the curve's parameter i/(n−1): its arc length is the table's entry there.
  const fracs = points.map((_, i) => (total > 1e-6 ? lengths[i * DIVS] / total : i / (n - 1)));
  return { curve, total, warp: new MonotoneCubic(ts, fracs) };
}

export class CameraPath {
  readonly keys: PathKey[];
  private pos: ReturnType<typeof arcCurve>;
  private look: ReturnType<typeof arcCurve>;
  private fov: MonotoneCubic;
  private roll: MonotoneCubic;
  private ts: number[];

  constructor(keys: PathKey[]) {
    this.keys = keys;
    this.ts = keys.map((k) => k.t);
    this.pos = arcCurve(
      keys.map((k) => new Vector3(...k.pos)),
      this.ts,
    );
    this.look = arcCurve(
      keys.map((k) => new Vector3(...k.look)),
      this.ts,
    );
    this.fov = new MonotoneCubic(this.ts, keys.map((k) => k.fov));
    this.roll = new MonotoneCubic(this.ts, keys.map((k) => k.roll ?? 0));
  }

  get start() {
    return this.ts[0];
  }

  get end() {
    return this.ts[this.ts.length - 1];
  }

  /** Beat → how far along the position curve (0..1 of its length). */
  warp(t: number) {
    return this.pos.warp.at(t);
  }

  sample(t: number, out: PathSample): PathSample {
    const clamp = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
    this.pos.curve.getPointAt(clamp(this.pos.warp.at(t)), out.pos);
    this.look.curve.getPointAt(clamp(this.look.warp.at(t)), out.look);
    out.fov = this.fov.at(t);
    out.roll = this.roll.at(t);
    return out;
  }
}
