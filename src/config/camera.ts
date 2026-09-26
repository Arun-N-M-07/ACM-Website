/**
 * Named camera states for the scroll journey. Every cinematic shot
 * interpolates between these, so the journey can be re-framed from this file.
 * (The opening cinematic's camera is authored in src/intro/camera.ts; it ends
 * exactly on `facilityEnd`, where the journey's scroll begins.)
 */
import { EYE_Y, PORTAL, UNDERGROUND } from './world';
import { lookPose, makePose } from '@/systems/camera/pose';

export const CAMERA_STATES = {
  /** The corridor mouth, looking north down the Events corridor: the handoff from the intro. */
  facilityEnd: makePose([0, EYE_Y, UNDERGROUND.hall.north + 2.5], 0, 0, 54),

  // Down the vestibule towards the portal, then standing square on to it.
  portalApproach: lookPose([0, EYE_Y, PORTAL.z + 17], [0, PORTAL.y + 0.6, PORTAL.z], 54),
  portalStand: lookPose([0, EYE_Y + 0.1, PORTAL.z + 8.8], [0, PORTAL.y - 0.15, PORTAL.z], 50),
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
