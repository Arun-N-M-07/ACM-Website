'use client';
import { useRef } from 'react';
import type { Group } from 'three';
import { useMist } from '@/intro/useMist';
import { CampusModel } from './CampusModel';
import { CEGBuilding } from './CEGBuilding';
import { Grounds } from './Grounds';
import { Sky } from './Sky';

/**
 * The red building and its campus — the world the opening film discovers.
 * Every material here takes the film's ground mist (src/intro/fog.ts).
 * (Lights: scenes/shared/WorldLights.)
 */
export function CampusScene() {
  const root = useRef<Group>(null);
  useMist(root);
  return (
    <group name="campus" ref={root}>
      <Sky />
      <Grounds />
      <CEGBuilding />
      <CampusModel />
    </group>
  );
}
