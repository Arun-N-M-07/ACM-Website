/**
 * A camera move as one smooth curve through authored keys.
 *
 * Position and look target each follow a centripetal Catmull-Rom spline
 * through the keys. Film time is mapped onto the spline with a monotone cubic
 * (Fritsch–Carlson) time-warp, so the camera passes each key exactly at its
 * time with continuous velocity — it eases out of a key the way it eased in,
 * never overshoots, and stops only where the keys ask it to (a key repeated,
 * or the ends).
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

const smooth = (x: number) => x * x * (3 - 2 * x);

export class CameraPath {
  readonly keys: PathKey[];
  private pos: CatmullRomCurve3;
  private look: CatmullRomCurve3;
  private ts: number[];
  private ss: number[];
  private m: number[];

  constructor(keys: PathKey[]) {
    this.keys = keys;
    this.pos = new CatmullRomCurve3(keys.map((k) => new Vector3(...k.pos)), false, 'centripetal');
    this.look = new CatmullRomCurve3(keys.map((k) => new Vector3(...k.look)), false, 'centripetal');
    const n = keys.length;
    this.ts = keys.map((k) => k.t);
    this.ss = keys.map((_, i) => i / (n - 1));
    // Fritsch–Carlson tangents; zero at both ends (start from rest, arrive at rest).
    const slopes: number[] = [];
    for (let i = 0; i < n - 1; i++) slopes.push((this.ss[i + 1] - this.ss[i]) / (this.ts[i + 1] - this.ts[i]));
    const m: number[] = new Array(n).fill(0);
    for (let i = 1; i < n - 1; i++) m[i] = slopes[i - 1] * slopes[i] <= 0 ? 0 : (2 * slopes[i - 1] * slopes[i]) / (slopes[i - 1] + slopes[i]);
    for (let i = 0; i < n - 1; i++) {
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

  get start() {
    return this.ts[0];
  }

  get end() {
    return this.ts[this.ts.length - 1];
  }

  /** Film time → spline parameter (monotone, C1). */
  warp(t: number) {
    const { ts, ss, m } = this;
    const n = ts.length;
    if (t <= ts[0]) return 0;
    if (t >= ts[n - 1]) return 1;
    let k = 0;
    while (k < n - 2 && t > ts[k + 1]) k++;
    const h = ts[k + 1] - ts[k];
    const u = (t - ts[k]) / h;
    const u2 = u * u;
    const u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * ss[k] + (u3 - 2 * u2 + u) * h * m[k] + (-2 * u3 + 3 * u2) * ss[k + 1] + (u3 - u2) * h * m[k + 1];
  }

  sample(t: number, out: PathSample): PathSample {
    const s = this.warp(t);
    this.pos.getPoint(s, out.pos);
    this.look.getPoint(s, out.look);
    // FOV and roll follow the same warp, eased between keys.
    const n = this.keys.length;
    const f = s * (n - 1);
    const i = Math.min(n - 2, Math.floor(f));
    const w = smooth(Math.min(1, Math.max(0, f - i)));
    const a = this.keys[i];
    const b = this.keys[i + 1];
    out.fov = a.fov + (b.fov - a.fov) * w;
    out.roll = (a.roll ?? 0) + ((b.roll ?? 0) - (a.roll ?? 0)) * w;
    return out;
  }
}
