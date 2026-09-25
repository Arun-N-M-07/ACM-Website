'use client';
/** A light inlaid into the route. Its position and revealed length rewind with scroll. */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { CatmullRomCurve3, Color, type Group, MeshBasicMaterial, SphereGeometry, TubeGeometry, Vector3 } from 'three';
import { SEGMENTS } from '@/config/timeline';
import { CAMPUS, CORRIDOR, DOOR, FLOOR_Y, UNDERGROUND } from '@/config/world';
import { roomDwellRange } from '@/systems/camera/shots';
import { TOUR_STOPS, tourProgress } from '@/systems/camera/tour';
import { smoothstep } from '@/systems/camera/pose';
import { useDisposable } from '@/systems/performance/useDisposable';
import { progress } from '@/systems/scroll/progress';

const Y = FLOOR_Y + 0.045;
const within = (segment: keyof typeof SEGMENTS, f: number) => SEGMENTS[segment].start + (SEGMENTS[segment].end - SEGMENTS[segment].start) * f;
const key = (p: number, x: number, y: number, z: number) => ({ p, at: new Vector3(x, y, z) });

/** The same route is reconstructed on the core's projection table. */
export const SIGNAL_KEYS = (() => {
  const w = CAMPUS.well;
  const keys = [
    key(within('descent', .15), w.x + w.r - .2, 0, w.z),
    key(within('descent', .76), w.x + w.r - .2, FLOOR_Y + 1, w.z),
    key(within('facility', .04), 0, Y, w.z - 1),
    key(within('facility', .95), 0, Y, UNDERGROUND.hall.north + 2),
  ];
  for (const r of CORRIDOR.rooms) {
    const [a, b] = roomDwellRange(r.index);
    const gap = a - keys[keys.length - 1].p;
    keys.push(
      key(a - gap * .5, 0, Y, r.z + 1.2),
      key(a, r.side * (UNDERGROUND.corridor.halfWidth + .2), Y, r.z + 1.2),
      key(a + (b - a) * .7, r.center[0], Y, r.z + 1.2),
      key(b, r.side * (UNDERGROUND.corridor.halfWidth + .2), Y, r.z + 1.2),
    );
  }
  keys.push(key(within('door', .15), 0, Y, DOOR.z + 4), key(SEGMENTS.team.start, 0, Y, DOOR.z - 2));
  for (let i = 0; i < TOUR_STOPS.length; i++) {
    const s = TOUR_STOPS[i];
    // The final turn approaches the core through its south-facing door.
    if (s.id === 'core') keys.push(key(SEGMENTS.core.start, 0, Y, s.view[2] + 9));
    keys.push(key(tourProgress(i, .2), s.view[0], Y, s.view[2]));
  }
  return keys;
})();

export function signalFraction(p: number) {
  const last = SIGNAL_KEYS.length - 1;
  if (p <= SIGNAL_KEYS[0].p) return 0;
  for (let i = 1; i <= last; i++) {
    if (p <= SIGNAL_KEYS[i].p) {
      const t = smoothstep(SIGNAL_KEYS[i - 1].p, SIGNAL_KEYS[i].p, p);
      return (i - 1 + t) / last;
    }
  }
  return 1;
}

export function SignalThread() {
  const group = useRef<Group>(null);
  const head = useRef<Group>(null);
  const res = useDisposable(() => {
    const curve = new CatmullRomCurve3(SIGNAL_KEYS.map((k) => k.at), false, 'centripetal');
    return {
      curve,
      tube: new TubeGeometry(curve, 1200, .023, 4, false),
      track: new TubeGeometry(curve, 1200, .016, 4, false),
      material: new MeshBasicMaterial({ color: new Color('#83bbff'), transparent: true, opacity: .85, toneMapped: false }),
      trackMaterial: new MeshBasicMaterial({ color: '#26313f', transparent: true, opacity: .55 }),
      bead: new SphereGeometry(.04, 10, 8),
      beadMaterial: new MeshBasicMaterial({ color: '#edf6ff', toneMapped: false }),
    };
  }, []);
  const point = useMemo(() => new Vector3(), []);
  useFrame(() => {
    const p = progress.value;
    const t = signalFraction(p);
    if (group.current) group.current.visible = p > SEGMENTS.descent.start && p < SEGMENTS.core.end;
    res.tube.setDrawRange(0, Math.floor(t * 1200) * 24);
    res.material.opacity = .85 * smoothstep(SEGMENTS.descent.start, SIGNAL_KEYS[0].p, p);
    if (head.current) head.current.position.copy(res.curve.getPoint(t, point));
  });
  return (
    <group ref={group} name="connected-signal">
      <mesh geometry={res.track} material={res.trackMaterial} />
      <mesh geometry={res.tube} material={res.material} />
      <group ref={head}><mesh geometry={res.bead} material={res.beadMaterial} /></group>
    </group>
  );
}
