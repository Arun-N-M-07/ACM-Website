'use client';
/**
 * The team workspace beyond the door: a tall concrete hall with the office
 * bearers' commons at the entrance, a bay per domain around the perimeter,
 * and the core at the centre. Everything is placed from content + layout; the
 * visitor walks it by scrolling, and each domain stages its own moment
 * (scenes/team/sets).
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import { Color, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from 'three';
import { DOOR, TEAM_HALL, TEAM_LAYOUT, TEAM_ORIGIN, UNDERGROUND } from '@/config/world';
import { FACULTY } from '@/content/team';
import { PALETTE } from '@/config/palette';
import { smoothstep } from '@/systems/camera/pose';
import { TOUR_STOPS } from '@/systems/camera/tour';
import { tour } from '@/systems/characters/cues';
import { merge, metricBox, place } from '@/systems/geometry/build';
import { useLightAnchors } from '@/systems/lighting/lightPool';
import { useDisposable } from '@/systems/performance/useDisposable';
import { fitSize, paragraph, text } from '@/systems/textures/typeset';
import { CoreRoom } from '../final/CoreRoom';
import { CanvasPanel } from '../shared/CanvasPanel';
import { ModelSlot } from '../shared/ModelSlot';
import { SafeBoundary } from '../shared/SafeBoundary';
import { useKit } from '../underground/kit';
import { MeetingDirector } from './MeetingDirector';
import { NPC } from './NPC';
import { PlayerHand } from './PlayerHand';
import { DomainSet, WelcomeScene } from './sets';
import { buildPlacements } from './teamLayout';

const HW = TEAM_HALL.halfWidth;
const D = TEAM_HALL.depth;
const H = TEAM_HALL.height;
const [OX, OY, OZ] = TEAM_ORIGIN;

function HallShell() {
  const kit = useKit();
  const geo = useDisposable(() => {
    const t = 0.5;
    const doorHalf = UNDERGROUND.corridor.halfWidth + 0.4;
    const coreZ = OZ + TEAM_HALL.core.z;
    const hole = 1.8;
    return {
      floor: place(metricBox(2 * HW, 0.2, D), { position: [OX, OY - 0.1, OZ - D / 2] }),
      walls: merge([
        place(metricBox(t, H, D), { position: [OX - HW - t / 2, OY + H / 2, OZ - D / 2] }),
        place(metricBox(t, H, D), { position: [OX + HW + t / 2, OY + H / 2, OZ - D / 2] }),
        place(metricBox(2 * HW + 2 * t, H, t), { position: [OX, OY + H / 2, OZ - D - t / 2] }),
        // Front wall either side of the door.
        place(metricBox(HW - doorHalf, H, t), { position: [OX - (HW + doorHalf) / 2, OY + H / 2, DOOR.z - 0.4] }),
        place(metricBox(HW - doorHalf, H, t), { position: [OX + (HW + doorHalf) / 2, OY + H / 2, DOOR.z - 0.4] }),
      ]),
      // Ceiling with a square opening over the core's light well.
      ceiling: merge([
        place(metricBox(2 * HW, 0.3, coreZ - hole - (OZ - D)), { position: [OX, OY + H + 0.15, (coreZ - hole + OZ - D) / 2] }),
        place(metricBox(2 * HW, 0.3, OZ - (coreZ + hole)), { position: [OX, OY + H + 0.15, (OZ + coreZ + hole) / 2] }),
        place(metricBox(HW - hole, 0.3, 2 * hole), { position: [OX - (HW + hole) / 2, OY + H + 0.15, coreZ] }),
        place(metricBox(HW - hole, 0.3, 2 * hole), { position: [OX + (HW + hole) / 2, OY + H + 0.15, coreZ] }),
      ]),
      lights: merge(
        [-HW * 0.45, 0, HW * 0.45].flatMap((x) =>
          [-6, -20, -48].map((z) => place(metricBox(0.14, 0.05, 9), { position: [OX + x, OY + H - 0.03, OZ + z] })),
        ),
      ),
      // Floor light strip from the commons to the core door; brightens when the core opens.
      guide: (() => {
        const z0 = TEAM_HALL.commons.z - 3.8;
        const z1 = TEAM_HALL.core.z + TEAM_HALL.core.radius + 0.3;
        return place(metricBox(0.12, 0.012, z0 - z1), { position: [OX, OY + 0.008, OZ + (z0 + z1) / 2] });
      })(),
      island: merge([
        place(metricBox(3.2, 0.06, 1), { position: [OX, OY + 1.02, OZ + TEAM_HALL.commons.z - 0.6] }),
        place(metricBox(2.8, 0.98, 0.6), { position: [OX, OY + 0.49, OZ + TEAM_HALL.commons.z - 0.6] }),
      ]),
    };
  }, []);
  const guideMat = useDisposable(() => new MeshBasicMaterial({ color: new Color(PALETTE.warm) }), []);
  const glow = useRef(0.12);
  useFrame((_, dt) => {
    // The floor line to the core wakes up as the tour heads there.
    const last = TOUR_STOPS.length - 1;
    const toward = tour.inTeam ? (tour.index === last ? 1 : tour.index === last - 1 ? smoothstep(0.5, 1, tour.meet) : 0) : 0;
    glow.current += (0.12 + 1.5 * toward - glow.current) * (1 - Math.exp(-dt * 2));
    guideMat.color.set(PALETTE.warm).multiplyScalar(glow.current);
  });

  return (
    <group name="team-shell">
      <mesh geometry={geo.floor} material={kit.floor} />
      <mesh geometry={geo.walls} material={kit.concrete} />
      <mesh geometry={geo.ceiling} material={kit.ceiling} />
      <mesh geometry={geo.lights} material={kit.lightCool} />
      <mesh geometry={geo.guide} material={guideMat} />
      <mesh geometry={geo.island} material={kit.oak} />
    </group>
  );
}

/** Freestanding panel behind the commons: who the chapter is, and who founded it. */
function CommonsPanel() {
  const founder = FACULTY.find((f) => f.role === 'Founder');
  const heads = FACULTY.filter((f) => f.role !== 'Founder');
  return (
    <CanvasPanel
      width={5.4}
      height={2.8}
      pxPerMeter={200}
      position={[OX, OY + 2.3, OZ + TEAM_HALL.commons.z - 3.4]}
      drawKey="commons-panel"
      shading="glow"
      glowStrength={0.92}
      draw={(ctx, w, h) => {
        ctx.fillStyle = '#0f1012';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = PALETTE.cegRed;
        ctx.fillRect(0, 0, w, h * 0.012);
        text(ctx, 'THE CHAPTER · OFFICE BEARERS', w * 0.06, h * 0.13, { family: 'mono', size: h * 0.038, color: 'rgba(239,233,223,0.58)', tracking: 0.22 });
        const s = fitSize(ctx, 'Welcome to ACM-CEG.', w * 0.88, { family: 'serif', size: h * 0.2 }, h * 0.2);
        text(ctx, 'Welcome to ACM-CEG.', w * 0.06, h * 0.36, { family: 'serif', italic: true, size: s, color: PALETTE.bone });
        if (founder) {
          text(ctx, 'FOUNDED BY', w * 0.06, h * 0.55, { family: 'mono', size: h * 0.032, color: 'rgba(239,233,223,0.58)', tracking: 0.2 });
          text(ctx, founder.name, w * 0.06, h * 0.64, { family: 'sans', weight: 600, size: h * 0.06, color: PALETTE.bone });
        }
        text(ctx, 'FACULTY HEADS', w * 0.06, h * 0.78, { family: 'mono', size: h * 0.032, color: 'rgba(239,233,223,0.58)', tracking: 0.2 });
        paragraph(ctx, heads.map((f) => f.name).join('  ·  '), w * 0.06, h * 0.87, w * 0.9, h * 0.07, { family: 'sans', weight: 600, size: h * 0.05, color: PALETTE.bone }, 2);
      }}
    />
  );
}

/** Fixture positions for the pooled lights (the lights themselves live in WorldLights). */
function TeamLightAnchors() {
  const anchors = useMemo(
    () => [
      { position: new Vector3(OX, OY + 4, OZ + TEAM_HALL.commons.z - 1), color: new Color('#ffd9ae'), intensity: 70, distance: 14 },
      { position: new Vector3(OX, OY + 6, OZ - 20), color: new Color('#e3ebff'), intensity: 40, distance: 16 },
      { position: new Vector3(OX, OY + 6, OZ - 50), color: new Color('#e3ebff'), intensity: 40, distance: 16 },
    ],
    [],
  );
  useLightAnchors(anchors);
  return null;
}

/**
 * Mount a long list a little at a time (one item every `every` frames), so the
 * hall streams in behind the closed door instead of stalling a frame.
 */
function useStaged(total: number, every = 2) {
  const [n, setN] = useState(0);
  const frame = useRef(0);
  useFrame(() => {
    if (n >= total) return;
    frame.current++;
    if (frame.current % every === 0) setN((x) => Math.min(total, x + 1));
  });
  return n;
}

export function TeamWorkspace() {
  const placements = useMemo(buildPlacements, []);
  const avatarMaterial = useDisposable(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0 }), []);
  const bays = useMemo(
    () =>
      TEAM_LAYOUT.bays.map((bay) => ({
        bay,
        stop: TOUR_STOPS.findIndex((s) => s.id === bay.domain.id),
        members: placements.filter((p) => p.bay === bay),
      })),
    [placements],
  );
  const office = useMemo(() => placements.filter((p) => p.domain === 'office'), [placements]);
  const staged = useStaged(bays.length + 1);
  const mountedBays = bays.slice(0, Math.max(0, staged - 1));
  const people = useMemo(() => new Set(mountedBays.flatMap((b) => b.members.map((m) => m.member.id))), [mountedBays]);
  return (
    <group name="team-workspace">
      <ModelSlot id="teamWorkspace">
        <HallShell />
      </ModelSlot>
      <TeamLightAnchors />
      <CommonsPanel />
      {/* Sets write this frame's choreography before the people read it. */}
      <WelcomeScene members={office} />
      {mountedBays.map(({ bay, stop, members }) => (
        <SafeBoundary key={bay.domain.id} name={`set:${bay.domain.id}`} fallback={null}>
          <DomainSet bay={bay} stop={stop} members={members} />
        </SafeBoundary>
      ))}
      <MeetingDirector />
      {placements
        .filter((p) => p.domain === 'office' || people.has(p.member.id))
        .map((p) => (
          <NPC key={p.member.id} placement={p} material={avatarMaterial} />
        ))}
      <ModelSlot id="core">
        <CoreRoom />
      </ModelSlot>
      <PlayerHand />
    </group>
  );
}
