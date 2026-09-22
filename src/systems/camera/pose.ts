/**
 * Camera pose math. Orientation is stored as yaw / pitch / roll (Euler 'YXZ',
 * yaw 0 looks down −z) rather than look-at targets, so poses interpolate
 * cleanly all the way to a straight-down view without gimbal flips.
 */
import type { Vec3 } from '@/config/world';

export interface CameraPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  fov: number;
}

export const DEG = Math.PI / 180;

export function makePose(pos: Vec3, yaw: number, pitch: number, fov: number, roll = 0): CameraPose {
  return { x: pos[0], y: pos[1], z: pos[2], yaw, pitch, roll, fov };
}

/** yaw/pitch that aim from `from` at `to`. */
export function aim(from: Vec3, to: Vec3): { yaw: number; pitch: number } {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const h = Math.hypot(dx, dz);
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, h) };
}

export function lookPose(from: Vec3, to: Vec3, fov: number, roll = 0): CameraPose {
  const { yaw, pitch } = aim(from, to);
  return makePose(from, yaw, pitch, fov, roll);
}

export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number) => t * t * t;
export const easeInOutQuint = (t: number) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2);

/** Shortest signed angular difference b − a. */
export function angleDelta(a: number, b: number) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function lerpAngle(a: number, b: number, t: number) {
  return a + angleDelta(a, b) * t;
}

export function lerpPose(a: CameraPose, b: CameraPose, t: number, out: CameraPose): CameraPose {
  out.x = lerp(a.x, b.x, t);
  out.y = lerp(a.y, b.y, t);
  out.z = lerp(a.z, b.z, t);
  out.yaw = lerpAngle(a.yaw, b.yaw, t);
  out.pitch = lerp(a.pitch, b.pitch, t);
  out.roll = lerp(a.roll, b.roll, t);
  out.fov = lerp(a.fov, b.fov, t);
  return out;
}

export function copyPose(src: CameraPose, out: CameraPose): CameraPose {
  out.x = src.x;
  out.y = src.y;
  out.z = src.z;
  out.yaw = src.yaw;
  out.pitch = src.pitch;
  out.roll = src.roll;
  out.fov = src.fov;
  return out;
}

export const emptyPose = (): CameraPose => ({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, fov: 45 });

/** Quadratic Bézier on Vec3. */
export function bezier3(a: Vec3, c: Vec3, b: Vec3, t: number): Vec3 {
  const u = 1 - t;
  return [
    u * u * a[0] + 2 * u * t * c[0] + t * t * b[0],
    u * u * a[1] + 2 * u * t * c[1] + t * t * b[1],
    u * u * a[2] + 2 * u * t * c[2] + t * t * b[2],
  ];
}

export function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/** Keyframed pose track with per-span easing. Keys must be sorted by t. */
export interface PoseKey {
  t: number;
  pose: CameraPose;
  ease?: (t: number) => number;
}

export function sampleTrack(keys: PoseKey[], t: number, out: CameraPose): CameraPose {
  if (t <= keys[0].t) return copyPose(keys[0].pose, out);
  const last = keys[keys.length - 1];
  if (t >= last.t) return copyPose(last.pose, out);
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t <= b.t) {
      const local = (t - a.t) / (b.t - a.t);
      const e = (b.ease ?? easeInOutSine)(local);
      return lerpPose(a.pose, b.pose, e, out);
    }
  }
  return copyPose(last.pose, out);
}
