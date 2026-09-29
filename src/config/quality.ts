/**
 * Device quality tiers. Chosen once at start-up (see systems/performance/quality)
 * and lowered at runtime if the frame rate can't keep up.
 */
export type QualityTier = 'high' | 'medium' | 'low';

export interface QualitySettings {
  dpr: [number, number];
  antialias: boolean;
  shadows: boolean;
  shadowMapSize: number;
  /** Campus trees (instanced). */
  trees: number;
  /** Extra massing blocks around the campus core. */
  campusBlocks: number;
  /** Canvas texture scale (signage, posters, brick). */
  textureScale: number;
  /** How many event rooms are mounted either side of the current one. */
  roomWindow: number;
  /** Max dynamic point lights that follow the camera underground. */
  pointLights: number;
  environmentMap: boolean;
}

export const QUALITY: Record<QualityTier, QualitySettings> = {
  high: {
    dpr: [1, 2],
    antialias: true,
    shadows: true,
    shadowMapSize: 2048,
    trees: 3400,
    campusBlocks: 70,
    textureScale: 1,
    roomWindow: 2,
    pointLights: 4,
    environmentMap: true,
  },
  medium: {
    dpr: [1, 1.5],
    antialias: true,
    shadows: false,
    shadowMapSize: 1024,
    trees: 1900,
    campusBlocks: 48,
    textureScale: 0.75,
    roomWindow: 2,
    pointLights: 3,
    environmentMap: true,
  },
  low: {
    // (Phones. The floor is below 1: on a weak GPU, when the frame still can't keep up at a pixel per
    // CSS pixel with the runtime `degrade` knobs turned, fewer pixels than that is the last step — a
    // smooth scroll is worth more than a sharper frame. Reached only by measured decline, never as a
    // start: ExperienceCanvas.)
    dpr: [0.75, 1.25],
    antialias: false,
    shadows: false,
    shadowMapSize: 512,
    trees: 750,
    campusBlocks: 28,
    textureScale: 0.5,
    roomWindow: 1,
    pointLights: 2,
    environmentMap: false,
  },
};
