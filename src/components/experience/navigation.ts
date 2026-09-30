/**
 * Navigation actions shared by the index menu, keyboard shortcuts, deep links
 * and the HUD. Every jump goes through here so camera, scroll, phase and the
 * portal stay consistent.
 *
 * The journey — the opening (chapters 01–05) and the Events up to the portal
 * — is one scroll timeline, so destinations are progress values. The Teams world lies
 * through the portal: going there from anywhere stands you before it and
 * plays the travel (it is never a cut); leaving it for an earlier chapter
 * crosses back instantly behind the jump's fade.
 */
import { CHAPTERS, PORTAL_DWELL, progressForRoom, SEGMENTS, type ChapterId } from '@/config/timeline';
import { CORRIDOR } from '@/config/world';
import { DOMAIN_COUNT } from '@/content/teams';
import { experience } from '@/store/experience';
import { REDUCED_MOTION_STOPS } from '@/systems/camera/shots';
import { progress } from '@/systems/scroll/progress';
import { jumpToProgress, scrollToProgress, shiftProgress } from '@/systems/scroll/ScrollTimeline';
import { closeDomain, resetFocus } from '@/teams/focus';
import { progressForDomain } from '@/teams/layout';
import { teams, teamsFrame } from '@/teams/state';
import { enterTeams, onArrival, placeInside, placeOutside } from '@/teams/travel';

function close() {
  experience().set({ menuOpen: false, dossier: null });
}

/** Leave the Teams world instantly (behind a cut), if we're in it or crossing. */
function leaveTeams() {
  if (teamsFrame.inside || teams().state === 'portalEntering' || teams().state === 'portalExiting') {
    resetFocus();
    placeOutside();
    experience().set({ phase: 'cinematic' });
  }
}

/** Jump to a point before the portal (leaving the Teams world first). */
function jumpOutside(p: number) {
  leaveTeams();
  jumpToProgress(p);
}

/** Standing before the portal. */
const PORTAL_STAND = SEGMENTS.portal.start + (SEGMENTS.portal.end - SEGMENTS.portal.start) * (PORTAL_DWELL + 0.1);

/** Resume the journey at progress p (default: standing before the portal). */
export function backToJourney(p = PORTAL_STAND) {
  close();
  jumpOutside(p);
}

/**
 * Into the Teams world — optionally straight to a domain. From outside,
 * stand before the portal and go through it.
 */
export function enterTeamsWorld(domain?: number) {
  close();
  const reduced = experience().reducedMotion;
  if (teamsFrame.inside) {
    if (teams().state === 'domainDetail' || teams().state === 'cardFocused') closeDomain();
    if (domain !== undefined) scrollToProgress(progressForDomain(domain), reduced ? 0.01 : 2.2);
    return;
  }
  if (domain !== undefined) onArrival(() => scrollToProgress(progressForDomain(domain), reduced ? 0.01 : 2.4));
  const here = progress.value >= SEGMENTS.portal.start + (SEGMENTS.portal.end - SEGMENTS.portal.start) * (PORTAL_DWELL - 0.05);
  if (!here) jumpToProgress(PORTAL_STAND);
  // Let the cut land (and the portal settle) before going through.
  window.setTimeout(() => enterTeams({ reduced: experience().reducedMotion }), here ? 0 : 700);
}

/**
 * A chapter, chosen from the rail or the index: not a teleport, and not a fast-forward through the
 * film between here and there. The picture dims where it is; at black the journey moves (leaving
 * the Teams world, if you are in it); it lands a moment before the chapter's opening and the
 * camera's own follow carries it in as the picture comes up — you arrive, moving, into the
 * chapter. (Reduced motion: its framed stills, cut between as ever.)
 */
export function goToChapter(id: ChapterId) {
  close();
  if (id === 'teams') return enterTeamsWorld();
  const def = CHAPTERS.find((c) => c.id === id);
  if (!def || def.jumpTo === null) return;
  const to = def.jumpTo;
  if (experience().reducedMotion) return jumpOutside(to);
  progress.pending = () => {
    leaveTeams();
    progress.fadeInRate = 1.15;
    jumpToProgress(to, CHAPTER_LEAD);
  };
}

/** How far before a chapter's opening a chapter change lands (progress: a couple of the film's beats). */
const CHAPTER_LEAD = 0.004;

export function goToRoom(index: number) {
  close();
  jumpOutside(progressForRoom(Math.max(0, Math.min(CORRIDOR.rooms.length - 1, index))));
}

/** Travel to domain i (entering the world if needed). */
export function goToDomain(i: number) {
  enterTeamsWorld(Math.max(0, Math.min(DOMAIN_COUNT - 1, i)));
}

/**
 * The journey is a loop: past the end of the Teams world's return (down the
 * spine, into the dark) it begins again with the opening — one finite track
 * read cyclically, nothing appended (JourneyLoop decides when).
 *
 * Forward: out of the world and to the opening's first frame. Both are dark
 * (the return ends in the dark the opening begins in); the cut is behind the
 * jump's own fade from black. Nothing of the last pass is carried over: no
 * open card, room, dossier or menu, no Teams state.
 */
export function loopToStart() {
  close();
  leaveTeams();
  teams().set({ state: 'outside', selected: null });
  experience().set({ activeRoom: -1 });
  // Made inside the mist that has swallowed the world, landing inside the same mist at the track's
  // start (before the film's first frame): no dip to black — the scroll carries on from there.
  jumpToProgress(4 * LOOP_EDGE, 0, { fade: false });
}

/** …and backwards: from the start of the track, in the mist, to its end, in the same mist. */
export function loopToEnd() {
  close();
  resetFocus();
  const p = placeInside(1);
  jumpToProgress(p - 4 * LOOP_EDGE, 0, { fade: false });
}

/** How close to an end of the track (progress) counts as having reached it (the jumps above). */
export const LOOP_EDGE = 1e-4;

/**
 * The loop's own wraps, made where the track's two ends meet inside the mist (JourneyLoop): the
 * world is exchanged for the other end's while nothing can be seen, and the journey moves on by
 * exactly the seam's length — `shiftProgress`: no cut, the scroll's own motion carried across — so
 * the visitor's scroll simply continues on the other side.
 */
export function wrapToStart(delta: number) {
  close();
  leaveTeams();
  teams().set({ state: 'outside', selected: null });
  experience().set({ activeRoom: -1 });
  shiftProgress(delta);
}
export function wrapToEnd(delta: number) {
  close();
  resetFocus();
  placeInside(1);
  // (The orbit takes up its place on this frame — a cut, not a spring through every card.)
  progress.cut = true;
  shiftProgress(delta);
}

/**
 * With reduced motion the ends meet still to still: on past the last still, the opening's first; back
 * before the first, the last — landed on exactly, clear of where JourneyLoop makes this cut from the
 * scroll, with the world exchanged in the dark (CameraRig: a pending change of place goes dark first).
 */
export function loopStill(dir: 1 | -1) {
  const stops = REDUCED_MOTION_STOPS;
  const land = dir > 0 ? stops[0] : stops[stops.length - 1];
  progress.pending = () => (dir > 0 ? wrapToStart(land - progress.target) : wrapToEnd(land - progress.target));
}

/** Step to the next / previous framed stop (keyboard N / P). */
export function stepStop(dir: 1 | -1) {
  const p = progress.target;
  const stops = REDUCED_MOTION_STOPS;
  const next = dir > 0 ? stops.find((s) => s > p + 0.0005) : [...stops].reverse().find((s) => s < p - 0.0005);
  // The ends meet: past the last still, the first; before the first, the last.
  if (next === undefined) {
    if (dir > 0 && !teamsFrame.inside) return;
    if (experience().reducedMotion) return loopStill(dir);
    return dir > 0 ? loopToStart() : loopToEnd();
  }
  // At the portal, N means "go through".
  if (!teamsFrame.inside && next > progress.lock.max) return enterTeamsWorld();
  if (teamsFrame.inside && next < progress.lock.min) return;
  jumpToProgress(next);
}
