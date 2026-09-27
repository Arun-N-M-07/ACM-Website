/**
 * The prologue's staging: where it happens, and how its physical events run
 * as functions of the beat (so they scrub, stop and reverse with the scroll —
 * the camera's own damping gives them their inertia).
 *
 *   the ground   ten metres behind the story's first shot, on the road in
 *                the pre-dawn mist; the camera starts 18 cm above it
 *   the roll     a sealed canister comes rolling down the road towards the
 *                lens, out of the fog, already moving, slowing under its own
 *                friction —
 *                rolling, not thrown: its turn is its travel over its radius,
 *                with the small wobble and knocks of a real object on a real
 *                surface — and rocks to rest a few metres in front of the lens
 *   pressure     its seam wakes (a thin violet line), it trembles
 *   release      it vents from both ends: two jets along the ground, then a
 *                billow that spreads and rises, pushing the mist aside
 *   the words    the gas thickens into the shape of the chapter's years —
 *                formed in its own density (see GasVolume) — is readable for a
 *                moment, and loosens back into gas that mixes into the mist
 */
import { yearsActive } from '@/content/chapter';
import { clamp01, ease, span, T } from '../timeline';

/** The surface the prologue stands on: the road behind the garden (the canister rolls on it). */
export const GROUND_Y = 0.1;
/** The camera's line: x, and where it stands at first. */
export const PX = -7.4;
export const CAM_Z = 166.2;

/** The canister. */
export const CAN = { r: 0.06, length: 0.24 } as const;

/** Where it rolls in from (down the road, out of the fog), and where it comes to rest, a couple of metres from the lens. */
export const ROLL_FROM = { x: PX + 0.85, z: 151.2 } as const;
export const ROLL_TO = { x: PX + 0.18, z: 164.3 } as const;
const DX = ROLL_TO.x - ROLL_FROM.x;
const DZ = ROLL_TO.z - ROLL_FROM.z;
export const ROLL_LENGTH = Math.hypot(DX, DZ);
/** Unit direction of travel, and the axle (the canister's own axis, across the travel). */
export const ROLL_DIR = { x: DX / ROLL_LENGTH, z: DZ / ROLL_LENGTH } as const;
export const ROLL_AXLE = { x: -ROLL_DIR.z, z: ROLL_DIR.x } as const;

/** The words, and the plane they form in (world). */
export const WORDS = `${yearsActive()} YEARS AGO`;
export const LETTERS = { x: PX + 0.1, y: 1.35, z: 160.2 } as const;

export interface RollState {
  /** Metres travelled along the path. */
  s: number;
  /** Speed (m per beat) — for the wobble, the knocks and the sound. */
  v: number;
  /** Turn about the axle (rad). */
  angle: number;
  /** Where it is (world). */
  x: number;
  z: number;
  /** Lift off the ground (m): the small knocks over the surface. */
  lift: number;
  /** Tilt of the axle out of level (rad) and yaw about the vertical (rad): the wobble. */
  tilt: number;
  yaw: number;
  /** 0 → 1: it has entered the frame (and the fog lets it be seen). */
  seen: number;
}

/** Distance along the path at beat t: already moving as it enters, slowing to rest, a small rock back and settle. */
function travelled(t: number) {
  const u = span(t, T.roll, T.rest);
  // Constant friction: speed falls linearly to nothing.
  const s = ROLL_LENGTH * (1 - (1 - u) * (1 - u));
  // It stops a hair past its rest and rocks back once, then is still.
  const r = span(t, T.rest - 0.9, T.rest + 1.6);
  const rock = r > 0 && r < 1 ? Math.sin(r * Math.PI * 2) * Math.exp(-r * 3.2) * 0.028 : 0;
  return s + rock;
}

/** The canister at beat t. */
export function rollAt(t: number, out: RollState): RollState {
  const s = travelled(t);
  const v = (travelled(t + 0.05) - travelled(t - 0.05)) / 0.1;
  const vn = Math.min(1, Math.abs(v) / ((2 * ROLL_LENGTH) / (T.rest - T.roll)));
  out.s = s;
  out.v = v;
  // Rolling without slipping: the turn is the travel over the radius.
  out.angle = s / CAN.r;
  out.x = ROLL_FROM.x + ROLL_DIR.x * s;
  out.z = ROLL_FROM.z + ROLL_DIR.z * s;
  // Knocks: now and then a small lift over the surface, more when it is quick.
  const k = Math.max(0, Math.sin(s * 7.3 + 1.1)) ** 10 + 0.6 * Math.max(0, Math.sin(s * 3.1 + 2.4)) ** 14;
  out.lift = 0.0045 * k * vn;
  // Wobble: it is not a perfect cylinder — the axle nods and swings a little, less as it slows.
  out.tilt = (Math.sin(out.angle * 0.5 + 0.7) * 0.035 + Math.sin(s * 1.9) * 0.012) * (0.25 + 0.75 * vn);
  out.yaw = Math.sin(s * 1.27 + 0.4) * 0.05 * vn;
  out.seen = ease(t, T.roll, T.roll + 2);
  return out;
}

/** 0 → 1 → 0: the pressure before the release (the seam's light, the tremble). */
export const pressureAt = (t: number) => ease(t, T.pressure, T.release - 0.2) * (1 - ease(t, T.release + 0.3, T.release + 3));
/** Beats since the release (negative before it). */
export const sinceRelease = (t: number) => t - T.release;
/** How far the gas has spread (m): fast at first, slowing as the pressure is spent. */
export const gasRadius = (t: number) => {
  const a = sinceRelease(t);
  return a <= 0 ? 0 : 3.3 * (1 - Math.exp(-a / 1.7));
};
/** How much gas there is (0..1): released, then thinning into the mist. */
export const gasAmount = (t: number) => ease(t, T.release, T.release + 0.5) * (1 - 0.85 * ease(t, T.dissolve, T.mixed + 1)) * (1 - ease(t, T.mixed, T.story1 + 1));
/**
 * The words: how formed they are (0 → 1, from the first word to the last),
 * and how far they have come apart again (0 → 1).
 */
export const formAt = (t: number) => clamp01((t - T.form) / (T.legible - 0.6 - T.form));
export const dissolveAt = (t: number) => ease(t, T.dissolve, T.mixed);
/** How much of the prologue is to be drawn at all. */
export const prologueOn = (t: number) => t < T.story1 + 1;
