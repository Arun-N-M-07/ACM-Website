'use client';
/**
 * Pooled dynamic lighting. Scenes register many "light anchors" (every room
 * fixture, corridor downlight, desk lamp), but only a fixed handful of real
 * point lights exist; each frame they're moved to the anchors nearest the
 * camera. The number of lights never changes, so shaders never recompile, and
 * per-pixel lighting cost stays constant however large the facility gets.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Color, type PointLight, Vector3 } from 'three';
import { QUALITY } from '@/config/quality';
import { useExperience } from '@/store/experience';

export interface LightAnchor {
  position: Vector3;
  color: Color;
  intensity: number;
  distance: number;
  /** Optional multiplier updated by the owner (e.g. a room fading in). */
  gain?: number;
}

const anchors = new Set<LightAnchor>();

export function useLightAnchor(position: [number, number, number], color: string, intensity: number, distance: number) {
  const anchor = useMemo<LightAnchor>(
    () => ({ position: new Vector3(...position), color: new Color(color), intensity, distance, gain: 1 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [position[0], position[1], position[2], color, intensity, distance],
  );
  useEffect(() => {
    anchors.add(anchor);
    return () => {
      anchors.delete(anchor);
    };
  }, [anchor]);
  return anchor;
}

/** Register several anchors at once (static fixtures). */
export function useLightAnchors(list: Omit<LightAnchor, 'gain'>[]) {
  useEffect(() => {
    const items = list.map((a) => ({ ...a, gain: 1 }));
    items.forEach((a) => anchors.add(a));
    return () => items.forEach((a) => anchors.delete(a));
  }, [list]);
}

const _scored: { a: LightAnchor; d: number }[] = [];

export function LightPool({ maxDistance = 48 }: { maxDistance?: number }) {
  const quality = useExperience((s) => s.quality);
  const count = QUALITY[quality].pointLights;
  const lights = useRef<(PointLight | null)[]>([]);
  const current = useRef<(LightAnchor | null)[]>([]);

  useFrame(({ camera }, dt) => {
    _scored.length = 0;
    for (const a of anchors) {
      const d = a.position.distanceTo(camera.position);
      if (d < maxDistance) _scored.push({ a, d });
    }
    _scored.sort((x, y) => x.d - y.d);
    const wanted = new Set<LightAnchor>();
    for (let i = 0; i < Math.min(count, _scored.length); i++) wanted.add(_scored[i].a);

    // Lights keep their anchor while it stays among the nearest; only the
    // slots whose anchor dropped out are re-targeted (fading in from zero).
    const free: number[] = [];
    for (let i = 0; i < count; i++) {
      const a = current.current[i];
      if (a && wanted.has(a)) wanted.delete(a);
      else free.push(i);
    }
    for (const a of wanted) {
      const i = free.shift();
      if (i === undefined) break;
      const l = lights.current[i];
      current.current[i] = a;
      if (!l) continue;
      l.intensity = 0;
      l.position.copy(a.position);
      l.color.copy(a.color);
      l.distance = a.distance;
    }
    for (const i of free) current.current[i] = null;

    const k = 1 - Math.exp(-dt * 6);
    for (let i = 0; i < count; i++) {
      const l = lights.current[i];
      if (!l) continue;
      const a = current.current[i];
      const target = a ? a.intensity * (a.gain ?? 1) : 0;
      l.intensity += (target - l.intensity) * k;
      if (a) l.position.copy(a.position);
    }
  });

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <pointLight
          key={i}
          ref={(el) => {
            lights.current[i] = el;
          }}
          intensity={0}
          decay={2}
        />
      ))}
    </>
  );
}
