/**
 * The dust's memory of recent forces: a small ring of impulses in world space
 * (relative to the Teams origin), each a pointer stroke or a card's landing.
 * ParticleField feeds them to its vertex shader, where every mote near one
 * receives a kick that carries on briefly and then settles (pointer.ts,
 * `impulse`) — so a moving hand disturbs the air locally, fast strokes more
 * than slow ones, and the air keeps settling after the hand stops.
 *
 * Plain typed arrays, written in place: no allocation per frame.
 */
export const DUST_IMPULSES = 16;

/** QA only (debug.ts): scale the dust's response, to see the field's shape plainly. */
export const dustQa = { gain: 1 };

/** xyz position, w the time it happened (s, performance clock). */
export const impulsePos = new Float32Array(DUST_IMPULSES * 4).fill(-1e4);
/** xyz velocity (m/s), w radial strength (a push outward from the point). */
export const impulseVel = new Float32Array(DUST_IMPULSES * 4);

let next = 0;

export const now = () => performance.now() / 1000;

export function pushImpulse(x: number, y: number, z: number, vx: number, vy: number, vz: number, radial = 0, t = now()) {
  const i = next * 4;
  impulsePos[i] = x;
  impulsePos[i + 1] = y;
  impulsePos[i + 2] = z;
  impulsePos[i + 3] = t;
  impulseVel[i] = vx;
  impulseVel[i + 1] = vy;
  impulseVel[i + 2] = vz;
  impulseVel[i + 3] = radial;
  next = (next + 1) % DUST_IMPULSES;
}

/** Forget everything (leaving the world). */
export function clearImpulses() {
  impulsePos.fill(-1e4);
  impulseVel.fill(0);
}

/** QA: the impulses still acting (age < 1.5 s) and the fastest of them (m/s). */
export function activeImpulses() {
  const t = now();
  let n = 0;
  let fastest = 0;
  for (let i = 0; i < DUST_IMPULSES; i++) {
    if (t - impulsePos[i * 4 + 3] < 1.5) {
      n++;
      fastest = Math.max(fastest, Math.hypot(impulseVel[i * 4], impulseVel[i * 4 + 1], impulseVel[i * 4 + 2]));
    }
  }
  return { n, fastest: Math.round(fastest * 100) / 100 };
}
