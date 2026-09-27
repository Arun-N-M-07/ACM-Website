/**
 * Lightning: rare, irregular, distant — a light event, not a graphic.
 *
 * Each storm is a short sequence of pulses laid on the beat: an irregular
 * first flash, darkness, a secondary flicker, the strong flash (itself
 * doubled), darkness, a faint afterglow. Its light is a pure function of the
 * scroll's beat (look.ts reads flashAt), so the same scroll position always
 * shows the same light — forwards, backwards, scrubbed. What it lights: the
 * fog brightens, the stone and the ground and the trees catch a cold light
 * from high behind the lens, the cloud glows from within. The thunder follows
 * (sound: a cue on the strong flash, heard only going forward).
 */
import { T } from '../timeline';

interface Pulse {
  /** Beat of the pulse's peak, its width (beats), and its strength. */
  at: number;
  w: number;
  a: number;
}

interface Storm {
  /** The strong flash (thunder is keyed to it) and how strong the storm is. */
  strike: number;
  strength: number;
  pulses: Pulse[];
  /** Afterglow: from the strike, decaying over this many beats. */
  glow: number;
}

/** A storm's shape around its strike, scaled. */
function storm(strike: number, strength: number, seed: number): Storm {
  return {
    strike,
    strength,
    glow: 0.9,
    pulses: [
      // an irregular first flash…
      { at: strike - 1.25 - 0.1 * seed, w: 0.07, a: 0.38 },
      { at: strike - 1.12 - 0.08 * seed, w: 0.04, a: 0.22 },
      // …darkness; a secondary flicker…
      { at: strike - 0.62 + 0.05 * seed, w: 0.05, a: 0.26 },
      // …the strong flash, doubled…
      { at: strike, w: 0.06, a: 1 },
      { at: strike + 0.16 + 0.04 * seed, w: 0.09, a: 0.72 },
    ].map((p) => ({ ...p, a: p.a * strength })),
  };
}

export const STORMS: Storm[] = [
  // At the stone, as the name is read in the mist: the environment revealed for an instant.
  storm(T.acmHold + 1.7, 1, 0.3),
  // Faint, deep in the cloud on the way up.
  storm(T.cloudIn + 1.8, 0.45, 0.7),
  // Out of the cloud's base on the way down: its underside, and the campus below.
  storm(T.cloudBase + 1.3, 0.6, 0.5),
];

/** For the sound: each storm's strong flash, and its strength. */
export const LIGHTNING = STORMS.map((s) => ({ at: s.strike, strength: s.strength }));

/** Lightning's light (0..~1.2) at beat t. */
export function flashAt(t: number) {
  let f = 0;
  for (const s of STORMS) {
    if (t < s.strike - 2 || t > s.strike + 3) continue;
    for (const p of s.pulses) {
      const x = (t - p.at) / p.w;
      f += p.a * Math.exp(-x * x);
    }
    // The afterglow: the fog holding a little of the light.
    if (t > s.strike) f += 0.14 * s.strength * Math.exp(-(t - s.strike) / s.glow);
  }
  return f;
}
