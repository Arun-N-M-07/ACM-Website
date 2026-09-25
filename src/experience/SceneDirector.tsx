'use client';
/**
 * Chapter streaming. The world is too big to hold at once, so each chapter
 * mounts shortly before the camera can see it and unmounts (disposing its
 * geometry, materials and canvas textures) once it's behind the camera.
 * Mount/unmount decisions are debounced so scrubbing at a boundary doesn't
 * thrash the GPU.
 */
import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import { SEGMENTS, type SegmentId } from '@/config/timeline';
import { CampusScene } from '@/scenes/campus/CampusScene';
import { EventCorridor } from '@/scenes/events/EventCorridor';
import { FinalDoor } from '@/scenes/events/FinalDoor';
import { SafeBoundary } from '@/scenes/shared/SafeBoundary';
import { SignalThread } from '@/scenes/shared/SignalThread';
import { TeamWorkspace } from '@/scenes/team/TeamWorkspace';
import { DescentShaft } from '@/scenes/underground/DescentShaft';
import { FacilityHall } from '@/scenes/underground/FacilityHall';
import { UndergroundKit } from '@/scenes/underground/kit';
import { experience } from '@/store/experience';
import { fx } from '@/systems/camera/effects';
import { progress } from '@/systems/scroll/progress';

type ChunkId = 'campus' | 'shaft' | 'hall' | 'corridor' | 'team' | 'underground';

const at = (seg: SegmentId, t: number) => SEGMENTS[seg].start + (SEGMENTS[seg].end - SEGMENTS[seg].start) * t;

/** Progress windows in which each chunk should exist. */
const WINDOWS: Record<Exclude<ChunkId, 'team' | 'underground'>, [number, number]> = {
  campus: [0, at('descent', 0.7)],
  shaft: [at('topdown', 0), at('facility', 0.3)],
  hall: [at('descent', 0.3), at('events', 0.3)],
  corridor: [at('descent', 0.72), SEGMENTS.team.start + 0.002],
};

function wanted(p: number): Record<ChunkId, boolean> {
  // Past the door (or being pushed through it) the corridor is behind you.
  const inTeam = experience().phase === 'impact' || p >= SEGMENTS.team.start + 0.001;
  const inside = (w: [number, number]) => p >= w[0] && p <= w[1];
  return {
    campus: !inTeam && inside(WINDOWS.campus),
    shaft: !inTeam && inside(WINDOWS.shaft),
    hall: !inTeam && inside(WINDOWS.hall),
    corridor: !inTeam && inside(WINDOWS.corridor),
    team: inTeam || p >= at('door', 0),
    underground: inTeam || p >= at('topdown', 0),
  };
}

const DEBOUNCE = 0.25;

export function SceneDirector() {
  const [mounted, setMounted] = useState<Record<ChunkId, boolean>>(() => wanted(progress.value));
  const pending = useRef<Partial<Record<ChunkId, number>>>({});

  useFrame((_, dt) => {
    const want = wanted(progress.value);
    let changed = false;
    const next = { ...mounted };
    for (const k of Object.keys(want) as ChunkId[]) {
      if (want[k] === mounted[k]) {
        delete pending.current[k];
        continue;
      }
      // Mount immediately when needed by a jump; otherwise debounce.
      const t = (pending.current[k] ?? 0) + dt;
      pending.current[k] = t;
      // Jumps cut behind a fade, so mount straight away while it's dark.
      if (t >= DEBOUNCE || (want[k] && (fx.fade > 0.3 || Math.abs(progress.target - progress.value) > 0.05))) {
        next[k] = want[k];
        delete pending.current[k];
        changed = true;
      }
    }
    if (changed) setMounted(next);
  });

  const inTeam = !mounted.corridor && mounted.team;
  return (
    <>
      {mounted.campus && (
        <SafeBoundary name="campus" fallback={null}>
          <CampusScene />
        </SafeBoundary>
      )}
      {mounted.underground && (
        <UndergroundKit>
          <SignalThread />
          {mounted.shaft && (
            <SafeBoundary name="shaft" fallback={null}>
              <DescentShaft />
            </SafeBoundary>
          )}
          {mounted.hall && (
            <SafeBoundary name="hall" fallback={null}>
              <FacilityHall />
            </SafeBoundary>
          )}
          {mounted.corridor && (
            <SafeBoundary name="corridor" fallback={null}>
              <EventCorridor />
            </SafeBoundary>
          )}
          {inTeam && <FinalDoor />}
          {mounted.team && (
            <SafeBoundary name="team" fallback={null}>
              <TeamWorkspace />
            </SafeBoundary>
          )}
        </UndergroundKit>
      )}
    </>
  );
}
