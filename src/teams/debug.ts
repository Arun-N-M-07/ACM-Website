/**
 * Test hooks for the visual/interaction QA harness (exposed as
 * window.__acm.teams in dev builds or with ?debug).
 */
import { experience } from '@/store/experience';
import { jumpToProgress } from '@/systems/scroll/ScrollTimeline';
import { closeDomain, hopTo, resetFocus, selectDomain } from './focus';
import { carouselAt, progressForCarousel, progressForDomain } from './layout';
import { teams, teamsFrame } from './state';
import { enterTeams, exitTeams, placeInside } from './travel';
import { cardPick, cardScreenPoint } from './controller';

export const teamsDebug = {
  /** Snapshot of the Teams state (for assertions). */
  snapshot() {
    const f = teamsFrame;
    const s = teams();
    return {
      state: s.state,
      phase: experience().phase,
      inside: f.inside,
      armed: f.armed,
      holding: f.holding,
      hold: +f.hold.toFixed(4),
      travelT: +f.travel.t.toFixed(4),
      arrival: +f.arrival.toFixed(4),
      c: +f.c.toFixed(4),
      cVel: +f.cVel.toFixed(4),
      focus: +f.focus.toFixed(4),
      focusK: +f.focusK.toFixed(4),
      current: s.current,
      selected: s.selected,
      hover: f.hover,
      pull: Math.round(f.pull),
      pressure: +f.pressure.toFixed(3),
      cardRect: { ...f.cardRect },
      picks: cardPick.map((p) => p.live),
    };
  },
  /** Go through the portal now (as if the hold completed). */
  enter: () => enterTeams({ reduced: experience().reducedMotion }),
  exit: () => exitTeams({ reduced: experience().reducedMotion }),
  /** Put the camera inside the world at orbit coordinate c (no travel). */
  at(c: number) {
    resetFocus();
    const p = placeInside(progressForCarousel(c));
    jumpToProgress(p);
    return carouselAt(p);
  },
  domain(i: number) {
    resetFocus();
    const p = placeInside(progressForDomain(i));
    jumpToProgress(p);
  },
  cardScreen: (i: number) => cardScreenPoint(i),
  select: (i: number) => selectDomain(i),
  hop: (i: number) => hopTo(i),
  close: () => closeDomain(),
};
