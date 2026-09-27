'use client';
/**
 * Runs the film's sound effects (systems/audio/sfx.ts) from where the film
 * is — every frame, from the beat and how it is moving. The visual state is
 * the authority: every sound is made by something the film is doing right
 * then, and stops when it stops.
 *
 *   the canister   it touches down (a muted knock); each time a band or seam
 *                  of it meets the road as it turns, a contact — so the
 *                  rhythm IS its rotation, quickening as it rolls faster,
 *                  thinning as it slows, stopping when it stops (whichever
 *                  way the scroll turns it); under them, a friction rub whose
 *                  level is its speed; its settle (scrape, rock, last tick).
 *                  Then quiet — and the pressure release, a separate event.
 *   the smog       its hiss and the air it moves, while there is smog
 *   a burning sheet  sound follows the burn's own progress: the first edge
 *                  catching; crackles and tiny pops as the fire's front runs
 *                  (densest where the front is longest); fine brittle ticks
 *                  as it curls; then drier, fainter ash crumbling; a last
 *                  breath; silence. Only while the burn moves forward (or
 *                  rests, faintly, as the ember line flickers); scrolled back,
 *                  it is silent.
 *   the world      thunder after lightning; the shaft's resonance; the Events
 *                  heard through their door before it opens; its mechanism
 *
 * One-off events play when the film crosses their beat going forward (never
 * scrubbed back, never on a jump), and re-arm once it is back before them.
 * No wind: the flight belongs to the music. With sound off, nothing is made.
 */
import { useEffect, useRef } from 'react';
import { introCameraAt } from '@/intro/camera';
import { CAN, GROUND_Y, gasAmount, rollAt, type RollState } from '@/intro/prologue/layout';
import { introFrame } from '@/intro/state';
import { edgeFor, flapIndex, flightAt, flutterAt, SNAP, START_AHEAD } from '@/intro/story/flight';
import { FRAGMENTS } from '@/intro/story/fragments';
import { T } from '@/intro/timeline';
import { LIGHTNING } from '@/intro/world/lightning';
import { world } from '@/scenes/shared/blend';
import { useExperience } from '@/store/experience';
import { cue, type Cue, quietAll, setLayer } from '@/systems/audio/sfx';
import { useProgressFrame } from './useProgressFrame';

const DOOR_BEATS = 6.5;
const CUES: { at: number; name: Cue; level?: number; pan?: number }[] = [
  { at: T.roll + 0.4, name: 'contact' },
  { at: T.rest - 0.3, name: 'settle' },
  { at: T.pressure, name: 'pressure' },
  { at: T.release, name: 'release' },
  { at: T.form, name: 'words' },
  ...LIGHTNING.map((l) => ({ at: l.at, name: 'thunder' as Cue, level: l.strength })),
  { at: T.door + DOOR_BEATS * 0.02, name: 'doorWake' },
  { at: T.door + DOOR_BEATS * 0.1, name: 'doorPressure' },
  { at: T.door + DOOR_BEATS * 0.3, name: 'doorRetract' },
  { at: T.door + DOOR_BEATS * 0.9, name: 'doorHome' },
];

/** Contacts per turn of the canister (its bands and seam meeting the road). */
const CONTACTS_PER_TURN = 5;

const roll: RollState = { s: 0, v: 0, angle: 0, x: 0, z: 0, lift: 0, tilt: 0, yaw: 0, seen: 0 };
const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
const span = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));

/** Per burning sheet: where its burn was last frame, and its one-off moments. */
interface BurnState {
  b: number;
  ignite: boolean;
  release: boolean;
}

/** Per arriving sheet: which flap it was on last frame, and whether its snap is still to come. */
interface ArrivalState {
  flap: number | null;
  snap: boolean;
}
/** Where a sheet is in its flight, for the sound (camera frame; the picture's own path, at a 16:9 frame). */
const _o = { x: 0, y: 0, z: 0 };
const _o2 = { x: 0, y: 0, z: 0 };
const TAN_HALF = Math.tan((43 * Math.PI) / 360) * (16 / 9);

export function SoundDirector() {
  const musicOn = useExperience((s) => s.musicOn);
  const last = useRef<number | null>(null);
  const armed = useRef(CUES.map(() => true));
  const bps = useRef(0);
  const contact = useRef<number | null>(null);
  const burns = useRef<BurnState[]>(FRAGMENTS.map(() => ({ b: 0, ignite: true, release: true })));
  const arrivals = useRef<ArrivalState[]>(FRAGMENTS.map(() => ({ flap: null, snap: true })));

  useEffect(() => {
    if (!musicOn) quietAll();
  }, [musicOn]);

  useProgressFrame((_, dt) => {
    if (!musicOn) return;
    const st = useExperience.getState();
    const t = introFrame.t;
    const inFilm = introFrame.active && st.phase === 'cinematic';
    const prev = last.current;
    last.current = inFilm ? t : null;
    if (!inFilm) {
      // After the film: only the Events' own air, faintly, underground.
      for (const l of ['roll', 'hiss', 'air', 'flight', 'burn', 'shaft']) setLayer(l, 0);
      setLayer('events', 0.035 * world.underground * (1 - world.teams), { freq: 1200 });
      contact.current = null;
      return;
    }
    // How fast the film is moving (beats per second), smoothed; a jump is not movement.
    const step = prev === null ? 0 : t - prev;
    const jump = Math.abs(step) > 4;
    bps.current += ((jump || dt <= 0 ? 0 : step / dt) - bps.current) * Math.min(1, dt * 10);

    // ── one-off events: forward crossings only, never on a jump
    CUES.forEach((c, i) => {
      if (t < c.at - 0.5) armed.current[i] = true;
      if (prev !== null && !jump && armed.current[i] && prev < c.at && t >= c.at) {
        armed.current[i] = false;
        cue(c.name, { pan: c.pan ?? (c.name === 'contact' || c.name === 'settle' || c.name === 'pressure' || c.name === 'release' ? canPan(t) : 0), level: c.level });
      }
    });

    // ── the canister: contacts keyed to its rotation, friction to its speed
    const cam = introCameraAt(t).pos;
    rollAt(t, roll);
    const dist = Math.hypot(roll.x - cam.x, GROUND_Y + CAN.r - cam.y, roll.z - cam.z);
    const near = roll.seen / (1 + 0.06 * dist * dist);
    const speed = jump ? 0 : Math.abs(roll.v * bps.current); // m/s
    const sp = Math.min(1, speed / 1.4);
    const pan = canPan(t);
    const idx = Math.floor(roll.angle / ((2 * Math.PI) / CONTACTS_PER_TURN));
    if (contact.current !== null && idx !== contact.current && !jump && t > T.roll && t < T.rest + 1) {
      // (At most a couple a frame: a fling doesn't machine-gun.)
      const n = Math.min(2, Math.abs(idx - contact.current));
      for (let k = 0; k < n; k++) cue('rollTick', { pan, level: (0.45 + 0.55 * sp) * near * 1.8 });
    }
    contact.current = idx;
    setLayer('roll', t > T.roll && t < T.rest + 0.5 ? 0.09 * Math.pow(sp, 1.2) * near * 1.8 : 0, { freq: 240 + 260 * sp, pan });

    // ── the smog: its hiss and the air it moves
    const since = t - T.release;
    const gas = gasAmount(t);
    setLayer('hiss', since > 0 ? (0.03 + 0.12 * Math.exp(-since / 2.5)) * gas : 0, { freq: 2600 + 1800 * Math.exp(-since / 3) });
    setLayer('air', since > 0 ? 0.16 * Math.exp(-since / 4) * gas + 0.03 * gas : 0);

    // ── a sheet arriving: the air past it follows its speed, a flap for each flutter, the snap as
    //    it unfurls (flaps and snap forward only; the air, either way — it is moving)
    let air = 0;
    let airFreq = 900;
    let airPan = 0;
    FRAGMENTS.forEach((f, i) => {
      const s = arrivals.current[i];
      const len = f.arrive[1] - f.arrive[0];
      const a = span(t, f.arrive[0], f.arrive[1]);
      const aPrev = prev === null ? a : span(prev, f.arrive[0], f.arrive[1]);
      const flap = flapIndex(a, f.seed);
      if (a <= 0) s.snap = true;
      if (a > 0 && a < 1) {
        const edge = edgeFor(f.side, f.rest[0], f.rest[2] + START_AHEAD, TAN_HALF);
        flightAt(a, f.side, edge, f.seed, _o);
        flightAt(Math.min(1, a + 0.01), f.side, edge, f.seed, _o2);
        const x = (f.rest[0] + _o.x) / Math.max(0.5, (f.rest[2] + _o.z) * TAN_HALF);
        const pan = Math.max(-1, Math.min(1, x * 0.85));
        // Metres per second along its path.
        const v = jump ? 0 : (Math.hypot(_o2.x - _o.x, _o2.y - _o.y, _o2.z - _o.z) / (0.01 * len)) * Math.abs(bps.current);
        const sp = Math.min(1, v / 6);
        if (sp * 0.05 > air) {
          air = sp * 0.05;
          airFreq = 650 + 1500 * sp;
          airPan = pan;
        }
        if (s.flap !== null && flap > s.flap && a > aPrev && !jump && flutterAt(a) > 0.04) cue('flap', { pan, level: 0.35 + 0.65 * flutterAt(a) });
        if (s.snap && a >= SNAP && aPrev < SNAP && !jump) {
          s.snap = false;
          cue('unfurl', { pan: pan * 0.6 });
        }
      }
      s.flap = flap;
    });
    setLayer('flight', air, { freq: airFreq, pan: airPan });

    // ── a burning sheet: sound follows the burn's own state
    let bed = 0;
    let bedFreq = 2400;
    let bedPan = 0;
    FRAGMENTS.forEach((f, i) => {
      const s = burns.current[i];
      const b = span(t, f.burn[0], f.burn[1]);
      const db = jump ? 0 : b - s.b;
      s.b = b;
      if (b <= 0.001) {
        s.ignite = true;
        s.release = true;
        return;
      }
      if (b >= 0.999) return;
      const p = f.rest[0] * 0.6;
      if (db > 0 && s.ignite && b > 0.012) {
        s.ignite = false;
        cue('ignite', { pan: p });
      }
      if (db > 0 && s.release && b > 0.93) {
        s.release = false;
        cue('ashRelease', { pan: p });
      }
      if (db < 0) return; // scrolled back: the fire un-burns in silence
      // How fast the burn is moving (per second) against its pace at an ordinary scroll.
      const rate = dt > 0 ? db / dt : 0;
      const activity = 0.12 + 0.88 * Math.min(1, rate / 0.5);
      const front = Math.pow(Math.sin(Math.PI * Math.min(1, b / 0.85)), 1.2);
      const grains: [Cue, number][] = [
        ['crackle', 14 * front],
        ['pop', 3 * front],
        ['brittle', 5 * smooth(0.3, 0.5, b) * (1 - smooth(0.8, 0.9, b))],
        ['crumble', 22 * smooth(0.65, 0.8, b) * (1 - smooth(0.95, 1, b))],
      ];
      for (const [g, perSecond] of grains) if (Math.random() < perSecond * activity * dt) cue(g, { pan: p + (Math.random() - 0.5) * 0.2 });
      bed = Math.max(bed, 0.016 * front * (0.3 + 0.7 * Math.min(1, rate / 0.5)));
      bedFreq = 1900 + 1600 * (1 - b);
      bedPan = p;
    });
    setLayer('burn', bed, { freq: bedFreq, pan: bedPan });

    // ── below: the shaft's resonance, then the Events through the door
    const below = smooth(T.shaft - 1, T.shaft + 1, t);
    setLayer('shaft', below * (0.14 - 0.06 * smooth(T.lobby, T.door, t)) * (1 - smooth(T.doorway, T.end, t)));
    const open = smooth(T.door + DOOR_BEATS * 0.25, T.doorway, t);
    setLayer('events', smooth(T.lobby - 2, T.lobby, t) * (0.04 + 0.1 * open), { freq: 260 + 1100 * open });
  });

  return null;
}

/** Where the canister is, left to right, from where the camera is. */
function canPan(t: number) {
  rollAt(t, roll);
  const cam = introCameraAt(t).pos;
  return Math.max(-1, Math.min(1, (roll.x - cam.x) / 1.5));
}
