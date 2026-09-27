/**
 * Teams world state.
 *
 * Two layers, on purpose:
 *
 *  - `useTeams` (Zustand) holds the handful of discrete facts the DOM needs to
 *    re-render for: which state we're in, which card is nearest, which one is
 *    selected. These change a few times per visit.
 *
 *  - `teamsFrame` is a plain mutable object for everything that changes every
 *    frame (hold progress, travel clock, the damped orbit coordinate, pointer,
 *    velocities, the selected card's screen rectangle). Systems read and write
 *    it directly inside useFrame / GSAP tweens; React never sees it.
 */
import { create } from 'zustand';
import { DOMAIN_COUNT } from '@/content/teams';

export type TeamsState =
  /** Anywhere before the portal. */
  | 'outside'
  /** Standing before the portal; it can be held. */
  | 'portalIdle'
  /** The portal is being held (or releasing back to idle). */
  | 'portalHolding'
  /** Travelling in through the portal. */
  | 'portalEntering'
  /** Arrived; the world is revealing itself. Input is locked. */
  | 'teamsEntering'
  /** Orbiting the spine: scroll, pointer and cards are live. */
  | 'teamsActive'
  /** A card has been chosen and the camera is flying to or from it. */
  | 'cardFocused'
  /** The chosen domain is open. */
  | 'domainDetail'
  /** Travelling back out through the portal. */
  | 'portalExiting';

interface TeamsStore {
  state: TeamsState;
  /** Card nearest the centre of the orbit (0..DOMAIN_COUNT-1), for the index and labels. */
  current: number;
  /** The chosen card while focused / open. */
  selected: number | null;
  /** Direction of the current focus flight: opening a card or closing it. */
  focusDir: 'in' | 'out';
  set: (partial: Partial<Omit<TeamsStore, 'set'>>) => void;
}

export const useTeams = create<TeamsStore>((set) => ({
  state: 'outside',
  current: 0,
  selected: null,
  focusDir: 'in',
  set: (partial) => set(partial),
}));

export const teams = () => useTeams.getState();

export interface ScreenRect {
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
}

/** Per-frame channel. Units noted per field. */
export const teamsFrame = {
  /** The camera is in the Teams world (scroll lives past the portal gate). */
  inside: false,

  // ── Portal ────────────────────────────────────────────────────────────────
  /** The visitor is standing in the hold zone. */
  armed: false,
  /** Input is down (pointer, touch or key). */
  holding: false,
  /** Hold progress 0..1 (2 s to fill; releases smoothly). */
  hold: 0,
  /** Seconds since the hold began (for the stage reactions). */
  heldFor: 0,
  /** Scroll pressure against the gate (progress units, decaying): prompts the hint. */
  pressure: 0,
  /** Upward scroll pressure at the start of the world: sustained, it takes you back out. */
  pull: 0,
  /** Seconds the camera has been at rest at the floor of the world (the pull only counts after a moment). */
  floorRest: 0,

  // ── Travel (written by the travel timeline) ───────────────────────────────
  travel: {
    /** Master clock 0..1 of the current travel. */
    t: 0,
    /** +1 entering, −1 leaving. */
    dir: 1 as 1 | -1,
    /** The camera is inside the streak tunnel. */
    inTunnel: false,
    /** Speed along the tunnel, 0..1 (drives streak stretch). */
    speed: 0,
    /** Radial zoom blur 0..1. */
    warp: 0,
    /** Chromatic aberration 0..1. */
    aberration: 0,
    /** White bloom-out 0..1 (hides the crossing). */
    flash: 0,
    /** Darkness 0..1 (the arrival starts from black). */
    dark: 0,
  },

  /** World reveal 0..1 (arrival sequence). */
  arrival: 0,
  /** Scroll reveal after the architectural letters have passed the lens. */
  reveal: 0,
  /** Focus blend 0..1 from the orbit towards the chosen card (eased). */
  focus: 0,
  /** The dive into a card as it opens (0..1, peaks mid-flight): drives the lens surge. */
  dive: 0,
  /** A chosen card's acknowledgement (0..1, quick): it comes forward and squares up at once. */
  commit: 0,
  /** The card the focus shot is on — continuous, so card-to-card moves arc between them. */
  focusK: 0,

  // ── Orbit ─────────────────────────────────────────────────────────────────
  /** The orbit coordinate: < 0 the entrance (THE TEAM), 0 = card 01 centred … 6 = card 07, beyond = outro. */
  c: -0.35,
  /** dc/dt (cards per second), smoothed at the camera's rate (bank, particles). */
  cVel: 0,
  /** The orbit follower's own velocity (critically damped; the primary response). */
  cV: 0,
  /** Orbit velocity as the cards feel it (a little later than the camera). */
  cardVel: 0,
  /** Orbit velocity as the spine feels it (heavier still: it trails and catches up). */
  spineVel: 0,

  // ── Pointer (NDC, −1..1, +y up) ───────────────────────────────────────────
  pointer: { x: 0, y: 0, sx: 0, sy: 0, cx: 0, cy: 0, active: false, dx: 0, dy: 0, vx: 0, vy: 0, fx: 0, fy: 0, fvx: 0, fvy: 0, energy: 0, stir: 0, dirX: 1, dirY: 0 },
  /** The card being pressed (pointer or finger down on it, −1 none) and where, in its plane: the touch lands before the click. */
  press: { card: -1, x: 0, y: 0 },
  /** Card under the pointer (−1 none). */
  hover: -1,
  /** Where the pointer is on that card (metres from its centre, in its plane), eased. */
  hoverAt: { x: 0, y: 0 },
  /** Smoothed hover amount per card. */
  hoverAmt: Array.from({ length: DOMAIN_COUNT }, () => 0),
  proximity: Array.from({ length: DOMAIN_COUNT }, () => 0),
  touchCard: -1,
  /** Visibility of content physically behind the chosen card. */
  domainReveal: 0,

  /** The selected card's rectangle on screen (CSS px) — the detail layer is laid out inside it. */
  cardRect: { x: 0, y: 0, w: 0, h: 0, visible: false } as ScreenRect,
};

type Listener = () => void;
const rectListeners = new Set<Listener>();
/** Subscribe to per-frame updates of teamsFrame.cardRect (fires after the camera is placed). */
export function onCardRect(l: Listener) {
  rectListeners.add(l);
  return () => {
    rectListeners.delete(l);
  };
}
export function emitCardRect() {
  for (const l of rectListeners) l();
}
