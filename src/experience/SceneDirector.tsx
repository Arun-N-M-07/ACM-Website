'use client';
/**
 * Chapter residency. The chunks of the world — the campus, the opening, the
 * underground (the shaft, the lobby, the Events corridor) and the Teams
 * world — are built and compiled once, behind the loader and the threshold,
 * and then stay: nothing is built, drawn to a canvas or compiled while the
 * visitor scrolls.
 *
 * (The journey is a loop — past its last card it comes round, through the
 * mist, to the opening's first frame, and back again the other way — so there
 * is no "behind the camera" to unmount: from any point, either end of the
 * world is one short scroll away, and rebuilding either there — the opening's
 * papers alone are seconds of canvas work — stalled the journey at the very
 * moment it should be seamless.)
 *
 * What the camera can't see is hidden, not unmounted: the campus once the
 * opening is down in the lobby; the facility while the camera is in the
 * Teams world; the Teams world while it is outside it (TeamsWorld). Mount
 * decisions are still debounced, and a jump mounts straight away.
 */
import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import type { Group } from 'three';
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
import { teamsFrame } from '@/teams/state';
import { TeamsWorld } from '@/teams/world/TeamsWorld';

type ChunkId = 'intro' | 'campus' | 'corridor' | 'teams' | 'underground';

/**
 * Everything is resident once built: the facility from the loader on, the Teams world from the
 * threshold on (compiled while the visitor is at "Enter", so the loader isn't longer for it).
 */
function wanted(): Record<ChunkId, boolean> {
  const building = experience().phase === 'loading';
  return { intro: true, campus: true, corridor: true, underground: true, teams: !building };
}

const DEBOUNCE = 0.25;

export function SceneDirector() {
  const [mounted, setMounted] = useState<Record<ChunkId, boolean>>(() => wanted());
  const pending = useRef<Partial<Record<ChunkId, number>>>({});
  const campus = useRef<Group>(null);
  const corridor = useRef<Group>(null);
  const facility = useRef<Group>(null);

  useFrame((_, dt) => {
    // What the opening's camera can see: the campus until it goes down the
    // shaft (from half a beat before T.shaft the campus, sky and all, adds not
    // one pixel to the frame — checked frame against frame), the corridor once
    // the door begins to open onto it.
    const film = introFrame.active;
    const t = introFrame.t;
    const inside = teamsFrame.inside;
    if (campus.current) campus.current.visible = film && t < T.shaft;
    if (corridor.current) corridor.current.visible = !film || t > T.door - 0.5;
    // The facility is somewhere else entirely while the camera is in the Teams world.
    if (facility.current) facility.current.visible = !inside;

    const want = wanted();
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
        <group ref={facility}>
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
        </group>
      )}
      {mounted.teams && (
        <SafeBoundary name="teams" fallback={null}>
          <TeamsWorld />
        </SafeBoundary>
      )}
    </>
  );
}
