/**
 * Where in the world fixed pieces of content live, for the overlay to find on
 * screen. (The Events matrix registers its own — its bays move as it opens:
 * scenes/events/EventsHall.)
 */
import { Vector3 } from 'three';
import { PORTAL } from './world';
import { setAnchor } from '@/systems/anchors/anchors';

export const ANCHOR = {
  /** The portal: its centre, the top of the ring and just below it (the prompt). */
  portal: new Vector3(0, PORTAL.y, PORTAL.z),
  portalTop: new Vector3(0, PORTAL.y + PORTAL.radius + PORTAL.tube, PORTAL.z),
  portalBase: new Vector3(0, PORTAL.y - PORTAL.radius - PORTAL.tube - 0.35, PORTAL.z + 0.2),
};

/** Called once when the canvas mounts. */
export function registerWorldAnchors() {
  for (const [id, at] of Object.entries(ANCHOR)) setAnchor(id, at);
}
