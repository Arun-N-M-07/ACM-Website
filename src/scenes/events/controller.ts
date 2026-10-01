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
 *   Visit          the chosen room: the scroll set at its threshold — no scroll
 *                  carried for the visitor; the room's entry plays from there
 *   Back to full   the record slid away by the scroll, back to the matrix's
 *                  stretch; the room's exit plays from there
 *   Next event     back out, and — once the camera is at the matrix — the next
 *   Visit the Crew on from the whole matrix through its opening to the portal
 *
 * Two kinds of time, never confused. The SCROLL is where the visitor is: the
 * matrix, a room's threshold crossed or not, how far up the record has come —
 * nothing moves on without it, and it stops where it stops. A room's ENTRY
 * (the camera in through its bay) and its INSTALLATION (and the camera's slow
 * step in with it) are choreography: each plays at its own fixed pace once the
 * scroll has crossed into the room, and plays back at its own pace once it has
 * crossed out — never faster or slower for how fast the scroll moved. Both are
 * clocks stepped once a frame with the frame's time (stepEventsTrack): no
 * timers, no loop of their own.
 * Nothing runs on a timer: the scroll moves, and everything is a function of it.
 */
import { EVENTS } from '@/content/events';
import { EVENTS_TRACK as K, EVENTS_VH, INTRO_PROGRESS_END, PORTAL_DWELL, PORTAL_GATE, PORTAL_SPLIT, SEGMENTS, eventsAt, segmentAt, segmentProgress } from '@/config/timeline';
import { INTRO_SPAN, INTRO_START, T } from '@/intro/timeline';
import { EVENT_ROOMS } from '@/config/world';
import { experience } from '@/store/experience';
import { cue } from '@/systems/audio/sfx';
import { clamp01, easeInOutSine, smoothstep, type CameraPose } from '@/systems/camera/pose';
import { progress } from '@/systems/scroll/progress';
import { jumpToProgress, scrollSpan, scrollToProgress, shiftProgress } from '@/systems/scroll/ScrollTimeline';
import { teamsFrame } from '@/teams/state';
import { eventsFrame, eventsState } from './state';
import { HUB_REST, HUB_SEAM, REJOIN_SEAM } from './track';

const N = EVENTS.length;
const part = (p: number, r: { start: number; end: number }) => clamp01((p - r.start) / (r.end - r.start));

/** Where a room is reached: across its threshold, half-way through the scroll's short step from the matrix. */
const ENTRY_AT = K.enter.start + (K.enter.end - K.enter.start) * 0.5;
/** Where "Visit" sets the scroll: the room reached (its entry plays from there). */
const ROOM_REACHED = K.room.start;
/** With reduced motion, the room's framed still (systems/camera/shots: ROOM_STILLS), cut to at once. */
const ROOM_STILL = K.room.end;
/** The choreography's own pace (s): in through the bay, and back out; the installation, and back. */
const ENTRY_S = 2;
const EXIT_S = 1.6;
const ROOM_PLAY_S = 4;
const ROOM_UNPLAY_S = 1.6;
/** Standing before the portal (where "Visit the Crew" goes). */
const PORTAL_STAND = SEGMENTS.portal.start + (SEGMENTS.portal.end - SEGMENTS.portal.start) * PORTAL_DWELL;

/** The moves' own pace (s): the record slid away (Back, Next); on to the portal. */
const PACE = { slide: 0.9, crew: 5.8 };

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

/**
 * What waits for the camera to be back at the whole matrix — after a room's exit, the next thing
 * (the next room, the matrix's opening): run once the exit and the installation have played back,
 * so what happens next starts from the picture every room's path starts from. Given up if the
 * scroll is taken back into the room meanwhile.
 */
let afterOut: (() => void) | null = null;

/** The choreography's clocks (0..1), and the room they are for. */
let entry = 0;
let roomPlay = 0;
let clockFor = -1;

/**
 * Once a frame, before the camera is placed: the join at the matrix (no event chosen, the scroll
 * passes from the hub's seam to the rejoin's and back), the walls, and what waited for the matrix.
 */
export function stepEventsTrack(dt = 0) {
  const st = eventsState();
  const t = progress.target;
  const prev = lastTarget;
  lastTarget = t;
  applyWall();
  stepClocks(dt);
  if (teamsFrame.inside || experience().phase !== 'cinematic' || progress.pending) return;
  if (afterOut) {
    if (st.visiting && t >= ENTRY_AT) afterOut = null;
    else if (entry === 0 && roomPlay === 0) {
      const run = afterOut;
      afterOut = null;
      run();
      lastTarget = progress.target;
      return;
    }
  }
  // Back in the matrix, past where its scroll turns for the Crew, and the room's exit played: the
  // visit is over.
  if (st.visiting && t < HUB_SEAM - 1e-5 && entry === 0 && roomPlay === 0) return endVisit();
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
 * The room's choreography, a frame on: its entry plays in once the scroll is across the room's
 * threshold and back out once it isn't, at its own pace; its installation plays once the camera is
 * in, and back as it leaves. (Reduced motion: at once.) Written into the picture (eventsFrame.view)
 * before the camera is placed from it.
 */
function stepClocks(dt: number) {
  const st = eventsState();
  const v = eventsFrame.view;
  if (st.selected !== clockFor) {
    clockFor = st.selected;
    entry = 0;
    roomPlay = 0;
  }
  const on = experience().phase === 'cinematic' && !teamsFrame.inside;
  const inward = on && st.visiting && st.selected >= 0 && progress.target >= ENTRY_AT;
  const now = experience().reducedMotion;
  if (now) entry = inward ? 1 : 0;
  else if (inward) entry = Math.min(1, entry + dt / ENTRY_S);
  else entry = Math.max(0, entry - dt / EXIT_S);
  const inside = inward && entry >= 1;
  if (now) roomPlay = inside ? 1 : 0;
  else if (inside) roomPlay = Math.min(1, roomPlay + dt / ROOM_PLAY_S);
  else roomPlay = Math.max(0, roomPlay - dt / ROOM_UNPLAY_S);
  v.enter = entry;
  v.room = roomPlay;
}

/** Well inside each side of the join (a page scroll lands to the pixel, never quite where it was sent). */
const HUB_INSIDE = HUB_SEAM - (HUB_SEAM - K.hub.start) * 0.15;
const REJOIN_INSIDE = REJOIN_SEAM + (K.rejoin.end - REJOIN_SEAM) * 0.15;
/** The rejoin's end: the whole matrix, the moment before it begins to open. */
const REJOIN_END = K.rejoin.end - (K.rejoin.end - REJOIN_SEAM) * 0.02;

// ─── What is asked of it ─────────────────────────────────────────────────────

const reduced = () => experience().reducedMotion;
/** Into event i's room, from the whole matrix: the scroll set at its threshold, and its entry plays. */
export function visitEvent(i: number) {
  if (i < 0 || i >= N || experience().phase !== 'cinematic') return;
  afterOut = null;
  const st = eventsState();
  st.set({ selected: i, visiting: true });
  applyWall();
  eventsFrame.hover = -1;
  // (The camera is placed from the room's clocks, not the scroll: setting the scroll moves nothing.)
  jumpToProgress(reduced() ? ROOM_STILL : ROOM_REACHED, 0, { fade: false });
}

/**
 * Out of a room (or its record) to the whole matrix: the record slid back down by the scroll, then the
 * scroll set at the matrix's stretch, and the room's exit plays; then `then`, once it has.
 */
function outToHub(then: (() => void) | null) {
  afterOut = null;
  const leave = () => {
    jumpToProgress(HUB_REST, 0, { fade: false });
    afterOut = then;
  };
  if (!reduced() && eventsFrame.view.page > 1) scrollToProgress(ROOM_REACHED, PACE.slide, { easing: easeInOutSine, onComplete: leave });
  else leave();
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
  afterOut = null;
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
  // (v.enter and v.room are the room's choreography: stepClocks, before the camera was placed.)
  if (!ev && seg !== 'portal') {
    v.enter = 0;
    v.room = 0;
  }
  const inRoomPart = ev && p >= K.enter.start && p < K.rejoin.start;
  // The record: a page moved by the scroll from where its edge starts up over the room to its wall —
  // its first screen the room giving way to it (unfold: the room's picture going up the screen with
  // it, CameraRig), the rest of it read (read), and the last half screen of it, the choice coming up
  // (decide). It goes with the scroll itself (Lenis's own smoothing), as a page does — not with the
  // camera's follow behind it (the camera stands still in the room while it does).
  const R = eventsFrame.record;
  const screen = Math.max(1, R.screen);
  const length = Math.max(R.height, screen);
  const from = K.unfold.start;
  const pr = progress.target;
  v.page = st.visiting && pr > from && pr < K.rejoin.start ? clamp01((pr - from) / Math.max(1e-9, recordWall() - from)) * length : 0;
  v.unfold = clamp01(v.page / screen);
  v.read = length > screen ? clamp01((v.page - screen) / (length - screen)) : v.page >= screen ? 1 : 0;
  v.decide = v.page > 0 ? clamp01(1 - (length - v.page) / (screen * 0.5)) : 0;
  v.inside = smoothstep(0.96, 0.995, v.enter);
  v.split = seg === 'portal' ? smoothstep(0, 1, segmentProgress(p, 'portal') / PORTAL_SPLIT) : seg === 'teams' || seg === 'return' ? 1 : 0;
  // The whole matrix, still: to be chosen from.
  let hub = 0;
  if (ev) {
    if (p < K.arrival.end) hub = smoothstep(0.86, 1, part(p, K.arrival));
    else hub = 1 - smoothstep(0, 0.06, v.enter);
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
  const w = reduced || !F.pointer.active ? 0 : hub;
  const kp = 1 - Math.exp(-dt * 3);
  lean.x += (F.pointer.x * w - lean.x) * kp;
  lean.y += (F.pointer.y * w - lean.y) * kp;
  shot.x += lean.x * 0.45;
  shot.y += lean.y * 0.22;
  shot.yaw -= lean.x * 0.014;
}

/** How far through the portal segment the matrix's opening sits (for the camera's keys: shots.ts). */
export const SPLIT_AT = PORTAL_SPLIT;
