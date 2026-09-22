'use client';
import { CampusModel } from './CampusModel';
import { CEGBuilding } from './CEGBuilding';
import { Grounds } from './Grounds';
import { Sky } from './Sky';

/** Chapters 1–3: the red building, the drone ascent, the campus from above. (Lights: scenes/shared/WorldLights.) */
export function CampusScene() {
  return (
    <group name="campus">
      <Sky />
      <Grounds />
      <CEGBuilding />
      <CampusModel />
    </group>
  );
}
