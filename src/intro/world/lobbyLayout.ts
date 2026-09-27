/**
 * The lobby at the foot of the light-well: where it is, how big, and where
 * its things stand — the four-part door in the north wall, the EVENTS
 * lettering mounted above it, and the short passage beyond the door to the
 * Events corridor. Shared by the geometry (Lobby, EventsTitle, Gate) and the
 * camera (../camera.ts).
 *
 * Deliberately small: a room for one thing, not a hall — you land in it from
 * the shaft, and across it is the door.
 */
import { FLOOR_Y, UNDERGROUND } from '@/config/world';
import { CAMPUS } from '@/config/world';
import { layoutWord } from './glyphs';

const C = UNDERGROUND.corridor;

export const LOBBY = {
  halfWidth: 10,
  /** South wall (behind the well). */
  south: CAMPUS.well.z + 5.5,
  /** The north wall's lobby-side face (the door is in it). */
  north: 27.6,
  /** Tall enough for the lettering to stand clear above the door. */
  height: 11,
  /** Thickness of the north wall (the door's frame is set into it). */
  wall: 0.8,
} as const;

export const LOBBY_TOP = FLOOR_Y + LOBBY.height;

/** The four-part door: as big as the corridor it opens onto, centred in the north wall. */
export const GATE = {
  width: C.halfWidth * 2,
  height: C.height,
  /** The door's plane (the middle of the wall). */
  z: LOBBY.north - LOBBY.wall / 2,
} as const;

/** From the door to the corridor mouth. */
export const PASSAGE = { z0: LOBBY.north - LOBBY.wall, z1: UNDERGROUND.hall.north } as const;

/**
 * EVENTS, mounted above the door: letter height, stroke, tracking, depth, and
 * how far the letters stand off the wall.
 */
export const SIGN = { H: 1.9, S: 0.29, tracking: 0.26, depth: 0.4, standoff: 0.16 } as const;
export const SIGN_LAYOUT = layoutWord('EVENTS', SIGN.H, SIGN.S, SIGN.tracking);
/** The lettering's left edge (centred on the door). */
export const SIGN_X0 = -SIGN_LAYOUT.width / 2;
/** Its baseline: clear of the door's frame. */
export const SIGN_BASE = FLOOR_Y + GATE.height + 1.05;
/** The plane of its faces. */
export const SIGN_Z = LOBBY.north + SIGN.standoff + SIGN.depth;
