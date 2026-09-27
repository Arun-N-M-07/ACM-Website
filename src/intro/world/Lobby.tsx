'use client';
/**
 * The lobby at the foot of the light-well — small, tall, and for one thing.
 *
 * The camera comes down the shaft through an opening in its ceiling and levels
 * out facing north: across a short polished floor, the north wall is a dark
 * feature wall, and set in it, the four-part door (Gate.tsx) with EVENTS
 * mounted above it (EventsTitle.tsx). Beyond the door a short passage, the
 * corridor's own width and height, leads to the Events.
 *
 * No boards, no panels, no information: concrete walls with pilasters, a dark
 * ceiling, cove light along the tops of the walls, a ring of light round the
 * well, and one inlaid line on the floor leading from where you land to the
 * door.
 */
import { useMemo } from 'react';
import { Color, Vector3 } from 'three';
import { CAMPUS, FLOOR_Y, UNDERGROUND } from '@/config/world';
import { useKit } from '@/scenes/underground/kit';
import { merge, metricBox, place } from '@/systems/geometry/build';
import { useLightAnchors } from '@/systems/lighting/lightPool';
import { useDisposable } from '@/systems/performance/useDisposable';
import { GATE, LOBBY, LOBBY_TOP, PASSAGE } from './lobbyLayout';

const WELL = CAMPUS.well;
const C = UNDERGROUND.corridor;

export function Lobby() {
  const kit = useKit();
  const geo = useDisposable(() => {
    const hw = LOBBY.halfWidth;
    const h = LOBBY.height;
    const depth = LOBBY.south - LOBBY.north;
    const zMid = (LOBBY.south + LOBBY.north) / 2;
    const t = 0.5;
    const wz = LOBBY.north - LOBBY.wall / 2;
    const gw = GATE.width / 2;
    const walls = merge([
      place(metricBox(t, h, depth), { position: [-hw - t / 2, FLOOR_Y + h / 2, zMid] }),
      place(metricBox(t, h, depth), { position: [hw + t / 2, FLOOR_Y + h / 2, zMid] }),
      place(metricBox(LOBBY.halfWidth * 2 + 2 * t, h, t), { position: [0, FLOOR_Y + h / 2, LOBBY.south + t / 2] }),
      // The north wall, solid either side of and above the door.
      place(metricBox(hw - gw, h, LOBBY.wall), { position: [-(hw + gw) / 2, FLOOR_Y + h / 2, wz] }),
      place(metricBox(hw - gw, h, LOBBY.wall), { position: [(hw + gw) / 2, FLOOR_Y + h / 2, wz] }),
      place(metricBox(GATE.width, h - GATE.height, LOBBY.wall), { position: [0, FLOOR_Y + GATE.height + (h - GATE.height) / 2, wz] }),
      // The passage beyond: the corridor's own section, from the door to its mouth.
      place(metricBox(0.3, C.height, PASSAGE.z0 - PASSAGE.z1), { position: [-gw - 0.15, FLOOR_Y + C.height / 2, (PASSAGE.z0 + PASSAGE.z1) / 2] }),
      place(metricBox(0.3, C.height, PASSAGE.z0 - PASSAGE.z1), { position: [gw + 0.15, FLOOR_Y + C.height / 2, (PASSAGE.z0 + PASSAGE.z1) / 2] }),
      // Pilasters down both side walls.
      ...[-1, 1].flatMap((sd) =>
        [30.8, 35.6, 40.4, 45.2, 49.2].map((z) => place(metricBox(0.55, h, 0.5), { position: [sd * (hw - 0.27), FLOOR_Y + h / 2, z] })),
      ),
    ]);
    // The feature wall: dark stone cladding round the door and its lettering.
    const fw = gw + 2.6;
    const fh = h - 0.25;
    const feature = merge([
      // Either side of the door, and above it (the doorway itself stays open).
      place(metricBox(fw - gw - 0.34, fh, 0.12), { position: [-(fw + gw + 0.34) / 2, FLOOR_Y + fh / 2, LOBBY.north + 0.06] }),
      place(metricBox(fw - gw - 0.34, fh, 0.12), { position: [(fw + gw + 0.34) / 2, FLOOR_Y + fh / 2, LOBBY.north + 0.06] }),
      place(metricBox(2 * (gw + 0.34), fh - GATE.height - 0.34, 0.12), { position: [0, FLOOR_Y + GATE.height + 0.34 + (fh - GATE.height - 0.34) / 2, LOBBY.north + 0.06] }),
    ]);
    const passageTop = place(metricBox(GATE.width + 0.6, 0.3, PASSAGE.z0 - PASSAGE.z1), { position: [0, FLOOR_Y + C.height + 0.15, (PASSAGE.z0 + PASSAGE.z1) / 2] });
    const floor = merge([
      place(metricBox(hw * 2, 0.2, depth), { position: [0, FLOOR_Y - 0.1, zMid] }),
      place(metricBox(GATE.width, 0.2, PASSAGE.z0 - PASSAGE.z1 + LOBBY.wall), { position: [0, FLOOR_Y - 0.1, (PASSAGE.z0 + PASSAGE.z1) / 2 + LOBBY.wall / 2] }),
    ]);
    // The ceiling, open round the well.
    const wh = WELL.r + 0.4;
    const cz0 = WELL.z - wh;
    const cz1 = WELL.z + wh;
    const ceiling = merge([
      place(metricBox(hw * 2, 0.4, cz0 - LOBBY.north), { position: [0, LOBBY_TOP + 0.2, (LOBBY.north + cz0) / 2] }),
      place(metricBox(hw * 2, 0.4, LOBBY.south - cz1), { position: [0, LOBBY_TOP + 0.2, (LOBBY.south + cz1) / 2] }),
      place(metricBox(hw - wh, 0.4, cz1 - cz0), { position: [-(hw + wh) / 2, LOBBY_TOP + 0.2, WELL.z] }),
      place(metricBox(hw - wh, 0.4, cz1 - cz0), { position: [(hw + wh) / 2, LOBBY_TOP + 0.2, WELL.z] }),
    ]);
    // Cool light: a square round the well opening, and cove lines along the tops of the side walls.
    const cool = merge([
      place(metricBox(2 * wh, 0.08, 0.1), { position: [0, LOBBY_TOP - 0.05, cz0] }),
      place(metricBox(2 * wh, 0.08, 0.1), { position: [0, LOBBY_TOP - 0.05, cz1] }),
      place(metricBox(0.1, 0.08, 2 * wh), { position: [-wh, LOBBY_TOP - 0.05, WELL.z] }),
      place(metricBox(0.1, 0.08, 2 * wh), { position: [wh, LOBBY_TOP - 0.05, WELL.z] }),
      place(metricBox(0.08, 0.05, depth - 1), { position: [-hw + 0.62, LOBBY_TOP - 0.35, zMid] }),
      place(metricBox(0.08, 0.05, depth - 1), { position: [hw - 0.62, LOBBY_TOP - 0.35, zMid] }),
    ]);
    // A warm lip of light at the foot of the side walls.
    const warm = merge([
      place(metricBox(0.06, 0.04, depth - 0.6), { position: [-hw + 0.03, FLOOR_Y + 0.05, zMid] }),
      place(metricBox(0.06, 0.04, depth - 0.6), { position: [hw - 0.03, FLOOR_Y + 0.05, zMid] }),
    ]);
    // The door's surround: a deep frame of dark steel.
    const f = 0.34;
    const frame = merge([
      place(metricBox(f, GATE.height + f, 0.34), { position: [-gw - f / 2, FLOOR_Y + (GATE.height + f) / 2, LOBBY.north + 0.17] }),
      place(metricBox(f, GATE.height + f, 0.34), { position: [gw + f / 2, FLOOR_Y + (GATE.height + f) / 2, LOBBY.north + 0.17] }),
      place(metricBox(GATE.width + 2 * f, f, 0.34), { position: [0, FLOOR_Y + GATE.height + f / 2, LOBBY.north + 0.17] }),
    ]);
    // Where you land, the line leads to the door.
    const inlay = place(metricBox(0.06, 0.012, WELL.z - LOBBY.north - 0.4), { position: [0, FLOOR_Y + 0.006, (WELL.z + LOBBY.north + 0.4) / 2] });
    return { walls, feature, passageTop, floor, ceiling, cool, warm, frame, inlay };
  }, []);

  const anchors = useMemo(
    () => [
      // Over the landing.
      { position: new Vector3(0, LOBBY_TOP - 1.6, WELL.z - 1), color: new Color('#dfe8ff'), intensity: 40, distance: 18 },
      // Along the room.
      { position: new Vector3(-6.5, LOBBY_TOP - 1.6, 37), color: new Color('#e6edff'), intensity: 26, distance: 15 },
      { position: new Vector3(6.5, LOBBY_TOP - 1.6, 37), color: new Color('#e6edff'), intensity: 26, distance: 15 },
    ],
    [],
  );
  useLightAnchors(anchors);

  return (
    <group name="intro-lobby">
      <mesh geometry={geo.floor} material={kit.floor} />
      <mesh geometry={geo.walls} material={kit.concrete} />
      <mesh geometry={geo.feature} material={kit.concreteDark} />
      <mesh geometry={geo.passageTop} material={kit.ceiling} />
      <mesh geometry={geo.ceiling} material={kit.ceiling} />
      <mesh geometry={geo.cool} material={kit.lightCool} />
      <mesh geometry={geo.warm} material={kit.lightWarm} />
      <mesh geometry={geo.frame} material={kit.steel} />
      <mesh geometry={geo.inlay} material={kit.acmLine} />
    </group>
  );
}
