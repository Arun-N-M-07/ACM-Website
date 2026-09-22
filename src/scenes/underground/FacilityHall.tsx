'use client';
/**
 * The facility hall at the foot of the light-well: the departures board of
 * every programme on the west wall, the founding-year monument on the east,
 * and the mouth of the events corridor to the north.
 */
import { useMemo } from 'react';
import { EVENTS, FLAGSHIPS } from '@/content/events';
import { CAMPUS, FLOOR_Y, hallZ, UNDERGROUND } from '@/config/world';
import { merge, metricBox, place } from '@/systems/geometry/build';
import { useLightAnchors } from '@/systems/lighting/lightPool';
import { useDisposable } from '@/systems/performance/useDisposable';
import { Color, Vector3 } from 'three';
import { CanvasPanel } from '../shared/CanvasPanel';
import { ModelSlot } from '../shared/ModelSlot';
import { DeparturesBoard } from './DeparturesBoard';
import { drawEventsSign, drawMonument } from './hallGraphics';
import { useKit } from './kit';

const H = UNDERGROUND.hall;
const C = UNDERGROUND.corridor;
const WELL = CAMPUS.well;
const hw = H.width / 2;
const zMid = (H.north + H.south) / 2;
const depth = H.south - H.north;
const top = FLOOR_Y + H.height;
/** The board on the west wall and the monument on the east (hall-local z). */
export const BOARD = { z: 9, y: 3.35, width: 13, height: 4.7 };
export const MONUMENT = { z: 3.6, y: 3.3, width: 10, height: 4.4 };

function HallShell() {
  const kit = useKit();
  const geo = useDisposable(() => {
    const t = 0.5;
    const wh = WELL.r + 0.4;
    const openW = C.halfWidth * 2;
    const walls = merge([
      place(metricBox(t, H.height, depth), { position: [-hw - t / 2, FLOOR_Y + H.height / 2, zMid] }),
      place(metricBox(t, H.height, depth), { position: [hw + t / 2, FLOOR_Y + H.height / 2, zMid] }),
      place(metricBox(H.width, H.height, t), { position: [0, FLOOR_Y + H.height / 2, H.south + t / 2] }),
      // North wall with the corridor opening.
      place(metricBox(hw - openW / 2, H.height, t), { position: [-(hw + openW / 2) / 2, FLOOR_Y + H.height / 2, H.north - t / 2] }),
      place(metricBox(hw - openW / 2, H.height, t), { position: [(hw + openW / 2) / 2, FLOOR_Y + H.height / 2, H.north - t / 2] }),
      place(metricBox(openW, H.height - C.height, t), { position: [0, FLOOR_Y + C.height + (H.height - C.height) / 2, H.north - t / 2] }),
      // Pilasters, clear of the board (west) and the monument (east).
      ...[21.6, 17.2, 0.6, -3.2].map(hallZ).map((z) => place(metricBox(0.5, H.height, 0.7), { position: [-hw + 0.25, FLOOR_Y + H.height / 2, z] })),
      ...[22, 17, 11.2, -3.8].map(hallZ).map((z) => place(metricBox(0.5, H.height, 0.7), { position: [hw - 0.25, FLOOR_Y + H.height / 2, z] })),
      // Two monolithic columns flanking the corridor mouth.
      place(metricBox(1.1, H.height, 1.1), { position: [-5.2, FLOOR_Y + H.height / 2, H.north + 3.2] }),
      place(metricBox(1.1, H.height, 1.1), { position: [5.2, FLOOR_Y + H.height / 2, H.north + 3.2] }),
    ]);
    const floor = place(metricBox(H.width, 0.2, depth), { position: [0, FLOOR_Y - 0.1, zMid] });
    // Ceiling around the well opening.
    const cz0 = WELL.z - wh;
    const cz1 = WELL.z + wh;
    const ceiling = merge([
      place(metricBox(H.width, 0.4, cz0 - H.north), { position: [0, top + 0.2, (H.north + cz0) / 2] }),
      place(metricBox(H.width, 0.4, H.south - cz1), { position: [0, top + 0.2, (H.south + cz1) / 2] }),
      place(metricBox(hw - wh, 0.4, cz1 - cz0), { position: [-(hw + wh) / 2, top + 0.2, WELL.z] }),
      place(metricBox(hw - wh, 0.4, cz1 - cz0), { position: [(hw + wh) / 2, top + 0.2, WELL.z] }),
    ]);
    const lights = merge([
      place(metricBox(0.18, 0.05, cz0 - H.north - 1), { position: [-4.8, top - 0.03, (H.north + cz0) / 2] }),
      place(metricBox(0.18, 0.05, cz0 - H.north - 1), { position: [4.8, top - 0.03, (H.north + cz0) / 2] }),
      place(metricBox(2 * wh, 0.08, 0.1), { position: [0, top - 0.05, cz0] }),
      place(metricBox(2 * wh, 0.08, 0.1), { position: [0, top - 0.05, cz1] }),
      place(metricBox(0.1, 0.08, 2 * wh), { position: [-wh, top - 0.05, WELL.z] }),
      place(metricBox(0.1, 0.08, 2 * wh), { position: [wh, top - 0.05, WELL.z] }),
    ]);
    const inlay = place(metricBox(0.06, 0.012, WELL.z - H.north), { position: [0, FLOOR_Y + 0.006, (WELL.z + H.north) / 2] });
    // Housings: the board's dark frame and a lip of light under each piece.
    const frames = merge([
      place(metricBox(0.3, BOARD.height + 0.5, BOARD.width + 0.5), { position: [-hw + 0.15, FLOOR_Y + BOARD.y, hallZ(BOARD.z)] }),
      place(metricBox(0.12, MONUMENT.height + 0.2, MONUMENT.width + 0.2), { position: [hw - 0.06, FLOOR_Y + MONUMENT.y, hallZ(MONUMENT.z)] }),
    ]);
    const lips = merge([
      place(metricBox(0.4, 0.05, BOARD.width + 0.4), { position: [-hw + 0.35, FLOOR_Y + BOARD.y + BOARD.height / 2 + 0.3, hallZ(BOARD.z)] }),
      place(metricBox(0.4, 0.05, MONUMENT.width), { position: [hw - 0.3, FLOOR_Y + MONUMENT.y + MONUMENT.height / 2 + 0.25, hallZ(MONUMENT.z)] }),
    ]);
    return { walls, floor, ceiling, lights, inlay, frames, lips };
  }, []);

  const anchors = useMemo(
    () => [
      { position: new Vector3(0, top - 1.5, hallZ(20)), color: new Color('#dfe8ff'), intensity: 60, distance: 20 },
      { position: new Vector3(-8, FLOOR_Y + 5.5, hallZ(BOARD.z)), color: new Color('#ffd9a8'), intensity: 80, distance: 18 },
      { position: new Vector3(8, FLOOR_Y + 5.5, hallZ(MONUMENT.z)), color: new Color('#ffd9a8'), intensity: 80, distance: 18 },
      { position: new Vector3(0, top - 1.5, hallZ(-3)), color: new Color('#dfe8ff'), intensity: 50, distance: 16 },
    ],
    [],
  );
  useLightAnchors(anchors);

  return (
    <group name="facility-shell">
      <mesh geometry={geo.floor} material={kit.floor} />
      <mesh geometry={geo.walls} material={kit.concrete} />
      <mesh geometry={geo.ceiling} material={kit.ceiling} />
      <mesh geometry={geo.lights} material={kit.lightCool} />
      <mesh geometry={geo.inlay} material={kit.acmLine} />
      <mesh geometry={geo.frames} material={kit.black} />
      <mesh geometry={geo.lips} material={kit.lightWarm} />
    </group>
  );
}

export function FacilityHall() {
  return (
    <group name="facility-hall">
      <ModelSlot id="facilityHall">
        <HallShell />
      </ModelSlot>

      <DeparturesBoard position={[-hw + 0.32, FLOOR_Y + BOARD.y, hallZ(BOARD.z)]} rotation={[0, Math.PI / 2, 0]} width={BOARD.width} height={BOARD.height} />

      <CanvasPanel
        width={MONUMENT.width}
        height={MONUMENT.height}
        pxPerMeter={170}
        position={[hw - 0.13, FLOOR_Y + MONUMENT.y, hallZ(MONUMENT.z)]}
        rotation={[0, -Math.PI / 2, 0]}
        draw={drawMonument}
        drawKey="monument"
        shading="glow"
        glowStrength={0.95}
      />

      {/* Sign over the corridor mouth. */}
      <CanvasPanel
        width={11}
        height={2.4}
        pxPerMeter={150}
        position={[0, FLOOR_Y + C.height + 1.6, H.north + 0.02]}
        draw={(ctx, w, h) => drawEventsSign(ctx, w, h, EVENTS.length, FLAGSHIPS.length)}
        drawKey="events-sign"
        shading="glow"
        glowStrength={0.9}
        transparent
      />
    </group>
  );
}
