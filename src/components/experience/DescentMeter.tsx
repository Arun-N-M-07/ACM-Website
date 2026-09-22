'use client';
/** Depth gauge shown while the camera drops down the light-well. */
import { useRef } from 'react';
import { FLOOR_Y } from '@/config/world';
import { segmentProgress } from '@/config/timeline';
import { evaluateCinematic } from '@/systems/camera/shots';
import { emptyPose } from '@/systems/camera/pose';
import { smooth, useProgressFrame } from './useProgressFrame';

const pose = emptyPose();

export function DescentMeter() {
  const root = useRef<HTMLDivElement>(null);
  const value = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLSpanElement>(null);

  useProgressFrame((p) => {
    const u = segmentProgress(p, 'descent');
    const o = smooth(0.3, 0.42, u) * (1 - smooth(0.93, 1, u));
    if (root.current) {
      root.current.style.opacity = String(o);
      root.current.style.visibility = o < 0.01 ? 'hidden' : 'visible';
    }
    if (o < 0.01) return;
    evaluateCinematic(p, pose);
    const depth = Math.max(0, -pose.y);
    const alt = Math.max(0, pose.y);
    if (value.current) value.current.textContent = depth > 0.05 ? `−${depth.toFixed(1).padStart(4, '0')} m` : `+${alt.toFixed(1).padStart(4, '0')} m`;
    if (bar.current) bar.current.style.transform = `scaleY(${Math.min(1, depth / Math.abs(FLOOR_Y))})`;
  });

  return (
    <div className="descent-meter" ref={root} aria-hidden="true">
      <span className="kicker">Depth</span>
      <span className="descent-scale">
        <span ref={bar} />
      </span>
      <span className="descent-value" ref={value}>
        +000.0 m
      </span>
      <span className="kicker">Light-well · CEG lawn</span>
    </div>
  );
}
