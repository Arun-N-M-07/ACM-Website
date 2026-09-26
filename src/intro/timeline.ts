/**
 * The intro's timeline, in seconds of film time.
 *
 * The cinematic is scored to the supplied recording (config/music.ts). Film
 * time t = 0 plays the score from SCORE_IN, so every moment below is also a
 * point in the music. Chapter boundaries sit on the score's own structure,
 * measured from the file with scripts/intro/analyze-score.mjs (see
 * docs/INTRO.md):
 *
 *   1:10.0  t 0     the world, in mist
 *   1:13.0  t 3     phrase — the first fragment of the story
 *   1:19.0  t 9     a swell — the second fragment (ACM)
 *   1:22.75 t 12.75 the music breathes (a 2 s thinning)…
 *   1:25.0  t 15    …and a new phrase begins: the crescendo; the mist starts to part
 *   1:37.0  t 27    the full orchestra — the red building, complete
 *   1:37–1:49        one whole phrase held on the building
 *   1:49.0  t 39    the next phrase — the camera begins to rise
 *   ~1:54   t 44    bright peaks — into the cloud
 *   2:01.0  t 51    the loudest bar — the tunnel forms out of the dark
 *   2:04.0  t 54    EVENTS catches the light
 *   2:07.0  t 57    through EVENTS; the Events world begins (the phrase resolves at 2:13)
 *
 * The phrases are twelve seconds long (four 3-second bars at ~80 bpm), which
 * is why the chapters are too.
 */

/** Score time (s) at film time 0. */
export const SCORE_IN = 70.0;
/** Score time at which the phrase that carries the handoff resolves. */
export const SCORE_RESOLVE = 133.0;

export const T = {
  story1: 3,
  story2: 9,
  breath: 12.75,
  build: 15,
  reveal: 27,
  heroEnd: 39,
  cloudIn: 44,
  cloudDeep: 46,
  descent: 48,
  tunnel: 51,
  events: 54,
  end: 57,
} as const;

export const INTRO_END = T.end;

export type IntroChapterId = 'arrival' | 'story' | 'ceg' | 'ascent' | 'descent';

export interface IntroChapter {
  id: IntroChapterId;
  number: string;
  label: string;
  from: number;
  to: number;
  /** Where "jump to this chapter" lands (a composed moment, not the cut). */
  enterAt: number;
}

/** User-facing chapters (numbered so the journey's own 06–08 follow on). */
export const INTRO_CHAPTERS: IntroChapter[] = [
  { id: 'arrival', number: '01', label: 'Arrival', from: 0, to: T.story1, enterAt: 0 },
  { id: 'story', number: '02', label: 'The Story', from: T.story1, to: T.reveal, enterAt: T.story1 },
  { id: 'ceg', number: '03', label: 'CEG', from: T.reveal, to: T.heroEnd, enterAt: T.reveal + 1.5 },
  { id: 'ascent', number: '04', label: 'Ascent', from: T.heroEnd, to: T.descent, enterAt: T.heroEnd },
  { id: 'descent', number: '05', label: 'Descent', from: T.descent, to: T.end, enterAt: T.descent },
];

export function introChapterAt(t: number): IntroChapterId {
  for (const c of INTRO_CHAPTERS) if (t < c.to) return c.id;
  return 'descent';
}

/**
 * Where the film comes to rest when the visitor stops asking it to continue:
 * each fragment of the story fully readable, the end of the building's
 * phrase, the end. There are none inside the reveal-and-hold (25 → 39) or the
 * journey (39 → 57): once begun, those play through.
 */
export const REST_POINTS = [0, 8, 13.2, 20, 25.2, T.heroEnd, T.end];

/**
 * Reduced motion: framed stills the film cuts between instead of flying (the
 * ascent and the cloud are motion, not pictures — the hero cuts to the tunnel).
 */
export const STILLS = [1.5, 8, 13.2, 20, 25.2, 32, 55.2, T.end];

// ─── helpers ──────────────────────────────────────────────────────────────────

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
