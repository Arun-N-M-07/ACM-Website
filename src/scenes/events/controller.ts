/**
 * The Events' track, and what is asked of it.
 *
 * One scroll track (config/timeline: EVENTS_TRACK): the arrival, the whole
 * matrix (the hub), one room part — whichever event was chosen — and the whole
 * matrix again (the rejoin), from where the scroll goes on through the
 * matrix's opening to the portal. The picture is the same all along the hub
 * and the rejoin, so they are joined at a seam in each (HUB_SEAM,
 * REJOIN_SEAM): scrolling on from the hub with no event chosen, the journey
 * continues past the rejoin's seam by as much as it went past the hub's, and
 * back — ScrollTimeline.shiftProgress, as the journey's loop is made: no cut,
 * the scroll's own motion carried across. An event chosen (Visit, the index),
 * the room part is live instead — and walled at its end: the choice there,
 * never another event unasked.
 *
 *   Visit          request entry on the same scroll track; input can interrupt
 *   Back to full   scroll back through the record and room to the matrix
 *   Next event     back out, and — once at the matrix — visit the next
 *   Visit the Crew on from the whole matrix through its opening to the portal
 *
 * Two kinds of time, never confused. The SCROLL is where the visitor is: the
 * matrix, camera approach, the step inside and editorial. It stops/reverses
 * exactly at that position. Only the INSTALLATION plays at a fixed pace once
 * the room is reached, reversing at its own pace when asked. That clock never
 * writes scroll, camera or page progress. It uses the existing frame callback:
 * no timers, no animation-completion navigation, no loop of its own.
 */
import { EVENTS } from '@/content/events';
import { EVENTS_TRACK as K, INTRO_PROGRESS_END, PORTAL_DWELL, PORTAL_GATE, PORTAL_SPLIT, SEGMENTS, eventsAt, segmentAt, segmentProgress } from '@/config/timeline';
import { INTRO_SPAN, INTRO_START, T } from '@/intro/timeline';
import { introFrame } from '@/intro/state';
import { EVENT_ROOMS } from '@/config/world';
import { experience } from '@/store/experience';
import { cue } from '@/systems/audio/sfx';
import { clamp01, easeInOutSine, smoothstep, type CameraPose } from '@/systems/camera/pose';
import { progress } from '@/systems/scroll/progress';
import { cancelScrollMotion, jumpToProgress, scrollSpan, scrollToProgress, shiftProgress } from '@/systems/scroll/ScrollTimeline';
import { teamsFrame } from '@/teams/state';
import { eventsFrame, eventsState } from './state';
import { eventsNavigation, HUB_REST, HUB_SEAM, REJOIN_SEAM } from './track';

const N = EVENTS.length;

/** With reduced motion, the room's framed still (systems/camera/shots: ROOM_STILLS), cut to at once. */
const ROOM_STILL = K.room.end;
/** Only the installation has a playback pace (s), independent of navigation. */
const ROOM_PLAY_S = 4;
const ROOM_UNPLAY_S = 1.6;
/** Standing before the portal (where "Visit the Crew" goes). */
const PORTAL_STAND = SEGMENTS.portal.start + (SEGMENTS.portal.end - SEGMENTS.portal.start) * PORTAL_DWELL;

/** The moves' own pace (s): the record slid away (Back, Next); on to the portal. */
const PACE = { crew: 5.8 };

/** The matrix's light, and its rooms, coming up: from the door half open, to half-way across the hall. */
const REVEAL_FROM = INTRO_PROGRESS_END * ((T.door + 3.5 - INTRO_START) / INTRO_SPAN);
const REVEAL_TO = eventsAt('arrival', 0.5);

/** The picture is the whole matrix, still, at progress p (the hub, or the rejoin). */
export const atHub = (p: number) => (p >= K.hub.start && p <= K.enter.start) || (p >= K.rejoin.start && p <= K.rejoin.end);

// ─── The track: its walls, and the join at the matrix ────────────────────────

let lastTarget: number | null = null;

/** The furthest the room part goes: a hair inside it (at its very end the track is the rejoin's — the whole matrix). */
const BRANCH_LAST = K.branch.end - (K.decide.end - K.decide.start) * 0.004;
/** The record's first screen: risen over the room (its framed still — and, with reduced motion, where it ends: it scrolls itself). */
export const RECORD_STILL = eventsAt('read', 0);

/**
 * The wall at the end of a visited event's record, where the choice is. The record is a page the
 * scroll moves px for px, from where its edge starts up over the room: the wall is where its foot
 * meets the screen's — as far as the record is long, and no further (never scroll with nothing
 * moving). (A record longer than the room part has room for, on a short screen, reads a little
 * faster than the scroll instead.)
 */
export function recordWall() {
  if (experience().reducedMotion) return RECORD_STILL;
  const R = eventsFrame.record;
  const length = Math.max(R.height, R.screen);
  if (!(length > 0)) return BRANCH_LAST;
  return Math.min(BRANCH_LAST, Math.max(RECORD_STILL, K.unfold.start + length / Math.max(1, scrollSpan())));
}

/** The walls the Events put on the scroll (outside the Crew's world: travel.applyScrollLock keeps it there). */
function applyWall() {
  if (teamsFrame.inside) return;
  progress.lock.max = eventsState().visiting ? recordWall() : PORTAL_GATE;
}

function endVisit() {
  const st = eventsState();
  if (st.visiting || st.selected >= 0) st.set({ visiting: false, selected: -1 });
  applyWall();
}

/** Installation playback (0..1), and the room it is for. */
let roomPlay = 0;
let clockFor = -1;
let playbackAt = 0;
let playbackDirection = 1;

/**
 * Once a frame, before the camera is placed: the join at the matrix (no event chosen, the scroll
 * passes from the hub's seam to the rejoin's and back), the walls and installation playback.
 */
export function stepEventsTrack(dt = 0) {
  const st = eventsState();
  const t = progress.target;
  const prev = lastTarget;
  lastTarget = t;
  applyWall();
  stepClocks(dt);
  if (teamsFrame.inside || experience().phase !== 'cinematic' || progress.pending) return;
  // Back in the matrix, past where its scroll turns for the Crew, and the room's exit played: the
  // visit is over.
  // Selection at the hub is allowed to wait indefinitely. End a visit only when the visitor has
  // actually scrolled back across the seam, not merely because selection began there.
  if (st.visiting && prev !== null && prev >= HUB_SEAM && t < HUB_SEAM - 1e-5) return endVisit();
  if (st.visiting || !(t > HUB_SEAM && t < REJOIN_SEAM)) return;
  // No event chosen, and the scroll between the seams: carry it across, the way it came — a step of
  // the scroll's own (however fast, far less than the room part is long). Anything else put it there
  // (a jump, the page's scroll landing a pixel short of where it was sent): back to whichever side is
  // nearer, the picture the same there.
  const step = prev === null ? Infinity : Math.abs(t - prev);
  const scrolled = step < (REJOIN_SEAM - HUB_SEAM) * 0.4;
  if (scrolled && prev! <= HUB_SEAM) shiftProgress(REJOIN_SEAM - HUB_SEAM);
  else if (scrolled && prev! >= REJOIN_SEAM) shiftProgress(HUB_SEAM - REJOIN_SEAM);
  else jumpToProgress(t - HUB_SEAM < REJOIN_SEAM - t ? HUB_INSIDE : REJOIN_INSIDE, 0, { fade: false });
  lastTarget = progress.target;
}

/**
 * Installation playback only. Scroll chooses direction, never speed. Neither its completion nor
 * its duration can move the camera, change the scroll or gate the editorial.
 */
function stepClocks(dt: number) {
  const st = eventsState();
  const v = eventsFrame.view;
  if (st.selected !== clockFor) {
    clockFor = st.selected;
    roomPlay = 0;
    playbackAt = progress.target;
    playbackDirection = 1;
  }
  const on = experience().phase === 'cinematic' && !teamsFrame.inside;
  const navigation = eventsNavigation(progress.target, st.selected);
  const delta = progress.target - playbackAt;
  if (Math.abs(delta) > 1e-8) playbackDirection = delta > 0 ? 1 : -1;
  playbackAt = progress.target;
  const inside = on && st.visiting && navigation.enter === 1;
  const now = experience().reducedMotion;
  if (now) roomPlay = inside ? 1 : 0;
  else if (inside && playbackDirection > 0) roomPlay = Math.min(1, roomPlay + dt / ROOM_PLAY_S);
  else roomPlay = Math.max(0, roomPlay - dt / ROOM_UNPLAY_S);
  v.play = roomPlay;
}

/** Well inside each side of the join (a page scroll lands to the pixel, never quite where it was sent). */
const HUB_INSIDE = HUB_SEAM - (HUB_SEAM - K.hub.start) * 0.15;
const REJOIN_INSIDE = REJOIN_SEAM + (K.rejoin.end - REJOIN_SEAM) * 0.15;
/** The rejoin's end: the whole matrix, the moment before it begins to open. */
const REJOIN_END = K.rejoin.end - (K.rejoin.end - REJOIN_SEAM) * 0.02;

// ─── What is asked of it ─────────────────────────────────────────────────────

const reduced = () => experience().reducedMotion;

/**
 * Explicit Visit/Back only: budget travel by the part of the existing path being traversed.
 * A long editorial must not squeeze the physical room exit into the last fraction of a fixed
 * two-second move. Return pacing is independent of record length; deliberate selection has a
 * gentler approach budget. Wheel/touch can interrupt this single Lenis request at any point.
 */
function requestRoomTravel(to: number, onComplete?: () => void, entering = false) {
  const from = progress.target;
  const low = Math.min(from, to), high = Math.max(from, to);
  const boundaries = [low, ...[K.arrival.end, K.enter.start, K.enter.end, K.room.end].filter((p) => p > low && p < high), high];
  const points = to < from ? boundaries.reverse() : boundaries;
  const legs = points.slice(1).map((end, i) => {
    const start = points[i];
    const mid = (start + end) / 2;
    // Explicit entry has no time budget for the identical-pose browsing interval. Its scroll
    // position can cross that interval instantaneously without cutting the physical camera path.
    const secondsPerProgress = mid < K.arrival.end
      ? 1.8 / (K.arrival.end - K.arrival.start)
      : mid < K.enter.start
        ? 0
        : mid < K.enter.end
          ? (entering ? 3.2 : 2.2) / (K.enter.end - K.enter.start)
          : mid < K.room.end
            ? (entering ? 0.8 : 0.6) / (K.room.end - K.room.start)
            : scrollSpan() / 1000; // editorial retreat: 1000 CSS px/s, not a content-length multiplier
    return { start, end, seconds: Math.abs(end - start) * secondsPerProgress };
  });
  const duration = legs.reduce((sum, leg) => sum + leg.seconds, 0);
  if (duration < 1e-6) { onComplete?.(); return; }
  // Short start/stop ramps; no second sine over the camera's already-authored approach easing.
  // The middle of a long record remains constant-speed instead of racing through the room later.
  const ramp = Math.min(0.25, 0.14 / duration);
  const easing = (t: number) => {
    const u = t < ramp ? t * t / (2 * ramp * (1 - ramp))
      : t > 1 - ramp ? 1 - (1 - t) ** 2 / (2 * ramp * (1 - ramp))
        : (t - ramp / 2) / (1 - ramp);
    let elapsed = u * duration;
    for (const leg of legs) {
      if (leg.seconds === 0) continue;
      if (elapsed <= leg.seconds) {
        const p = leg.start + (leg.end - leg.start) * elapsed / leg.seconds;
        return clamp01((p - from) / (to - from));
      }
      elapsed -= leg.seconds;
    }
    return 1;
  };
  scrollToProgress(to, duration, { easing, onComplete });
}

/** Only the matrix accepts selection, never an old hit region over an already-entered room. */
export function canVisitEvent() {
  const st = eventsState();
  const p = progress.target;
  const ex = experience();
  const pixel = 1 / Math.max(1, scrollSpan());
  const doorway = INTRO_PROGRESS_END * ((T.doorway - INTRO_START) / INTRO_SPAN);
  const matrix = (p >= doorway && p <= K.enter.start + pixel) || (p >= K.rejoin.start && p <= K.rejoin.end);
  return matrix && ex.phase === 'cinematic' && !ex.menuOpen && !ex.dossier && !ex.textVersionOpen && !teamsFrame.inside &&
    !(st.visiting && p >= K.enter.start - pixel && p < K.rejoin.start);
}

/** Click/tap explicitly requests entry on the same scroll path; any input interrupts it. */
export function visitEvent(i: number) {
  if (i < 0 || i >= N || !canVisitEvent()) return;
  const st = eventsState();
  cancelScrollMotion();
  st.set({ selected: i, visiting: true });
  applyWall();
  eventsFrame.hover = -1;
  if (reduced()) jumpToProgress(ROOM_STILL);
  else {
    // The hub is a stationary stretch, not part of the approach. Skip only
    // that identical-pose stretch on an explicit selection so a tap responds
    // immediately instead of spending its first half-second on invisible travel.
    if (atHub(progress.target)) shiftProgress(K.enter.start - progress.target);
    // Stop one CSS pixel before the editorial boundary. Browser scroll rounding must not put a
    // selection into its record; the next real scroll is what brings that foreground layer up.
    requestRoomTravel(K.room.end - 1 / Math.max(1, scrollSpan()), undefined, true);
  }
}

/**
 * An explicit Back/Next request scrolls the same path to the matrix. Any user input interrupts the
 * existing Lenis move. Only an explicit Next request visits another room on completion.
 */
function outToHub(then: (() => void) | null) {
  if (reduced()) {
    jumpToProgress(HUB_REST);
    endVisit();
    then?.();
  } else requestRoomTravel(K.enter.start, () => {
    // Only the stationary hub interval is skipped, after the physical return has completed.
    shiftProgress(HUB_REST - progress.target);
    endVisit();
    then?.();
  });
}

/** From a room (or its record) back out to the whole matrix. */
export function backToFullView() {
  const st = eventsState();
  if (!st.visiting) return;
  outToHub(null);
}

/** Out of this room to the whole matrix, and into the next (after the last: on to the Crew). */
export function visitNextEvent() {
  const st = eventsState();
  const next = st.selected + 1;
  if (next >= N) return visitCrew();
  if (reduced()) {
    st.set({ selected: next, visiting: true });
    return void jumpToProgress(ROOM_STILL);
  }
  outToHub(() => visitEvent(next));
}

/** On from the whole matrix through its opening to the portal (out of a room first, if in one). */
export function visitCrew() {
  if (experience().phase !== 'cinematic' || teamsFrame.inside) return;
  const go = () => {
    endVisit();
    if (reduced()) return void jumpToProgress(PORTAL_STAND);
    // The rejoin's whole matrix is the hub's: from its end (the same picture) the scroll goes on at
    // once into the opening.
    if (progress.target < REJOIN_END) jumpToProgress(REJOIN_END, 0, { fade: false });
    scrollToProgress(PORTAL_STAND, PACE.crew, { easing: easeInOutSine });
  };
  const st = eventsState();
  if (!st.visiting || reduced()) return go();
  outToHub(go);
}

/** Event i's room, from the index or a link: cut to it behind the jump's fade, its installation begun. */
export function roomProgress(i: number, t = 0.02) {
  eventsState().set({ selected: Math.max(0, Math.min(N - 1, i)), visiting: true });
  applyWall();
  return eventsAt('room', t);
}

/** Nothing chosen, nothing lit (a jump elsewhere, the loop). */
export function resetEvents() {
  roomPlay = eventsFrame.view.play = 0;
  clockFor = -1;
  playbackDirection = 1;
  endVisit();
  eventsFrame.hover = -1;
  eventsFrame.lit.fill(0);
  eventsFrame.trace.fill(0);
}

// ─── The picture ─────────────────────────────────────────────────────────────

const lean = { x: 0, y: 0 };
let lastHover = -1;
let lastEnter = 0;

/**
 * Once a frame, from the camera rig, after the scroll's camera is evaluated: what the hall and the
 * interface show (eventsFrame.view), the bays' answer to the pointer, and — laid over the camera
 * at the whole matrix — the lean it gives it.
 */
export function updateEvents(dt: number, shot: CameraPose, apply: boolean, reduced: boolean) {
  const v = eventsFrame.view;
  const p = progress.value;
  const seg = segmentAt(p);
  const st = eventsState();
  v.index = st.selected;

  const ev = seg === 'events';
  // The matrix comes up as the door opens — lit, its rooms coming clear, by half-way across the hall.
  v.reveal = seg === 'descent' || ev || seg === 'portal' || seg === 'teams' || seg === 'return' ? smoothstep(REVEAL_FROM, REVEAL_TO, p) : 0;
  // The picture and camera read the same navigation sample. The installation's v.play is separate.
  const navigation = eventsNavigation(p, st.visiting ? st.selected : -1);
  v.enter = navigation.enter;
  v.room = navigation.room;
  // The record: a page moved by the scroll from where its edge starts up over the room to its wall —
  // its first screen the sheet covering the room (unfold: CameraRig moves the deeper picture only
  // slightly underneath), the rest of it read (read), and the last half screen, the choice coming up
  // (decide). It goes with the native scroll itself, as a page does — not with the
  // camera's follow behind it (the camera stands still in the room while it does).
  const R = eventsFrame.record;
  const screen = Math.max(1, R.screen);
  const length = Math.max(R.height, screen);
  const from = K.unfold.start;
  const pr = p;
  v.page = st.visiting && pr > from && pr < K.rejoin.start ? clamp01((pr - from) / Math.max(1e-9, recordWall() - from)) * length : 0;
  v.unfold = clamp01(v.page / screen);
  v.read = length > screen ? clamp01((v.page - screen) / (length - screen)) : v.page >= screen ? 1 : 0;
  v.decide = v.page > 0 ? clamp01(1 - (length - v.page) / (screen * 0.5)) : 0;
  v.inside = smoothstep(0.96, 0.995, v.enter);
  v.split = seg === 'portal' ? smoothstep(0, 1, segmentProgress(p, 'portal') / PORTAL_SPLIT) : seg === 'teams' || seg === 'return' ? 1 : 0;
  // The whole matrix, still: to be chosen from.
  let hub = 0;
  if (ev) {
    hub = 1 - smoothstep(0, 0.06, v.enter);
  } else if (seg === 'descent') {
    // The gate is fully retracted by the doorway beat. The rooms are already
    // visible there: their real buttons must not remain disabled until the
    // last few pixels of the later shelf approach.
    hub = smoothstep(T.doorway, T.doorway + 0.4, introFrame.t);
  } else if (seg === 'portal') hub = 1 - smoothstep(0, 0.05, segmentProgress(p, 'portal'));
  v.hub = hub;

  // The threshold, crossed going in.
  if (lastEnter < 0.62 && v.enter >= 0.62 && v.enter - lastEnter < 0.2) cue('threshold', { level: 0.55 });
  lastEnter = v.enter;

  // The bays answer the pointer (only at the whole matrix): lit, and their tracing's own clock.
  const F = eventsFrame;
  const h = hub > 0.6 ? F.hover : -1;
  if (h !== lastHover && h >= 0) cue('tileMove', { level: 0.45, variant: h, pan: (EVENT_ROOMS[h].col - 1) * 0.4 });
  lastHover = h;
  const k = 1 - Math.exp(-dt * 7);
  for (let i = 0; i < N; i++) {
    const on = h === i ? 1 : 0;
    F.lit[i] += (on - F.lit[i]) * (reduced ? 1 : k);
    if (on || F.lit[i] > 0.004) F.trace[i] += dt;
    else F.trace[i] = 0;
  }

  if (!apply) return;
  // At the whole matrix, the camera leans a little with the pointer.
  const settled = smoothstep(eventsAt('arrival', 0.9), K.arrival.end, p);
  // The UI can retire immediately on selection, but the physical pointer lean must release
  // across the first part of the approach, not collapse with the hit areas in a few frames.
  const presence = st.visiting && ev ? 1 - smoothstep(0, 0.24, v.enter) : hub;
  const w = reduced || !F.pointer.active ? 0 : presence * settled;
  const kp = 1 - Math.exp(-dt * 3);
  lean.x += (F.pointer.x - lean.x) * kp;
  lean.y += (F.pointer.y - lean.y) * kp;
  // The pointer's damping must not leave a residual camera move inside a room.
  // Gate the damped pointer by its scroll-authored presence, not its target.
  shot.x += lean.x * w * 0.45;
  shot.y += lean.y * w * 0.22;
  shot.yaw -= lean.x * w * 0.014;
}

/** How far through the portal segment the matrix's opening sits (for the camera's keys: shots.ts). */
export const SPLIT_AT = PORTAL_SPLIT;
