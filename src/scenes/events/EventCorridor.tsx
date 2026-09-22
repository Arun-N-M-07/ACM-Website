'use client';
/**
 * The events corridor: a long concrete spine running north under the red
 * building, with event rooms alternating left and right, the two flagships
 * facing each other in a taller transept, and a tall vestibule ending at the
 * door to the team.
 *
 * Rooms stream: only those within `roomWindow` of the camera's current station
 * are mounted (their canvases and geometry are disposed when they leave).
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useState } from 'react';
import { Color, type BufferGeometry, Vector3 } from 'three';
import { QUALITY } from '@/config/quality';
import { CORRIDOR, DOOR, FLOOR_Y, UNDERGROUND } from '@/config/world';
import { useExperience } from '@/store/experience';
import { eventStationAt } from '@/systems/camera/shots';
import { merge, metricBox, place } from '@/systems/geometry/build';
import { useLightAnchors } from '@/systems/lighting/lightPool';
import { useDisposable } from '@/systems/performance/useDisposable';
import { progress } from '@/systems/scroll/progress';
import { SEGMENTS } from '@/config/timeline';
import { text } from '@/systems/textures/typeset';
import { CanvasPanel } from '../shared/CanvasPanel';
import { ModelSlot } from '../shared/ModelSlot';
import { useKit } from '../underground/kit';
import { EventRoom } from './EventRoom';
import { FinalDoor } from './FinalDoor';

const hw = UNDERGROUND.corridor.halfWidth;
const LOW = UNDERGROUND.corridor.height;
const rooms = CORRIDOR.rooms;
const flagships = rooms.filter((r) => r.event.flagship);
const TRANSEPT = flagships.length
  ? {
      z0: Math.max(...flagships.map((r) => r.z + r.length / 2)) + 1,
      z1: Math.min(...flagships.map((r) => r.z - r.length / 2)) - 1,
      height: Math.max(...flagships.map((r) => r.height)),
    }
  : null;
export const VESTIBULE = { z0: TRANSEPT ? TRANSEPT.z1 : DOOR.z + 12, z1: DOOR.z, height: 9 };
const WALL_H = VESTIBULE.height;

function CorridorShell() {
  const kit = useKit();
  const geo = useDisposable(() => {
    const start = CORRIDOR.start;
    const end = DOOR.z;
    const len = start - end;
    const t = 0.4;

    // Side walls: fill the corridor length minus each room's opening.
    const walls: BufferGeometry[] = [];
    for (const side of [-1, 1] as const) {
      const openings = rooms
        .filter((r) => r.side === side)
        .map((r) => [r.z - r.length / 2 - t, r.z + r.length / 2 + t] as const)
        .sort((a, b) => b[1] - a[1]);
      let cursor: number = start;
      for (const [o0, o1] of openings) {
        if (cursor - o1 > 0.01) walls.push(place(metricBox(t, WALL_H, cursor - o1), { position: [side * (hw + t / 2), FLOOR_Y + WALL_H / 2, (cursor + o1) / 2] }));
        cursor = Math.min(cursor, o0);
      }
      if (cursor - end > 0.01) walls.push(place(metricBox(t, WALL_H, cursor - end), { position: [side * (hw + t / 2), FLOOR_Y + WALL_H / 2, (cursor + end) / 2] }));
    }

    // Ceiling: low corridor → raised transept → tall vestibule.
    const ceilings: BufferGeometry[] = [];
    const lights: BufferGeometry[] = [];
    const beams: BufferGeometry[] = [];
    const span = (z0: number, z1: number, h: number) => {
      ceilings.push(place(metricBox(2 * hw + 2 * t, 0.3, z0 - z1), { position: [0, FLOOR_Y + h + 0.15, (z0 + z1) / 2] }));
      lights.push(place(metricBox(0.12, 0.04, z0 - z1 - 1), { position: [0, FLOOR_Y + h - 0.02, (z0 + z1) / 2] }));
      for (let z = z0 - 1.6; z > z1 + 0.5; z -= 3.25) beams.push(place(metricBox(2 * hw, 0.22, 0.1), { position: [0, FLOOR_Y + h - 0.11, z] }));
    };
    const bulkhead = (z: number, h0: number, h1: number) => ceilings.push(place(metricBox(2 * hw + 2 * t, h1 - h0, 0.3), { position: [0, FLOOR_Y + (h0 + h1) / 2, z] }));
    if (TRANSEPT) {
      span(start, TRANSEPT.z0, LOW);
      bulkhead(TRANSEPT.z0, LOW, TRANSEPT.height);
      span(TRANSEPT.z0, TRANSEPT.z1, TRANSEPT.height);
      bulkhead(TRANSEPT.z1, TRANSEPT.height, VESTIBULE.height);
    } else {
      span(start, VESTIBULE.z0, LOW);
      bulkhead(VESTIBULE.z0, LOW, VESTIBULE.height);
    }
    span(VESTIBULE.z0, VESTIBULE.z1, VESTIBULE.height);

    const floor = place(metricBox(2 * hw, 0.2, len), { position: [0, FLOOR_Y - 0.1, (start + end) / 2] });
    const blueEnd = TRANSEPT ? TRANSEPT.z0 : VESTIBULE.z0;
    const inlayBlue = place(metricBox(0.06, 0.012, start - blueEnd), { position: [0, FLOOR_Y + 0.006, (start + blueEnd) / 2] });
    const inlayRed = place(metricBox(0.06, 0.012, blueEnd - end - 0.6), { position: [0, FLOOR_Y + 0.006, (blueEnd + end + 0.6) / 2] });
    return { walls: merge(walls), ceilings: merge(ceilings), lights: merge(lights), beams: merge(beams), floor, inlayBlue, inlayRed };
  }, []);

  const anchors = useMemo(() => {
    const list: { position: Vector3; color: Color; intensity: number; distance: number }[] = [];
    for (let z = CORRIDOR.start - 2; z > DOOR.z + 2; z -= 6.5) {
      const inVestibule = z < VESTIBULE.z0;
      list.push({ position: new Vector3(0, FLOOR_Y + (inVestibule ? 7.5 : LOW - 0.6), z), color: new Color('#dce6ff'), intensity: inVestibule ? 60 : 26, distance: inVestibule ? 16 : 10 });
    }
    return list;
  }, []);
  useLightAnchors(anchors);

  return (
    <group name="corridor-shell">
      <mesh geometry={geo.floor} material={kit.floor} />
      <mesh geometry={geo.walls} material={kit.concrete} />
      <mesh geometry={geo.ceilings} material={kit.ceiling} />
      <mesh geometry={geo.beams} material={kit.steel} />
      <mesh geometry={geo.lights} material={kit.lightCool} />
      <mesh geometry={geo.inlayBlue} material={kit.acmLine} />
      <mesh geometry={geo.inlayRed} material={kit.redLine} />
    </group>
  );
}

/** Wall sign beside each room opening, facing the approaching visitor. */
function RoomSign({ index }: { index: number }) {
  const r = rooms[index];
  const z = r.z + r.length / 2 + 0.95;
  const x = r.side * (hw - 0.02);
  return (
    <CanvasPanel
      width={0.9}
      height={1.3}
      pxPerMeter={280}
      position={[x, FLOOR_Y + 1.75, z]}
      rotation={[0, r.side === -1 ? Math.PI / 2 : -Math.PI / 2, 0]}
      shading="glow"
      glowStrength={0.9}
      transparent
      drawKey={`sign-${r.event.slug}`}
      draw={(ctx, w, h) => {
        ctx.fillStyle = r.event.accent;
        ctx.fillRect(0, 0, w * 0.06, h);
        text(ctx, String(index + 1).padStart(2, '0'), w * 0.16, h * 0.34, { family: 'mono', size: h * 0.24, color: '#efe9df' });
        text(ctx, r.event.title.toUpperCase(), w * 0.16, h * 0.56, { family: 'mono', size: h * 0.075, color: '#efe9df', tracking: 0.12 });
        text(ctx, r.event.kind.toUpperCase(), w * 0.16, h * 0.68, { family: 'mono', size: h * 0.06, color: 'rgba(239,233,223,0.55)', tracking: 0.14 });
        text(ctx, r.side === -1 ? '←' : '→', w * 0.16, h * 0.9, { family: 'mono', size: h * 0.12, color: r.event.accent });
      }}
    />
  );
}

export function EventCorridor() {
  const quality = useExperience((s) => s.quality);
  const activeRoom = useExperience((s) => s.activeRoom);
  const win = QUALITY[quality].roomWindow;
  const [focus, setFocus] = useState(0);

  useFrame(() => {
    const p = progress.value;
    let f: number;
    if (p < SEGMENTS.events.start) f = 0;
    else if (p > SEGMENTS.events.end) f = rooms.length - 1;
    else f = Math.max(0, eventStationAt(p).index);
    if (f !== focus) setFocus(f);
  });

  return (
    <group name="events-corridor">
      <ModelSlot id="corridor">
        <CorridorShell />
      </ModelSlot>
      {rooms.map((r, i) => (
        <RoomSign key={`sign-${r.event.slug}`} index={i} />
      ))}
      {rooms.map((r, i) =>
        Math.abs(i - focus) <= win || (r.event.flagship && focus >= rooms.length - 3) ? (
          <EventRoom key={r.event.slug} layout={r} total={rooms.length} active={activeRoom === i} />
        ) : null,
      )}
      <FinalDoor />
    </group>
  );
}
