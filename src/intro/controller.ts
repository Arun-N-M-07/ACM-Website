/**
 * The opening, as a function of the scroll.
 *
 * There is no playhead: the opening's five chapters are the first segments of
 * the journey's scroll track, and every frame the camera rig hands the damped
 * scroll progress here. The beat is progress, rescaled (linearly) onto the
 * beat sheet — so the camera, the light, the fragments, the fire, the name,
 * the cloud, the well, the door are all where the visitor's scroll puts them,
 * and nowhere else. Stop scrolling and everything stops; scroll back and
 * everything plays backwards.
 */
import { INTRO_PROGRESS_END, SEGMENTS } from '@/config/timeline';
import { experience } from '@/store/experience';
import { progress } from '@/systems/scroll/progress';
import { jumpToProgress } from '@/systems/scroll/ScrollTimeline';
import { intro, introFrame } from './state';
import { INTRO_END, introChapterAt } from './timeline';
import { STORY_LINES } from './story/fragments';

/** The beat at scroll progress p. */
export const introTimeAt = (p: number) => Math.min(1, Math.max(0, p / INTRO_PROGRESS_END)) * INTRO_END;
/** The scroll progress at beat t. */
export const progressAtIntroTime = (t: number) => (Math.min(INTRO_END, Math.max(0, t)) / INTRO_END) * INTRO_PROGRESS_END;

/** Idle time (s) before the quiet scroll cue shows: at the very start, and later on. */
const HINT_AT_START = 2.4;
const HINT_LATER = 9;
let shownAt = 0;

/** Called once per frame by the camera rig with the damped progress, before the shot is evaluated. */
export function syncIntro(p: number) {
  const f = introFrame;
  f.active = p < INTRO_PROGRESS_END;
  f.t = introTimeAt(p);

  const s = intro();
  const st = experience();
  const onScreen = f.active && st.phase === 'cinematic';
  if (onScreen !== s.active) {
    s.set({ active: onScreen });
    if (onScreen) shownAt = performance.now();
  }
  if (!onScreen) {
    if (s.hint) s.set({ hint: false });
    return;
  }
  const ch = introChapterAt(f.t);
  if (ch !== s.chapter) s.set({ chapter: ch });
  const line = STORY_LINES.findIndex((l) => f.t >= l.readable[0] && f.t <= l.readable[1]);
  if (line !== s.line) s.set({ line });
  const idle = (performance.now() - Math.max(progress.lastInputAt, shownAt)) / 1000;
  const settled = st.reducedMotion || Math.abs(progress.target - progress.value) < 1e-4;
  const hint = idle > (f.t < 1.5 ? HINT_AT_START : HINT_LATER) && settled;
  if (hint !== s.hint) s.set({ hint });
}

/** Skip the opening: cut (behind the fade) to the start of the Events. */
export function skipIntro() {
  jumpToProgress(SEGMENTS.events.start + 0.0005);
}
