/**
 * Procedural pose library. A pose is a set of target joint rotations; the NPC
 * blends toward it every frame, so switching activity or state is always a
 * smooth transition. Activities are the base layer; look-at, wave, handshake,
 * walk and talk are layered on top.
 *
 * Conventions (joint local space, character faces +z):
 *   negative x on a shoulder/hip/elbow = swing forward; positive x on a knee = bend
 *   positive x on spine/head = lean / look down; y = turn; z on shoulders = abduct
 *   (left arm outward is +z, right arm outward is −z).
 */
import type { Activity } from '@/content/avatar';
import type { AvatarRig } from './rig';

export const JOINTS = ['hips', 'spine', 'head', 'shoulderL', 'elbowL', 'shoulderR', 'elbowR', 'hipL', 'kneeL', 'hipR', 'kneeR'] as const;
export type JointName = (typeof JOINTS)[number];

export interface Pose {
  j: Record<JointName, [number, number, number]>;
  hipsY: number;
  /** Extra yaw on the whole body (pacing, turning). */
  bodyYaw: number;
}

export function createPose(): Pose {
  const j = {} as Pose['j'];
  for (const n of JOINTS) j[n] = [0, 0, 0];
  return { j, hipsY: 0, bodyYaw: 0 };
}

export const SEATED: Record<Activity, boolean> = {
  typing: true,
  writing: true,
  thinking: true,
  sketching: false,
  reviewing: false,
  pointing: false,
  phone: false,
  clipboard: false,
  pinning: false,
  presenting: false,
  watching: true,
  boardwork: false,
};

const set = (p: Pose, n: JointName, x: number, y = 0, z = 0) => {
  p.j[n][0] = x;
  p.j[n][1] = y;
  p.j[n][2] = z;
};

/** Smooth 0..1 square-ish wave for alternating sub-actions. */
const cycle = (t: number, period: number, duty = 0.5) => {
  const u = (t % period) / period;
  const edge = 0.08;
  if (u < duty) return Math.min(1, u / edge, (duty - u) / edge);
  return 0;
};

export function basePose(p: Pose, activity: Activity, t: number, seated: boolean, rig: AvatarRig, standOverride = false) {
  const d = rig.dims;
  for (const n of JOINTS) set(p, n, 0);
  p.bodyYaw = 0;
  const breathe = Math.sin(t * 1.6) * 0.012;
  const sit = seated && !standOverride;

  if (sit) {
    p.hipsY = d.seatedHipY;
    set(p, 'hipL', -1.48, 0, 0.05);
    set(p, 'hipR', -1.48, 0, -0.05);
    set(p, 'kneeL', 1.42);
    set(p, 'kneeR', 1.42);
  } else {
    p.hipsY = d.hipY;
    set(p, 'kneeL', 0.03);
    set(p, 'kneeR', 0.03);
  }
  // Relaxed arms, hanging just clear of the torso.
  set(p, 'shoulderL', 0.02, 0, 0.13);
  set(p, 'shoulderR', 0.02, 0, -0.13);
  set(p, 'elbowL', -0.14);
  set(p, 'elbowR', -0.14);
  set(p, 'spine', breathe);

  if (standOverride) return;

  switch (activity) {
    case 'typing': {
      set(p, 'spine', 0.12 + breathe);
      set(p, 'head', 0.1, Math.sin(t * 0.3) * 0.08);
      const tapL = Math.sin(t * 11) * Math.sin(t * 2.3) * 0.05;
      const tapR = Math.sin(t * 12 + 1.7) * Math.sin(t * 1.9 + 0.4) * 0.05;
      set(p, 'shoulderL', -0.5, 0, -0.06);
      set(p, 'shoulderR', -0.5, 0, 0.06);
      set(p, 'elbowL', -1.08 + tapL);
      set(p, 'elbowR', -1.08 + tapR);
      break;
    }
    case 'writing': {
      set(p, 'spine', 0.2 + breathe);
      set(p, 'head', 0.36, 0.05);
      set(p, 'shoulderR', -0.45 + Math.sin(t * 5) * 0.02, 0, 0.14);
      set(p, 'elbowR', -1.36 + Math.cos(t * 5) * 0.03);
      set(p, 'shoulderL', -0.36, 0, -0.1);
      set(p, 'elbowL', -1.2);
      break;
    }
    case 'thinking': {
      const nod = cycle(t, 7, 0.3);
      set(p, 'spine', -0.04 + breathe);
      set(p, 'head', -0.04 + nod * 0.12, Math.sin(t * 0.4) * 0.15, 0.08);
      set(p, 'shoulderR', -0.78, 0, 0.36);
      set(p, 'elbowR', -2.15);
      set(p, 'shoulderL', -0.32, 0, -0.06);
      set(p, 'elbowL', -1.1);
      break;
    }
    case 'sketching': {
      set(p, 'spine', 0.28 + breathe);
      set(p, 'head', 0.42);
      set(p, 'shoulderR', -0.82 + Math.sin(t * 2.2) * 0.06, 0, 0.14 + Math.cos(t * 1.7) * 0.05);
      set(p, 'elbowR', -0.8 + Math.sin(t * 3.1) * 0.08);
      set(p, 'shoulderL', -0.62, 0, -0.1);
      set(p, 'elbowL', -0.5);
      break;
    }
    case 'reviewing': {
      set(p, 'spine', 0.06 + breathe, 0, Math.sin(t * 0.5) * 0.02);
      set(p, 'head', 0.36, Math.sin(t * 0.7) * 0.06);
      set(p, 'shoulderL', -0.42, 0, -0.22);
      set(p, 'shoulderR', -0.42, 0, 0.22);
      set(p, 'elbowL', -1.3);
      set(p, 'elbowR', -1.3);
      p.hipsY -= Math.abs(Math.sin(t * 0.5)) * 0.008;
      break;
    }
    case 'pointing': {
      const k = cycle(t, 6, 0.5);
      set(p, 'spine', 0.02 + breathe);
      set(p, 'head', -0.12 * k, 0.1 * k);
      set(p, 'shoulderR', -0.1 - 1.35 * k, 0, -0.08 - 0.05 * k);
      set(p, 'elbowR', -0.3 + 0.18 * k);
      set(p, 'shoulderL', 0.02, 0, 0.1);
      set(p, 'elbowL', -0.3 - 1 * (1 - k));
      break;
    }
    case 'phone': {
      set(p, 'spine', breathe);
      set(p, 'head', 0.05, 0, -0.1);
      set(p, 'shoulderR', -0.35, 0, -0.32);
      set(p, 'elbowR', -2.45);
      set(p, 'shoulderL', 0.05, 0, 0.14);
      set(p, 'elbowL', -0.25);
      p.bodyYaw = Math.sin(t * 0.35) * 0.35;
      break;
    }
    case 'clipboard': {
      set(p, 'spine', 0.08 + breathe);
      set(p, 'head', 0.4);
      set(p, 'shoulderL', -0.5, 0, -0.2);
      set(p, 'elbowL', -1.5);
      set(p, 'shoulderR', -0.42 + Math.sin(t * 4.5) * 0.02, 0, 0.26);
      set(p, 'elbowR', -1.62 + Math.cos(t * 4.5) * 0.03);
      break;
    }
    case 'pinning': {
      const k = cycle(t, 5, 0.6);
      set(p, 'spine', -0.04 + breathe);
      set(p, 'head', -0.22 * k);
      set(p, 'shoulderL', -0.2 - 2.0 * k, 0, 0.05);
      set(p, 'shoulderR', -0.2 - 2.1 * k, 0, -0.05);
      set(p, 'elbowL', -0.4 - 0.2 * k);
      set(p, 'elbowR', -0.35);
      break;
    }
    case 'watching': {
      // Leaning in toward a laptop, chin on hand.
      set(p, 'spine', 0.26 + breathe);
      set(p, 'head', 0.22, Math.sin(t * 0.25) * 0.05);
      set(p, 'shoulderR', -0.9, 0, 0.3);
      set(p, 'elbowR', -2.25);
      set(p, 'shoulderL', -0.45, 0, -0.08);
      set(p, 'elbowL', -1.25 + Math.sin(t * 0.7) * 0.03);
      break;
    }
    case 'boardwork': {
      // Writing on a whiteboard: marker arm up, small strokes.
      set(p, 'spine', -0.02 + breathe, 0.1);
      set(p, 'head', -0.08, 0.12);
      set(p, 'shoulderR', -1.55 + Math.sin(t * 3.1) * 0.06, 0, -0.1 + Math.cos(t * 2.3) * 0.08);
      set(p, 'elbowR', -0.55 + Math.sin(t * 4.7) * 0.08);
      set(p, 'shoulderL', 0.05, 0, 0.14);
      set(p, 'elbowL', -0.3);
      break;
    }
    case 'presenting': {
      const g = Math.sin(t * 0.9);
      set(p, 'spine', 0.02 + breathe, 0.1 * g);
      set(p, 'head', 0, 0.35 * g);
      set(p, 'shoulderR', -0.8 + 0.25 * Math.sin(t * 1.3), 0, -0.3 + 0.18 * g);
      set(p, 'elbowR', -0.7);
      set(p, 'shoulderL', -0.2, 0, 0.12);
      set(p, 'elbowL', -0.9);
      break;
    }
  }
}

/** Turn head and torso toward a target (yaw/pitch relative to the body). */
export function overlayLook(p: Pose, yaw: number, pitch: number, w: number) {
  if (w <= 0) return;
  const y = Math.max(-1.25, Math.min(1.25, yaw));
  p.j.head[1] += (y * 0.6 - p.j.head[1] * 0.5) * w;
  p.j.head[0] += (-pitch - p.j.head[0]) * w;
  p.j.head[2] *= 1 - w;
  p.j.spine[1] += y * 0.32 * w;
  p.j.spine[0] *= 1 - w * 0.6;
}

export function overlayWave(p: Pose, t: number, w: number) {
  if (w <= 0) return;
  const s = p.j.shoulderR;
  const e = p.j.elbowR;
  s[0] += (-0.25 - s[0]) * w;
  s[2] += (-1.7 - s[2]) * w;
  e[0] += (-0.2 - e[0]) * w;
  e[2] += (1.3 + Math.sin(t * 10) * 0.32 - e[2]) * w;
}

export function overlayHandshake(p: Pose, t: number, extend: number, pump: number) {
  if (extend <= 0) return;
  const s = p.j.shoulderR;
  const e = p.j.elbowR;
  s[0] += (-0.9 + Math.sin(t * 15) * 0.09 * pump - s[0]) * extend;
  s[1] += (0 - s[1]) * extend;
  s[2] += (0.1 - s[2]) * extend;
  e[0] += (-0.5 - e[0]) * extend;
  e[2] *= 1 - extend;
  p.j.spine[0] += 0.06 * extend;
}

export function overlayWalk(p: Pose, phase: number, w: number) {
  if (w <= 0) return;
  const s = Math.sin(phase);
  const k = (x: number) => (0.5 - 0.5 * Math.cos(x)) * 0.7;
  const lerpTo = (arr: [number, number, number], i: number, v: number) => {
    arr[i] += (v - arr[i]) * w;
  };
  lerpTo(p.j.hipL, 0, -s * 0.42);
  lerpTo(p.j.hipR, 0, s * 0.42);
  lerpTo(p.j.kneeL, 0, k(phase + 0.4) * (s < 0 ? 1 : 0.35));
  lerpTo(p.j.kneeR, 0, k(phase + Math.PI + 0.4) * (s > 0 ? 1 : 0.35));
  lerpTo(p.j.shoulderL, 0, s * 0.3);
  lerpTo(p.j.shoulderR, 0, -s * 0.3);
  lerpTo(p.j.elbowL, 0, -0.25);
  lerpTo(p.j.elbowR, 0, -0.25);
  p.hipsY += (Math.cos(phase * 2) * 0.012 - 0.01) * w;
}

/** Right arm pointing at a target: relYaw > 0 = target to the character's left. */
export function overlayPoint(p: Pose, relYaw: number, relPitch: number, w: number) {
  if (w <= 0) return;
  const s = p.j.shoulderR;
  const e = p.j.elbowR;
  const y = Math.max(-0.9, Math.min(0.9, relYaw));
  s[0] += (-1.5 - relPitch - s[0]) * w;
  s[1] += (0 - s[1]) * w;
  s[2] += (y * 0.9 - s[2]) * w;
  e[0] += (-0.1 - e[0]) * w;
  e[2] *= 1 - w;
}

/** Blend the rig toward the pose with exponential smoothing. */
export function applyPose(rig: AvatarRig, p: Pose, dt: number, rate = 8) {
  const k = 1 - Math.exp(-dt * rate);
  for (const n of JOINTS) {
    const obj = rig[n];
    const tgt = p.j[n];
    obj.rotation.x += (tgt[0] - obj.rotation.x) * k;
    obj.rotation.y += (tgt[1] - obj.rotation.y) * k;
    obj.rotation.z += (tgt[2] - obj.rotation.z) * k;
  }
  rig.hips.position.y += (p.hipsY - rig.hips.position.y) * k;
}
