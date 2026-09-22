'use client';
/**
 * The visitor's own right arm, seen only during the welcome handshake: it
 * rises from below frame, meets the Chairperson's hand, shakes, and withdraws.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { CapsuleGeometry, type Group, Matrix4, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
import { handshake } from '@/systems/characters/cues';
import { npcAnchors } from '@/systems/characters/registry';
import { useDisposable } from '@/systems/performance/useDisposable';

const REST = new Vector3(0.28, -0.62, -0.25);

export function PlayerHand() {
  const root = useRef<Group>(null);
  const arm = useRef<Group>(null);
  const weight = useRef(0);
  const res = useDisposable(
    () => ({
      sleeve: new CapsuleGeometry(0.05, 0.42, 4, 12),
      hand: new SphereGeometry(0.05, 12, 10),
      sleeveMat: new MeshStandardMaterial({ color: '#23262c', roughness: 0.9 }),
      handMat: new MeshStandardMaterial({ color: '#a8765a', roughness: 0.7 }),
    }),
    [],
  );
  const inv = useMemo(() => new Matrix4(), []);
  const target = useMemo(() => new Vector3(), []);
  const local = useMemo(() => new Vector3(), []);
  const shoulder = useMemo(() => new Vector3(), []);

  useFrame(({ camera, clock }, dt) => {
    const g = root.current;
    const a = arm.current;
    if (!g || !a) return;
    // Driven by the welcome's scroll clock, so the handshake scrubs.
    const anchor = handshake.member ? npcAnchors.get(handshake.member) : undefined;
    weight.current += ((anchor ? handshake.weight : 0) - weight.current) * (1 - Math.exp(-dt * 12));
    g.visible = weight.current > 0.01;
    if (!g.visible) return;

    // Follow the camera.
    g.position.copy(camera.position);
    g.quaternion.copy(camera.quaternion);

    // Aim the hand at the director's hand, expressed in camera space.
    if (anchor) {
      inv.copy(camera.matrixWorld).invert();
      target.copy(anchor.hand).applyMatrix4(inv);
      target.z = Math.max(target.z, -0.75);
      target.x = Math.min(0.35, Math.max(-0.1, target.x));
      target.y = Math.min(-0.1, Math.max(-0.5, target.y));
    }
    local.copy(REST).lerp(target, weight.current);
    local.y += Math.sin(clock.elapsedTime * 15) * 0.025 * handshake.pump;
    a.position.copy(local);
    // Point the forearm back toward a shoulder below and behind the lens.
    g.updateMatrixWorld();
    a.lookAt(g.localToWorld(shoulder.set(0.35, -0.9, 0.4)));
  });

  return (
    <group ref={root} visible={false}>
      <group ref={arm}>
        <mesh geometry={res.hand} material={res.handMat} scale={[0.8, 0.6, 1.3]} />
        <mesh geometry={res.sleeve} material={res.sleeveMat} position={[0, 0, 0.28]} rotation={[Math.PI / 2, 0, 0]} />
      </group>
    </group>
  );
}
