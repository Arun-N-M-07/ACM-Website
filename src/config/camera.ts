/**
 * Named camera states. Every cinematic shot interpolates between these, so the
 * whole journey can be re-framed from this one file.
 */
import { CAMPUS, CORRIDOR, DOOR, EYE_Y, FLOOR_Y, hallZ, TEAM_HALL, TEAM_ORIGIN, UNDERGROUND, type Vec3 } from './world';
import { DEG, lookPose, makePose } from '@/systems/camera/pose';

export type CameraMode =
  | 'ARRIVAL_CAMERA'
  | 'DRONE_CAMERA'
  | 'CAMPUS_CAMERA'
  | 'DESCENT_CAMERA'
  | 'EVENT_CAMERA'
  | 'DOOR_CAMERA'
  | 'IMPACT_CAMERA'
  | 'FIRST_PERSON_CAMERA';

const W = CAMPUS.well;
const T = CAMPUS.tower;

/**
 * The opening drone flight: one continuous spline from low over the fountain
 * pool, up the face of the clock tower, over the dome, pulling back to reveal
 * the campus, and settling straight down over the light-well. `t` is the time
 * (0..1) across the arrival → top-down chapters at which each key is reached;
 * a monotone time-warp keeps velocity continuous between keys.
 */
export interface FlightKey {
  t: number;
  pos: Vec3;
  look: Vec3;
  fov: number;
}

export const FLIGHT: FlightKey[] = [
  { t: 0, pos: [0.9, 1.9, 108], look: [T.x, 12.5, T.z], fov: 34 },
  { t: 0.2, pos: [0.6, 2.9, 77], look: [T.x, 14, T.z], fov: 36 },
  { t: 0.37, pos: [-1.5, 9.5, 44], look: [T.x, 18.5, T.z], fov: 40 },
  { t: 0.5, pos: [-4.5, 20.8, 25], look: [T.x, 21, T.z], fov: 42 },
  { t: 0.62, pos: [-3, 36, 28], look: [T.x, 23, -3], fov: 44 },
  { t: 0.8, pos: [8, 128, 124], look: [0, 0, -8], fov: 44 },
  { t: 1, pos: [W.x, 205, W.z], look: [W.x, 0, W.z], fov: 40 },
];

export const CAMERA_STATES = {
  topDown: makePose([W.x, 205, W.z], 0, -89.9 * DEG, 40),

  // Descent: straight down the light-well, then level out inside the hall.
  descentGround: makePose([W.x, 6, W.z], 0, -89.9 * DEG, 52),
  descentShaft: makePose([W.x, FLOOR_Y + 13, W.z], 0, -89.9 * DEG, 58),
  descentHall: makePose([W.x, FLOOR_Y + 5.4, W.z - 0.6], 0, -38 * DEG, 56),
  facilityStart: makePose([W.x, EYE_Y + 0.25, W.z - 2.5], 0, -2 * DEG, 54),

  // Square on to the departures board (west wall), then a slow push in.
  facilityBoard: lookPose([0.6, EYE_Y, hallZ(9)], [-14, FLOOR_Y + 3.2, hallZ(9)], 50),
  facilityBoardClose: lookPose([-2.2, EYE_Y, hallZ(9)], [-14, FLOOR_Y + 3.25, hallZ(9)], 50),
  // A pan through north between the two walls (no 180° whip).
  facilityMid: makePose([0.4, EYE_Y, hallZ(6.4)], 0, 0, 52),
  // The monument (east wall), framed to the right so its plate can sit on the left.
  facilityMonument: lookPose([-1.5, EYE_Y, hallZ(3.6)], [14, FLOOR_Y + 3.1, hallZ(1.4)], 50),
  facilityEnd: makePose([0, EYE_Y, UNDERGROUND.hall.north + 2.5], 0, 0, 54),

  doorApproach: makePose([0, EYE_Y, DOOR.z + 7.5], 0, 7 * DEG, 50),
  doorThrough: makePose([0, EYE_Y, DOOR.z + 1.6], 0, 1 * DEG, 56),
  doorLean: makePose([0, EYE_Y - 0.05, DOOR.z + 0.6], 0, 0, 60),

  teamSpawn: makePose([TEAM_ORIGIN[0], EYE_Y, TEAM_ORIGIN[2] + TEAM_HALL.spawnZ], 0, -3 * DEG, 62),
} as const;

/** Tuning for the scroll → camera response. */
export const CAMERA_RESPONSE = {
  /** Exponential damping rate applied to scroll progress before sampling shots. */
  progressDamping: 5.5,
  /** Gentle hand-held drift in cinematic mode (radians / metres). Disabled with reduced motion. */
  driftAngle: 0.0035,
  driftPosition: 0.02,
  near: 0.1,
  far: 2600,
} as const;

/** The physical push through the door. */
export const IMPACT = {
  duration: 1.9,
  /** Fraction of the duration spent accelerating forward. */
  rush: 0.36,
  shakeAmplitude: 0.075,
  shakeRoll: 5.5 * DEG,
  pitchDip: -9 * DEG,
  fovPunch: 16,
  blurPx: 7,
} as const;

export const FIRST_PERSON = {
  walkSpeed: 3.1,
  runSpeed: 5.2,
  acceleration: 14,
  damping: 10,
  radius: 0.34,
  lookSensitivity: 0.0022,
  dragSensitivity: 0.0042,
  keyTurnSpeed: 1.8,
  pitchLimit: 78 * DEG,
  wheelStep: 0.9,
  bobAmount: 0.028,
  bobFrequency: 8.5,
  fov: 62,
} as const;

export const ROOM_COUNT = CORRIDOR.rooms.length;
