/**
 * IMPACT_CAMERA: the push through the door into the team workspace.
 *
 *   rush     accelerate hard through the doorway, FOV opens up, image smears
 *   impact   sudden stop: a jolt, a dip of the head, a small roll
 *   recover  shake decays, the horizon levels, FOV settles to first-person
 *
 * A pure function of normalised time so it's deterministic and testable.
 * Amplitudes are deliberately small — physical, not nauseating.
 */
import { IMPACT } from '@/config/camera';
import { TOUR_START_POSE } from './tour';
import { easeInCubic, easeInOutSine, easeOutCubic, lerp, lerpPose, type CameraPose } from './pose';

/** Smooth deterministic noise from a few incommensurate sines. */
const n1 = (t: number) => Math.sin(t * 37.1) * 0.5 + Math.sin(t * 61.7 + 1.3) * 0.3 + Math.sin(t * 17.3 + 2.1) * 0.2;
const n2 = (t: number) => Math.sin(t * 43.9 + 0.7) * 0.5 + Math.sin(t * 71.3 + 2.9) * 0.3 + Math.sin(t * 23.1 + 0.2) * 0.2;

export interface ImpactFx {
  blur: number;
  vignette: number;
  /** True exactly once, when the jolt lands (for sound). */
  landed: boolean;
}

export function evaluateImpact(t: number, from: CameraPose, out: CameraPose, reduced: boolean): ImpactFx {
  const to = TOUR_START_POSE;
  const r = IMPACT.rush;

  if (t < r) {
    // Rush: cover 88% of the distance, accelerating.
    const u = easeInCubic(t / r);
    lerpPose(from, to, u * 0.88, out);
    out.pitch = lerp(from.pitch, 0, u);
    out.fov = from.fov + IMPACT.fovPunch * u;
    return { blur: IMPACT.blurPx * Math.pow(t / r, 3), vignette: 0.6 * (t / r), landed: false };
  }

  // Impact + recovery.
  const u = (t - r) / (1 - r);
  const settle = easeOutCubic(Math.min(1, u * 2.2));
  lerpPose(from, to, 0.88 + 0.12 * settle, out);
  const decay = Math.exp(-u * 5.5);
  const amp = reduced ? 0 : IMPACT.shakeAmplitude * decay;
  out.x += n1(u * 3) * amp;
  out.y += n2(u * 3) * amp * 0.7 - (reduced ? 0 : 0.05 * Math.sin(Math.min(1, u * 1.6) * Math.PI));
  out.roll = (reduced ? 0 : IMPACT.shakeRoll) * decay * Math.sin(u * 14 + 0.6);
  // Head dips on the stop, then comes back up to level.
  const dip = Math.sin(Math.min(1, u * 1.35) * Math.PI) * (1 - easeInOutSine(Math.min(1, u)));
  out.pitch = to.pitch + (reduced ? 0 : IMPACT.pitchDip) * dip;
  out.yaw = to.yaw + (reduced ? 0 : 0.03 * decay * n2(u * 2));
  out.fov = lerp(from.fov + IMPACT.fovPunch, to.fov, easeOutCubic(Math.min(1, u * 1.8)));
  return {
    blur: IMPACT.blurPx * Math.exp(-u * 9),
    vignette: 0.6 * Math.exp(-u * 3),
    landed: u > 0 && u < 0.06,
  };
}
