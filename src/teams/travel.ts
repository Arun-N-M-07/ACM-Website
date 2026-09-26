/**
 * Travel through the portal, and the arrival on the other side.
 *
 * GSAP owns the clocks (so the sequence is one timeline that can be killed
 * cleanly); every visual channel is a pure function of those clocks, read by
 * the camera, the post pass and the tunnel each frame.
 *
 *   enter:  hold completes → plunge into the ring → [crossing, hidden by a
 *           bloom-out] → streak tunnel → out of the mouth into darkness
 *           → arrival (the world reveals itself; the camera glides in)
 *           → teamsActive, scroll handed back exactly where the glide ends
 *
 *   exit:   sustained scroll back at the start of the world → back out of
 *           the mouth and up the tunnel → [crossing] → out of the membrane
 *           backwards, braking to stand before the portal again
 *
 * Reduced motion replaces both with a short fade cut.
 */
import { gsap } from 'gsap';
import { PORTAL_GATE } from '@/config/timeline';
import { world } from '@/scenes/shared/blend';
import { experience } from '@/store/experience';
import { fx } from '@/systems/camera/effects';
import { smoothstep } from '@/systems/camera/pose';
import { progress } from '@/systems/scroll/progress';
import { placeScroll } from '@/systems/scroll/ScrollTimeline';
import { ENTER_CROSS, EXIT_CROSS } from './camera';
import { TEAMS_FLOOR, carouselAt } from './layout';
import { teams, teamsFrame } from './state';

const DUR = { enter: 2.3, arrival: 1.8, exit: 2.1 };

let tl: gsap.core.Timeline | null = null;

function kill() {
  tl?.kill();
  tl = null;
}

/** Scroll walls: outside, the portal gate is a ceiling; inside, it's a floor. */
export function applyScrollLock() {
  progress.lock = teamsFrame.inside ? { min: TEAMS_FLOOR, max: 1 } : { min: 0, max: PORTAL_GATE };
}

/** Cross between worlds (always behind a flash or a fade). */
function setInside(inside: boolean) {
  teamsFrame.inside = inside;
  world.teams = inside ? 1 : 0;
  applyScrollLock();
}

/** The progress value the arrival settles on: the floor of the world, facing THE TEAM. */
const REST_P = TEAMS_FLOOR;

function resetTravel(dir: 1 | -1) {
  const tr = teamsFrame.travel;
  tr.t = 0;
  tr.dir = dir;
  tr.inTunnel = dir === -1;
  tr.speed = 0;
  tr.warp = 0;
  tr.aberration = 0;
  tr.flash = 0;
  tr.dark = 0;
  capture.pending = true;
}

/** Set by travel starts; the camera rig captures its current pose as the travel's origin. */
export const capture = { pending: false };

/** Evaluate every travel channel from the clock (called once per frame). */
export function travelChannels() {
  const tr = teamsFrame.travel;
  const t = tr.t;
  const st = teams().state;
  if (st === 'portalEntering') {
    tr.inTunnel = t >= ENTER_CROSS;
    if (!tr.inTunnel) {
      const u = t / ENTER_CROSS;
      tr.speed = 0.25 + 0.75 * u * u;
      tr.warp = 0.35 + 0.65 * u * u;
      tr.aberration = 0.25 + 0.6 * u;
      tr.flash = smoothstep(0.55, 1, u);
    } else {
      const u = (t - ENTER_CROSS) / (1 - ENTER_CROSS);
      tr.speed = 1 - smoothstep(0.1, 1, u) * 0.92;
      tr.warp = 1 - smoothstep(0, 0.95, u);
      tr.aberration = 0.85 * (1 - smoothstep(0.2, 1, u));
      tr.flash = 1 - smoothstep(0, 0.14, u);
    }
    tr.dark = 0;
  } else if (st === 'portalExiting') {
    tr.inTunnel = t < EXIT_CROSS;
    if (tr.inTunnel) {
      const u = t / EXIT_CROSS;
      const run = u < 0.35 ? 0 : (u - 0.35) / 0.65;
      tr.speed = 0.1 + 0.9 * run * run;
      tr.warp = smoothstep(0.2, 1, u);
      tr.aberration = 0.8 * smoothstep(0.3, 1, u);
      tr.flash = smoothstep(0.82, 1, u);
    } else {
      const u = (t - EXIT_CROSS) / (1 - EXIT_CROSS);
      tr.speed = 0;
      tr.warp = 1 - smoothstep(0, 0.8, u);
      tr.aberration = 0.7 * (1 - smoothstep(0, 0.7, u));
      tr.flash = 1 - smoothstep(0, 0.25, u);
    }
    tr.dark = 0;
  } else if (st === 'teamsEntering') {
    tr.inTunnel = false;
    tr.speed = 0;
    tr.warp = 0;
    tr.aberration = 0;
    tr.flash = 0;
    // The world starts black and comes up out of the dark with the dust.
    tr.dark = 1 - smoothstep(0, 0.12, teamsFrame.arrival);
  } else {
    tr.inTunnel = false;
    tr.speed = tr.warp = tr.aberration = tr.flash = tr.dark = 0;
  }
}

let arrivalCallback: (() => void) | null = null;
/** Run once when the next arrival completes (navigation: "take me to domain 4"). */
export function onArrival(cb: () => void) {
  arrivalCallback = cb;
}

function finishArrival(ownsTimeline = true) {
  teamsFrame.arrival = 1;
  teams().set({ state: 'teamsActive' });
  experience().set({ phase: 'cinematic' });
  placeScroll(REST_P);
  // (The reduced-motion cut calls this from inside its own fade timeline — leave that running.)
  if (ownsTimeline) kill();
  const cb = arrivalCallback;
  arrivalCallback = null;
  // After the scroll position has been placed (placeScroll settles over a few frames).
  if (cb) window.setTimeout(cb, 120);
}

function beginArrival(reduced: boolean) {
  teams().set({ state: 'teamsEntering' });
  teamsFrame.arrival = 0;
  teamsFrame.c = carouselAt(REST_P);
  teamsFrame.cVel = 0;
  if (reduced) {
    teamsFrame.arrival = 1;
    finishArrival(false);
    return;
  }
  tl = gsap.timeline({ onComplete: () => finishArrival() });
  tl.to(teamsFrame, { arrival: 1, duration: DUR.arrival, ease: 'none' });
}

/** The hold completed (or navigation asked to enter): go through. */
export function enterTeams(opts: { reduced: boolean }) {
  const s = teams().state;
  if (s === 'portalEntering' || s === 'teamsEntering' || teamsFrame.inside) return;
  kill();
  experience().set({ phase: 'travel', menuOpen: false, dossier: null });
  teams().set({ state: 'portalEntering', selected: null });
  resetTravel(1);
  teamsFrame.holding = false;
  if (opts.reduced) {
    tl = gsap.timeline();
    tl.to(fx, { fade: 1, duration: 0.35, ease: 'power1.in' })
      .call(() => {
        teamsFrame.hold = 0;
        setInside(true);
        teamsFrame.travel.t = 1;
        beginArrival(true);
      })
      .to(fx, { fade: 0, duration: 0.6, ease: 'power1.out' });
    return;
  }
  const tr = teamsFrame.travel;
  tl = gsap.timeline();
  tl.to(tr, {
    t: 1,
    duration: DUR.enter,
    ease: 'none',
    onUpdate: () => {
      if (!teamsFrame.inside && tr.t >= ENTER_CROSS) {
        teamsFrame.hold = 0;
        setInside(true);
      }
    },
    onComplete: () => {
      tl = null;
      beginArrival(false);
    },
  });
}

/** Back out through the portal. */
export function exitTeams(opts: { reduced: boolean }) {
  const s = teams().state;
  if (!teamsFrame.inside || s === 'portalExiting' || s === 'portalEntering') return;
  kill();
  experience().set({ phase: 'travel', menuOpen: false });
  teams().set({ state: 'portalExiting', selected: null });
  teamsFrame.focus = 0;
  teamsFrame.pull = 0;
  resetTravel(-1);
  const done = () => {
    tl = null;
    teamsFrame.hold = 0;
    teamsFrame.heldFor = 0;
    teams().set({ state: 'portalIdle' });
    experience().set({ phase: 'cinematic' });
    placeScroll(PORTAL_GATE - 0.0002);
  };
  if (opts.reduced) {
    tl = gsap.timeline({ onComplete: done });
    tl.to(fx, { fade: 1, duration: 0.35, ease: 'power1.in' })
      .call(() => {
        teamsFrame.travel.t = 1;
        setInside(false);
      })
      .to(fx, { fade: 0, duration: 0.6, ease: 'power1.out' });
    return;
  }
  const tr = teamsFrame.travel;
  tl = gsap.timeline();
  tl.to(tr, {
    t: 1,
    duration: DUR.exit,
    ease: 'none',
    onUpdate: () => {
      if (teamsFrame.inside && tr.t >= EXIT_CROSS) setInside(false);
    },
    onComplete: done,
  });
}

/**
 * Put the visitor straight into the world (deep links, the debug harness,
 * a jump into the Teams chapter) without the travel.
 */
export function placeInside(p: number) {
  kill();
  setInside(true);
  teamsFrame.hold = 0;
  teamsFrame.arrival = 1;
  teamsFrame.focus = 0;
  teams().set({ state: 'teamsActive', selected: null });
  experience().set({ phase: 'cinematic' });
  return Math.max(TEAMS_FLOOR, p);
}

/** Leave the world instantly (a jump back to an earlier chapter). */
export function placeOutside() {
  kill();
  arrivalCallback = null;
  setInside(false);
  teamsFrame.hold = 0;
  teamsFrame.focus = 0;
  teamsFrame.arrival = 0;
  teams().set({ state: 'outside', selected: null });
}

export const travelBusy = () => tl !== null;
