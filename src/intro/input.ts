/**
 * Input → intent.
 *
 * Wheels, trackpads, Magic Mice and fingers report wildly different deltas —
 * a mouse notch is ~100 px in one event, a trackpad swipe is dozens of small
 * events followed by a long momentum tail. The film doesn't care how far the
 * page "would" have scrolled; it wants to know one thing: continue, or go
 * back. So input is grouped into gestures (a burst of events in one direction
 * with no pause longer than GAP), and a gesture becomes a step:
 *
 *   – any deliberate gesture → one step (the next rest point)
 *   – a long one (sustained scrolling) → at most two more
 *   – momentum tails, one huge wheel event, high-resolution deltas → still
 *     one gesture: they can't skip anything
 *
 * The film then plays each step at its own speed (controller.ts).
 *
 * At the corridor mouth, after the handoff, a sustained scroll back re-enters
 * the film (backwards) — a pull, so reading back up the Events never does it
 * by accident.
 */
import { experience } from '@/store/experience';
import { progress } from '@/systems/scroll/progress';
import { teamsFrame } from '@/teams/state';
import { reenterIntro, stepIntro } from './controller';
import { introFrame } from './state';

/** Silence (ms) that ends a gesture. */
const GAP = 240;
/** Normalised distance (px) that makes a gesture deliberate. */
const START = 14;
/** Extra distance (px) per further step within one sustained gesture… */
const MORE = 720;
/** …and how many further steps one gesture may add. */
const MAX_EXTRA = 2;
/** Sustained scroll back at the corridor mouth (px) that re-enters the film. */
export const PULL_BACK = 560;

interface Gesture {
  dir: 0 | 1 | -1;
  sum: number;
  steps: number;
  at: number;
}

const gesture: Gesture = { dir: 0, sum: 0, steps: 0, at: 0 };

/** Wheel delta in CSS pixels, whatever the device reports. */
export function wheelPixels(e: WheelEvent) {
  if (e.deltaMode === 1) return e.deltaY * 16;
  if (e.deltaMode === 2) return e.deltaY * window.innerHeight;
  return e.deltaY;
}

/** Feed normalised movement (px, + = continue). Returns the steps taken. */
export function feedIntent(px: number, now = performance.now()) {
  if (!px) return 0;
  const dir: 1 | -1 = px > 0 ? 1 : -1;
  if (now - gesture.at > GAP || dir !== gesture.dir) {
    gesture.dir = dir;
    gesture.sum = 0;
    gesture.steps = 0;
  }
  gesture.at = now;
  gesture.sum += Math.abs(px);
  let taken = 0;
  const due = gesture.sum < START ? 0 : 1 + Math.min(MAX_EXTRA, Math.floor((gesture.sum - START) / MORE));
  while (gesture.steps < due) {
    gesture.steps++;
    taken++;
    stepIntro(dir);
  }
  return taken;
}

/** Is the film listening (running, and nothing is open over it)? */
export function filmListening() {
  const st = experience();
  return introFrame.active && st.phase === 'intro' && !st.menuOpen && !st.dossier && !st.textVersionOpen;
}

/** At the corridor mouth, after the film: scrolling back gathers a pull. */
export function atFilmEnd() {
  const st = experience();
  return !introFrame.active && st.phase === 'cinematic' && !teamsFrame.inside && progress.target <= progress.lock.min + 0.0005 && !st.menuOpen && !st.dossier && !st.textVersionOpen;
}

/** Add to (or let decay) the pull back into the film; re-enters when it completes. */
export function feedPull(px: number) {
  // px < 0: back.
  if (px >= 0) {
    introFrame.pull = Math.max(0, introFrame.pull - px * 0.5);
    return;
  }
  introFrame.pull += -px;
  if (introFrame.pull > PULL_BACK) {
    introFrame.pull = 0;
    reenterIntro();
    // The re-entry is this gesture's step: the rest of it (its momentum tail) adds nothing.
    gesture.dir = -1;
    gesture.sum = Infinity;
    gesture.steps = 1 + MAX_EXTRA;
    gesture.at = performance.now();
  }
}

/** Per frame: an unfinished pull relaxes. */
export function relaxPull(dt: number) {
  if (introFrame.pull > 0) introFrame.pull *= Math.exp(-dt * 1.4);
  if (introFrame.pull < 1) introFrame.pull = 0;
}
