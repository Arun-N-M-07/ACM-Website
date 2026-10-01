/**
 * Cinematic shots: a pure, deterministic function from scroll progress to a
 * camera pose. Each segment's first pose equals the previous segment's last
 * pose, so the whole journey is one continuous move. The opening's segments
 * are shot by src/intro/camera.ts (its last pose is `facilityEnd`, where the
 * Events segment begins); the Events' by scenes/events/track.
 */
import { CAMERA_STATES as S } from '@/config/camera';
import { EVENTS_TRACK, PORTAL_DWELL, PORTAL_GATE, PORTAL_SPLIT, eventsAt, segmentAt, segmentProgress } from '@/config/timeline';
import { progressAtIntroTime } from '@/intro/controller';
import { STILLS } from '@/intro/timeline';
import { RECORD_STILL, recordWall } from '@/scenes/events/controller';
import { eventsState } from '@/scenes/events/state';
import { eventsCamera, HUB_REST, hubPose, type EventsShot } from '@/scenes/events/track';
import { teamsStops } from '@/teams/layout';
import { copyPose, easeInOutSine, emptyPose, sampleTrack, smoothstep, type CameraPose, type PoseKey } from './pose';

/**
 * What the last evaluated shot asks of the camera rig: how far it is composed for the screen's shape
 * (1: the rig's generic widening for tall screens stays out of it), and the scale of the space the
 * camera is in (1 the hall; a room's own inside it — the rig's small motions are scaled with it).
 */
export const cinematic = { composed: 0, scale: 1 };
const eventsShot: EventsShot = { composed: 0, scale: 1 };

// The matrix opening onto the portal (from the whole matrix), down the passage, and stand square on to
// it (from PORTAL_DWELL on, the camera holds there: the hold zone).
const _hub = emptyPose();
const _near = emptyPose();
const APPROACH_AT = PORTAL_SPLIT + (PORTAL_DWELL - PORTAL_SPLIT) * 0.5;
const portalKeys: PoseKey[] = [
  { t: 0, pose: _hub },
  // While the columns part: a step towards the opening, down a little.
  { t: PORTAL_SPLIT * 0.85, pose: _near, ease: easeInOutSine },
  { t: APPROACH_AT, pose: S.portalApproach, ease: easeInOutSine },
  { t: PORTAL_DWELL, pose: S.portalStand, ease: easeInOutSine },
  { t: 1, pose: S.portalStand },
];

/** Up across [a, b] and back down across [c, d]. */
const swell = (x: number, a: number, b: number, c: number, d: number) => smoothstep(a, b, x) * (1 - smoothstep(c, d, x));

function evaluatePortal(u: number, aspect: number, out: CameraPose) {
  hubPose(aspect, _hub);
  copyPose(_hub, _near);
  _near.z -= Math.min(3.5, (_hub.z - S.portalApproach.z) * 0.2);
  _near.y -= 0.6;
  sampleTrack(portalKeys, u, out);
  // The columns coming home — the outer ones into the wall, the middle one into the floor: the
  // smallest settling of the picture as each does (EventsHall: splitOffsets).
  const k = u / PORTAL_SPLIT;
  out.y -= 0.018 * swell(k, 0.55, 0.61, 0.61, 0.7) + 0.026 * swell(k, 0.93, 0.99, 0.99, 1.08);
  cinematic.composed = 1 - smoothstep(PORTAL_SPLIT * 0.85, APPROACH_AT, u);
  cinematic.scale = 1;
  return out;
}

/** Evaluate the cinematic camera for scroll progress `p` (0..1), for a screen of this shape. */
export function evaluateCinematic(p: number, out: CameraPose, aspect = 16 / 9): CameraPose {
  const seg = segmentAt(p);
  const u = segmentProgress(p, seg);
  cinematic.composed = 0;
  cinematic.scale = 1;
  switch (seg) {
    case 'events':
      eventsCamera(p, eventsState().selected, aspect, out, eventsShot);
      cinematic.composed = eventsShot.composed;
      cinematic.scale = eventsShot.scale;
      return out;
    case 'portal':
      return evaluatePortal(u, aspect, out);
    case 'teams':
      // Only reachable through the portal (the Teams camera takes over there);
      // outside it, the gate keeps you standing before the ring.
      return copyPose(S.portalStand, out);
    default:
      // The opening (its own camera — src/intro/camera.ts — shoots it).
      return copyPose(S.facilityEnd, out);
  }
}

// ─── Values other systems derive from the same timeline ────────────────────────

/**
 * Reduced-motion "stills": the camera cuts between these instead of flying.
 * Each is a progress value whose pose frames a chapter well. (In the Events, the
 * room part's stills are a visited event's — its room played, its record's first
 * screen, and (the scroll moving it) the choice at its end — and are only stills
 * while one is visited: activeStops.)
 */
const ROOM_STILLS = [eventsAt('room', 1), RECORD_STILL];
export const REDUCED_MOTION_STOPS: number[] = [
  // The opening's framed stills.
  ...STILLS.map(progressAtIntroTime),
  HUB_REST,
  ...ROOM_STILLS,
  PORTAL_GATE - 0.0002,
  // Inside the Teams world (the gate keeps these out of reach until the portal is entered).
  ...teamsStops(),
].sort((a, b) => a - b);

/** The stills there are now: a visited event's (and none past its end), or none of its. */
export function activeStops() {
  if (!eventsState().visiting) return REDUCED_MOTION_STOPS.filter((s) => !ROOM_STILLS.includes(s));
  const stops = REDUCED_MOTION_STOPS.filter((s) => s <= EVENTS_TRACK.branch.end);
  // (Its record's end, where the choice is — as far on as the record is long: reduced motion's record
  // scrolls itself, and ends at its first screen.)
  const end = recordWall();
  return end > RECORD_STILL + 1e-6 ? [...stops, end] : stops;
}

export function nearestStop(p: number) {
  const stops = activeStops();
  let best = stops[0];
  let bestD = Infinity;
  for (const s of stops) {
    const d = Math.abs(s - p);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}
