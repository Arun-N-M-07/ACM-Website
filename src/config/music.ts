/**
 * The soundtrack. One track plays, quietly, for the whole journey — there are
 * no sound effects: the experience is either music or silence.
 *
 * The audio file is NOT part of this repository. Drop your own copy at
 * `public/audio/pink-white.mp3` (see docs/ASSETS.md), and make sure the
 * chapter has the right to use it on a public site before deploying.
 */
export const MUSIC = {
  title: 'Pink + White',
  artist: 'Frank Ocean',
  src: '/audio/pink-white.mp3',
  /** Playback volume (0–1). */
  volume: 0.62,
  /** Seconds to fade in / out. */
  fade: 2.2,
} as const;
