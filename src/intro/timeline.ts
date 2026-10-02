/**
 * The opening's beat sheet.
 *
 * The opening is the first stretch of the journey's scroll track
 * (config/timeline.ts): the visitor's scroll is the only clock. Every beat
 * below is a position on that stretch, in "beats" — one beat normally takes
 * INTRO_VH_PER_BEAT viewport-heights of scrolling, about one notch of a mouse
 * wheel — so the whole film is a pure function of scroll progress: stop
 * scrolling and it stops, scroll back and it plays backwards, at the
 * visitor's own speed.
 *
 *   01 Arrival    the prologue, on the ground in the mist: something rolls in
 *                 out of the fog and comes to rest; it releases a pressurised
 *                 purple gas, and the gas itself becomes "22 YEARS AGO" before
 *                 it dissolves into the mist — then the world, in mist
 *   02 The Story  four fragments of an archive, each read and burnt; after the
 *                 second ("Within CEG, a community was born."), a stone in the
 *                 mist carries the chapter's name
 *   03 CEG        the last fragment burns and the mist clears: the red
 *                 building, held; a glide over the fountain pool to hover
 *                 before the tower
 *   04 Ascent     straight up the face of the tower, over the campus, through
 *                 the cloud, out above it; levelling into a flight over the
 *                 sea of cloud, where ACM-CEG stands, huge, and is held
 *   05 Descent    straight down again through the cloud onto the glass
 *                 light-well, which opens; down its shaft into the lobby; the
 *                 EVENTS door opens; through it into the Events
 *
 * The spacing is the pacing. Moments get room in proportion to their weight
 * (a fragment is legible for about six beats, the building is held, the rise
 * and the fall are long), and the camera's own speed is keyed so that what
 * the eye sees changes at a steady rate — slow near things, faster where the
 * ground is far away.
 */

/** Viewport-heights of scrolling per beat (≈ one wheel notch). */
export const INTRO_VH_PER_BEAT = 10;
/**
 * The fastest the opening's camera follows the scroll (beats per second):
 * a hard fling still reads as a move, not a cut. Ordinary scrolling never
 * reaches it.
 */
export const INTRO_MAX_BEATS_PER_SECOND = 10;

/** Where the score starts when the visitor enters with sound (s into the recording). */
export const SCORE_IN = 70.0;

export const T = {
  /**
   * Before the film: the mist the journey comes round through (JourneyLoop). Scrolling back from
   * the film's first frame thickens it; at the very start of the track the journey continues from
   * its end, inside the same mist. (Entering, the film starts at `prologue`, clear.)
   */
  mist: -55,
  // 01 Arrival — the prologue lives on the beats before 0, so every beat of the story keeps its place.
  /** The film begins: the camera almost on the ground, in the mist. */
  prologue: -44,
  /** Something rolls in out of the fog, touching down… */
  roll: -42,
  /** …slows, and comes to rest. */
  rest: -33,
  /** Pressure: the seam wakes, the canister trembles. */
  pressure: -30.5,
  /** The release: the smog floods the air, and the camera rises into it. */
  release: -28,
  /** The smog begins to take the shape of words… */
  form: -19,
  /** …readable, while the camera travels slowly through the smog towards them… */
  legible: -13,
  /** …and they loosen back into smog… */
  dissolve: -8,
  /** …gone; the smog remains (and stays, thinning, through the first two sheets). */
  mixed: -3,
  story1: 4,
  // 02 The Story
  story2: 19,
  /** The second fragment burns; the camera turns towards a stone in the mist… */
  acmTurn: 33,
  /** …it comes out of the mist… */
  acm: 36,
  /** …its uplight wakes and a light runs across the name… */
  acmLit: 41,
  /** …held… */
  acmHold: 44,
  /** …and the camera moves on past it. */
  acmOut: 50,
  acmGone: 56,
  story3: 55,
  story4: 70,
  /** The mist begins to thin behind the last fragment… */
  build: 72,
  /** …and, the last fragment burnt, clears. */
  clearing: 84,
  // 03 CEG
  reveal: 92,
  heroEnd: 103,
  /** The glide over the pool towards the building… */
  approach: 103,
  /** …hovering over the plaza before the tower. */
  hover: 116,
  // 04 Ascent
  /** Straight up. */
  rise: 120,
  /** Into the cloud's base on the way up… */
  cloudIn: 132,
  /** …out of its top. */
  cloudOut: 135.5,
  /** Above the cloud: the rise levels out into flight over the sea of cloud. */
  apex: 138,
  /** Warm cloud light preceding the name's staggered reveal. */
  goldIn: 138.6,
  /** ACM-CEG rises out of the cloud ahead… */
  acmCegIn: 139.5,
  /** …the camera slows into its composition… */
  acmCeg: 144,
  /** The final letter settles into the full composition. */
  acmCegFormed: 144.6,
  /** …and holds it (a deliberate beat), drifting in a little, until here. */
  acmCegHold: 150.5,
  // 05 Descent
  /** Tilting down; into the drop. */
  descend: 155.5,
  /** Into the cloud's top… */
  cloudTop: 158,
  /** …out of its base: the campus below, the light-well at the centre. */
  cloudBase: 163.5,
  /** Low over the light-well. */
  plaza: 172,
  /** The well's glass leaves slide open (over 2 beats). */
  wellOpen: 172,
  /** Through the ground, down the shaft. */
  shaft: 175,
  /** Level, in the lobby. */
  lobby: 182.5,
  /** The door wakes, unlocks and opens (over 6.5 beats). */
  door: 189.5,
  /** Through the door. */
  doorway: 197,
  /** The Events. */
  end: 201,
} as const;

/** The track's first beat (the mist before the film — the film itself begins at T.prologue) and its last. */
export const INTRO_START = T.mist;
export const INTRO_END = T.end;
export const INTRO_SPAN = INTRO_END - INTRO_START;

/** Scroll density only: 6% less travel before Ascent; the building reveal keeps its full spacing. */
const EARLY_SCROLL = [
  [INTRO_START, T.prologue, 1],
  [T.prologue, T.clearing, 0.94],
  [T.clearing, T.heroEnd, 1],
  [T.heroEnd, T.rise, 0.94],
  [T.rise, INTRO_END, 1],
] as const;

/** Scroll distance (vh) at an authored beat. Camera, light and animation keys stay unchanged. */
export function introScrollAt(beat: number) {
  let vh = 0;
  for (const [from, to, density] of EARLY_SCROLL) {
    vh += Math.max(0, Math.min(to, beat) - from) * INTRO_VH_PER_BEAT * density;
    if (beat <= to) break;
  }
  return vh;
}

/** Exact inverse of introScrollAt: the same mapping for forward, reverse and navigation jumps. */
export function introBeatAt(vh: number) {
  let consumed = 0;
  for (const [from, to, density] of EARLY_SCROLL) {
    const span = (to - from) * INTRO_VH_PER_BEAT * density;
    if (vh <= consumed + span) return from + Math.max(0, vh - consumed) / (INTRO_VH_PER_BEAT * density);
    consumed += span;
  }
  return INTRO_END;
}

export type IntroChapterId = 'arrival' | 'story' | 'ceg' | 'ascent' | 'descent';

export interface IntroChapter {
  id: IntroChapterId;
  number: string;
  label: string;
  from: number;
  to: number;
  /** Where "go to this chapter" lands (a composed moment, not the cut). */
  enterAt: number;
}

/** User-facing chapters (numbered so the journey's own 06–08 follow on). */
export const INTRO_CHAPTERS: IntroChapter[] = [
  { id: 'arrival', number: '01', label: 'Arrival', from: INTRO_START, to: T.story1, enterAt: T.prologue },
  { id: 'story', number: '02', label: 'The Story', from: T.story1, to: T.clearing, enterAt: 12 },
  { id: 'ceg', number: '03', label: 'CEG', from: T.clearing, to: T.rise, enterAt: T.reveal + 2 },
  { id: 'ascent', number: '04', label: 'Ascent', from: T.rise, to: T.descend, enterAt: T.rise + 0.5 },
  { id: 'descent', number: '05', label: 'Descent', from: T.descend, to: T.end, enterAt: T.descend + 0.5 },
];

export function introChapterAt(t: number): IntroChapterId {
  for (const c of INTRO_CHAPTERS) if (t < c.to) return c.id;
  return 'descent';
}

/**
 * Reduced motion: framed stills the camera cuts between instead of flying —
 * the canister come to rest, the words in the gas, each fragment legible, the
 * name, the building, the tower, the rise, ACM-CEG over the cloud, the well
 * below, the lobby, the open door.
 */
export const STILLS = [-32, -11, 13, 28, 45, 64, 79, 95, 117, 127, 147, 167, 185, 195];

// ─── helpers ──────────────────────────────────────────────────────────────────

/** 0 → 1 as the light-well's glass slides open. */
export const wellOpenAmount = (t: number) => ease(t, T.wellOpen, T.wellOpen + 2);

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** 0 → 1 across [a, b] (linear, clamped). */
export const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
/** Smoothstep across [a, b]. */
export const ease = (t: number, a: number, b: number) => {
  const x = span(t, a, b);
  return x * x * (3 - 2 * x);
};
/** Smootherstep across [a, b]. */
export const ease5 = (t: number, a: number, b: number) => {
  const x = span(t, a, b);
  return x * x * x * (x * (x * 6 - 15) + 10);
};
/** Up across [a, b], down across [c, d]. */
export const window4 = (t: number, a: number, b: number, c: number, d: number) => ease(t, a, b) * (1 - ease(t, c, d));
