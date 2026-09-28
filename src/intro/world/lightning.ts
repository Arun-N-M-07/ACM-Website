/**
 * Lightning: rare, irregular, distant — a light event, not a graphic.
 *
 * Each storm is a short sequence of pulses laid on the beat: an irregular
 * first flash, darkness, a secondary flicker, the strong flash (itself
 * doubled), darkness, a faint afterglow. Its light is a pure function of the
 * scroll's beat (look.ts reads it), so the same scroll position always shows
 * the same light — forwards, backwards, scrubbed.
 *
 * Every pulse strikes somewhere a little different in the sky — the storm
 * moves about, around and behind what the camera is looking at — and that is
 * where the fog lights up most (fog.ts: the film's mist scatters it, the
 * distant air most of all, so the flash is seen dispersed through the air,
 * not laid over it). What it lights besides: the stone, the ground and the
 * trees catch a cold light from high behind the lens; the sky lifts; the
 * cloud glows from within. The thunder follows (sound: a cue on the strong
 * flash, heard only going forward).
 *
 * Reduced motion: no flicker — each storm is one slow, soft brightening of
 * the air and back.
 */
import { Vector3 } from 'three';
import { T } from '../timeline';
import { STONE, STONE_FOCUS } from './stoneLayout';

interface Pulse {
  /** Beat of the pulse's peak, its width (beats), and its strength. */
  at: number;
  w: number;
  a: number;
  /** Where in the sky it strikes: turned about the vertical from the storm's bearing (rad), and lifted. */
  az: number;
  up: number;
}

interface Storm {
  /** The strong flash (thunder is keyed to it) and how strong the storm is. */
  strike: number;
  strength: number;
  pulses: Pulse[];
  /** Afterglow: from the strike, decaying over this many beats. */
  glow: number;
  /** Which way the storm lies from the camera (unit, world). */
  bearing: Vector3;
}

/** A storm's shape around its strike, scaled; its pulses scattered about its bearing. */
function storm(strike: number, strength: number, seed: number, bearing: Vector3): Storm {
  const s = seed - 0.5;
  return {
    strike,
    strength,
    glow: 0.9,
    bearing: bearing.clone().normalize(),
    pulses: [
      // an irregular first flash, off to one side…
      { at: strike - 1.25 - 0.1 * seed, w: 0.07, a: 0.38, az: -0.42 + 0.3 * s, up: 0.1 },
      { at: strike - 1.12 - 0.08 * seed, w: 0.04, a: 0.22, az: -0.36 + 0.3 * s, up: 0.18 },
      // …darkness; a secondary flicker, somewhere else…
      { at: strike - 0.62 + 0.05 * seed, w: 0.05, a: 0.26, az: 0.38 - 0.4 * s, up: 0.06 },
      // …the strong flash, doubled, behind the subject…
      { at: strike, w: 0.06, a: 1, az: 0.05, up: 0.22 },
      { at: strike + 0.16 + 0.04 * seed, w: 0.09, a: 0.72, az: -0.08 + 0.1 * s, up: 0.16 },
    ].map((p) => ({ ...p, a: p.a * strength })),
  };
}

/** From where the camera reads the stone, towards it and on up into the sky behind it. */
const OVER_THE_STONE = new Vector3(STONE_FOCUS[0] - STONE.reader[0], 7, STONE_FOCUS[2] - STONE.reader[2]);

export const STORMS: Storm[] = [
  // At the stone: first far off and faint as the camera comes to it (the air around the stone
  // shows for an instant)…
  storm(T.acm + 3, 0.42, 0.8, OVER_THE_STONE.clone().applyAxisAngle(new Vector3(0, 1, 0), 0.5)),
  // …then nearer, as the name is read: the environment revealed.
  storm(T.acmHold + 1.7, 1, 0.3, OVER_THE_STONE),
  // Faint, deep in the cloud on the way up.
  storm(T.cloudIn + 1.8, 0.45, 0.7, new Vector3(0.3, 1, -0.4)),
  // Out of the cloud's base on the way down: its underside, and the campus below.
  storm(T.cloudBase + 1.3, 0.6, 0.5, new Vector3(-0.2, 1, 0.3)),
];

/** For the sound: each storm's strong flash, and its strength. */
/**
 * For the thunder (SoundDirector): when each storm strikes, how strong, how far off (0 overhead …
 * 1 far away — the fainter flashes are the farther: their thunder comes later, lower and longer)
 * and which it is (its own roll, the same every time).
 */
export const LIGHTNING = STORMS.map((s, i) => ({ at: s.strike, strength: s.strength, distance: Math.min(0.9, Math.max(0.1, 1.15 - s.strength)), variant: i }));

const _d = new Vector3();
const UP = new Vector3(0, 1, 0);

/**
 * Lightning's light (0..~1.2) at beat t; with `dir`, also where it comes from
 * (the pulses' directions weighted by their light, written into it).
 */
export function flashAt(t: number, reduced = false, dir?: Vector3) {
  let f = 0;
  dir?.set(0, 0, 0);
  for (const s of STORMS) {
    if (t < s.strike - 2 || t > s.strike + 3) continue;
    if (reduced) {
      // One slow swell of light in the air and back: no flicker.
      const x = (t - s.strike) / 0.9;
      const g = 0.3 * s.strength * Math.exp(-x * x);
      f += g;
      dir?.addScaledVector(s.bearing, g);
      continue;
    }
    for (const p of s.pulses) {
      const x = (t - p.at) / p.w;
      const g = p.a * Math.exp(-x * x);
      if (g < 1e-4) continue;
      f += g;
      if (dir) {
        _d.copy(s.bearing).applyAxisAngle(UP, p.az);
        _d.y += p.up;
        dir.addScaledVector(_d.normalize(), g);
      }
    }
    // The afterglow: the fog holding a little of the light.
    if (t > s.strike) {
      const g = 0.14 * s.strength * Math.exp(-(t - s.strike) / s.glow);
      f += g;
      dir?.addScaledVector(s.bearing, g);
    }
  }
  if (dir) {
    if (dir.lengthSq() > 1e-10) dir.normalize();
    else dir.set(0, 1, 0);
  }
  return f;
}
