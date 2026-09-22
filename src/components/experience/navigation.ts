/**
 * Navigation actions shared by the index menu, keyboard shortcuts, deep links
 * and the HUD. Every jump goes through here so camera, scroll and phase stay
 * consistent. The whole experience — the team tour included — is one scroll
 * timeline, so every destination is just a progress value.
 */
import { CHAPTERS, progressForRoom, SEGMENTS, type ChapterId } from '@/config/timeline';
import { CORRIDOR } from '@/config/world';
import type { DomainId } from '@/content/domains';
import { experience } from '@/store/experience';
import { REDUCED_MOTION_STOPS } from '@/systems/camera/shots';
import { TOUR_STOPS, tourProgress } from '@/systems/camera/tour';
import { progress } from '@/systems/scroll/progress';
import { jumpToProgress, scrollToProgress } from '@/systems/scroll/ScrollTimeline';

function close() {
  experience().set({ menuOpen: false, dossier: null });
}

/** Resume the journey at progress p (default: in front of the door). */
export function backToJourney(p = SEGMENTS.door.start + (SEGMENTS.door.end - SEGMENTS.door.start) * 0.64) {
  close();
  jumpToProgress(p);
}

/** Straight to the welcome inside the team workspace. */
export function enterTeam() {
  close();
  jumpToProgress(tourProgress(0, 0));
}

/** Skip the domain tour and go to the core. */
export function skipToCore() {
  close();
  jumpToProgress(tourProgress(TOUR_STOPS.length - 1, 0.45));
}

export function goToChapter(id: ChapterId) {
  close();
  if (id === 'team') return enterTeam();
  if (id === 'core') return skipToCore();
  const def = CHAPTERS.find((c) => c.id === id);
  if (!def || def.jumpTo === null) return;
  jumpToProgress(def.jumpTo);
}

export function goToRoom(index: number) {
  close();
  jumpToProgress(progressForRoom(Math.max(0, Math.min(CORRIDOR.rooms.length - 1, index))));
}

/** Meet a domain: from a neighbouring stop, walk there; from further away, cut. */
export function goToDomain(id: DomainId | 'core') {
  close();
  const i = TOUR_STOPS.findIndex((s) => s.id === id);
  if (i < 0) return;
  const p = tourProgress(i, 0.04);
  const here = experience().tourStop;
  if (here >= 0 && Math.abs(here - i) <= 1 && !experience().reducedMotion) scrollToProgress(p, 2.2);
  else jumpToProgress(p);
}

/** Step to the next / previous framed stop (keyboard N / P). */
export function stepStop(dir: 1 | -1) {
  const p = progress.target;
  const stops = REDUCED_MOTION_STOPS;
  const next = dir > 0 ? stops.find((s) => s > p + 0.0005) : [...stops].reverse().find((s) => s < p - 0.0005);
  if (next !== undefined) jumpToProgress(next);
}

/** Next / previous domain on the tour (walks there). */
export function stepDomain(dir: 1 | -1) {
  const here = Math.max(0, experience().tourStop);
  const next = Math.max(0, Math.min(TOUR_STOPS.length - 1, here + dir));
  if (next === here) return;
  close();
  const p = tourProgress(next, 0.04);
  if (experience().reducedMotion) jumpToProgress(p);
  else scrollToProgress(p, 2.2);
}
