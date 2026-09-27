'use client';
/**
 * Chapter streaming. The world is too big to hold at once, so each chapter
 * mounts shortly before the camera can see it and unmounts (disposing its
 * geometry, materials and canvas textures) once it's behind the camera.
 * Mount/unmount decisions are debounced so scrubbing at a boundary doesn't
 * thrash the GPU.
 *
 * The opening (src/intro) and the Events corridor are both mounted while the
 * world loads, so everything the opening will show — the campus, the story's
 * artefacts, the name, the cloud, the shaft, the lobby and the corridor its
 * door opens into — is built and compiled behind the loader: nothing appears
 * or compiles after Enter. Within the opening, chunks the camera can't see
 * are hidden (not unmounted), so scrolling back never has to rebuild them.
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
/** Past the opening, its world stays a while (in case the visitor scrolls straight back). */
const INTRO_UNTIL = at('events', 0.1);

/** Before the visitor has entered (everything compiles behind the loader), or within reach of the opening. */
const inOpening = (p: number) => {
  const ph = experience().phase;
  return ph === 'loading' || ph === 'ready' || p <= INTRO_UNTIL;
};

function wanted(p: number): Record<ChunkId, boolean> {
  // Through the portal, the facility is somewhere else entirely. Leaving,
  // the corridor comes back before the crossing so it's there when you are.
  const s = teams().state;
  const inTeams = teamsFrame.inside;
  const exiting = s === 'portalExiting';
  const travelling = s === 'portalEntering' || exiting;
  const out = !inTeams;
  const opening = out && inOpening(p);
  return {
    intro: opening,
    campus: opening,
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
    // What the opening's camera can see: the campus until it is down in the
    // lobby, the corridor once the door begins to open onto it.
    const film = introFrame.active;
    const t = introFrame.t;
    if (campus.current) campus.current.visible = film && t < T.lobby;
    if (corridor.current) corridor.current.visible = !film || t > T.door - 0.5;

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
