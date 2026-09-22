/**
 * Where in the world each piece of content lives. The overlay draws a leader
 * line from its card to these points, so every card is visibly attached to the
 * thing it describes.
 */
import { Vector3 } from 'three';
import { CAMPUS, CORRIDOR, DOOR, FLOOR_Y, hallZ, TEAM_HALL, TEAM_LAYOUT, TEAM_ORIGIN, UNDERGROUND, type RoomLayout } from './world';
import { setAnchor } from '@/systems/anchors/anchors';
import { bayToWorld } from '@/scenes/team/teamLayout';

const H = UNDERGROUND.hall;
const C = UNDERGROUND.corridor;

/** A room's back wall, where its title is painted. */
export function roomAnchor(r: RoomLayout) {
  const rotY = r.side === -1 ? Math.PI / 2 : -Math.PI / 2;
  const lz = -r.depth / 2 + 0.1;
  return new Vector3(r.center[0] + lz * Math.sin(rotY), r.center[1] + r.height * 0.62, r.center[2] + lz * Math.cos(rotY));
}

export const ANCHOR = {
  tower: new Vector3(CAMPUS.tower.x, CAMPUS.tower.top - 4.5, CAMPUS.tower.z),
  porch: new Vector3(0, 9.5, 19),
  well: new Vector3(CAMPUS.well.x, 0.4, CAMPUS.well.z),
  board: new Vector3(-H.width / 2 + 0.3, FLOOR_Y + 3.4, hallZ(9)),
  plaque: new Vector3(H.width / 2 - 0.3, FLOOR_Y + 3.6, hallZ(3.6)),
  corridorSign: new Vector3(0, FLOOR_Y + C.height + 1.6, H.north + 0.1),
  door: new Vector3(0, FLOOR_Y + DOOR.height + 0.9, DOOR.z + 0.2),
  commons: new Vector3(TEAM_ORIGIN[0], FLOOR_Y + 3.4, TEAM_ORIGIN[2] + TEAM_HALL.commons.z - 3.4),
};

/** Called once when the canvas mounts. */
export function registerWorldAnchors() {
  for (const [id, at] of Object.entries(ANCHOR)) setAnchor(id, at);
  for (const r of CORRIDOR.rooms) setAnchor(`room:${r.event.slug}`, roomAnchor(r));
  for (const bay of TEAM_LAYOUT.bays) {
    const [x, y, z] = bayToWorld(bay, 0, -bay.depth / 2 + 0.1, 4.6);
    setAnchor(`bay:${bay.domain.id}`, new Vector3(x, y, z));
  }
}
