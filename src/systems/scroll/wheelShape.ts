/**
 * How wheel and trackpad input become scroll.
 *
 * The journey's scroll is linear — so many pixels, so many beats — but input
 * is not: a mouse notch is ~100 px, while an ordinary trackpad flick delivers
 * 500–1500 px of momentum in half a second, which carried the camera through
 * a whole story beat at once. So each wheel event is scaled by how fast the
 * input is arriving: deliberate scrolling passes nearly as it is, a fling is
 * compressed — faster, but still a move you can follow. Nothing is delayed or
 * replayed: the page's scroll position is still the only clock, and stopping
 * stops it.
 *
 * Only before the portal: the Teams world keeps its own feel.
 */
import { PORTAL_GATE } from '@/config/timeline';
import { progress } from './progress';

/** How quickly the input-speed estimate follows (s): a few frames. */
const TAU = 0.025;
/** Input speed (px/s) at which the gain has halved; and how sharply it falls beyond. */
const KNEE = 1100;
const SHARP = 2;
/** The least a fling is scaled by. */
const FLOOR = 0.2;

let speed = 0;
let last = 0;

/** The gain for one wheel event (deltas in px, after Lenis's own multiplier). */
export function wheelGain(dx: number, dy: number, now = performance.now()) {
  // Time since the last event, within reason: a lone mouse notch after a pause counts as slow input
  // (it passes nearly as is); a trackpad's stream, an event a frame, reads as fast.
  const dt = Math.min(0.2, Math.max(1 / 120, last ? (now - last) / 1000 : 0.2));
  last = now;
  const k = 1 - Math.exp(-dt / TAU);
  speed += (Math.hypot(dx, dy) / dt - speed) * k;
  if (progress.target >= PORTAL_GATE - 1e-4) return 1;
  return Math.max(FLOOR, 1 / (1 + Math.pow(speed / KNEE, SHARP)));
}
