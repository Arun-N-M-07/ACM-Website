/**
 * The intro's playhead: the visitor asks the film to continue; the film
 * decides how.
 *
 *   input (wheel / touch / keys, normalised in IntroInput)
 *     → steps: "continue" / "go back"
 *       → the goal moves to the next (or previous) rest point
 *         → the playhead travels towards it at no more than real time
 *           (the score can't play faster), easing in and coming to rest
 *
 * One gesture never skips anything — at most it queues the next two rest
 * points, and between rest points the film always plays at its own speed.
 * The reveal-and-hold and the journey to the Events have no rest points
 * inside: once begun they play through (a gesture back still rewinds).
 *
 * With music on, the score is the clock: while the film cruises, the playhead
 * is phase-locked to the recording; as it comes to rest the music breathes
 * out and pauses, and resumes in sync on the next step. Without music (or if
 * the file fails) the playhead runs on its own clock — nothing waits for audio.
 *
 * Reaching the end hands the camera to the journey's scroll at the Events.
 */
import { experience } from '@/store/experience';
import { music } from '@/systems/audio/music';
import { fx } from '@/systems/camera/effects';
import { progress } from '@/systems/scroll/progress';
import { placeScroll } from '@/systems/scroll/ScrollTimeline';
import { intro, introFrame } from './state';
import { INTRO_CHAPTERS, INTRO_END, introChapterAt, REST_POINTS, SCORE_IN, STILLS } from './timeline';
import { STORY_LINES } from './story/fragments';

/** Forward: never faster than real time (the score plays at 1×). */
const V_FWD = 1;
/** Back: rewinding may be quicker. */
const V_REV = 1.8;
/** Arrival gain: within ~1/ARRIVE s of the goal the film slows to rest. */
const ARRIVE = 1.1;
/** How quickly velocity follows its target (1/s): the start is a gentle ease-in. */
const ACCEL = 2.4;
/** Resting this long (s) shows the quiet "scroll" cue. */
const HINT_AFTER = 2.6;

type Listener = (t: number, dt: number) => void;
const listeners = new Set<Listener>();
/** Per-frame subscription for the DOM layer (sr text, hint, skip). */
export function onIntroFrame(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

let scorePending = 0;
let stillTarget: number | null = null;
/** Reduced motion: the fade between stills (the intro owns fx.fade while it cuts). */
let stillFade = 0;

const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);

/** Is the playhead's clock allowed to follow the score right now? */
function scoreWanted() {
  const st = experience();
  return st.musicOn && !music.failed;
}

// ─── lifecycle ────────────────────────────────────────────────────────────────

/** Enter: the threshold has been crossed. The arrival plays itself to the first fragment. */
export function startIntro(withMusic: boolean) {
  const f = introFrame;
  f.active = true;
  f.handedOff = false;
  f.t = 0;
  f.v = 0;
  f.idle = 0;
  f.goal = REST_POINTS[1];
  stillTarget = null;
  stillFade = 0;
  // Reduced motion: the film is a sequence of framed stills, starting on the first.
  if (experience().reducedMotion) f.t = f.goal = STILLS[0];
  intro().set({ state: 'playing', chapter: 'arrival', line: -1, hint: false });
  experience().set({ phase: 'intro', chapter: 'arrival' });
  if (withMusic) {
    // Start the score with the film; the arrival fades it up out of nothing.
    scorePending = performance.now();
    void music.playFrom(SCORE_IN, 3);
  }
}

/** Hand the camera to the journey at the Events (the film has reached its end). */
function handoff() {
  const f = introFrame;
  f.active = false;
  f.handedOff = true;
  f.v = 0;
  f.pull = 0;
  intro().set({ state: 'done', hint: false, line: -1 });
  experience().set({ phase: 'cinematic', segment: 'events', chapter: 'events' });
  // The journey's progress 0 is the corridor mouth — exactly where the film ends.
  progress.value = 0;
  placeScroll(0);
  // The score carries on into the Events (even if the film was skipped while it rested).
  if (scoreWanted()) {
    music.setLevel(1);
    if (!music.running) void music.playFrom(SCORE_IN + INTRO_END, 1.6);
  }
}

/**
 * Leave the intro for the journey right away (skip, deep links, the index):
 * the caller cuts to wherever it is going behind a fade.
 */
export function endIntro() {
  const f = introFrame;
  if (!f.active) return;
  f.t = INTRO_END;
  f.goal = INTRO_END;
  handoff();
}

/** Skip to the Events: a quick fade through black to the corridor mouth. */
export function skipIntro() {
  if (!introFrame.active) return;
  fx.fade = 1;
  endIntro();
}

/** Come back into the intro from the Events (a sustained scroll back at the corridor mouth). */
export function reenterIntro() {
  const f = introFrame;
  if (f.active) return;
  f.active = true;
  f.t = INTRO_END;
  f.v = 0;
  f.pull = 0;
  f.goal = REST_POINTS[REST_POINTS.length - 2];
  intro().set({ state: 'playing', chapter: introChapterAt(f.t) });
  experience().set({ phase: 'intro', chapter: introChapterAt(f.t) });
}

/** Jump straight into the film at film time `t` (the index): cut there and rest. */
export function jumpIntro(t: number) {
  const f = introFrame;
  f.active = true;
  f.handedOff = false;
  f.t = clamp(t, 0, INTRO_END);
  f.goal = f.t;
  f.v = 0;
  fx.fade = 1;
  music.hold(0.3);
  intro().set({ state: 'resting', chapter: introChapterAt(f.t) });
  experience().set({ phase: 'intro', chapter: introChapterAt(f.t) });
}

// ─── intent ───────────────────────────────────────────────────────────────────

/** One "continue" (+1) or "go back" (−1). */
export function stepIntro(dir: 1 | -1) {
  const f = introFrame;
  if (!f.active) return;
  f.idle = 0;
  if (intro().hint) intro().set({ hint: false });
  if (experience().reducedMotion) return stepStill(dir);
  if (dir > 0) {
    // Continue from where the film is already heading (so repeated steps queue),
    // but never more than two rest points ahead of the playhead.
    const base = f.goal > f.t ? f.goal : f.t;
    const next = REST_POINTS.find((r) => r > base + 0.05) ?? INTRO_END;
    const ahead = REST_POINTS.filter((r) => r > f.t + 0.05);
    f.goal = Math.min(next, ahead[1] ?? INTRO_END);
  } else {
    const base = f.goal < f.t ? f.goal : f.t;
    const prev = [...REST_POINTS].reverse().find((r) => r < base - 0.05) ?? 0;
    const behind = [...REST_POINTS].reverse().filter((r) => r < f.t - 0.05);
    f.goal = Math.max(prev, behind[1] ?? 0);
  }
  if (f.goal !== f.t && intro().state !== 'playing') intro().set({ state: 'playing' });
}

/** Reduced motion: cut to the next / previous still behind a fade. */
function stepStill(dir: 1 | -1) {
  const f = introFrame;
  const from = stillTarget ?? f.t;
  const next = dir > 0 ? STILLS.find((s) => s > from + 0.05) : [...STILLS].reverse().find((s) => s < from - 0.05);
  if (next === undefined) {
    if (dir > 0 && from >= INTRO_END - 0.05) handoff();
    return;
  }
  stillTarget = next;
}

// ─── the frame ────────────────────────────────────────────────────────────────

/** Called once per frame by the camera rig, before the shot is evaluated. */
export function updateIntro(dt: number) {
  const f = introFrame;
  if (!f.active) return;
  const st = experience();
  const held = st.menuOpen || st.textVersionOpen || !!st.dossier;

  if (st.reducedMotion) updateStills(dt);
  else {
    const d = f.goal - f.t;
    let vt = 0;
    if (!held && Math.abs(d) > 1e-4) {
      if (d > 0) {
        vt = Math.min(V_FWD, d * ARRIVE);
        // Cruising with the score playing: follow its clock.
        if (music.running && scoreWanted() && d > 1.1 && f.v > 0.4) {
          const lag = music.time - (SCORE_IN + f.t);
          if (Math.abs(lag) < 3) vt = clamp(1 + lag * 0.9, 0.7, 1.3);
        }
      } else vt = Math.max(-V_REV, d * ARRIVE * 1.5);
    }
    f.v += (vt - f.v) * (1 - Math.exp(-dt * ACCEL));
    const before = f.t;
    f.t = clamp(f.t + f.v * dt, 0, INTRO_END);
    // Never pass the goal.
    if ((before <= f.goal && f.t > f.goal) || (before >= f.goal && f.t < f.goal) || Math.abs(f.goal - f.t) < 0.002) {
      if (Math.abs(f.goal - f.t) < 0.02) {
        f.t = f.goal;
        if (Math.abs(f.v) < 0.25) f.v = 0;
      }
    }
    syncScore(held);
  }

  // Resting / hint.
  const resting = f.t === f.goal && f.v === 0;
  // The cue waits for the film to have been at rest a while (not just for input).
  f.idle = resting ? f.idle + dt : 0;
  const s = intro();
  if (resting && s.state === 'playing') s.set({ state: 'resting' });
  if (!resting && s.state === 'resting') s.set({ state: 'playing' });
  const hint = resting && f.idle > HINT_AFTER && f.t < INTRO_END;
  if (hint !== s.hint) s.set({ hint });

  // Chapter and readable line (a few times per minute).
  const ch = introChapterAt(f.t);
  if (ch !== s.chapter) {
    s.set({ chapter: ch });
    st.set({ chapter: ch });
  }
  const line = STORY_LINES.findIndex((l) => f.t >= l.readable[0] && f.t <= l.readable[1]);
  if (line !== s.line) s.set({ line });

  for (const l of listeners) l(f.t, dt);

  // The end of the film is the start of the Events.
  if (f.t >= INTRO_END - 1e-4 && f.goal >= INTRO_END - 1e-4 && f.v >= 0) handoff();
}

function updateStills(dt: number) {
  const f = introFrame;
  f.v = 0;
  if (stillTarget !== null) {
    // Out to black, cut, back in.
    stillFade = Math.min(1, stillFade + dt * 4);
    if (stillFade >= 1) {
      f.t = f.goal = stillTarget;
      stillTarget = null;
    }
  } else {
    // (Reduced motion switched on mid-film: stay on this frame.)
    f.goal = f.t;
    stillFade = Math.max(0, stillFade - dt * 3);
  }
  // Runs after the rig's own fade handling, so this is what's drawn. The score
  // is left to play on its own: the stills don't follow it.
  fx.fade = Math.max(fx.fade, stillFade);
}

/** Keep the score with the film: play while it cruises, breathe out as it rests. */
function syncScore(held: boolean) {
  const f = introFrame;
  if (!scoreWanted()) return;
  const cruising = !held && f.v > 0.5 && f.goal - f.t > 0.4;
  if (music.running) {
    scorePending = 0;
    if (f.v < -0.05 || held) music.hold(0.35);
    else if (f.goal - f.t < 1.2 && f.goal < INTRO_END) music.setLevel(clamp(f.v * 1.15, 0, 1));
    else music.setLevel(1);
    if (f.v === 0 && f.t === f.goal && f.t < INTRO_END) music.hold(0.9);
    f.scoreLocked = Math.abs(music.time - (SCORE_IN + f.t)) < 1.5;
    return;
  }
  f.scoreLocked = false;
  const waiting = scorePending && performance.now() - scorePending < 4000;
  if (cruising && !waiting) {
    scorePending = performance.now();
    music.setLevel(1);
    void music.playFrom(SCORE_IN + f.t + 0.15, 0.7);
  }
}

/** The chapter a film time belongs to, for navigation. */
export const introChapterStart = (id: string) => INTRO_CHAPTERS.find((c) => c.id === id)?.enterAt ?? 0;
