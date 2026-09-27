/**
 * Lightning: rare, irregular, distant — inside and under the cloud.
 *
 * The scroll decides WHEN (crossing one of these beats going forward — never
 * scrubbing back, never on a jump), but a flash is a flash: once struck it
 * plays out in real time, a few uneven flickers over half a second, so it can
 * never be frozen on screen by a stopped scroll. It lights the cloud from
 * within and lifts the light a little — no white screen — and the thunder
 * (sfx: 'thunder') follows a second or two later, low and far.
 */
import { T } from '../timeline';

export const LIGHTNING = [
  /** Faint, deep in the cloud on the way up. */
  { at: T.cloudIn + 1.6, strength: 0.5, seed: 0.31 },
  /** The strong one: entering the cloud on the way down. */
  { at: T.cloudTop + 2.1, strength: 1, seed: 0.77 },
  /** Out of its base: the underside of the cloud and the campus below lit for an instant. */
  { at: T.cloudBase + 1.2, strength: 0.7, seed: 0.53 },
];

export const flash = { level: 0, start: -1, strength: 0, seed: 0 };

/** The flash's light at `now` (s): uneven flickers, decaying. */
export function flashLevel(now: number) {
  if (flash.start < 0) return 0;
  const x = now - flash.start;
  if (x > 0.9) return 0;
  const k = (d: number, w: number, a: number) => (x >= d ? a * Math.exp(-(x - d) / w) : 0);
  const s = flash.seed;
  return flash.strength * Math.min(1, k(0, 0.06, 1) + k(0.12 + 0.08 * s, 0.05, 0.55) + k(0.3 + 0.1 * s, 0.12, 0.35));
}
