/**
 * World layout — the single source of truth for where things are.
 *
 * One continuous coordinate system (metres, +y up, the CEG building faces +z):
 *
 *   y = 0      campus ground. The red building sits north of the lawn.
 *   y = -60    underground facility floor. A glass light-well in the lawn
 *              drops straight into the facility hall; beyond its door, north
 *              (−z) under the building, the Events hall and its matrix, and
 *              behind them the passage to the portal.
 *
 * Layouts that depend on content (the events' rooms) are computed from the
 * content arrays, so adding an event re-flows the world.
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

// ─── The Events: a hall, and in it the matrix of their rooms ─────────────────

/**
 * Beyond the lobby's door the Events are one dark hall, and at its far end one
 * object: the matrix — a monumental case of nine bays, three by three, set in a
 * niche in the end wall. Each bay holds an event's room: the room itself
 * (scenes/events/EventRoom), whole, built at full size and set into the bay at
 * the scale that fits it (a flagship's wider room smaller, under a lintel). The
 * lineup reads row by row from the top left.
 *
 * The matrix is built as three columns standing side by side — the seams run
 * down the middle of its two mullions. When it opens onto the Crew, the outer
 * two slide into the wall either side and the middle one sinks until its top
 * is the floor; behind them a passage runs to the portal.
 */
export const MATRIX = (() => {
  const cols = 3;
  const rows = Math.ceil(EVENTS.length / cols);
  /** A bay's opening. */
  const bay = { w: 4.2, h: 2.15 };
  /** The frame between bays (width of a mullion, height of a transom), and round the whole. */
  const mullion = 0.5;
  const transom = 0.5;
  const pier = 1.1;
  const crown = 1.25;
  const base = 1.0;
  const width = cols * bay.w + (cols - 1) * mullion + 2 * pier;
  const height = base + rows * bay.h + (rows - 1) * transom + crown;
  /**
   * Its front face (z) — near the door: the whole matrix is framed a few steps into the hall from the
   * lobby's passage (scenes/events/track: hubPose), so the door opens onto the gallery itself — and
   * how deep it is.
   */
  const face = UNDERGROUND.hall.north - 23;
  const depth = 4.6;
  /** How far behind the face a room's opening stands: the bay's layered reveal. */
  const reveal = 0.45;
  /** The seams between its three columns (x, either side of the middle one). */
  const seam = bay.w / 2 + mullion / 2;
  /** How far the outer columns slide into the wall when it opens. */
  const slide = 3;
  return { cols, rows, bay, mullion, transom, pier, crown, base, width, height, face, depth, back: face - depth, reveal, seam, slide };
})();

/** The hall: from the lobby passage's mouth north to the end wall, whose niche holds the matrix. */
export const EVENTS_HALL = (() => {
  const nicheMargin = 0.6;
  return {
    south: UNDERGROUND.hall.north,
    halfWidth: 16,
    height: 15,
    /** The end wall's face (the niche opens in it, the matrix standing back inside). */
    wall: MATRIX.face + 1.2,
    niche: { halfWidth: MATRIX.width / 2 + nicheMargin, height: MATRIX.height + nicheMargin, back: MATRIX.back - 0.4 },
  };
})();

/** Behind the matrix, once it has opened: the passage to the portal. */
export const EVENTS_PASSAGE = (() => {
  const halfWidth = MATRIX.seam + MATRIX.slide;
  const z0 = EVENTS_HALL.niche.back;
  const length = 16;
  return { halfWidth, height: MATRIX.height, z0, z1: z0 - length };
})();

/** One event's room, and where it stands in the matrix. */
export interface RoomLayout {
  index: number;
  event: EventRecord;
  /** The room's own size as built (m, full scale): along its opening (x), in from it (z), up. */
  length: number;
  depth: number;
  height: number;
  /** Height of the space over its opening (= height: a bay has no header). */
  ceiling: number;
  /** Its bay: column and row (0 at the top left), the opening's centre (x) and sill (y above the floor). */
  col: number;
  row: number;
  bayX: number;
  baySill: number;
  /** The scale it stands at in its bay, and where its floor's centre is (world). */
  scale: number;
  center: Vec3;
}

const ROOM_SIZE = { regular: { length: 11, depth: 10, height: 5.6 }, flagship: { length: 18, depth: 14, height: 7.2 } };

export const EVENT_ROOMS: RoomLayout[] = EVENTS.map((event, index) => {
  const { cols, rows, bay, mullion, transom, base, face, reveal } = MATRIX;
  const size = event.flagship ? ROOM_SIZE.flagship : ROOM_SIZE.regular;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const bayX = (col - (cols - 1) / 2) * (bay.w + mullion);
  const baySill = base + (rows - 1 - row) * (bay.h + transom);
  const scale = Math.min(bay.w / size.length, bay.h / size.height);
  return {
    index,
    event,
    ...size,
    ceiling: size.height,
    col,
    row,
    bayX,
    baySill,
    scale,
    center: [bayX, FLOOR_Y + baySill, face - reveal - (size.depth * scale) / 2],
  };
});

/** Which of the matrix's three columns a room stands in (-1 left, 0 middle, 1 right). */
export const columnOf = (col: number) => (col < 1 ? -1 : col > 1 ? 1 : 0) as -1 | 0 | 1;

// ─── The portal & the Teams world ─────────────────────────────────────────────

/** The passage's end wall, where the portal is cut. */
export const DOOR = { z: EVENTS_PASSAGE.z1, halfWidth: EVENTS_PASSAGE.halfWidth, height: EVENTS_PASSAGE.height };

/**
 * The portal stands in the passage's end wall. Its ring is vertical, facing +z
 * (back towards the matrix).
 */
export const PORTAL = { z: DOOR.z, y: FLOOR_Y + 3.4, radius: 2.55, tube: 0.2 } as const;

/**
 * The Teams world is somewhere else entirely: far below and beyond the
 * facility, reached only through the portal. Everything in it is authored
 * relative to this origin (see src/teams/layout.ts).
 */
export const TEAMS_ORIGIN: Vec3 = [0, -420, -1400];
