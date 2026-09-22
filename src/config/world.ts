/**
 * World layout — the single source of truth for where things are.
 *
 * One continuous coordinate system (metres, +y up, the CEG building faces +z):
 *
 *   y = 0      campus ground. The red building sits north of the lawn.
 *   y = -60    underground facility floor. A glass light-well in the lawn
 *              drops straight into the facility hall; the events corridor runs
 *              north (−z) underneath the building, ending at the door to the
 *              team workspace.
 *
 * Layouts that depend on content (event rooms, domain bays) are computed from
 * the content arrays, so adding an event or a domain re-flows the world.
 */
import { EVENTS, type EventRecord } from '@/content/events';
import { DOMAINS, type Domain, type DomainId } from '@/content/domains';

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

// ─── Team workspace ───────────────────────────────────────────────────────────

/** World-space origin of the team hall: centre of the entrance threshold. */
export const TEAM_ORIGIN: Vec3 = [0, FLOOR_Y, DOOR.z - 0.6];

export const TEAM_HALL = {
  halfWidth: 22,
  depth: 60,
  height: 7.6,
  core: { z: -34, radius: 7.2, doorWidth: 3.2 },
  commons: { z: -8.5 },
  spawnZ: -5.5,
} as const;

export interface BayLayout {
  domain: Domain;
  /** Bay centre in hall-local coordinates (x, z). */
  x: number;
  z: number;
  /** Rotation so bay-local +z faces the aisle. */
  rotationY: number;
  width: number;
  depth: number;
  /** Hall-local point in the aisle in front of the bay. */
  approach: [number, number];
}

/**
 * Perimeter bay slots in walking order: down the west aisle, across the back
 * wall, up the east aisle — the scroll tour visits domains in this loop, then
 * turns into the core.
 */
const BAY_SLOTS: { x: number; z: number; rot: number }[] = [
  { x: -16.5, z: -14, rot: Math.PI / 2 },
  { x: -16.5, z: -25.5, rot: Math.PI / 2 },
  { x: -16.5, z: -37, rot: Math.PI / 2 },
  { x: -16.5, z: -48.5, rot: Math.PI / 2 },
  { x: -6, z: -54.5, rot: 0 },
  { x: 6, z: -54.5, rot: 0 },
  { x: 16.5, z: -48.5, rot: -Math.PI / 2 },
  { x: 16.5, z: -37, rot: -Math.PI / 2 },
  { x: 16.5, z: -25.5, rot: -Math.PI / 2 },
  { x: 16.5, z: -14, rot: -Math.PI / 2 },
];

export function buildTeamLayout(domains: Domain[] = DOMAINS) {
  const bays: BayLayout[] = [];
  const perimeter = domains.filter((d) => d.id !== 'office');
  if (perimeter.length > BAY_SLOTS.length && typeof console !== 'undefined') {
    console.warn(`[world] ${perimeter.length} domains but only ${BAY_SLOTS.length} bays; extra domains are listed in the archive only.`);
  }
  perimeter.slice(0, BAY_SLOTS.length).forEach((domain, i) => {
    const s = BAY_SLOTS[i];
    const fx = Math.sin(s.rot);
    const fz = Math.cos(s.rot);
    bays.push({
      domain,
      x: s.x,
      z: s.z,
      rotationY: s.rot,
      width: 10,
      depth: 10.5,
      approach: [s.x + fx * 7.2, s.z + fz * 7.2],
    });
  });
  return { bays };
}

export const TEAM_LAYOUT = buildTeamLayout();

export function bayFor(domain: DomainId) {
  return TEAM_LAYOUT.bays.find((b) => b.domain.id === domain);
}

/** Convert hall-local (x, z) to world space. */
export function teamToWorld(x: number, z: number, y = 0): Vec3 {
  return [TEAM_ORIGIN[0] + x, TEAM_ORIGIN[1] + y, TEAM_ORIGIN[2] + z];
}
