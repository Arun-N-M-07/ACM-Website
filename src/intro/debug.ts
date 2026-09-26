/**
 * Test hooks for the visual QA harness (dev builds, or ?debug in production):
 * window.__acm.intro — put the film anywhere, play it, read its state.
 */
import { music } from '@/systems/audio/music';
import { jumpIntro, skipIntro, stepIntro } from './controller';
import { intro, introFrame } from './state';
import { INTRO_END, SCORE_IN } from './timeline';

export const introDebug = {
  snapshot() {
    const f = introFrame;
    const s = intro();
    return {
      active: f.active,
      t: Math.round(f.t * 1000) / 1000,
      v: Math.round(f.v * 1000) / 1000,
      goal: f.goal,
      state: s.state,
      chapter: s.chapter,
      line: s.line,
      hint: s.hint,
      score: music.running ? Math.round((music.time - SCORE_IN) * 1000) / 1000 : null,
      locked: f.scoreLocked,
    };
  },
  /** Cut to film time t and rest there. */
  at(t: number) {
    jumpIntro(t);
  },
  /** Play (at film speed) from wherever the playhead is to film time t. */
  play(t: number) {
    introFrame.goal = Math.min(INTRO_END, Math.max(0, t));
    intro().set({ state: 'playing' });
  },
  step: (dir: 1 | -1) => stepIntro(dir),
  skip: () => skipIntro(),
};
