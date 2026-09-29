/**
 * The room clock and the Prodigy wall's timing — plain functions of scroll, with nothing of the
 * renderer in them, so the page's own code (the sound director reads both) can use them without
 * bringing the 3D world into the page's first script. The exhibits reach them through common.ts.
 */
import { SEGMENTS } from '@/config/timeline';
import { CORRIDOR } from '@/config/world';
import { eventStationAt } from '@/systems/camera/shots';
import { progress } from '@/systems/scroll/progress';

export interface RoomClock {
  /**
   * How far through the visit: < 0 while walking up (−0.3 → 0), 0 → 1 while
   * standing in the room, 1 once it's behind you.
   */
  u: number;
  /** This is the room being visited. */
  here: boolean;
  /** Within one room either side: worth animating. */
  near: boolean;
  /**
   * How present the room is to the visitor, 0 → 1, from where the camera is:
   * faint next door, waking through the approach, full inside, easing out as
   * the camera walks on. Continuous with scroll (the camera is damped).
   */
  presence: number;
}

export function readRoomClock(index: number, out: RoomClock) {
  const p = progress.value;
  const st = eventStationAt(p);
  const inEvents = p >= SEGMENTS.events.start && p <= SEGMENTS.events.end;
  if (inEvents && st.index === index) {
    out.here = true;
    out.u = st.dwell > 0 ? st.dwell : (st.travel - 1) * 0.3;
  } else {
    out.here = false;
    out.u = p > SEGMENTS.events.end || (inEvents && st.index > index) ? 1 : -0.3;
  }
  // (Walking on to the portal, the last rooms stay awake behind you.)
  out.near = (inEvents && Math.abs(st.index - index) <= 1) || (p > SEGMENTS.events.end && p < SEGMENTS.portal.end && index >= CORRIDOR.rooms.length - 2);
  if (out.here) out.presence = out.u < 0 ? 0.2 + ((out.u + 0.3) / 0.3) * 0.8 : 1;
  else if (inEvents && st.index === index + 1) out.presence = 1 - 0.85 * st.travel;
  else out.presence = out.near ? 0.15 : 0;
  return out;
}

// ─── Prodigy: when each puzzle piece moves, and when it locks into the wall ──────────────

/** How many pieces the Prodigy wall has (the programme's eight, and Prodigy itself at the centre). */
export const PUZZLE_PIECES = 9;
/** The order a piece arrives in (the centre, Prodigy, last) — piece i as laid out on the wall. */
export const puzzleOrder = (i: number) => (i === 4 ? 8 : i < 4 ? i : i - 1);
/** Piece i as laid out, from its arrival order. */
export const puzzlePiece = (order: number) => (order < 4 ? order : order === 8 ? 4 : order + 1);
/**
 * The room visit (its clock's u) over which the piece arriving `order`-th travels: it leaves at
 * the first, and is home — locked into the wall — at the second. (The picture, PuzzlePieces, and
 * the sound, SoundDirector, both read this, so each lock is heard exactly as it is seen.)
 */
export const puzzleSpan = (order: number): [number, number] => [0.06 + order * 0.08, 0.2 + order * 0.08];
