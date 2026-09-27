/**
 * The opening's state.
 *
 * Per-frame values live in `introFrame`, a plain mutable object read and
 * written inside the frame loop — never React state. It is derived from the
 * scroll (controller.ts): the opening has no clock of its own. The few
 * discrete facts the interface needs (is the opening on screen, which
 * chapter, which line of the story is readable, whether to show the quiet
 * scroll cue) live in the small `useIntro` store and change a handful of
 * times per minute.
 */
import { create } from 'zustand';
import type { IntroChapterId } from './timeline';

export const introFrame = {
  /** The opening owns the camera (the journey's progress is within it). */
  active: true,
  /** The beat the scroll is at (see timeline.ts). */
  t: 0,
};

interface IntroStore {
  /** The opening is what's on screen (entered, and scrolled to within it). */
  active: boolean;
  chapter: IntroChapterId;
  /** Index of the story fragment currently readable (−1: none). */
  line: number;
  /** Show the quiet "scroll" cue (the visitor hasn't scrolled for a while). */
  hint: boolean;
  set: (p: Partial<Omit<IntroStore, 'set'>>) => void;
}

export const useIntro = create<IntroStore>((set) => ({
  active: false,
  chapter: 'arrival',
  line: -1,
  hint: false,
  set: (p) => set(p),
}));

export const intro = () => useIntro.getState();
