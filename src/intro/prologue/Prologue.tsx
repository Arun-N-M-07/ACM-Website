'use client';
/**
 * The prologue (beats before 0): the canister that rolls in out of the fog,
 * and the gas it releases — which becomes the chapter's years, and then mist.
 * See layout.ts for the staging.
 */
import { Canister } from './Canister';
import { GasVolume } from './GasVolume';
import { RoadLamp } from './RoadLamp';

export function Prologue() {
  return (
    <group name="intro-prologue">
      <RoadLamp />
      <Canister />
      <GasVolume />
    </group>
  );
}
