'use client';
import { useEffect, useRef } from 'react';
import { progress } from '@/systems/scroll/progress';

/**
 * Run a callback every rendered frame with the damped journey progress.
 * Overlays use this to mutate styles directly instead of re-rendering React.
 */
export function useProgressFrame(cb: (p: number, dt: number) => void) {
  const ref = useRef(cb);
  useEffect(() => {
    ref.current = cb;
  });
  useEffect(() => progress.subscribe((p, dt) => ref.current(p, dt)), []);
}

export const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
