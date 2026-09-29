'use client';
/**
 * Projects every registered world anchor to screen coordinates once per frame,
 * right after the camera has been placed, then tells the HTML overlay. This is
 * what lets a content card draw a line to the thing it describes.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Vector3 } from 'three';
import { registerWorldAnchors } from '@/config/anchors';
import { anchorPoints, anchorSources, emitProjected, stage } from '@/systems/anchors/anchors';

export function AnchorProjector() {
  const v = useMemo(() => new Vector3(), []);
  useEffect(registerWorldAnchors, []);
  useFrame(({ camera, size }) => {
    stage.w = size.width;
    stage.h = size.height;
    const points = anchorPoints();
    for (const [id, get] of anchorSources()) {
      let p = points.get(id);
      if (!p) {
        p = { x: 0, y: 0, visible: false };
        points.set(id, p);
      }
      const at = get();
      if (!at) {
        p.visible = false;
        continue;
      }
      v.copy(at).project(camera);
      p.x = (v.x * 0.5 + 0.5) * size.width;
      p.y = (-v.y * 0.5 + 0.5) * size.height;
      const margin = 80;
      p.visible = v.z < 1 && p.x > -margin && p.x < size.width + margin && p.y > -margin && p.y < size.height + margin;
    }
    emitProjected();
  });
  return null;
}
