/**
 * Navigation actions shared by the index menu, keyboard shortcuts, deep links
 * and the HUD. Every jump goes through here so camera, scroll, phase and the
 * portal stay consistent.
 *
 * The journey up to the portal is one scroll timeline, so those destinations
 * are progress values. The Teams world lies through the portal: going there
 * from anywhere stands you before it and plays the travel (it is never a
 * cut); leaving it for an earlier chapter crosses back instantly behind the
 * jump's fade.
 */
import { CHAPTERS, PORTAL_DWELL, progressForRoom, SEGMENTS, type ChapterId } from '@/config/timeline';
import { CORRIDOR } from '@/config/world';
import { DOMAIN_COUNT } from '@/content/teams';
import { experience } from '@/store/experience';
import { REDUCED_MOTION_STOPS } from '@/systems/camera/shots';
import { progress } from '@/systems/scroll/progress';
import { jumpToProgress, scrollToProgress } from '@/systems/scroll/ScrollTimeline';
import { closeDomain, resetFocus } from '@/teams/focus';
import { progressForDomain } from '@/teams/layout';
import { teams, teamsFrame } from '@/teams/state';
import { enterTeams, onArrival, placeOutside } from '@/teams/travel';

function close() {
  experience().set({ menuOpen: false, dossier: null });
}

/** Jump to a point before the portal (leaving the Teams world first if needed). */
function jumpOutside(p: number) {
  if (teamsFrame.inside || teams().state === 'portalEntering' || teams().state === 'portalExiting') {
    resetFocus();
    placeOutside();
    experience().set({ phase: 'cinematic' });
  }
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

export function goToChapter(id: ChapterId) {
  close();
  if (id === 'teams') return enterTeamsWorld();
  const def = CHAPTERS.find((c) => c.id === id);
  if (!def || def.jumpTo === null) return;
  jumpOutside(def.jumpTo);
}

export function goToRoom(index: number) {
  close();
  jumpOutside(progressForRoom(Math.max(0, Math.min(CORRIDOR.rooms.length - 1, index))));
}

/** Travel to domain i (entering the world if needed). */
export function goToDomain(i: number) {
  enterTeamsWorld(Math.max(0, Math.min(DOMAIN_COUNT - 1, i)));
}

/** Step to the next / previous framed stop (keyboard N / P). */
export function stepStop(dir: 1 | -1) {
  const p = progress.target;
  const stops = REDUCED_MOTION_STOPS;
  const next = dir > 0 ? stops.find((s) => s > p + 0.0005) : [...stops].reverse().find((s) => s < p - 0.0005);
  if (next === undefined) return;
  // At the portal, N means "go through".
  if (!teamsFrame.inside && next > progress.lock.max) return enterTeamsWorld();
  if (teamsFrame.inside && next < progress.lock.min) return;
  jumpToProgress(next);
}
