/**
 * World anchors: points in the 3D world that the HTML layer can point at.
 *
 * The canvas projects every registered anchor to screen coordinates once per
 * frame (AnchorProjector, which runs right after the camera is placed); the
 * overlay reads the result to draw leader lines from a content card to the
 * thing in the world it is describing.
 */
import type { Vector3 } from 'three';

export interface Projected {
  /** CSS pixels from the top-left of the canvas. */
  x: number;
  y: number;
  /** In front of the camera and within (a margin of) the viewport. */
  visible: boolean;
}

type Source = () => Vector3 | null | undefined;

const sources = new Map<string, Source>();
const points = new Map<string, Projected>();
const listeners = new Set<() => void>();

/** Register a moving anchor (a person's head); returns an unregister function. */
export function trackAnchor(id: string, get: Source) {
  sources.set(id, get);
  return () => {
    sources.delete(id);
    points.delete(id);
  };
}

/** Register a fixed anchor. */
export function setAnchor(id: string, at: Vector3) {
  sources.set(id, () => at);
}

export const anchorSources = () => sources;
export const anchorPoints = () => points;
export const anchorAt = (id: string | undefined) => (id ? points.get(id) : undefined);

export function onProjected(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function emitProjected() {
  for (const cb of listeners) cb();
}
