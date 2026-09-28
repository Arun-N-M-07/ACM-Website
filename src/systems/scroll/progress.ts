/**
 * Frame-rate progress channel. Scroll progress changes every frame, so it lives
 * outside React: the scroll system writes `target`, the camera rig damps it
 * into `value` once per frame and notifies subscribers (overlays mutate the
 * DOM directly from these callbacks — no React re-render per frame).
 */
import { PORTAL_GATE } from '@/config/timeline';

type Listener = (value: number, dt: number) => void;

const listeners = new Set<Listener>();

export const progress = {
  /** Raw scroll progress, 0..1. */
  target: 0,
  /** Damped progress used by the camera and every progress-driven visual. */
  value: 0,
  /** Timestamp of the last scroll input. */
  lastInputAt: 0,
  /** Set by jumps (chapter index, deep links): the camera cuts instead of flying. */
  snap: false,
  /**
   * A cut's lead-in (progress units): the camera lands this far before the destination and the
   * damped follow carries it in — you arrive into the place, moving, instead of it snapping on.
   * Set with a jump, used once by the rig.
   */
  snapLead: 0,
  /**
   * A chapter change waiting for the frame to go dark (navigation.goToChapter): the rig dims the
   * picture, and at black runs this — the jump itself — so nothing changes while it can be seen.
   */
  pending: null as null | (() => void),
  /** Set by the camera rig for the frame in which a jump cut the journey (through black or not). */
  cut: false,
  /** Whether a jump's cut goes through black (the loop's does not: it is made inside the mist). */
  snapFade: true,
  /** How fast the picture comes back up after a cut (per second): a chapter change, slower. */
  fadeInRate: 2.5,
  /**
   * While the page's scroll position is being moved to match the camera (after
   * the push through the door), stale scroll events are ignored until the
   * scroll catches up.
   */
  hold: null as number | null,
  holdUntil: 0,
  /**
   * Walls. Until the portal has been entered, scroll can't pass it; inside the
   * Teams world, it can't fall back through it (leaving takes a sustained
   * pull — see teams/controller). Set by the Teams module.
   */
  lock: { min: 0, max: PORTAL_GATE },
  /** How far the last input tried to go past a wall (progress units; + beyond max, − below min). */
  overshoot: 0,

  /** Returns true when the input was clamped at a wall (the page scroll should be pulled back). */
  setTarget(p: number): boolean {
    let v = p < 0 ? 0 : p > 1 ? 1 : p;
    if (this.hold !== null) {
      if (Math.abs(v - this.hold) > 0.002 && performance.now() < this.holdUntil) return false;
      this.hold = null;
    }
    let clamped = false;
    if (v > this.lock.max) {
      this.overshoot = v - this.lock.max;
      v = this.lock.max;
      clamped = true;
    } else if (v < this.lock.min) {
      this.overshoot = v - this.lock.min;
      v = this.lock.min;
      clamped = true;
    }
    this.target = v;
    this.lastInputAt = performance.now();
    return clamped;
  },

  /** Clamp a programmatic destination into the current walls. */
  clampToLock(p: number) {
    return Math.min(this.lock.max, Math.max(this.lock.min, Math.min(1, Math.max(0, p))));
  },

  publish(dt: number) {
    for (const l of listeners) l(this.value, dt);
  },

  subscribe(l: Listener) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};
