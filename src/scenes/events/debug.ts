/**
 * Test hooks for the QA harness (window.__acm.events in dev builds or with
 * ?debug): the Events' state, the scroll's camera anywhere along them, and
 * their actions as the interface takes them.
 */
import { EVENTS_TRACK, eventsAt, type EventsPart } from '@/config/timeline';
import { anchorAt } from '@/systems/anchors/anchors';
import { emptyPose } from '@/systems/camera/pose';
import { evaluateCinematic } from '@/systems/camera/shots';
import { progress } from '@/systems/scroll/progress';
import { scrollSpan } from '@/systems/scroll/ScrollTimeline';
import { backToFullView, recordWall, roomProgress, visitCrew, visitEvent, visitNextEvent } from './controller';
import { eventsFrame, eventsState } from './state';
import { HUB_REST, HUB_SEAM, REJOIN_SEAM } from './track';

export const eventsDebug = {
  snapshot() {
    const F = eventsFrame;
    const v = F.view;
    const st = eventsState();
    const r = (x: number) => +x.toFixed(4);
    return {
      selected: st.selected,
      visiting: st.visiting,
      hover: F.hover,
      lit: [...F.lit].map((x) => +x.toFixed(3)),
      view: { index: v.index, reveal: r(v.reveal), hub: r(v.hub), enter: r(v.enter), room: r(v.room), play: r(v.play), page: Math.round(v.page), unfold: r(v.unfold), read: r(v.read), decide: r(v.decide), split: r(v.split), inside: r(v.inside) },
      target: progress.target,
      value: progress.value,
      lockMax: progress.lock.max,
    };
  },
  /** Bay i's opening on screen (CSS px), as its hit area is placed. */
  bay(i: number) {
    const a = anchorAt(`events:bay:${i}:a`);
    const b = anchorAt(`events:bay:${i}:b`);
    return a && b ? { x0: a.x, y0: a.y, x1: b.x, y1: b.y } : null;
  },
  /** Progress `t` of the way through a part of the Events. */
  at: (part: EventsPart, t: number) => eventsAt(part, t),
  /** The scroll's camera at progress p (with the event chosen now; before the rig's drift and widening). */
  pose(p: number, aspect = window.innerWidth / window.innerHeight) {
    const out = emptyPose();
    evaluateCinematic(p, out, aspect);
    return out;
  },
  track: EVENTS_TRACK,
  hubRest: HUB_REST,
  /** The wall at a visited event's end (the choice): as far as its record is long. */
  get wall() {
    return recordWall();
  },
  /** The shown record's length and the screen it is read on (px). */
  get record() {
    return { ...eventsFrame.record };
  },
  /** How far the page scrolls (px) for the whole journey. */
  get span() {
    return scrollSpan();
  },
  seams: { hub: HUB_SEAM, rejoin: REJOIN_SEAM },
  visit: visitEvent,
  back: backToFullView,
  next: visitNextEvent,
  crew: visitCrew,
  /** Choose event i (visited) and return the progress `t` into its room's installation (for a jump). */
  room: roomProgress,
};
