'use client';
/**
 * Give everything under `root` the film's mist (src/intro/fog.ts). Parts of
 * the campus build asynchronously (the OpenStreetMap campus arrives after
 * the red building), so new materials are picked up as they appear; once
 * nothing new has arrived for a while the hook stops looking. All of this
 * happens while the world loads, before the shaders are warmed.
 */
import { useFrame } from '@react-three/fiber';
import { type RefObject, useRef } from 'react';
import type { Material, Mesh, Object3D } from 'three';
import { patchMist } from './fog';

export function useMist(root: RefObject<Object3D | null>) {
  const quiet = useRef(0);
  useFrame((_, dt) => {
    const r = root.current;
    if (!r || quiet.current > 12) return;
    let fresh = 0;
    r.traverse((o) => {
      const m = (o as Mesh).material as Material | Material[] | undefined;
      if (!m) return;
      if (Array.isArray(m)) m.forEach((x) => (fresh += patchMist(x) ? 1 : 0));
      else if (patchMist(m)) fresh++;
    });
    quiet.current = fresh ? 0 : quiet.current + dt;
  });
}
