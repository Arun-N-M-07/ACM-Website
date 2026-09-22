/**
 * Shared per-frame world state written by <Atmosphere/> and read by lights and
 * materials in every chapter. 0 = open-air campus, 1 = underground.
 */
export const world = {
  underground: 0,
  /** Camera speed (m/s), smoothed — drives audio rush and subtle effects. */
  cameraSpeed: 0,
  /** Seconds since the experience started (for idle animation). */
  time: 0,
};
