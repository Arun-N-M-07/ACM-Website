/**
 * Test hooks for the visual QA harness (dev builds, or ?debug in production):
 * window.__acm.intro — put the scroll at any beat of the opening, read its state.
 */
import { music } from '@/systems/audio/music';
import { progress } from '@/systems/scroll/progress';
import { jumpToProgress, scrollToProgress } from '@/systems/scroll/ScrollTimeline';
import { progressAtIntroTime, skipIntro } from './controller';
import { intro, introFrame } from './state';

export const introDebug = {
  snapshot() {
    const f = introFrame;
    const s = intro();
    return {
      active: f.active,
      t: Math.round(f.t * 1000) / 1000,
      p: Math.round(progress.value * 1e5) / 1e5,
      target: Math.round(progress.target * 1e5) / 1e5,
      chapter: s.chapter,
      line: s.line,
      hint: s.hint,
      music: music.running ? Math.round(music.time * 100) / 100 : null,
    };
  },
  /** Cut the scroll to beat t. */
  at(t: number) {
    jumpToProgress(progressAtIntroTime(t));
  },
  /** Scroll smoothly to beat t (as a long, steady scroll would). */
  scroll(t: number, seconds = 2) {
    scrollToProgress(progressAtIntroTime(t), seconds);
  },
  /** The progress of beat t. */
  progressAt: (t: number) => progressAtIntroTime(t),
  skip: () => skipIntro(),
};
