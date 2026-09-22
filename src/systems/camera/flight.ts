/**
 * The opening drone flight as one smooth curve.
 *
 * Position and look-at target each follow a centripetal Catmull-Rom spline
 * through the FLIGHT keys. Scroll time is mapped onto the spline with a
 * monotone cubic (Fritsch–Carlson) time-warp, so the camera passes each key at
 * its authored moment with continuous velocity — no stops, no jolts — and
 * eases in from rest and settles at rest over the light-well. In the last
 * stretch the orientation blends into an exact straight-down view.
 */
import { CatmullRomCurve3, Vector3 } from 'three';
import { FLIGHT } from '@/config/camera';
import { aim, DEG, lerp, lerpAngle, smoothstep, type CameraPose } from './pose';

const posCurve = new CatmullRomCurve3(
  FLIGHT.map((k) => new Vector3(...k.pos)),
  false,
  'centripetal',
);
const lookCurve = new CatmullRomCurve3(
  FLIGHT.map((k) => new Vector3(...k.look)),
  false,
  'centripetal',
);

const n = FLIGHT.length;
const ts = FLIGHT.map((k) => k.t);
const ss = FLIGHT.map((_, i) => i / (n - 1));

// Fritsch–Carlson tangents (zero at both ends: start from rest, settle at rest).
const slopes: number[] = [];
for (let i = 0; i < n - 1; i++) slopes.push((ss[i + 1] - ss[i]) / (ts[i + 1] - ts[i]));
const m: number[] = new Array(n).fill(0);
for (let i = 1; i < n - 1; i++) m[i] = slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2;
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

/** Monotone time-warp: flight time 0..1 → spline parameter 0..1. */
export function flightWarp(t: number) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  let k = 0;
  while (k < n - 2 && t > ts[k + 1]) k++;
  const h = ts[k + 1] - ts[k];
  const u = (t - ts[k]) / h;
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * ss[k] + (u3 - 2 * u2 + u) * h * m[k] + (-2 * u3 + 3 * u2) * ss[k + 1] + (u3 - u2) * h * m[k + 1];
}

const _p = new Vector3();
const _l = new Vector3();
const TOP_PITCH = -89.9 * DEG;

export function evaluateFlight(t: number, out: CameraPose): CameraPose {
  const s = flightWarp(t);
  posCurve.getPoint(s, _p);
  lookCurve.getPoint(s, _l);
  const { yaw, pitch } = aim([_p.x, _p.y, _p.z], [_l.x, _l.y, _l.z]);
  // FOV follows the same warp, piecewise between keys.
  const f = s * (n - 1);
  const i = Math.min(n - 2, Math.floor(f));
  const fov = lerp(FLIGHT[i].fov, FLIGHT[i + 1].fov, smoothstep(0, 1, f - i));
  // Settle into the exact top-down orientation over the light-well.
  const w = smoothstep(0.82, 1, t);
  out.x = _p.x;
  out.y = _p.y;
  out.z = _p.z;
  out.yaw = lerpAngle(yaw, 0, w);
  out.pitch = lerp(pitch, TOP_PITCH, w);
  out.roll = 0;
  out.fov = fov;
  return out;
}
