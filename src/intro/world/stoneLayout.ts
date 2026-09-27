/**
 * Where the chapter's name stands: a stone in the garden mist, off to the
 * right of the walk, turned to face the camera where it stops to read it.
 * Shared by the stone (AcmStone.tsx) and the camera (../camera.ts).
 */
import type { Vec3 } from '@/config/world';

export const STONE = {
  /** Centre of the stone's foot (on the ground). */
  x: 6.6,
  z: 124.6,
  /** Where the camera reads it from (the stone is turned to face this). */
  reader: [-0.2, 1.86, 135.4] as Vec3,
  width: 7.2,
  height: 3.7,
  depth: 0.7,
  /** The low plinth it stands on. */
  plinth: 0.34,
  /** Cap height of the name's large lines (m). */
  cap: 0.5,
} as const;

/** The stone's turn about y, so its face (+z) looks at the reader. */
export const STONE_YAW = Math.atan2(STONE.reader[0] - STONE.x, STONE.reader[2] - STONE.z);
/** The middle of the lettering (world), for the camera to look at. */
export const STONE_FOCUS: Vec3 = [STONE.x, STONE.plinth + STONE.height * 0.56, STONE.z];
