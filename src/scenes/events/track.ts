/**
 * The Events' camera: a pure function of scroll progress (and the screen's
 * shape, and which event the room part of the track shows), so it plays the
 * same forwards and backwards and stops where the scroll stops.
 *
 *   arrival   from the lobby's door across the hall until the whole matrix stands
 *             in the picture — short: going on from the doorway at its pace
 *   hub       the whole matrix, still (the pointer leans it: controller.ts)
 *   enter     the room's threshold, crossed by the scroll — and then the
 *             room's own entry plays (controller.ts: its clock): towards the
 *             chosen bay, then straight in through its frame — one curve,
 *             never a stop half-way, the lens opening as the frame passes
 *   room      inside: a slow step further in with the installation (its clock)
 *   unfold…   held there while the room gives way to its record
 *   rejoin    the whole matrix again
 *
 * Every room is framed as it was built to be seen (its viewpoint at the
 * threshold, looking in at the back wall), at the scale it stands at in its
 * bay: the camera goes into the room as it is. Every pose here is composed for
 * the screen's shape — a tall screen's room with the wide lens the camera rig
 * gives every interior — so the rig's own widening stays out of the Events
 * (bar the arrival's first steps, from the lobby's door).
 */
import { CAMERA_STATES as S } from '@/config/camera';
import { EVENTS_TRACK as K, EVENTS_VH, eventsAt } from '@/config/timeline';
import { eventsFrame } from './state';
import { introCameraAt } from '@/intro/camera';
import { INTRO_VH_PER_BEAT, T } from '@/intro/timeline';
import { EVENT_ROOMS, EVENTS_HALL, EYE_HEIGHT, FLOOR_Y, MATRIX, type RoomLayout } from '@/config/world';
import { clamp01, copyPose, easeInOutSine, emptyPose, lerpPose, lookPose, smoothstep, type CameraPose } from '@/systems/camera/pose';

const tanHalf = (fov: number) => Math.tan((fov * Math.PI) / 360);

/** The seams (controller.ts): where the hub's scroll goes on — past the room part — from the rejoin. */
export const HUB_SEAM = eventsAt('hub', 0.55);
export const REJOIN_SEAM = eventsAt('rejoin', 0.5);
/** The whole matrix, where the index and "back to full view" stand. */
export const HUB_REST = eventsAt('hub', 0.3);

// ─── The whole matrix ────────────────────────────────────────────────────────

const LOOK_Y = FLOOR_Y + MATRIX.height / 2 + 0.25;
const EYE = FLOOR_Y + 3.9;
/** Half the height framed, and half the width (a tall screen: the matrix and a hand's breadth). */
const HALF_H = MATRIX.height / 2 + 2.6;
const HALF_W = MATRIX.width / 2 + 3.4;
const HALF_W_TALL = MATRIX.width / 2 + 0.45;

/** The furthest the whole matrix is framed from: inside the hall, short of the lobby's passage. */
const HUB_ROOM = EVENTS_HALL.south - 0.6 - MATRIX.face;

/**
 * The whole matrix (a tall screen with a wider lens) — from no further back than the hall allows: a
 * screen that would need to stand further off takes it in with a wider lens instead.
 */
export function hubPose(aspect: number, out: CameraPose) {
  let fov = aspect >= 1 ? 40 : 60 - 16 * clamp01((aspect - 0.45) / 0.5);
  const halfW = aspect < 1 ? HALF_W_TALL : HALF_W;
  const fit = (f: number) => Math.max(HALF_H / tanHalf(f), halfW / (tanHalf(f) * aspect));
  let d = fit(fov);
  if (d > HUB_ROOM) {
    const t = Math.max(HALF_H / HUB_ROOM, halfW / (HUB_ROOM * aspect));
    fov = (2 * Math.atan(t) * 180) / Math.PI;
    d = fit(fov);
  }
  return copyPose(lookPose([0, EYE, MATRIX.face + d], [0, LOOK_Y, MATRIX.face], fov), out);
}

// ─── A bay, and its room ─────────────────────────────────────────────────────

/**
 * A tall screen's lens for an interior, as the camera rig opens it for every other interior (roughly
 * a landscape screen's horizontal coverage), and the step back that goes with it (m, as built) —
 * composed into the Events' own poses, so the lens opens along the way into a room, never at once.
 */
export function tallLens(fov: number, aspect: number) {
  if (aspect >= 1) return fov;
  const widen = Math.min(2.1, 1 + (1 / aspect - 1) * 0.9);
  return Math.min(110, (2 * Math.atan(Math.tan((fov * Math.PI) / 360) * widen) * 180) / Math.PI);
}
const tallBack = (aspect: number) => (aspect >= 1 ? 0 : Math.min(2, (1 / aspect - 1) * 1.6));

/** Before bay i: the bay filling the picture with its frame round it, looking straight in. */
export function bayPose(r: RoomLayout, aspect: number, out: CameraPose) {
  // (A tall screen already on its way to a room's wider lens.)
  const fov = aspect >= 1 ? 44 : 44 + (tallLens(62, aspect) - 62) * 0.55;
  const t = tanHalf(fov);
  const halfW = MATRIX.bay.w / 2 + MATRIX.mullion;
  const halfH = MATRIX.bay.h / 2 + MATRIX.transom;
  const d = Math.max(halfH / t, halfW / (t * aspect));
  const cy = FLOOR_Y + r.baySill + MATRIX.bay.h / 2;
  return copyPose(lookPose([r.bayX, cy, MATRIX.face + d], [r.bayX, cy - 0.05, MATRIX.face - 4], fov), out);
}

/** A point in room r's own frame (as built: its floor's centre, its opening towards +z), in the world. */
function roomPoint(r: RoomLayout, x: number, y: number, z: number): [number, number, number] {
  return [r.center[0] + x * r.scale, r.center[1] + y * r.scale, r.center[2] + z * r.scale];
}

/** How far a reading steps into the room (m, as built), and the lens closing a little with it. */
const PUSH_IN = 1.5;

/**
 * In room r, at its threshold looking in at the back wall — as its installation was built to be
 * seen — `push` of the way through the slow step further in.
 */
export function roomPose(r: RoomLayout, push: number, aspect: number, out: CameraPose) {
  const flag = !!r.event.flagship;
  const eye = EYE_HEIGHT + (flag ? 0.2 : 0);
  const k = easeInOutSine(clamp01(push));
  const from = roomPoint(r, 0, eye, r.depth / 2 + 0.4 + tallBack(aspect) - PUSH_IN * k);
  const to = roomPoint(r, 0, EYE_HEIGHT + (flag ? 0.45 : -0.05), -r.depth / 2);
  return copyPose(lookPose(from, to, tallLens(flag ? 66 : 62, aspect) - 3 * k), out);
}

// ─── Along the track ─────────────────────────────────────────────────────────

const _a = emptyPose();
const _b = emptyPose();
const _c = emptyPose();
const _d = emptyPose();

/** A quadratic Bézier through a control pose: one curve, its velocity never zero on the way. */
function curve(a: CameraPose, c: CameraPose, b: CameraPose, t: number, out: CameraPose) {
  const q = (x: number, y: number, z: number) => (1 - t) * (1 - t) * x + 2 * (1 - t) * t * y + t * t * z;
  out.x = q(a.x, c.x, b.x);
  out.y = q(a.y, c.y, b.y);
  out.z = q(a.z, c.z, b.z);
  out.yaw = q(a.yaw, c.yaw, b.yaw);
  out.pitch = q(a.pitch, c.pitch, b.pitch);
  out.roll = 0;
  out.fov = q(a.fov, c.fov, b.fov);
  return out;
}

const part = (p: number, r: { start: number; end: number }) => clamp01((p - r.start) / (r.end - r.start));

/**
 * The arrival's pace (0..1 → 0..1): it leaves the door at the speed the opening's camera comes through
 * the doorway at its end, and comes to rest before the matrix — a cubic with that slope at its start
 * and none at its end.
 */
const ARRIVAL_M = (() => {
  const doorway = (introCameraAt(T.end - 0.5).pos.z - introCameraAt(T.end).pos.z) / (0.5 * INTRO_VH_PER_BEAT); // m per vh
  const run = S.facilityEnd.z - hubPose(16 / 9, emptyPose()).z; // m
  return Math.max(0, Math.min(1.5, (doorway * EVENTS_VH.arrival) / run));
})();
const arrivalEase = (u: number) => (u * u * u - 2 * u * u + u) * ARRIVAL_M + (3 - 2 * u) * u * u;

export interface EventsShot {
  /** How far the pose is composed for the screen's shape (1: the rig's generic widening stays out). */
  composed: number;
  /** The scale of the space the camera is in (1 the hall; a room's own inside it). */
  scale: number;
}

/**
 * The camera along the Events segment, with room `index` in its room part (-1: none chosen — the
 * first stands in, though the track keeps the scroll out of that part then: controller.ts).
 */
export function eventsCamera(p: number, index: number, aspect: number, out: CameraPose, shot: EventsShot) {
  shot.composed = 1;
  shot.scale = 1;
  // Where the scroll has the camera: from the lobby's door (the opening's last pose — not composed)
  // across the hall — going on at the pace it came through the doorway, settling before the matrix —
  // and then the whole matrix.
  const base = _d;
  if (p < K.arrival.end) {
    const a = arrivalEase(part(p, K.arrival));
    lerpPose(S.facilityEnd, hubPose(aspect, _b), a, base);
    shot.composed = a;
  } else hubPose(aspect, base);
  // A room's choreography takes the camera on from there — not the scroll: its entry (in through the
  // bay, at its own pace, once the scroll is across the room's threshold: controller.ts) and, inside,
  // its slow step in with the installation. (Played back, it returns to wherever the scroll has the
  // camera now.)
  const e = eventsFrame.view.enter;
  if (index < 0 || e <= 0) return copyPose(base, out);
  shot.composed = 1;
  const r = EVENT_ROOMS[index];
  const step = eventsFrame.view.room;
  if (e < 1) {
    // Towards the bay and in through its frame: one curve (hub → the bay, as control → the threshold).
    const t = easeInOutSine(e);
    curve(base, bayPose(r, aspect, _c), roomPose(r, step, aspect, _b), t, out);
    shot.scale = 1 + (r.scale - 1) * smoothstep(0.5, 0.95, t);
    return out;
  }
  // Inside: the slow step in while the installation plays, then held while the record unfolds.
  shot.scale = r.scale;
  return roomPose(r, step, aspect, out);
}
