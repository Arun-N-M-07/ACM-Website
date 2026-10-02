/**
 * The Events' state.
 *
 * `eventsFrame` is read and written every frame (the camera rig, the hall, the
 * interface) — plain numbers, no React. `useEvents` holds the little the
 * interface renders from: which event the room part of the track shows, and
 * whether it is being visited (Visit, the index) — the track's walls and its
 * join at the matrix depend on that (controller.ts).
 */
import { create } from 'zustand';
import { EVENTS } from '@/content/events';
import { emptyPose, type CameraPose } from '@/systems/camera/pose';

const N = EVENTS.length;

export const eventsFrame = {
  /** Actual rendered camera, recorded by the existing rig after all pose layers. */
  camera: { pose: emptyPose(), aspect: 1, ready: false },
  /** Explicit selection's scroll-authored path, starting at the rendered viewpoint. */
  entry: null as null | { from: number; to: number; pixel: number; pose: CameraPose; aspect: number; rejoin: boolean },
  /** The bay under the pointer, the keyboard's focus or a finger, at the whole matrix (-1: none). */
  hover: -1,
  /** Each bay's answer to it (0..1, eased): its light, the veil over the others, the tracing. */
  lit: new Float32Array(N),
  /**
   * Each bay's tracing (its own clock, s): runs while the bay is lit — from 0 as it lights — so the
   * lines cross it once and settle, and runs out as it goes quiet.
   */
  trace: new Float32Array(N),
  /** The pointer (NDC, for the matrix's lean; and CSS px, for a lit bay's label); `active` while a mouse is over the page. */
  pointer: { x: 0, y: 0, px: 0, py: 0, active: false },
  /**
   * The shown record's own length and the screen it is read on (px), as the interface measures them:
   * the scroll moves the record as a page, px for px, and ends where it ends (controller.recordWall).
   */
  record: { height: 0, screen: 0 },
  /** The picture this frame (controller.ts). */
  view: {
    /** The event the room part of the track shows (-1: none). */
    index: -1,
    /** Arrival: the hall and the matrix coming up out of the dark (0..1). */
    reveal: 0,
    /** How much the picture is the whole matrix, still — to be chosen from (0..1). */
    hub: 0,
    /** Into the chosen room: scroll position along the authored approach, not a playback clock. */
    enter: 0,
    /**
     * The established room interval (0..1). Its camera holds one terminal composition.
     */
    room: 0,
    /** Installation playback (0..1), stepped at its own fixed rate; never drives camera/page/scroll. */
    play: 0,
    /**
     * The record moved up the screen by the scroll (px, 0 → its length): its edge rising over the room
     * for the first screen of it, and it read on up the screen after that.
     */
    page: 0,
    /** The room giving way to its record (0..1), the record read (0..1), the choice at its end (0..1). */
    unfold: 0,
    read: 0,
    decide: 0,
    /** The matrix opening onto the portal (0..1). */
    split: 0,
    /** The camera is inside the chosen room, nothing else in view (0..1). */
    inside: 0,
  },
};

interface EventsStore {
  /** The event the room part of the track shows (-1: none). */
  selected: number;
  /** Being visited: the track's room part is live, walled at its end (the choice). */
  visiting: boolean;
  set: (p: Partial<Omit<EventsStore, 'set'>>) => void;
}

export const useEvents = create<EventsStore>((set) => ({
  selected: -1,
  visiting: false,
  set: (p) => set(p),
}));

export const eventsState = () => useEvents.getState();
