/**
 * Cinematic shots: a pure, deterministic function from scroll progress to a
 * camera pose. Each segment's first pose equals the previous segment's last
 * pose, so the whole journey is one continuous move. The journey opens at the
 * corridor mouth — where the opening cinematic (src/intro) hands over.
 */
import { CAMERA_STATES as S } from '@/config/camera';
import { EVENT_STATION_WEIGHTS, PORTAL_DWELL, PORTAL_GATE, SEGMENTS, segmentAt, segmentProgress, progressForRoom } from '@/config/timeline';
import { teamsStops } from '@/teams/layout';
import { CORRIDOR, EYE_Y } from '@/config/world';
import {
  angleDelta,
  copyPose,
  easeInOutSine,
  emptyPose,
  lerpPose,
  lookPose,
  makePose,
  sampleTrack,
  type CameraPose,
  type PoseKey,
} from './pose';

/** Fraction of each event station spent travelling (the rest is the dwell). */
const TRAVEL = 0.52;

const corridorEntry = makePose([0, EYE_Y, CORRIDOR.start + 1], 0, 0, 54);
export const STATION_POSES: CameraPose[] = CORRIDOR.rooms.map((r) => lookPose(r.viewpoint, r.focus, r.event.flagship ? 66 : 62));
const lastStation = STATION_POSES[STATION_POSES.length - 1] ?? corridorEntry;

// Out of the last room, down the vestibule, and stand square on to the portal
// (from PORTAL_DWELL on, the camera holds there: the hold zone).
const portalKeys: PoseKey[] = [
  { t: 0, pose: lastStation },
  { t: PORTAL_DWELL * 0.55, pose: S.portalApproach, ease: easeInOutSine },
  { t: PORTAL_DWELL, pose: S.portalStand, ease: easeInOutSine },
  { t: 1, pose: S.portalStand },
];

/** Progress range of a room's dwell (when the camera is looking into it). */
export function roomDwellRange(index: number): [number, number] {
  const w = EVENT_STATION_WEIGHTS;
  let acc = 0;
  for (let k = 0; k <= index; k++) acc += w[k];
  const width = w[index + 1];
  const s = SEGMENTS.events;
  return [s.start + (s.end - s.start) * (acc + width * TRAVEL), s.start + (s.end - s.start) * (acc + width)];
}

/** Where along the events segment we are: which station, and how far into its dwell. */
export function eventStationAt(p: number): { index: number; travel: number; dwell: number } {
  const u = segmentProgress(p, 'events');
  let acc = 0;
  const w = EVENT_STATION_WEIGHTS;
  for (let k = 0; k < w.length; k++) {
    if (u <= acc + w[k] || k === w.length - 1) {
      const f = Math.min(1, Math.max(0, (u - acc) / w[k]));
      if (k === 0) return { index: -1, travel: f, dwell: 0 };
      return { index: k - 1, travel: Math.min(1, f / TRAVEL), dwell: f < TRAVEL ? 0 : (f - TRAVEL) / (1 - TRAVEL) };
    }
    acc += w[k];
  }
  return { index: -1, travel: 0, dwell: 0 };
}

const _mid = emptyPose();

/**
 * Between rooms the camera backs out through one portal, turns down the
 * corridor and steps in through the next: position and heading both follow a
 * quadratic Bézier through a corridor waypoint, so the move never stops or
 * cuts a corner through a wall.
 */
function travel(prev: CameraPose, cur: CameraPose, t: number, out: CameraPose) {
  const m = _mid;
  m.x = 0;
  m.y = EYE_Y;
  m.z = (prev.z + cur.z) / 2;
  m.yaw = 0;
  m.pitch = 0;
  m.roll = 0;
  m.fov = 56;
  const q = (a: number, b: number, c: number) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
  out.x = q(prev.x, m.x, cur.x);
  out.y = q(prev.y, m.y, cur.y);
  out.z = q(prev.z, m.z, cur.z);
  const ma = prev.yaw + angleDelta(prev.yaw, m.yaw);
  const ca = ma + angleDelta(ma, cur.yaw);
  out.yaw = q(prev.yaw, ma, ca);
  out.pitch = q(prev.pitch, m.pitch, cur.pitch);
  out.roll = 0;
  out.fov = q(prev.fov, m.fov, cur.fov);
  return out;
}

function evaluateEvents(p: number, out: CameraPose) {
  const { index, travel: tr, dwell } = eventStationAt(p);
  if (index < 0) return lerpPose(S.facilityEnd, corridorEntry, easeInOutSine(tr), out);
  const prev = index === 0 ? corridorEntry : STATION_POSES[index - 1];
  const cur = STATION_POSES[index];
  if (dwell <= 0) return index === 0 ? lerpPose(prev, cur, easeInOutSine(tr), out) : travel(prev, cur, easeInOutSine(tr), out);
  // Inside the room: a slow step further in while it performs, then back to
  // the threshold so the next move starts exactly from the station pose.
  copyPose(cur, out);
  const room = CORRIDOR.rooms[index];
  const lean = Math.sin(Math.PI * dwell);
  const dx = room.focus[0] - room.viewpoint[0];
  const dz = room.focus[2] - room.viewpoint[2];
  const len = Math.hypot(dx, dz) || 1;
  out.x += (dx / len) * lean * 1.5;
  out.z += (dz / len) * lean * 1.5;
  out.fov = cur.fov - lean * 3;
  return out;
}

/** Evaluate the cinematic camera for scroll progress `p` (0..1). */
export function evaluateCinematic(p: number, out: CameraPose): CameraPose {
  const seg = segmentAt(p);
  const u = segmentProgress(p, seg);
  switch (seg) {
    case 'events':
      return evaluateEvents(p, out);
    case 'portal':
      return sampleTrack(portalKeys, u, out);
    case 'teams':
      // Only reachable through the portal (the Teams camera takes over there);
      // outside it, the gate keeps you standing before the ring.
      return copyPose(S.portalStand, out);
  }
}

// ─── Values other systems derive from the same timeline ────────────────────────

/**
 * Reduced-motion "stills": the camera cuts between these instead of flying.
 * Each is a progress value whose pose frames a chapter well.
 */
export const REDUCED_MOTION_STOPS: number[] = [
  SEGMENTS.events.start,
  ...CORRIDOR.rooms.map((_, i) => progressForRoom(i)),
  PORTAL_GATE - 0.0002,
  // Inside the Teams world (the gate keeps these out of reach until the portal is entered).
  ...teamsStops(),
];

export function nearestStop(p: number) {
  let best = REDUCED_MOTION_STOPS[0];
  let bestD = Infinity;
  for (const s of REDUCED_MOTION_STOPS) {
    const d = Math.abs(s - p);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}
