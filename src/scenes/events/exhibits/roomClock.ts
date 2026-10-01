/**
 * The room clock and the Prodigy wall's timing — plain functions of scroll, with nothing of the
 * renderer in them, so the page's own code (the sound director reads both) can use them without
 * bringing the 3D world into the page's first script. The exhibits reach them through common.ts.
 */
import { eventsFrame } from '../state';

export interface RoomClock {
  /**
   * How far through the visit: < 0 while going in (−0.3 → 0, through the bay's frame), 0 → 1 while
   * standing in the room, 1 once it has played (its record read, the choice made).
   */
  u: number;
  /** This is the room being visited. */
  here: boolean;
  /** Worth animating: the room being visited, or the one the matrix's pointer is on. */
  near: boolean;
  /**
   * How present the room is to the visitor, 0 → 1: waking as the camera goes in through its bay,
   * full inside; a glimmer while the pointer rests on its bay; none otherwise. Continuous with scroll
   * (the camera is damped).
   */
  presence: number;
}

export function readRoomClock(index: number, out: RoomClock) {
  const v = eventsFrame.view;
  if (v.index === index && v.enter > 0) {
    out.here = true;
    out.near = true;
    // (Coming in through the frame, the installation's lead-in; inside, its own clock — and leaving
    // mid-way, that clock playing back, so it never jumps.)
    out.u = Math.max(v.room, v.enter < 1 ? -0.3 + 0.3 * v.enter : 0);
    out.presence = v.enter < 1 ? 0.2 + 0.8 * v.enter : 1;
    return out;
  }
  const lit = eventsFrame.lit[index] ?? 0;
  out.here = false;
  out.u = -0.3;
  out.near = lit > 0.02;
  out.presence = 0.15 * lit;
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
