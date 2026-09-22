/**
 * Frame-rate progress channel. Scroll progress changes every frame, so it lives
 * outside React: the scroll system writes `target`, the camera rig damps it
 * into `value` once per frame and notifies subscribers (overlays mutate the
 * DOM directly from these callbacks — no React re-render per frame).
 */
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
   * While the page's scroll position is being moved to match the camera (after
   * the push through the door), stale scroll events are ignored until the
   * scroll catches up.
   */
  hold: null as number | null,
  holdUntil: 0,

  setTarget(p: number) {
    const v = p < 0 ? 0 : p > 1 ? 1 : p;
    if (this.hold !== null) {
      if (Math.abs(v - this.hold) > 0.002 && performance.now() < this.holdUntil) return;
      this.hold = null;
    }
    this.target = v;
    this.lastInputAt = performance.now();
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
