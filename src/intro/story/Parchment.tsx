'use client';
/**
 * One fragment of the story: a physical sheet in the air in front of the
 * camera.
 *
 * It travels with the walk (it is carried on the air the camera moves
 * through — so it can be read), but it has its own motion inside that frame:
 * it arrives from its own direction out of the mist, turning over as it
 * comes, settles off-centre with a slight tilt, breathes in the air, and when
 * it burns it lifts a little on its own heat. The camera it is placed against
 * is the film's path, not the breathing camera, so it keeps a little
 * parallax of its own.
 *
 * Portrait screens: the sheet stands further off and nearer the middle so it
 * always fits the width.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { type Group, Matrix4, type PerspectiveCamera, PlaneGeometry, Quaternion, type Texture, Vector3 } from 'three';
import { useDisposable } from '@/systems/performance/useDisposable';
import { introCameraAt } from '../camera';
import { patchMist } from '../fog';
import { look } from '../look';
import { introFrame } from '../state';
import { ease, span } from '../timeline';
import { Ash } from './Ash';
import type { Fragment } from './fragments';
import { createParchmentMaterial } from './parchmentMaterial';
import type { ParchmentArt } from './parchmentTexture';

const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const _f = new Vector3();
const _r = new Vector3();
const _u = new Vector3();
const _p = new Vector3();
const _m = new Matrix4();
const _q = new Quaternion();
const _qt = new Quaternion();
const UP = new Vector3(0, 1, 0);

export function Parchment({ fragment, art, noise }: { fragment: Fragment; art: ParchmentArt; noise: Texture }) {
  const group = useRef<Group>(null);
  const size = useThree((s) => s.size);
  const f = fragment;

  const res = useDisposable(() => {
    const geo = new PlaneGeometry(f.size[0], f.size[1], 72, 50);
    const { material, uniforms } = createParchmentMaterial(art.texture, noise, f.size, art.lines, f.seed);
    patchMist(material);
    return { geo, material, uniforms };
  }, [art, noise, f]);

  // Spin it arrives with (decays to the settled tilt).
  const spin = useMemo(() => {
    const h = (k: number) => {
      const v = Math.sin(f.seed * (12.9 + k * 4.1)) * 43758.5453;
      return v - Math.floor(v) - 0.5;
    };
    return new Vector3(h(1) * 1.4, h(2) * 2.2, h(3) * 1.1);
  }, [f.seed]);

  // The camera's walking speed around this fragment (for the ash left behind).
  const speed = useMemo(() => {
    const a = introCameraAt(f.burn[0]).pos.clone();
    const b = introCameraAt(f.burn[1]).pos.clone();
    return a.distanceTo(b) / Math.max(0.1, f.burn[1] - f.burn[0]);
  }, [f]);

  useFrame(({ camera, clock }) => {
    const g = group.current;
    if (!g) return;
    const t = introFrame.t;
    const on = introFrame.active || t < 0.01 ? t >= f.arrive[0] - 0.4 && t <= f.burn[1] + 4.8 : false;
    g.visible = on;
    if (!on) return;

    // The camera's frame at this moment of the film (no breath).
    const S = introCameraAt(t);
    _f.subVectors(S.look, S.pos).normalize();
    _r.crossVectors(_f, UP).normalize();
    _u.crossVectors(_r, _f).normalize();

    // Where it is in that frame: from its own direction, settling off-centre.
    const a = easeOut(span(t, f.arrive[0], f.arrive[1]));
    let x = f.from[0] + (f.rest[0] - f.from[0]) * a;
    let y = f.from[1] + (f.rest[1] - f.from[1]) * a;
    let z = f.from[2] + (f.rest[2] - f.from[2]) * a;
    // Breathing in the air.
    const w = clock.elapsedTime;
    x += Math.sin(w * 0.47 + f.seed) * 0.025;
    y += Math.sin(w * 0.61 + f.seed * 0.3) * 0.022;
    z += Math.sin(w * 0.38 + f.seed * 0.7) * 0.03;
    // Burning, it rises a little on its own heat and drifts with the air.
    const b = span(t, f.burn[0], f.burn[1]);
    y += b * b * 0.16;
    x += b * 0.06;
    // Portrait: further off, nearer the middle, so the sheet fits the width.
    const cam = camera as PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    if (aspect < 1) {
      const hfov = 2 * Math.atan(Math.tan((cam.fov * Math.PI) / 360) * aspect);
      const fit = (f.size[0] * 1.12) / (2 * Math.tan(hfov / 2));
      const k = Math.max(1, fit / f.rest[2]);
      z *= k;
      x *= 0.18;
      y += (k - 1) * 0.12;
    }
    _p.copy(S.pos).addScaledVector(_r, x).addScaledVector(_u, y).addScaledVector(_f, z);
    g.position.copy(_p);

    // Facing the camera, with its settled tilt; arriving, it is still turning over.
    _m.lookAt(S.pos, _p, _u);
    _q.setFromRotationMatrix(_m);
    const k = 1 - a;
    _qt.setFromAxisAngle(_r.set(1, 0, 0), f.tilt[0] + spin.x * k + Math.sin(w * 0.33 + f.seed) * 0.03);
    _q.multiply(_qt);
    _qt.setFromAxisAngle(_r.set(0, 1, 0), f.tilt[1] + spin.y * k + Math.sin(w * 0.27 + f.seed * 2) * 0.04);
    _q.multiply(_qt);
    _qt.setFromAxisAngle(_r.set(0, 0, 1), f.tilt[2] + spin.z * k);
    _q.multiply(_qt);
    // (Matrix4.lookAt(eye, target) points +z from the sheet to the camera: the face.)
    g.quaternion.copy(_q);

    const u = res.uniforms;
    u.uTime.value = w;
    u.uPresence.value = ease(t, f.arrive[0], f.arrive[0] + 1.2);
    u.uReveal.value = span(t, f.ink[0], f.ink[1]);
    u.uBurn.value = b;
    u.uFlutter.value = 0.011 + 0.02 * k + 0.012 * b;
    // Before the sun, the sheet holds what little light there is (so it reads);
    // once the sun is up, the sun lights it.
    u.uFill.value = 0.36 - 0.25 * Math.min(1, look.sun.intensity / 2.2);
  });

  return (
    <group ref={group} visible={false}>
      <mesh geometry={res.geo} material={res.material} renderOrder={3} name={`parchment-${f.id}`} userData={{ sheet: art.texture.image }} />
      <Ash fragment={f} art={art} speed={speed} />
    </group>
  );
}
