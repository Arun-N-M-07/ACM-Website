/**
 * The intro's state.
 *
 * Per-frame values (the playhead, its velocity, what the camera and the world
 * derive from it) live in `introFrame`, a plain mutable object read and
 * written inside the frame loop — never React state. The few discrete facts
 * the interface needs (is the intro running, is it resting, which chapter,
 * which line of the story is readable) live in the small `useIntro` store and
 * change a handful of times per minute.
 */
import { create } from 'zustand';
import type { IntroChapterId } from './timeline';

export type IntroState =
  /** Not started (loading, waiting at the threshold). */
  | 'idle'
  /** The film is moving. */
  | 'playing'
  /** Stopped at a rest point, waiting for the visitor. */
  | 'resting'
  /** Handed over to the Events; the journey's scroll owns the camera. */
  | 'done';

export const introFrame = {
  /** The intro owns the camera (between Enter and the handoff, or while rewinding into it). */
  active: false,
  /** Film time (s). */
  t: 0,
  /** Playhead velocity (film seconds per second). */
  v: 0,
  /** Where the playhead is heading (a rest point, or the end). */
  goal: 0,
  /** Seconds since the last input (for the rest hint). */
  idle: 0,
  /** Reduced motion: fade to black / back for cuts between stills. */
  cut: 0,
  /** The score is the clock (music playing and locked). */
  scoreLocked: false,
  /** Set when the film reached the end in this pass (the handoff has happened). */
  handedOff: false,
  /** Fraction of the way into the "pull" that re-enters the intro from the Events. */
  pull: 0,
};

interface IntroStore {
  state: IntroState;
  chapter: IntroChapterId;
  /** Index of the story fragment currently readable (−1: none). */
  line: number;
  /** Show the quiet "scroll" cue (resting, and the visitor hasn't moved for a while). */
  hint: boolean;
  set: (p: Partial<Omit<IntroStore, 'set'>>) => void;
}

export const useIntro = create<IntroStore>((set) => ({
  state: 'idle',
  chapter: 'arrival',
  line: -1,
  hint: false,
  set: (p) => set(p),
}));

export const intro = () => useIntro.getState();
