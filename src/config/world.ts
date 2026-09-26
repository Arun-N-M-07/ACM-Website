/**
 * World layout — the single source of truth for where things are.
 *
 * One continuous coordinate system (metres, +y up, the CEG building faces +z):
 *
 *   y = 0      campus ground. The red building sits north of the lawn.
 *   y = -60    underground facility floor. A glass light-well in the lawn
 *              drops straight into the facility hall; the events corridor runs
 *              north (−z) underneath the building, ending at the portal.
 *
 * Layouts that depend on content (event rooms) are computed from the content
 * arrays, so adding an event re-flows the world.
 */
import { EVENTS, type EventRecord } from '@/content/events';

export type Vec3 = [number, number, number];

export const EYE_HEIGHT = 1.68;

/**
 * The surface, in the frame of scripts/build-campus.mjs: origin at the red
 * building's clock tower, +x along the front facade, +z south toward the front
 * garden. Building and garden positions come from the OpenStreetMap footprints.
 */
export const CAMPUS = {
  tower: { x: 0.2, z: 0.6, top: 29.9 },
  /** South facade line of the main (south) wing. */
  frontZ: 7.6,
  /** The long front garden inside the loop drive (OSM leisure=garden). */
  garden: { x0: -19.5, x1: 19, z0: 38.6, z1: 98.8 },
  /** The fountain pool down the garden's axis. */
  pool: { x0: -3.3, x1: 3.3, z0: 56, z1: 93 },
  /** Circular plaza at the garden head, holding the glass light-well. */
  plaza: { x: 0, z: 46, r: 6.4 },
  well: { x: 0, z: 46, r: 3.6 },
  groundSize: 3200,
  radius: 700,
} as const;

/** The facility sits directly beneath the light-well. */
const WELL_Z = CAMPUS.well.z;

export const UNDERGROUND = {
  floorY: -60,
  hall: { north: WELL_Z - 26, south: WELL_Z + 9, width: 28, height: 9.5 },
  corridor: { halfWidth: 3.4, height: 6.2 },
} as const;

/** Positions in the facility hall authored relative to the well at z = 18. */
export const hallZ = (z: number) => z + (WELL_Z - 18);

export const FLOOR_Y = UNDERGROUND.floorY;
export const EYE_Y = FLOOR_Y + EYE_HEIGHT;

// ─── Events corridor ──────────────────────────────────────────────────────────

export interface RoomLayout {
  index: number;
  event: EventRecord;
  /** -1 = left (−x), +1 = right (+x). */
  side: -1 | 1;
  /** Room centre on the corridor axis (z). */
  z: number;
  /** Extent along z. */
  length: number;
  /** Extent away from the corridor (x). */
  depth: number;
  height: number;
  /** Room centre in world space. */
  center: Vec3;
  /** Where the camera stands to look into the room. */
  viewpoint: Vec3;
  /** What the camera looks at while in the room. */
  focus: Vec3;
}

const REGULAR = { pitch: 6.5, length: 11, depth: 10, height: 5.6, firstOffset: 8 };
const FLAGSHIP = { gapBefore: 11, length: 18, depth: 14, height: 7.2, pairPitch: 22 };
const DOOR_GAP = 14;

export function buildCorridorLayout(events: EventRecord[] = EVENTS) {
  const start = UNDERGROUND.hall.north;
  const hw = UNDERGROUND.corridor.halfWidth;
  const regular = events.filter((e) => !e.flagship);
  const flagships = events.filter((e) => e.flagship);
  const rooms: RoomLayout[] = [];

  regular.forEach((event, i) => {
    const side: -1 | 1 = i % 2 === 0 ? -1 : 1;
    const z = start - REGULAR.firstOffset - i * REGULAR.pitch;
    const cx = side * (hw + REGULAR.depth / 2);
    rooms.push({
      index: rooms.length,
      event,
      side,
      z,
      length: REGULAR.length,
      depth: REGULAR.depth,
      height: REGULAR.height,
      center: [cx, FLOOR_Y, z],
      // At the portal, facing the back wall (the visit steps in from here) —
      // aimed a little off centre so the installation sits to one side and its
      // plate to the other.
      viewpoint: [side * (hw - 0.4), EYE_Y, z],
      focus: [side * (hw + REGULAR.depth), EYE_Y - 0.05, z - 1.8],
    });
  });

  const lastRegularZ = regular.length ? rooms[rooms.length - 1].z : start;
  const transeptZ = lastRegularZ - REGULAR.pitch - FLAGSHIP.gapBefore;
  flagships.forEach((event, j) => {
    const side: -1 | 1 = j % 2 === 0 ? -1 : 1;
    const z = transeptZ - Math.floor(j / 2) * FLAGSHIP.pairPitch;
    const cx = side * (hw + FLAGSHIP.depth / 2);
    rooms.push({
      index: rooms.length,
      event,
      side,
      z,
      length: FLAGSHIP.length,
      depth: FLAGSHIP.depth,
      height: FLAGSHIP.height,
      center: [cx, FLOOR_Y, z],
      viewpoint: [side * (hw - 0.4), EYE_Y + 0.2, z],
      focus: [side * (hw + FLAGSHIP.depth), EYE_Y + 0.5, z - 2.6],
    });
  });

  const lastZ = rooms.length ? Math.min(...rooms.map((r) => r.z - r.length / 2)) : start;
  const doorZ = lastZ - DOOR_GAP;
  return { rooms, start, doorZ, end: doorZ };
}

export const CORRIDOR = buildCorridorLayout();
export const DOOR = { z: CORRIDOR.doorZ, width: 4.4, height: 7 };

// ─── The portal & the Teams world ─────────────────────────────────────────────

/**
 * The portal stands in the vestibule's end wall, where the corridor runs out.
 * Its ring is vertical, facing +z (back down the corridor).
 */
export const PORTAL = { z: DOOR.z, y: FLOOR_Y + 3.4, radius: 2.55, tube: 0.2 } as const;

/**
 * The Teams world is somewhere else entirely: far below and beyond the
 * facility, reached only through the portal. Everything in it is authored
 * relative to this origin (see src/teams/layout.ts).
 */
export const TEAMS_ORIGIN: Vec3 = [0, -420, -1400];
