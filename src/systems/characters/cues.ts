/**
 * Choreography cues. Each domain's set decides, every frame, what its people
 * are doing as a pure function of scroll (so it scrubs forwards and backwards
 * cleanly), and writes a Cue per member. NPCs read their cue; members with no
 * cue this frame simply work, glancing up if the visitor passes close by.
 */
import { Vector3 } from 'three';
import type { Activity } from '@/content/avatar';

export interface Cue {
  /** Turn head/torso toward the visitor (0..1). */
  look: number;
  /** Turn the whole body toward the visitor (0..1). */
  turn: number;
  wave: number;
  /** Right hand extended for a handshake, and pumping. */
  extend: number;
  pump: number;
  /** Right arm pointing at `pointAt`. */
  point: number;
  pointAt: Vector3 | null;
  /** Rise from a seated activity. */
  stand: number;
  talk: number;
  /** Override standing position (world x/z) — the NPC walks there. */
  pos: { x: number; z: number } | null;
  /** Override facing (world yaw). */
  yaw: number | null;
  /** Replace the base activity. */
  activity: Activity | null;
}

export function blankCue(): Cue {
  return { look: 0, turn: 0, wave: 0, extend: 0, pump: 0, point: 0, pointAt: null, stand: 0, talk: 0, pos: null, yaw: null, activity: null };
}

/** Cues written this frame, keyed by member id. */
export const cues = new Map<string, Cue>();

/** Where the tour is, updated by the camera rig each frame. */
export const tour = { index: -1, walk: 0, meet: 0, inTeam: false };

/**
 * The camera can be asked to look at something (the Chairperson during the
 * handshake, the laptop in the CP Wing) and, optionally, to move its eye to a
 * new spot while doing so (leaning over a shoulder, taking a seat). `zoom`
 * narrows the FOV by that many degrees at full weight. `owner` is the tour
 * stop that set it; the weight is a pure function of scroll, so it scrubs.
 */
export const cameraFocus = { weight: 0, target: new Vector3(), zoom: 0, owner: -1, eye: new Vector3(), hasEye: false };

export function focusOn(owner: number, target: Vector3, weight: number, zoom = 0, eye?: Vector3) {
  cameraFocus.owner = owner;
  cameraFocus.target.copy(target);
  cameraFocus.weight = weight;
  cameraFocus.zoom = zoom;
  cameraFocus.hasEye = !!eye;
  if (eye) cameraFocus.eye.copy(eye);
}

export function releaseFocus(owner: number) {
  if (cameraFocus.owner === owner) {
    cameraFocus.weight = 0;
    cameraFocus.zoom = 0;
    cameraFocus.owner = -1;
    cameraFocus.hasEye = false;
  }
}

/** The visitor's own hand during the welcome handshake. */
export const handshake = { weight: 0, pump: 0, member: '' };

/** Smooth 0→1 window helper: rises over [a, a+ramp], falls over [b-ramp, b]. */
export function window01(u: number, a: number, b: number, ramp = 0.06) {
  if (u <= a || u >= b) return 0;
  return Math.min(1, (u - a) / ramp, (b - u) / ramp);
}

export const ramp01 = (u: number, a: number, b: number) => Math.min(1, Math.max(0, (u - a) / (b - a)));
