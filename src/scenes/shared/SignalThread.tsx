'use client';
/**
 * A light inlaid into the route. Its position and revealed length rewind with
 * scroll. It picks up where the opening's lobby hands over, at the mouth of
 * the Events hall, and runs across it to the matrix's foot — where it waits
 * while the matrix is the place (its rooms visited or not); when the matrix
 * opens it runs on over the middle column, sunk into the floor, down the
 * passage and into the portal — and while the portal is held, it floods
 * towards it.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { CatmullRomCurve3, Color, type Group, MeshBasicMaterial, SphereGeometry, TubeGeometry, Vector3 } from 'three';
import { EVENTS_TRACK, PORTAL_DWELL, PORTAL_SPLIT, SEGMENTS, eventsAt } from '@/config/timeline';
import { FLOOR_Y, MATRIX, PORTAL, UNDERGROUND } from '@/config/world';
import { introFrame } from '@/intro/state';
import { T } from '@/intro/timeline';
import { smoothstep } from '@/systems/camera/pose';
import { teamsFrame } from '@/teams/state';
import { useDisposable } from '@/systems/performance/useDisposable';
import { progress } from '@/systems/scroll/progress';

const Y = FLOOR_Y + 0.045;
const within = (segment: keyof typeof SEGMENTS, f: number) => SEGMENTS[segment].start + (SEGMENTS[segment].end - SEGMENTS[segment].start) * f;
const key = (p: number, x: number, y: number, z: number) => ({ p, at: new Vector3(x, y, z) });
/** The matrix's foot, where the thread waits. */
const FOOT_Z = MATRIX.face + 0.7;

export const SIGNAL_KEYS = [
  // From the hall's mouth (just beyond the lobby's door) across to the matrix's foot…
  key(SEGMENTS.events.start, 0, Y, UNDERGROUND.hall.north + 2),
  key(eventsAt('arrival', 0.55), 0, Y, (UNDERGROUND.hall.north + FOOT_Z) / 2),
  key(EVENTS_TRACK.arrival.end, 0, Y, FOOT_Z),
  // …waiting there while the matrix is the place, and while it begins to open…
  key(within('portal', PORTAL_SPLIT * 0.55), 0, Y, FOOT_Z - 0.01),
  // …then over the middle column, sunk flush into the floor, down the passage, and up into the foot of the ring.
  key(within('portal', PORTAL_SPLIT), 0, Y, MATRIX.back - 0.6),
  key(within('portal', PORTAL_DWELL), 0, Y, PORTAL.z + 0.9),
  key(SEGMENTS.portal.end, 0, PORTAL.y - PORTAL.radius - PORTAL.tube, PORTAL.z + 0.3),
];

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

const SIGNAL_BLUE = new Color('#83bbff');

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
    // During the opening it waits beyond the lobby's door until the door opens onto it.
    if (group.current) group.current.visible = !teamsFrame.inside && (!introFrame.active || introFrame.t > T.door);
    // The hold pulls the rest of the thread into the ring.
    const h = smoothstep(0.45, 1, teamsFrame.hold);
    const shown = t + (1 - t) * h;
    res.tube.setDrawRange(0, Math.floor(shown * 1200) * 24);
    res.material.opacity = .85;
    res.material.color.copy(SIGNAL_BLUE).multiplyScalar(1 + 2.2 * h);
    if (head.current) head.current.position.copy(res.curve.getPoint(Math.min(1, shown), point));
  });
  return (
    <group ref={group} name="connected-signal">
      <mesh geometry={res.track} material={res.trackMaterial} />
      <mesh geometry={res.tube} material={res.material} />
      <group ref={head}><mesh geometry={res.bead} material={res.beadMaterial} /></group>
    </group>
  );
}
