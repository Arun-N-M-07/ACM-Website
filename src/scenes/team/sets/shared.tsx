'use client';
/**
 * Shared pieces for the domain sets: the bay architecture (rug, low glass
 * partitions, pendant, signage naming the directors), a per-stop timing hook
 * for choreography, and a helper for objects that fly up to the visitor's eyes.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type ReactNode } from 'react';
import { Color, type Group, MeshStandardMaterial, Vector3 } from 'three';
import { PALETTE } from '@/config/palette';
import { TEAM_ORIGIN, type BayLayout } from '@/config/world';
import { membersOf } from '@/content/team';
import { blankCue, type Cue, cues, tour } from '@/systems/characters/cues';
import { merge, metricBox, place } from '@/systems/geometry/build';
import { useLightAnchor } from '@/systems/lighting/lightPool';
import { useDisposable } from '@/systems/performance/useDisposable';
import { fitSize, text } from '@/systems/textures/typeset';
import { CanvasPanel } from '../../shared/CanvasPanel';
import { useKit } from '../../underground/kit';
import { bayToHall, bayToWorld, type MemberPlacement } from '../teamLayout';

export const BONE = PALETTE.bone;
export const DIM = 'rgba(239,233,223,0.58)';

export interface SetProps {
  bay: BayLayout;
  /** Tour stop index of this bay. */
  stop: number;
  members: MemberPlacement[];
}

/** Timing for this stop, refreshed every frame from the tour. */
export interface StopClock {
  /** The visitor is at (or walking into) this stop. */
  here: boolean;
  /** 0..1 walking in. */
  walk: number;
  /** 0..1 through the meeting. */
  meet: number;
  /** Within one stop either side — animate screens, etc. */
  near: boolean;
}

export function useStopClock(stop: number) {
  const clock = useRef<StopClock>({ here: false, walk: 0, meet: 0, near: false });
  useFrame(() => {
    const c = clock.current;
    c.here = tour.inTeam && tour.index === stop;
    c.near = tour.inTeam && Math.abs(tour.index - stop) <= 1;
    c.walk = c.here ? tour.walk : tour.index > stop ? 1 : 0;
    c.meet = c.here ? tour.meet : tour.index > stop ? 1 : 0;
  });
  return clock;
}

/** Get this frame's cue for a member (reset to neutral). */
export function cue(id: string): Cue {
  let c = cues.get(id);
  if (!c) {
    c = blankCue();
    cues.set(id, c);
  } else Object.assign(c, blankCue());
  return c;
}

export function releaseCues(members: MemberPlacement[]) {
  for (const m of members) cues.delete(m.member.id);
}

/** Bay-local → world helpers bound to a bay. */
export function useBayFrame(bay: BayLayout) {
  return useMemo(
    () => ({
      world: (x: number, z: number, y = 0) => new Vector3(...bayToWorld(bay, x, z, y)),
      hall: (x: number, z: number) => bayToHall(bay, x, z),
    }),
    [bay],
  );
}

function Signage({ bay }: { bay: BayLayout }) {
  const members = membersOf(bay.domain.id);
  return (
    <CanvasPanel
      width={bay.width - 1}
      height={1.5}
      pxPerMeter={200}
      position={[0, 5.05, -bay.depth / 2 + 0.05]}
      shading="glow"
      glowStrength={0.92}
      transparent
      drawKey={`sign-${bay.domain.id}-${members.map((m) => m.id).join()}`}
      draw={(ctx, w, h) => {
        ctx.fillStyle = bay.domain.accent;
        ctx.fillRect(0, h * 0.06, h * 0.05, h * 0.62);
        const size = fitSize(ctx, bay.domain.signage, w * 0.62, { family: 'sans', weight: 700, size: h, stretch: 'expanded', tracking: 0.08 }, h * 0.5);
        text(ctx, bay.domain.signage, h * 0.14, h * 0.52, { family: 'sans', weight: 700, size, color: BONE, stretch: 'expanded', tracking: 0.08 });
        text(ctx, bay.domain.tagline, h * 0.15, h * 0.74, { family: 'serif', italic: true, size: h * 0.15, color: DIM });
        text(ctx, members.map((m) => m.name.toUpperCase()).join('  ·  '), h * 0.15, h * 0.94, { family: 'mono', size: h * 0.085, color: 'rgba(239,233,223,0.72)', tracking: 0.12 });
      }}
    />
  );
}

export function BayShell({ bay, children, lightGain }: { bay: BayLayout; children?: ReactNode; /** Dim the bay's light (house lights down). */ lightGain?: { current: number } }) {
  const kit = useKit();
  const rugMat = useDisposable(() => new MeshStandardMaterial({ color: new Color(bay.domain.accent).multiplyScalar(0.26), roughness: 1 }), [bay.domain.accent]);
  const accentLine = useDisposable(() => new MeshStandardMaterial({ color: bay.domain.accent, emissive: new Color(bay.domain.accent), emissiveIntensity: 1.2 }), [bay.domain.accent]);
  const geo = useDisposable(() => {
    const W = bay.width;
    const D = bay.depth;
    return {
      rug: place(metricBox(W - 1.2, 0.012, D - 2.2), { position: [0, 0.006, -0.9] }),
      glass: merge([place(metricBox(0.03, 1.05, 6), { position: [-W / 2, 0.6, -D / 2 + 3] }), place(metricBox(0.03, 1.05, 6), { position: [W / 2, 0.6, -D / 2 + 3] })]),
      rails: merge([
        place(metricBox(0.06, 0.05, 6), { position: [-W / 2, 1.14, -D / 2 + 3] }),
        place(metricBox(0.06, 0.05, 6), { position: [W / 2, 1.14, -D / 2 + 3] }),
        place(metricBox(0.02, 3.8, 0.02), { position: [-1.4, 5.7, -1.5] }),
        place(metricBox(0.02, 3.8, 0.02), { position: [1.4, 5.7, -1.5] }),
      ]),
      pendant: place(metricBox(3, 0.06, 0.45), { position: [0, 3.8, -1.5] }),
      inlay: place(metricBox(W - 1, 0.012, 0.05), { position: [0, 0.007, D / 2 - 0.9] }),
    };
  }, [bay.width, bay.depth]);
  const anchorPos = useMemo(() => bayToWorld(bay, 0, -1.5, 3.4), [bay]);
  const anchor = useLightAnchor(anchorPos, '#ffd7a8', 60, 13);
  useFrame(() => {
    if (lightGain) anchor.gain = lightGain.current;
  });
  return (
    <>
      <mesh geometry={geo.rug} material={rugMat} />
      <mesh geometry={geo.glass} material={kit.glass} renderOrder={3} />
      <mesh geometry={geo.rails} material={kit.steel} />
      <mesh geometry={geo.pendant} material={kit.lightWarm} />
      <mesh geometry={geo.inlay} material={accentLine} />
      <Signage bay={bay} />
      {children}
    </>
  );
}

/** Positions a group relative to the camera every frame (props handed to the visitor). */
export function CameraSpace({ children, visible }: { children: ReactNode; visible: { current: boolean } }) {
  const g = useRef<Group>(null);
  useFrame(({ camera }) => {
    const el = g.current;
    if (!el) return;
    el.visible = visible.current;
    if (!el.visible) return;
    el.position.copy(camera.position);
    el.quaternion.copy(camera.quaternion);
  });
  return <group ref={g}>{children}</group>;
}

/** Bay group transform. */
export function BayGroup({ bay, children }: { bay: BayLayout; children: ReactNode }) {
  return (
    <group position={[TEAM_ORIGIN[0] + bay.x, TEAM_ORIGIN[1], TEAM_ORIGIN[2] + bay.z]} rotation={[0, bay.rotationY, 0]} name={`bay-${bay.domain.id}`}>
      {children}
    </group>
  );
}
