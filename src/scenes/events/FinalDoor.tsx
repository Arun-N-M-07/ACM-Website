'use client';
/**
 * The door at the end of the events corridor — "Beyond the events". Its leaves
 * slide open with scroll progress, spilling warm light from the team workspace,
 * and close behind the visitor once they're through.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, type Group, MeshBasicMaterial } from 'three';
import { SEGMENTS } from '@/config/timeline';
import { DOOR, FLOOR_Y, UNDERGROUND } from '@/config/world';
import { experience } from '@/store/experience';
import { doorOpenAmount } from '@/systems/camera/shots';
import { merge, metricBox, place } from '@/systems/geometry/build';
import { useLightAnchor } from '@/systems/lighting/lightPool';
import { useDisposable } from '@/systems/performance/useDisposable';
import { progress } from '@/systems/scroll/progress';
import { fitSize, text } from '@/systems/textures/typeset';
import { CanvasPanel } from '../shared/CanvasPanel';
import { useKit } from '../underground/kit';

const hw = UNDERGROUND.corridor.halfWidth;
const WALL_H = 9;

export function FinalDoor() {
  const kit = useKit();
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);
  const open = useRef(0);
  const leafW = DOOR.width / 2;

  const geo = useDisposable(() => {
    const t = 0.8;
    const sideW = hw + 0.4 - DOOR.width / 2;
    const wall = merge([
      place(metricBox(sideW, WALL_H, t), { position: [-(DOOR.width / 2 + sideW / 2), FLOOR_Y + WALL_H / 2, DOOR.z - t / 2] }),
      place(metricBox(sideW, WALL_H, t), { position: [DOOR.width / 2 + sideW / 2, FLOOR_Y + WALL_H / 2, DOOR.z - t / 2] }),
      place(metricBox(DOOR.width, WALL_H - DOOR.height, t), { position: [0, FLOOR_Y + DOOR.height + (WALL_H - DOOR.height) / 2, DOOR.z - t / 2] }),
    ]);
    const frame = merge([
      place(metricBox(0.18, DOOR.height, 0.9), { position: [-DOOR.width / 2 - 0.09, FLOOR_Y + DOOR.height / 2, DOOR.z - 0.4] }),
      place(metricBox(0.18, DOOR.height, 0.9), { position: [DOOR.width / 2 + 0.09, FLOOR_Y + DOOR.height / 2, DOOR.z - 0.4] }),
      place(metricBox(DOOR.width + 0.36, 0.18, 0.9), { position: [0, FLOOR_Y + DOOR.height + 0.09, DOOR.z - 0.4] }),
      place(metricBox(DOOR.width, 0.03, 1.2), { position: [0, FLOOR_Y + 0.015, DOOR.z - 0.3] }),
    ]);
    const leaf = place(metricBox(leafW, DOOR.height, 0.22), { position: [0, DOOR.height / 2, 0] });
    const seam = place(metricBox(0.03, DOOR.height - 0.4, 0.01), { position: [0, DOOR.height / 2, 0.116] });
    return { wall, frame, leaf, seam };
  }, []);
  const seamMat = useDisposable(() => new MeshBasicMaterial({ color: new Color('#ffcf94').multiplyScalar(1.6) }), []);

  const glowPos = useMemo<[number, number, number]>(() => [0, FLOOR_Y + 4, DOOR.z - 3], []);
  const glow = useLightAnchor(glowPos, '#ffc988', 140, 22);
  const vestibule = useLightAnchor([0, FLOOR_Y + 7.8, DOOR.z + 4], '#dce6ff', 70, 16);

  useFrame((_, dt) => {
    // Open for the push through; it closes behind you once you're in.
    const target = experience().phase !== 'impact' && progress.value >= SEGMENTS.team.start + 0.004 ? 0 : doorOpenAmount(progress.value);
    open.current += (target - open.current) * (1 - Math.exp(-dt * 5));
    const slide = open.current * (leafW + 0.1);
    if (left.current) left.current.position.x = -leafW / 2 - slide;
    if (right.current) right.current.position.x = leafW / 2 + slide;
    glow.gain = 0.15 + open.current;
    vestibule.gain = 1;
  });

  const lintelY = FLOOR_Y + DOOR.height + (WALL_H - DOOR.height) / 2 + 0.1;

  return (
    <group name="final-door">
      <mesh geometry={geo.wall} material={kit.concrete} />
      <mesh geometry={geo.frame} material={kit.steel} />
      <group ref={left} position={[-leafW / 2, FLOOR_Y, DOOR.z - 0.4]}>
        <mesh geometry={geo.leaf} material={kit.steel} />
        <mesh geometry={geo.seam} material={seamMat} position={[leafW / 2 - 0.02, 0, 0]} />
      </group>
      <group ref={right} position={[leafW / 2, FLOOR_Y, DOOR.z - 0.4]}>
        <mesh geometry={geo.leaf} material={kit.steel} />
        <mesh geometry={geo.seam} material={seamMat} position={[-leafW / 2 + 0.02, 0, 0]} />
      </group>
      <CanvasPanel
        width={2 * hw - 0.2}
        height={WALL_H - DOOR.height - 0.3}
        pxPerMeter={220}
        position={[0, lintelY, DOOR.z + 0.02]}
        shading="glow"
        glowStrength={0.95}
        transparent
        drawKey="lintel"
        draw={(ctx, w, h) => {
          const s = fitSize(ctx, 'BEYOND THE EVENTS', w * 0.92, { family: 'sans', weight: 700, size: h, stretch: 'expanded', tracking: 0.14 }, h * 0.42);
          text(ctx, 'BEYOND THE EVENTS', w / 2, h * 0.56, { family: 'sans', weight: 700, size: s, color: '#efe9df', align: 'center', stretch: 'expanded', tracking: 0.14 });
          text(ctx, 'THE TEAM  ·  THE DOMAINS  ·  THE CORE', w / 2, h * 0.86, { family: 'mono', size: h * 0.11, color: 'rgba(239,233,223,0.6)', align: 'center', tracking: 0.3 });
        }}
      />
    </group>
  );
}
