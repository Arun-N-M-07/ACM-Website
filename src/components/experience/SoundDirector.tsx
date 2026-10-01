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
 *   the world      thunder after each flash — late, and the later the farther
 *                  (each storm its own); the air of the cloud as the camera
 *                  moves through it (soft pressure and displaced air, wide and
 *                  slowly moving, only as loud as the camera is fast); the
 *                  light-well's shaft as a tube of air (its resonances rising
 *                  as the camera goes down, the air brightening with its
 *                  speed) — its entry, its release into the lobby; the room
 *                  beyond the Events door, heard as air as it opens; the
 *                  door's mechanism; the threshold into the Events
 *   the Events     going into a room and out of it, room to room: the room's
 *                  own air (each room its acoustic — not a tune), coming up
 *                  through its frame from the side its bay is on, around the
 *                  camera inside, under its record; between rooms the hall's
 *                  air, as loud as the camera moves and settling as it stops.
 *                  Nothing at the whole matrix (the music is its bed). The
 *                  Prodigy wall: each piece's move and its lock, as the
 *                  picture has it (exhibits/common: puzzleSpan).
 *                  The matrix opening onto the portal: its columns' mechanism,
 *                  heard as the lobby's door is — waking, the pressure letting
 *                  go, the columns moving, and each coming home. (A bay's
 *                  tracing and the threshold into a room: scenes/events.)
 *
 * One-off events play when the film crosses their beat going forward (never
 * scrubbed back, never on a jump), and re-arm once it is back before them.
 * No wind, no drones. With sound off, nothing is made. (The portal's
 * crossing is the travel's own: teams/travel.ts.)
 */
import { useEffect, useRef } from 'react';
import { PORTAL_SPLIT, SCROLL_LENGTH_VH, segmentAt, segmentProgress } from '@/config/timeline';
import { EVENT_ROOMS } from '@/config/world';
import { EVENTS, type RoomArtifact } from '@/content/events';
import { cloud } from '@/intro/look';
import { PUZZLE_PIECES, puzzlePiece, puzzleSpan, readRoomClock, type RoomClock } from '@/scenes/events/exhibits/roomClock';
import { eventsFrame } from '@/scenes/events/state';
import { introCameraAt } from '@/intro/camera';
import { CAN, GROUND_Y, gasAmount, rollAt, type RollState } from '@/intro/prologue/layout';
import { introFrame } from '@/intro/state';
import { flapIndex, flightAt, flutterAt, SNAP, START_AHEAD, startFor } from '@/intro/story/flight';
import { FRAGMENTS } from '@/intro/story/fragments';
import { T } from '@/intro/timeline';
import { LIGHTNING } from '@/intro/world/lightning';
import { useExperience } from '@/store/experience';
import { cue, type Cue, prepare, quietAll, setLayer } from '@/systems/audio/sfx';
import { fx } from '@/systems/camera/effects';
import { progress } from '@/systems/scroll/progress';
import { useProgressFrame } from './useProgressFrame';

const DOOR_BEATS = 6.5;
/** Where the shaft tips up into the lobby (intro/camera: the key at 181). */
const TIP_UP = 181;
const CUES: { at: number; name: Cue; level?: number; pan?: number; variant?: number; distance?: number }[] = [
  { at: T.roll + 0.4, name: 'contact' },
  { at: T.rest - 0.3, name: 'settle' },
  { at: T.pressure, name: 'pressure' },
  { at: T.release, name: 'release' },
  { at: T.form, name: 'words' },
  ...LIGHTNING.map((l) => ({ at: l.at, name: 'thunder' as Cue, level: 0.6 + 0.4 * l.strength, variant: l.variant, distance: l.distance })),
  { at: T.shaft, name: 'tunnelEnter' },
  { at: TIP_UP, name: 'tunnelRelease' },
  { at: T.door + DOOR_BEATS * 0.02, name: 'doorWake' },
  { at: T.door + DOOR_BEATS * 0.1, name: 'doorPressure' },
  { at: T.door + DOOR_BEATS * 0.3, name: 'doorRetract' },
  { at: T.door + DOOR_BEATS * 0.9, name: 'doorHome' },
  { at: T.doorway, name: 'threshold' },
];

/** The Prodigy room (its artifact is the puzzle wall). */
const PRODIGY_ROOM = EVENTS.findIndex((e) => e.artifact === 'puzzle-wall');
/**
 * The matrix opening (EventsHall: splitOffsets — the outer columns home at 0.62 of it, the middle one at
 * 1): when each moment of its mechanism sounds, as a fraction of the opening. Forward only.
 */
const SPLIT_CUES: { at: number; name: Cue; level?: number }[] = [
  { at: 0.02, name: 'doorWake' },
  { at: 0.09, name: 'doorPressure' },
  { at: 0.2, name: 'doorRetract' },
  { at: 0.6, name: 'doorHome', level: 0.75 },
  { at: 0.97, name: 'doorHome' },
];
/** How far the matrix has opened at progress p (0 before the portal segment, 1 once it has). */
const splitAt = (p: number) => {
  const seg = segmentAt(p);
  return seg === 'portal' ? Math.min(1, segmentProgress(p, 'portal') / PORTAL_SPLIT) : seg === 'teams' || seg === 'return' ? 1 : 0;
};
const prodigyClock: RoomClock = { u: -0.3, here: false, near: false, presence: 0 };

/**
 * Each room's acoustic — the band its air sits in and how wide — as its installation is built: a
 * quiet office, a hall of voices, a lecture room, a small workshop… the same air, different rooms
 * (never a tune of its own).
 */
const ROOM_AIR: Record<RoomArtifact, { freq: number; q: number; level: number }> = {
  interview: { freq: 380, q: 0.9, level: 0.75 },
  voices: { freq: 560, q: 0.6, level: 1 },
  lectern: { freq: 320, q: 0.7, level: 0.9 },
  blocks: { freq: 720, q: 1.1, level: 0.8 },
  sequence: { freq: 900, q: 1.3, level: 0.7 },
  leaderboard: { freq: 620, q: 0.8, level: 1 },
  'puzzle-wall': { freq: 440, q: 0.6, level: 1.1 },
  'contribution-graph': { freq: 1050, q: 1, level: 0.75 },
  'hack-tables': { freq: 760, q: 0.7, level: 1 },
};
/** The camera's pace through the Events (vh of scroll per second) that counts as moving in earnest. */
const MOVING_VH_S = 40;
/** Every layer the film plays (all silenced once it is left behind). */
/**
 * The loop's mosaic, heard: silent at both ends (the world whole, the mist whole — the mist's own
 * air carries the seam), fullest halfway; a pure function of the transition, so it plays back as it
 * came and nothing is left sounding once it's over.
 */
function mosaicSound(a: number, side: number) {
  const k = a <= 0 || a >= 1 ? 0 : Math.pow(Math.sin(Math.PI * a), 1.3);
  const wander = (side ? -1 : 1) * Math.sin(a * Math.PI * 1.5);
  setLayer('mosaicShimmer', 0.009 * k, { freq: 2400 + 2600 * a, pan: 0.5 * wander });
  // Six steps across the passage, each held while its tiles go.
  const step = Math.min(5, Math.floor(a * 6));
  setLayer('mosaicTone', 0.0035 * k, { freq: 520 * Math.pow(1.335, step), pan: -0.35 * wander });
}

const FILM_LAYERS = ['roll', 'hiss', 'air', 'flight', 'burn', 'cloudLow', 'cloudHigh', 'tunnelAir', 'tunnelRes', 'tunnelRes2', 'eventsAir'];

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
  /** The Prodigy room's clock last frame (null: not in it). */
  const prodigyU = useRef<number | null>(null);
  /** How far the matrix had opened last frame (null: not in the journey). */
  const splitPrev = useRef<number | null>(null);
  /** The journey's progress last frame, and how much the camera is moving through the Events (0..1, smoothed). */
  const lastP = useRef<number | null>(null);
  const motion = useRef(0);
  const lastEnter = useRef(0);

  useEffect(() => {
    if (!musicOn) quietAll();
    else prepare();
  }, [musicOn]);

  useProgressFrame((p, dt) => {
    if (!musicOn) return;
    const st = useExperience.getState();
    const t = introFrame.t;
    const inFilm = introFrame.active && st.phase === 'cinematic';
    const prev = last.current;
    last.current = inFilm ? t : null;
    if (!inFilm) {
      // After the film: no bed at all (the rooms are the music's, and their own moments') — only,
      // at the end of the journey, the air of the mist that takes the world.
      for (const l of FILM_LAYERS) setLayer(l, 0);
      setLayer('mistAir', 0.018 * fx.mist);
      mosaicSound(fx.mosaic, fx.mosaicSide);
      contact.current = null;
      // The Prodigy wall: each piece's move and its lock, going forward through the visit.
      if (PRODIGY_ROOM >= 0 && st.phase === 'cinematic') {
        readRoomClock(PRODIGY_ROOM, prodigyClock);
        const u = prodigyClock.here ? prodigyClock.u : null;
        const pu = prodigyU.current;
        prodigyU.current = u;
        if (u !== null && pu !== null && u > pu && u - pu < 0.3) {
          let n = 0;
          for (let o = 0; o < PUZZLE_PIECES && n < 3; o++) {
            const [from, home] = puzzleSpan(o);
            const pan = ((puzzlePiece(o) % 3) - 1) * 0.45;
            if (pu < from && u >= from) cue('tileMove', { pan, variant: o });
            if (pu < home && u >= home) {
              cue('tileLock', { pan, variant: o });
              n++;
            }
          }
        }
      } else prodigyU.current = null;
      // Room to room: the room's air comes up as the camera passes through its frame (from the side its
      // bay is on, centred once inside), and goes under its record; between rooms, through the hall,
      // the hall's air — as loud as the camera is moving (smoothed, and settling as it stops), quiet
      // again at rest. At the whole matrix, nothing: the matrix is the music's.
      const v = eventsFrame.view;
      // (How much the camera is moving through the Events: the scroll's own pace, or a room's entry
      // playing — its choreography, at its own pace.)
      const scrolling = progress.cut || dt <= 0 ? 0 : Math.min(1, (Math.abs(p - (lastP.current ?? p)) * SCROLL_LENGTH_VH) / dt / MOVING_VH_S);
      const entering = dt <= 0 ? 0 : Math.min(1, (Math.abs(eventsFrame.view.enter - lastEnter.current) / dt) * 2);
      const moving = Math.max(scrolling, entering);
      lastP.current = p;
      lastEnter.current = eventsFrame.view.enter;
      motion.current += (moving - motion.current) * (1 - Math.exp(-dt * 3));
      const inRooms = st.phase === 'cinematic' && v.index >= 0 && v.enter > 0;
      if (inRooms) {
        const r = EVENT_ROOMS[v.index];
        const air = ROOM_AIR[r.event.artifact];
        const here = smooth(0.55, 1, v.enter) * (1 - 0.65 * v.unfold);
        const side = (r.col - 1) * 0.45 * (1 - smooth(0.3, 0.92, v.enter)) * (st.reducedMotion ? 0.3 : 1);
        setLayer('roomAir', 0.011 * air.level * here, { freq: air.freq * (0.85 + 0.15 * v.inside), q: air.q, pan: side });
        const between = Math.sin(Math.PI * Math.min(1, v.enter)) * (1 - v.inside);
        setLayer('hallAir', 0.014 * between * (0.25 + 0.75 * motion.current * (st.reducedMotion ? 0.4 : 1)), { freq: 180 + 220 * motion.current });
      } else {
        setLayer('roomAir', 0);
        setLayer('hallAir', 0);
      }
      // The matrix opening: each moment of its mechanism as it is crossed going forward (not on a jump).
      const sp = st.phase === 'cinematic' ? splitAt(p) : null;
      const was = splitPrev.current;
      splitPrev.current = sp;
      if (sp !== null && was !== null && sp > was && sp - was < 0.25) for (const c of SPLIT_CUES) if (was < c.at && sp >= c.at) cue(c.name, { level: c.level });
      return;
    }
    prodigyU.current = null;
    splitPrev.current = null;
    lastP.current = null;
    setLayer('roomAir', 0);
    setLayer('hallAir', 0);
    // How fast the film is moving (beats per second), smoothed; a jump is not movement.
    const step = prev === null ? 0 : t - prev;
    const jump = Math.abs(step) > 4;
    bps.current += ((jump || dt <= 0 ? 0 : step / dt) - bps.current) * Math.min(1, dt * 10);

    // ── one-off events: forward crossings only, never on a jump
    CUES.forEach((c, i) => {
      if (t < c.at - 0.5) armed.current[i] = true;
      if (prev !== null && !jump && armed.current[i] && prev < c.at && t >= c.at) {
        armed.current[i] = false;
        cue(c.name, { pan: c.pan ?? (c.name === 'contact' || c.name === 'settle' || c.name === 'pressure' || c.name === 'release' ? canPan(t) : 0), level: c.level, variant: c.variant, distance: c.distance });
      }
    });

    // How fast the camera itself is travelling (m/s): the air it moves through is as loud as that.
    const c0 = introCameraAt(t).pos;
    const x0 = c0.x;
    const y0 = c0.y;
    const z0 = c0.z;
    const c1 = introCameraAt(t + 0.05).pos;
    const camSpeed = jump ? 0 : (Math.hypot(c1.x - x0, c1.y - y0, c1.z - z0) / 0.05) * Math.abs(bps.current);

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

    // ── the smog: the vent's hiss dies away after the release (it is the canister emptying, not
    //    the air); a low breath of the air it moved lasts while you are deep in it, and is gone
    //    before the story's first sheet — no standing hiss or wind under the film
    const since = t - T.release;
    const gas = gasAmount(t);
    setLayer('hiss', since > 0 ? 0.12 * Math.exp(-since / 2.5) * gas : 0, { freq: 2600 + 1800 * Math.exp(-since / 3) });
    setLayer('air', since > 0 ? (0.16 * Math.exp(-since / 4) + 0.02 * (1 - smooth(T.dissolve, T.story1, t))) * gas : 0);

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
        const edge = startFor(f.side, f.rest[0], f.rest[2] + START_AHEAD, TAN_HALF);
        flightAt(a, f.side, edge, f.seed, _o);
        flightAt(Math.min(1, a + 0.01), f.side, edge, f.seed, _o2);
        const x = (f.rest[0] + _o.x) / Math.max(0.5, (f.rest[2] + _o.z) * TAN_HALF);
        const pan = Math.max(-1, Math.min(1, x * 0.85));
        // Metres per second along its path.
        const v = jump ? 0 : (Math.hypot(_o2.x - _o.x, _o2.y - _o.y, _o2.z - _o.z) / (0.01 * len)) * Math.abs(bps.current);
        const sp = Math.min(1, v / 6);
        // (Only heard as it comes near: far off in the smog a sheet makes no sound you could hear.)
        const close = 1 / (1 + Math.pow(Math.max(0, _o.z) / 2.5, 2));
        if (sp * 0.035 * close > air) {
          air = sp * 0.035 * close;
          airFreq = 650 + 1500 * sp;
          airPan = pan;
        }
        if (s.flap !== null && flap > s.flap && a > aPrev && !jump && flutterAt(a) > 0.04) cue('flap', { pan, level: (0.35 + 0.65 * flutterAt(a)) * close });
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

    // ── the cloud: the air as the camera moves through it — soft pressure, displaced air, wide
    //    and slowly wandering (its course is the beat's, so it plays back the same), only as loud
    //    as the camera is fast; above the cloud, the barest high air
    const inCloud = cloud(t);
    const above = smooth(T.cloudOut - 1, T.cloudOut + 1.5, t) * (1 - smooth(T.descend, T.cloudTop, t));
    const drift = Math.min(1, camSpeed / 24);
    const wander = t * 0.35;
    setLayer('cloudLow', inCloud * (0.01 + 0.032 * Math.pow(drift, 0.8)) + above * 0.006 * (0.4 + 0.6 * drift), { freq: 240 + 200 * drift, pan: 0.55 * Math.sin(wander) });
    // (The mist the journey comes round through: its air, exactly as on the other side of the seam.)
    setLayer('mistAir', 0.018 * fx.mist);
    mosaicSound(fx.mosaic, fx.mosaicSide);
    setLayer('cloudHigh', inCloud * (0.003 + 0.012 * drift), { freq: 1100 + 1000 * drift, pan: -0.55 * Math.sin(wander + 0.8) });

    // ── the tunnel: the light-well's shaft, a tube of air — its resonances rise as the camera goes
    //    down, the air brightens with its speed; it opens into the lobby (the release), and the
    //    Events beyond the door are heard as the air of a room, opening as the door does
    const inShaft = smooth(T.plaza + 1, T.shaft, t) * (1 - smooth(TIP_UP - 0.5, T.lobby, t));
    const depth = span(t, T.shaft, TIP_UP);
    const rush = Math.min(1, camSpeed / 14);
    setLayer('tunnelAir', inShaft * (0.014 + 0.07 * rush), { freq: 150 + 560 * rush });
    setLayer('tunnelRes', inShaft * (0.01 + 0.028 * rush), { freq: 96 + 74 * depth, q: 13, pan: -0.35 });
    setLayer('tunnelRes2', inShaft * (0.005 + 0.014 * rush), { freq: 238 + 190 * depth, q: 15, pan: 0.35 });
    const open = smooth(T.door + DOOR_BEATS * 0.25, T.doorway, t);
    setLayer('eventsAir', smooth(T.lobby - 1, T.lobby + 1, t) * (1 - smooth(T.doorway, T.end, t)) * (0.01 + 0.04 * open), { freq: 280 + 1300 * open });
  });

  return null;
}

/** Where the canister is, left to right, from where the camera is. */
function canPan(t: number) {
  rollAt(t, roll);
  const cam = introCameraAt(t).pos;
  return Math.max(-1, Math.min(1, (roll.x - cam.x) / 1.5));
}
