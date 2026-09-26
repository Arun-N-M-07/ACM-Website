/**
 * Where in the world each piece of content lives. The overlay draws a leader
 * line from its card to these points, so every card is visibly attached to the
 * thing it describes.
 */
import { Vector3 } from 'three';
import { CORRIDOR, PORTAL, type RoomLayout } from './world';
import { setAnchor } from '@/systems/anchors/anchors';

/** A room's back wall, where its title is painted. */
export function roomAnchor(r: RoomLayout) {
  const rotY = r.side === -1 ? Math.PI / 2 : -Math.PI / 2;
  const lz = -r.depth / 2 + 0.1;
  return new Vector3(r.center[0] + lz * Math.sin(rotY), r.center[1] + r.height * 0.62, r.center[2] + lz * Math.cos(rotY));
}

export const ANCHOR = {
  /** The portal: its centre, the top of the ring and just below it (the prompt). */
  portal: new Vector3(0, PORTAL.y, PORTAL.z),
  portalTop: new Vector3(0, PORTAL.y + PORTAL.radius + PORTAL.tube, PORTAL.z),
  portalBase: new Vector3(0, PORTAL.y - PORTAL.radius - PORTAL.tube - 0.35, PORTAL.z + 0.2),
};

/** Called once when the canvas mounts. */
export function registerWorldAnchors() {
  for (const [id, at] of Object.entries(ANCHOR)) setAnchor(id, at);
  for (const r of CORRIDOR.rooms) setAnchor(`room:${r.event.slug}`, roomAnchor(r));
}
