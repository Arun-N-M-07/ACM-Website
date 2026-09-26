'use client';
/**
 * Chapter streaming. The world is too big to hold at once, so each chapter
 * mounts shortly before the camera can see it and unmounts (disposing its
 * geometry, materials and canvas textures) once it's behind the camera.
 * Mount/unmount decisions are debounced so scrubbing at a boundary doesn't
 * thrash the GPU.
 *
 * The opening cinematic (src/intro) and the Events corridor are both mounted
 * while the world loads, so everything the film will show — the campus, the
 * story's artefacts, the cloud, the tunnel and the corridor it opens into — is
 * built and compiled behind the loader: nothing appears or compiles after
 * Enter. During the film, chunks the camera can't see are hidden (not
 * unmounted) so rewinding never has to rebuild them.
 */
import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import type { Group } from 'three';
import { SEGMENTS, type SegmentId } from '@/config/timeline';
import { introFrame } from '@/intro/state';
import { T } from '@/intro/timeline';
import { IntroWorld } from '@/intro/world/IntroWorld';
import { CampusScene } from '@/scenes/campus/CampusScene';
import { EventCorridor } from '@/scenes/events/EventCorridor';
import { SafeBoundary } from '@/scenes/shared/SafeBoundary';
import { SignalThread } from '@/scenes/shared/SignalThread';
import { UndergroundKit } from '@/scenes/underground/kit';
import { experience } from '@/store/experience';
import { fx } from '@/systems/camera/effects';
import { progress } from '@/systems/scroll/progress';
import { teams, teamsFrame } from '@/teams/state';
import { TeamsWorld } from '@/teams/world/TeamsWorld';

type ChunkId = 'intro' | 'campus' | 'corridor' | 'teams' | 'underground';

const at = (seg: SegmentId, t: number) => SEGMENTS[seg].start + (SEGMENTS[seg].end - SEGMENTS[seg].start) * t;

/** The Teams world mounts (and compiles) while you walk down the vestibule. */
const TEAMS_FROM = at('portal', 0.25);
/** After the handoff, the film's world stays a moment (in case the visitor turns straight back). */
const INTRO_UNTIL = at('events', 0.04);

/** Before the visitor has entered, or while the film runs (or is being rewound into). */
const inFilm = () => {
  const ph = experience().phase;
  return ph === 'loading' || ph === 'ready' || ph === 'intro' || introFrame.active;
};

function wanted(p: number): Record<ChunkId, boolean> {
  // Through the portal, the facility is somewhere else entirely. Leaving,
  // the corridor comes back before the crossing so it's there when you are.
  const s = teams().state;
  const inTeams = teamsFrame.inside;
  const exiting = s === 'portalExiting';
  const travelling = s === 'portalEntering' || exiting;
  const film = inFilm();
  const out = !inTeams;
  return {
    intro: film || (out && p <= INTRO_UNTIL),
    campus: film,
    corridor: (out && p <= SEGMENTS.portal.end) || exiting,
    teams: inTeams || travelling || (experience().phase !== 'loading' && p >= TEAMS_FROM),
    underground: out || exiting,
  };
}

const DEBOUNCE = 0.25;

export function SceneDirector() {
  const [mounted, setMounted] = useState<Record<ChunkId, boolean>>(() => wanted(progress.value));
  const pending = useRef<Partial<Record<ChunkId, number>>>({});
  const campus = useRef<Group>(null);
  const corridor = useRef<Group>(null);

  useFrame((_, dt) => {
    // What the film's camera can see: the campus until the cloud has swallowed
    // it, the corridor once the tunnel opens towards it.
    const film = introFrame.active;
    const t = introFrame.t;
    if (campus.current) campus.current.visible = !film || t < T.cloudDeep + 0.4;
    if (corridor.current) corridor.current.visible = !film || t > T.tunnel - 0.6;

    const want = wanted(progress.value);
    let changed = false;
    const next = { ...mounted };
    for (const k of Object.keys(want) as ChunkId[]) {
      if (want[k] === mounted[k]) {
        delete pending.current[k];
        continue;
      }
      // Mount immediately when needed by a jump; otherwise debounce.
      const w = (pending.current[k] ?? 0) + dt;
      pending.current[k] = w;
      // Jumps cut behind a fade, so mount straight away while it's dark.
      if (w >= DEBOUNCE || (want[k] && (fx.fade > 0.3 || Math.abs(progress.target - progress.value) > 0.05))) {
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
          <group ref={campus}>
            <CampusScene />
          </group>
        </SafeBoundary>
      )}
      {mounted.underground && (
        <UndergroundKit>
          {mounted.intro && (
            <SafeBoundary name="intro" fallback={null}>
              <IntroWorld />
            </SafeBoundary>
          )}
          <SignalThread />
          {mounted.corridor && (
            <SafeBoundary name="corridor" fallback={null}>
              <group ref={corridor}>
                <EventCorridor />
              </group>
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
