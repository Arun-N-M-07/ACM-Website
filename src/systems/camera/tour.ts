/**
 * The team tour: a scroll-driven first-person walk through the workspace.
 *
 * Stops: the welcome at the commons, one per domain bay (in the loop order of
 * the bay slots), then the core. The camera walks a Catmull-Rom path between
 * stops at eye height — head leading into the turn, a light walking bob — and
 * at each stop turns to face the domain while its moment plays out.
 */
import { CatmullRomCurve3, Vector3 } from 'three';
import { TOUR_RANGE, TOUR_WEIGHTS } from '@/config/timeline';
import { EYE_HEIGHT, TEAM_HALL, TEAM_LAYOUT, teamToWorld, type BayLayout, type Vec3 } from '@/config/world';
import type { DomainId } from '@/content/domains';
import { aim, easeInOutSine, lerp, lerpAngle, makePose, smoothstep, type CameraPose } from './pose';

export interface TourStop {
  id: DomainId | 'core';
  view: Vec3;
  look: Vec3;
  bay?: BayLayout;
  /** Index of this stop's position in the path knots. */
  knot: number;
  fov: number;
}

function bayPoint(bay: BayLayout, x: number, z: number, y: number): Vec3 {
  const c = Math.cos(bay.rotationY);
  const s = Math.sin(bay.rotationY);
  return teamToWorld(bay.x + x * c + z * s, bay.z - x * s + z * c, y);
}

const knots: Vec3[] = [];
export const TOUR_STOPS: TourStop[] = [];

// The welcome, right where the push through the door leaves the visitor.
knots.push(teamToWorld(0, TEAM_HALL.spawnZ, EYE_HEIGHT));
TOUR_STOPS.push({ id: 'office', view: knots[0], look: teamToWorld(0, TEAM_HALL.commons.z - 1, 1.5), knot: 0, fov: 60 });

for (const bay of TEAM_LAYOUT.bays) {
  knots.push(bayPoint(bay, 0, 6.3, EYE_HEIGHT));
  TOUR_STOPS.push({ id: bay.domain.id, view: knots[knots.length - 1], look: bayPoint(bay, 0, -2.2, 1.55), bay, knot: knots.length - 1, fov: 60 });
}

// Into the core through its door.
knots.push(teamToWorld(0, TEAM_HALL.core.z + TEAM_HALL.core.radius + 4.5, EYE_HEIGHT));
// Inside, a few steps from the projection table, looking down at the hologram
// with it sitting right of centre (the ending's words go on the left).
knots.push(teamToWorld(0.3, TEAM_HALL.core.z + 3.8, EYE_HEIGHT + 1.15));
TOUR_STOPS.push({ id: 'core', view: knots[knots.length - 1], look: teamToWorld(-1.1, TEAM_HALL.core.z - 0.4, 1.2), knot: knots.length - 1, fov: 58 });

const path = new CatmullRomCurve3(
  knots.map((k) => new Vector3(...k)),
  false,
  'centripetal',
);
const lastKnot = knots.length - 1;

export const TOUR_START_POSE: CameraPose = (() => {
  const s = TOUR_STOPS[0];
  const { yaw, pitch } = aim(s.view, s.look);
  return makePose(s.view, yaw, pitch, s.fov);
})();

/** Fraction of each stop spent walking (the rest is the meeting). */
const WALK = 0.4;

export interface TourAt {
  /** Stop index (0 = welcome). */
  index: number;
  /** 0..1 walking in toward this stop (always 1 for the welcome). */
  walk: number;
  /** 0..1 through the meeting at this stop. */
  meet: number;
}

export function tourAt(p: number): TourAt {
  const u = Math.min(1, Math.max(0, (p - TOUR_RANGE.start) / (TOUR_RANGE.end - TOUR_RANGE.start)));
  const total = TOUR_WEIGHTS.reduce((a, b) => a + b, 0);
  let acc = 0;
  for (let k = 0; k < TOUR_WEIGHTS.length; k++) {
    const w = TOUR_WEIGHTS[k] / total;
    if (u <= acc + w || k === TOUR_WEIGHTS.length - 1) {
      const f = Math.min(1, Math.max(0, (u - acc) / w));
      if (k === 0) return { index: 0, walk: 1, meet: f };
      return { index: k, walk: Math.min(1, f / WALK), meet: f < WALK ? 0 : (f - WALK) / (1 - WALK) };
    }
    acc += w;
  }
  return { index: TOUR_STOPS.length - 1, walk: 1, meet: 1 };
}

/** Scroll progress at a stop, `meet` of the way through its meeting (the inverse of tourAt). */
export function tourProgress(index: number, meet = 0.02): number {
  const total = TOUR_WEIGHTS.reduce((a, b) => a + b, 0);
  const i = Math.max(0, Math.min(TOUR_WEIGHTS.length - 1, index));
  let acc = 0;
  for (let k = 0; k < i; k++) acc += TOUR_WEIGHTS[k];
  const f = i === 0 ? meet : WALK + (1 - WALK) * meet;
  return TOUR_RANGE.start + ((acc + TOUR_WEIGHTS[i] * f) / total) * (TOUR_RANGE.end - TOUR_RANGE.start);
}

/** Scroll progress `f` of the way through the walk into stop `index` (index ≥ 1). */
export function tourWalkProgress(index: number, f: number): number {
  const total = TOUR_WEIGHTS.reduce((a, b) => a + b, 0);
  const i = Math.max(1, Math.min(TOUR_WEIGHTS.length - 1, index));
  let acc = 0;
  for (let k = 0; k < i; k++) acc += TOUR_WEIGHTS[k];
  return TOUR_RANGE.start + ((acc + TOUR_WEIGHTS[i] * WALK * f) / total) * (TOUR_RANGE.end - TOUR_RANGE.start);
}

const _v = new Vector3();
const _t = new Vector3();

function stopAngles(s: TourStop) {
  return aim(s.view, s.look);
}

export function evaluateTour(p: number, out: CameraPose, bob = true): CameraPose {
  const { index, walk, meet } = tourAt(p);
  const cur = TOUR_STOPS[index];
  const curA = stopAngles(cur);

  if (walk >= 1) {
    // Meeting: lean in a touch toward the domain, then ease back.
    const lean = Math.sin(Math.PI * meet) * 0.35;
    const dx = cur.look[0] - cur.view[0];
    const dz = cur.look[2] - cur.view[2];
    const len = Math.hypot(dx, dz) || 1;
    out.x = cur.view[0] + (dx / len) * lean;
    out.y = cur.view[1];
    out.z = cur.view[2] + (dz / len) * lean;
    out.yaw = curA.yaw;
    out.pitch = curA.pitch;
    out.roll = 0;
    out.fov = cur.fov - Math.sin(Math.PI * meet) * 2;
    return out;
  }

  // Walking from the previous stop's knot to this one's.
  const prev = TOUR_STOPS[index - 1];
  const prevA = stopAngles(prev);
  const s = easeInOutSine(walk);
  const t = lerp(prev.knot, cur.knot, s) / lastKnot;
  path.getPoint(t, _v);
  path.getTangent(t, _t);
  const heading = Math.atan2(-_t.x, -_t.z);
  // Head: previous gaze → where we're walking → the next domain.
  const yaw = s < 0.5 ? lerpAngle(prevA.yaw, heading, smoothstep(0, 1, s * 2.2)) : lerpAngle(heading, curA.yaw, smoothstep(0, 1, (s - 0.5) * 2.2));
  const pitch = lerp(prevA.pitch, curA.pitch, s) - 0.04 * Math.sin(Math.PI * s);
  out.x = _v.x;
  out.y = _v.y;
  out.z = _v.z;
  out.yaw = yaw;
  out.pitch = pitch;
  out.roll = 0;
  out.fov = lerp(prev.fov, cur.fov, s);
  if (bob) {
    const dist = new Vector3(...prev.view).distanceTo(new Vector3(...cur.view));
    const steps = Math.max(2, Math.round(dist / 0.74));
    const gait = Math.sin(Math.PI * walk);
    // A light, even footfall — enough to feel like walking, never a jolt.
    out.y += (0.5 - 0.5 * Math.cos(2 * Math.PI * steps * s)) * 0.014 * gait - 0.008 * gait;
    out.roll = Math.sin(Math.PI * steps * s) * 0.0012 * gait;
  }
  return out;
}
