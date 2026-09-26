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
import { SafeBoundary } from '@/scenes/shared/SafeBoundary';
import { SignalThread } from '@/scenes/shared/SignalThread';
import { DescentShaft } from '@/scenes/underground/DescentShaft';
import { FacilityHall } from '@/scenes/underground/FacilityHall';
import { UndergroundKit } from '@/scenes/underground/kit';
import { experience } from '@/store/experience';
import { fx } from '@/systems/camera/effects';
import { progress } from '@/systems/scroll/progress';
import { teams, teamsFrame } from '@/teams/state';
import { TeamsWorld } from '@/teams/world/TeamsWorld';

type ChunkId = 'campus' | 'shaft' | 'hall' | 'corridor' | 'teams' | 'underground';

const at = (seg: SegmentId, t: number) => SEGMENTS[seg].start + (SEGMENTS[seg].end - SEGMENTS[seg].start) * t;

/** Progress windows in which each chunk should exist. */
const WINDOWS: Record<Exclude<ChunkId, 'teams' | 'underground'>, [number, number]> = {
  campus: [0, at('descent', 0.7)],
  shaft: [at('topdown', 0), at('facility', 0.3)],
  hall: [at('descent', 0.3), at('events', 0.3)],
  corridor: [at('descent', 0.72), SEGMENTS.portal.end],
};

/** The Teams world mounts (and compiles) while you walk down the vestibule. */
const TEAMS_FROM = at('portal', 0.25);

function wanted(p: number): Record<ChunkId, boolean> {
  // Through the portal, the facility is somewhere else entirely. Leaving,
  // the corridor comes back before the crossing so it's there when you are.
  const s = teams().state;
  const inTeams = teamsFrame.inside;
  const exiting = s === 'portalExiting';
  const travelling = s === 'portalEntering' || exiting;
  const within = (w: [number, number]) => p >= w[0] && p <= w[1];
  const out = !inTeams;
  return {
    campus: out && within(WINDOWS.campus),
    shaft: out && within(WINDOWS.shaft),
    hall: out && within(WINDOWS.hall),
    corridor: (out && within(WINDOWS.corridor)) || exiting,
    teams: inTeams || travelling || (experience().phase !== 'loading' && p >= TEAMS_FROM),
    underground: (out && p >= at('topdown', 0)) || exiting,
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
        </UndergroundKit>
      )}
      {mounted.teams && (
        <SafeBoundary name="teams" fallback={null}>
          <TeamsWorld />
        </SafeBoundary>
      )}
    </>
  );
}
