/**
 * The Teams world's physics language — one small vocabulary shared by the
 * cards, the dust and the grain, so the pointer reads as one force acting on
 * one physical medium:
 *
 *   field      the pointer as a short, critically damped follower (it has
 *              momentum but returns to rest in ~0.3 s instead of chasing)
 *   energy     how hard the pointer is moving right now (quick in, quick out)
 *   stir       the same, released slowly: the air stays disturbed a moment
 *              after the hand stops
 *   spring     a critically damped spring, faster towards a new target than
 *              back to rest: a fast first response, short inertia, a slower
 *              natural recovery — no bounce, no overshoot
 *   impulse    the response of a damped particle to a kick: it moves on for a
 *              moment after the push, then settles back where it was
 */
export interface PointerField {
  x: number;
  y: number;
  active: boolean;
  vx: number;
  vy: number;
  fx: number;
  fy: number;
  fvx: number;
  fvy: number;
  energy: number;
  stir: number;
  /** Direction of the last real movement (NDC, unit) — kept after the pointer stops. */
  dirX: number;
  dirY: number;
}

export function updatePointerField(p: PointerField, delta: number, reduced: boolean) {
  const dt = Math.min(0.1, Math.max(0, delta));
  const steps = Math.max(1, Math.ceil(dt * 240));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    p.fvx += (((p.active ? p.x : p.fx) - p.fx) * 625 - p.fvx * 50) * h;
    p.fvy += (((p.active ? p.y : p.fy) - p.fy) * 625 - p.fvy * 50) * h;
    p.fx += p.fvx * h;
    p.fy += p.fvy * h;
  }
  const speed = Math.hypot(p.vx, p.vy);
  const energy = reduced || !p.active ? 0 : Math.min(1, speed * 0.07);
  p.energy += (energy - p.energy) * (1 - Math.exp(-dt * (energy > p.energy ? 14 : 8)));
  p.stir += (p.energy - p.stir) * (1 - Math.exp(-dt * (p.energy > p.stir ? 10 : 2.2)));
  if (speed > 0.05) {
    p.dirX = p.vx / speed;
    p.dirY = p.vy / speed;
  }
  if (reduced) {
    p.fvx = p.fvy = 0;
    p.fx = p.x;
    p.fy = p.y;
    p.stir = 0;
  }
}

/** A critically damped spring state (value + velocity). */
export interface Spring {
  v: number;
  dv: number;
}

/**
 * Step a spring towards `target`: ω `attack` (rad/s) while it moves away from
 * rest, ω `release` on the way back — a quick response, a slow recovery.
 */
export function stepSpring(s: Spring, target: number, dt: number, attack: number, release: number) {
  const w = Math.abs(target) >= Math.abs(s.v) ? attack : release;
  const steps = Math.max(1, Math.ceil(dt * 240));
  const h = Math.min(0.1, dt) / steps;
  for (let i = 0; i < steps; i++) {
    s.dv += ((target - s.v) * w * w - 2 * w * s.dv) * h;
    s.v += s.dv * h;
  }
  return s.v;
}

/**
 * The displacement of a damped particle kicked at t = 0 (normalised: peaks at
 * 1 when t = 1/ω): it keeps moving briefly, then settles back.
 */
export const impulse = (t: number, w: number) => (t <= 0 ? 0 : t * w * Math.exp(1 - t * w));

/** The same, in GLSL. */
export const IMPULSE_GLSL = /* glsl */ `
float impulse(float t, float w) { return t <= 0.0 ? 0.0 : t * w * exp(1.0 - t * w); }
`;
