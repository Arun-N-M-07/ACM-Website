/**
 * How a sheet arrives — the one account of it, for its picture (Parchment)
 * and its sound (SoundDirector). Every value is a function of the arrival's
 * progress `a` (0 → 1: how far the scroll is through the fragment's `arrive`
 * beats), so the arrival stops, scrubs and plays backwards with the scroll.
 *
 *   the flight   found in the air: it is first a shape far off in the smog,
 *                to one side of the way ahead — the first sheet to the left,
 *                the next to the right, and so on (its `side`) — then it is
 *                carried towards you on the air, on a swooping curve: it
 *                dips, comes across a touch past its place, and back;
 *                slowing as it comes (Parchment: its edge, then its fibres,
 *                resolve out of the smog on the way — discovered, not dealt)
 *   the flutter  pitching and banking as it comes, less as it slows (each
 *                pitch is a flap of the sheet in the air — heard, too)
 *   the turn     edgewise into the air in flight; slowing, it turns to face
 *                you (a spring: a touch past square, and back)
 *   the roll     it travels rolled up at its leading edge, like a scroll; as
 *                it slows the roll runs out ahead of it — slowly at first,
 *                faster — and snaps flat in front of you; the edge springs
 *                back a little and settles
 *
 * All offsets are in the camera frame of the moment (x right, y up, z
 * forward, metres), relative to where the sheet comes to rest.
 */
import { clamp01 } from '../timeline';

/** The share of the arrival spent flying in (the rest: the turn, the unfurling, the settle). */
export const FLY = 0.66;
/** Pitch half-cycles in flight: one flap of the sheet each. */
export const FLAPS = 5;
/** How much of the sheet's width is rolled up in flight. */
const ROLLED = 0.72;
/** The unfurling: begins, and snaps flat. */
const UNROLL: [number, number] = [0.38, 0.8];

/** A damped spring from 0 to 1 (starts at rest, overshoots, settles). */
const damped = (k: number, w: number) => (u: number) => {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  return 1 - Math.exp(-k * u) * (Math.cos(w * u) + (k / w) * Math.sin(w * u));
};
/** The turn to face you: a lively spring (~7% past square, and back). */
const spring = damped(6.2, 7.4);

const bez3 = (p0: number, p1: number, p2: number, p3: number, s: number) => {
  const r = 1 - s;
  return r * r * r * p0 + 3 * r * r * s * p1 + 3 * r * s * s * p2 + s * s * s * p3;
};

/** The flight's own progress (0 → 1 over the first FLY of the arrival). */
export const flyAt = (a: number) => clamp01(a / FLY);
/** How far along its path it is: a gust — fast, then slowing. */
export const travelAt = (a: number) => 1 - Math.pow(1 - flyAt(a), 1.8);
/** How hard it flutters (1 → 0 as it slows). */
export const flutterAt = (a: number) => Math.pow(1 - flyAt(a), 1.4);
/** How far it has turned to face you (0 edgewise → 1 square, with a small overshoot). */
export const faceAt = (a: number) => spring((a - 0.3) / 0.5);
/** Its pitch in the air (rad): the flaps. */
export const pitchAt = (a: number, seed: number) => 0.34 * Math.sin(flyAt(a) * Math.PI * FLAPS + seed) * flutterAt(a);
/** Which flap it is on (for the sound: a new one each half-cycle of the pitch). */
export const flapIndex = (a: number, seed: number) => Math.floor(flyAt(a) * FLAPS + seed / Math.PI);
/** Its bank in the air (rad), for a sheet from `side`: rolling into the swoop. */
export const bankAt = (a: number, side: number) => side * (0.45 * Math.sin(flyAt(a) * Math.PI * 2.5 + 0.4) * flutterAt(a) - 0.2 * (1 - travelAt(a)));
/** Its yaw (rad) for a sheet from `side`: edgewise into its path, turning to face you. */
export const yawAt = (a: number, side: number) => side * 0.8 * (1 - faceAt(a));

/** How far it has unfurled (0 rolled → 1 flat): accelerating, until it snaps flat. */
export const unfurlAt = (a: number) => Math.pow(clamp01((a - UNROLL[0]) / (UNROLL[1] - UNROLL[0])), 2.2);
/** The share of the width wound up at its leading edge (with the edge's small spring back after the snap). */
export function rolledAt(a: number) {
  if (a < UNROLL[1]) return ROLLED * (1 - unfurlAt(a));
  const r = clamp01((a - UNROLL[1]) / 0.16);
  return 0.06 * Math.sin(Math.PI * r) * (1 - r);
}
/** The moment it snaps flat (arrival progress). */
export const SNAP = UNROLL[1];

/** How far off it is first seen (m, beyond its resting place): deep in the air ahead. */
export const START_AHEAD = 8.5;

/**
 * Where it is at arrival progress a, as an offset from its resting place:
 * `edge` metres out to the `side`, a little above, START_AHEAD further off; in
 * on a swooping curve.
 */
export function flightAt(a: number, side: number, edge: number, seed: number, out: { x: number; y: number; z: number }) {
  const x = flyAt(a);
  const s = travelAt(a);
  out.x = side * bez3(edge, edge * 0.75, -0.28, 0, s);
  out.y = bez3(0.55, 0.9, -0.22, 0, s) + 0.07 * Math.sin(x * Math.PI * 4 + seed) * (1 - s);
  out.z = bez3(START_AHEAD, START_AHEAD * 0.42, 0.32, 0, s);
  return out;
}

/**
 * How far out to its side it starts (m, from its resting place), so that it
 * is first seen inside the frame, part-way out towards the edge: `restX` its
 * resting x, `ahead` how far in front of the camera it starts, `tanHalf` the
 * tangent of half the frame's horizontal field of view.
 */
export const startFor = (side: number, restX: number, ahead: number, tanHalf: number) => Math.max(0.3, 0.55 * ahead * tanHalf - side * restX);
