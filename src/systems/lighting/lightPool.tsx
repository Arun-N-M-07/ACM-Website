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

/**
 * Register several anchors and get them back, so the owner can animate each
 * one's `gain` (e.g. fixtures that switch on in sequence).
 */
export function useGainedLightAnchors(list: Omit<LightAnchor, 'gain'>[]): LightAnchor[] {
  const items = useMemo(() => list.map((a) => ({ ...a, gain: 1 })), [list]);
  useEffect(() => {
    items.forEach((a) => anchors.add(a));
    return () => items.forEach((a) => anchors.delete(a));
  }, [items]);
  return items;
}

// Scratch for the frame's choice (no arrays, sets or objects made per frame).
const _near: LightAnchor[] = [];
const _nearD: number[] = [];
const _kept: boolean[] = [];
const _free: number[] = [];

export function LightPool({ maxDistance = 48 }: { maxDistance?: number }) {
  const quality = useExperience((s) => s.quality);
  const count = QUALITY[quality].pointLights;
  const lights = useRef<(PointLight | null)[]>([]);
  const current = useRef<(LightAnchor | null)[]>([]);

  useFrame(({ camera }, dt) => {
    // The nearest `count` anchors in reach, nearest first (equal distances in registration order).
    let m = 0;
    for (const a of anchors) {
      const d = a.position.distanceTo(camera.position);
      if (!(d < maxDistance)) continue;
      let j = m;
      while (j > 0 && _nearD[j - 1] > d) j--;
      if (j >= count) continue;
      for (let k = Math.min(m, count - 1); k > j; k--) {
        _near[k] = _near[k - 1];
        _nearD[k] = _nearD[k - 1];
      }
      _near[j] = a;
      _nearD[j] = d;
      if (m < count) m++;
    }

    // Lights keep their anchor while it stays among the nearest; only the
    // slots whose anchor dropped out are re-targeted (fading in from zero).
    for (let j = 0; j < m; j++) _kept[j] = false;
    let free = 0;
    for (let i = 0; i < count; i++) {
      const a = current.current[i];
      let kept = false;
      if (a) {
        for (let j = 0; j < m; j++) {
          if (!_kept[j] && _near[j] === a) {
            _kept[j] = kept = true;
            break;
          }
        }
      }
      if (!kept) _free[free++] = i;
    }
    let f = 0;
    for (let j = 0; j < m && f < free; j++) {
      if (_kept[j]) continue;
      const a = _near[j];
      const i = _free[f++];
      const l = lights.current[i];
      current.current[i] = a;
      if (!l) continue;
      l.intensity = 0;
      l.position.copy(a.position);
      l.color.copy(a.color);
      l.distance = a.distance;
    }
    for (; f < free; f++) current.current[_free[f]] = null;

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
