/**
 * The soundtrack. One track, and no sound effects: the experience is either
 * music or silence.
 *
 * Entering with sound starts it at a chosen point in the recording
 * (src/intro/timeline.ts: SCORE_IN), inside the Enter click, and it plays on
 * under the whole journey whatever the scroll does.
 *
 * The audio file is NOT part of this repository. Drop your own copy at
 * `public/audio/the-batman.mp3` (see docs/ASSETS.md), and make sure the
 * chapter has the right to use it on a public site before deploying. Without
 * it, the opening plays in silence and the music controls stay hidden.
 */
export const MUSIC = {
  title: 'The Batman',
  artist: 'Michael Giacchino',
  src: '/audio/the-batman.mp3',
  /** Playback volume (0–1). */
  volume: 0.72,
  /** Seconds to fade in / out when music is switched on or off. */
  fade: 2.2,
} as const;
