'use client';
/**
 * The canister: a sealed, cylindrical container — graphite body, brushed
 * steel caps with a vent in each, and a thin seam around its middle. No
 * markings: it is simply an object that has come out of the fog.
 *
 * It rolls (layout.ts: rollAt — turn = travel / radius, with the wobble and
 * knocks of a real object), lies still, and under pressure its seam wakes a
 * thin violet and it trembles, until it vents. A soft contact shadow keeps
 * it on the ground. It takes the film's mist like everything else.
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { CanvasTexture, CircleGeometry, Color, CylinderGeometry, type Group, type Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, TorusGeometry } from 'three';
import { useDisposable } from '@/systems/performance/useDisposable';
import { patchMist } from '../fog';
import { introFrame } from '../state';
import { CAN, GROUND_Y, pressureAt, prologueOn, ROLL_AXLE, rollAt, type RollState, sinceRelease } from './layout';

const R = CAN.r;
const L = CAN.length;
const YAW = Math.atan2(-ROLL_AXLE.z, ROLL_AXLE.x);
const state: RollState = { s: 0, v: 0, angle: 0, x: 0, z: 0, lift: 0, tilt: 0, yaw: 0, seen: 0 };

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 32, 2, 64, 32, 60);
  grad.addColorStop(0, 'rgba(0,0,0,0.9)');
  grad.addColorStop(0.45, 'rgba(0,0,0,0.45)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.setTransform(1, 0, 0, 0.5, 0, 16);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}

export function Canister() {
  const outer = useRef<Group>(null);
  const nod = useRef<Group>(null);
  const spin = useRef<Group>(null);
  const shadow = useRef<Mesh>(null);

  const res = useDisposable(() => {
    const shadowMap = shadowTexture();
    const mats = {
      mBody: new MeshStandardMaterial({ color: '#2a2c31', roughness: 0.42, metalness: 0.62 }),
      mCap: new MeshStandardMaterial({ color: '#8a8f97', roughness: 0.3, metalness: 0.9 }),
      mBand: new MeshStandardMaterial({ color: '#15161a', roughness: 0.7, metalness: 0.3 }),
      mVent: new MeshBasicMaterial({ color: '#07070a' }),
      mSeam: new MeshBasicMaterial({ color: new Color('#8f6bd6'), toneMapped: false }),
    };
    Object.values(mats).forEach((m) => patchMist(m));
    return {
      // Local frame: the axle along x.
      gBody: new CylinderGeometry(R, R, L * 0.8, 40).rotateZ(Math.PI / 2),
      gCap: new CylinderGeometry(R * 0.97, R * 0.9, L * 0.1, 40).rotateZ(Math.PI / 2),
      gVent: new CircleGeometry(R * 0.5, 28),
      gBand: new CylinderGeometry(R * 1.012, R * 1.012, 0.012, 40).rotateZ(Math.PI / 2),
      gSeam: new TorusGeometry(R * 1.006, 0.0032, 8, 48).rotateY(Math.PI / 2),
      shadowMap,
      gShadow: new PlaneGeometry(L * 1.7, R * 5).rotateX(-Math.PI / 2),
      mShadow: new MeshBasicMaterial({ map: shadowMap, color: '#000000', transparent: true, depthWrite: false, opacity: 0.6 }),
      ...mats,
    };
  }, []);

  useFrame(() => {
    const g = outer.current;
    if (!g) return;
    const t = introFrame.t;
    const on = introFrame.active && prologueOn(t);
    g.visible = on;
    if (shadow.current) shadow.current.visible = on;
    if (!on) return;
    rollAt(t, state);
    const p = pressureAt(t);
    // The tremble under pressure (a function of the beat, like everything here).
    const tr = p * 0.0028;
    g.position.set(state.x + Math.sin(t * 97) * tr, GROUND_Y + R + state.lift + Math.abs(Math.sin(t * 131)) * tr * 0.6, state.z + Math.cos(t * 89) * tr);
    g.rotation.set(0, YAW + state.yaw, 0);
    if (nod.current) nod.current.rotation.set(0, 0, state.tilt);
    // Rolling without slipping: about the axle, backwards to the travel.
    if (spin.current) spin.current.rotation.set(-state.angle, 0, 0);
    // The seam: dark until the pressure wakes it; after the release it cools.
    const cool = 1 - Math.min(1, Math.max(0, sinceRelease(t) / 3));
    const glow = 0.12 + p * (1.6 + 0.35 * Math.sin(t * 23)) + (sinceRelease(t) > 0 ? 0.5 * cool : 0);
    res.mSeam.color.set('#8f6bd6').multiplyScalar(glow);
    const sh = shadow.current;
    if (sh) {
      sh.position.set(state.x, GROUND_Y + 0.004, state.z);
      sh.rotation.set(0, YAW + state.yaw, 0);
      res.mShadow.opacity = 0.62 * state.seen * (1 - state.lift * 40);
    }
  });

  const capX = L * 0.45;
  return (
    <>
      <group ref={outer} name="prologue-canister" visible={false}>
        <group ref={nod}>
          <group ref={spin}>
            <mesh geometry={res.gBody} material={res.mBody} />
            <mesh geometry={res.gCap} material={res.mCap} position={[capX, 0, 0]} />
            <mesh geometry={res.gCap} material={res.mCap} position={[-capX, 0, 0]} rotation={[0, Math.PI, 0]} />
            <mesh geometry={res.gVent} material={res.mVent} position={[L / 2 + 0.0005, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
            <mesh geometry={res.gVent} material={res.mVent} position={[-L / 2 - 0.0005, 0, 0]} rotation={[0, -Math.PI / 2, 0]} />
            <mesh geometry={res.gBand} material={res.mBand} position={[L * 0.24, 0, 0]} />
            <mesh geometry={res.gBand} material={res.mBand} position={[-L * 0.24, 0, 0]} />
            <mesh geometry={res.gSeam} material={res.mSeam} />
          </group>
        </group>
      </group>
      <mesh ref={shadow} geometry={res.gShadow} material={res.mShadow} visible={false} renderOrder={1} />
    </>
  );
}
