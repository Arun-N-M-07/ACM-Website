/**
 * 3D asset manifest. Each slot is an optional GLB that replaces a procedural
 * stand-in when the file exists under /public (detected by `npm run media:scan`).
 * Specs for each model (scale, origin, orientation, budgets) are in docs/ASSETS.md.
 */
import type { Vec3 } from './world';

export interface ModelSlotDef {
  path: string;
  /** Transform applied to the loaded model (models are authored in metres, +z forward). */
  position?: Vec3;
  rotation?: Vec3;
  scale?: number;
  castShadow?: boolean;
}

export type ModelSlotId = 'cegBuilding' | 'cegCampus' | 'facilityHall' | 'corridor';

export const MODEL_SLOTS: Record<ModelSlotId, ModelSlotDef> = {
  cegBuilding: { path: '/models/campus/ceg-building.glb', castShadow: true },
  cegCampus: { path: '/models/campus/ceg-campus.glb' },
  facilityHall: { path: '/models/underground/facility-hall.glb' },
  corridor: { path: '/models/underground/corridor.glb' },
};
