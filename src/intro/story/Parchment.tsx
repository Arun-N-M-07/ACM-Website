'use client';
/**
 * One fragment of the story: a physical sheet in the air in front of the
 * camera.
 *
 * It travels with the walk (it is carried on the air the camera moves
 * through — so it can be read), with its own motion inside that frame. Its
 * arrival is staged like a shot, and every part of it is a function of the
 * scroll (the arrival's progress `a`), so it can be stopped anywhere and
 * played backwards:
 *
 *   anticipation  far off in the mist it hangs, turning slowly, even drifting
 *                 a little away — something out there, not yet coming
 *   the carry     then the air takes it: it accelerates towards the lens on a
 *                 curving path, tumbling, its plain back towards you
 *   the turn      it turns over as it comes, catching the light as its face
 *                 swings through it (the paper is glossier while it moves)
 *   overshoot     it comes a touch too close and turns a little too far,
 *                 and settles back — damped springs, not an ease
 *   the wake      a breath of mist is dragged along behind it
 *
 * Settled, it breathes in the air; burning, it lifts on its own heat. The
 * camera it is placed against is the opening's path, not the breathing
 * camera, so it keeps a little parallax of its own.
 *
 * Portrait screens: the sheet stands further off and nearer the middle so it
 * always fits the width.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { BufferAttribute, BufferGeometry, Color, type Group, Matrix4, type PerspectiveCamera, PlaneGeometry, type Points, Quaternion, ShaderMaterial, type Texture, Vector3 } from 'three';
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

/** The share of the arrival spent hanging in the mist before the air takes it. */
const HANG = 0.2;
/** A damped spring from 0 to 1 (starts at rest, overshoots, settles). */
const damped = (a: number, w: number) => (u: number) => {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  return 1 - Math.exp(-a * u) * (Math.cos(w * u) + (a / w) * Math.sin(w * u));
};
/** The turn: a lively spring (~7% past square, and back). */
const spring = damped(6.2, 7.4);
/** The travel: a gentler one (~3% — it comes a touch too close, then settles). */
const carry = damped(7.5, 6.5);
/** Quadratic Bézier (extrapolates smoothly past 1, for the overshoot). */
const bez = (p0: number, p1: number, p2: number, s: number) => (1 - s) * (1 - s) * p0 + 2 * (1 - s) * s * p1 + s * s * p2;

const WAKE = 14;
const _f = new Vector3();
const _r = new Vector3();
const _u = new Vector3();
const _p = new Vector3();
const _n = new Vector3();
const _m = new Matrix4();
const _q = new Quaternion();
const _qt = new Quaternion();
const _ax = new Vector3();
const UP = new Vector3(0, 1, 0);

export function Parchment({ fragment, art, noise }: { fragment: Fragment; art: ParchmentArt; noise: Texture }) {
  const group = useRef<Group>(null);
  const wake = useRef<Points>(null);
  const size = useThree((s) => s.size);
  const f = fragment;

  const res = useDisposable(() => {
    const geo = new PlaneGeometry(f.size[0], f.size[1], 72, 50);
    const { material, uniforms } = createParchmentMaterial(art.texture, noise, f.size, art.lines, f.seed);
    patchMist(material);
    // The wake: a few soft puffs of mist along the path it has just travelled.
    const wakeGeo = new BufferGeometry();
    wakeGeo.setAttribute('position', new BufferAttribute(new Float32Array(WAKE * 3), 3));
    wakeGeo.setAttribute('aWake', new BufferAttribute(new Float32Array(WAKE * 2), 2));
    const wakeMat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uColor: { value: new Color() }, uScale: { value: 800 } },
      vertexShader: /* glsl */ `
        attribute vec2 aWake; // size (m), alpha
        uniform float uScale;
        varying float vA;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aWake.x * uScale / max(0.3, -mv.z);
          vA = aWake.y;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vA;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float r = dot(c, c) * 4.0;
          float a = exp(-r * 3.2) * vA;
          if (a < 0.003) discard;
          gl_FragColor = vec4(uColor, a);
        }`,
    });
    return { geo, material, uniforms, wakeGeo, wakeMat };
  }, [art, noise, f]);

  // How it tumbles on the way in (decays through zero to the settled tilt).
  const spin = useMemo(() => {
    const h = (k: number) => {
      const v = Math.sin(f.seed * (12.9 + k * 4.1)) * 43758.5453;
      return v - Math.floor(v) - 0.5;
    };
    // Mostly a turn over (it arrives back first), a little pitch and roll.
    return new Vector3(h(1) * 1.1, (h(2) > 0 ? 1 : -1) * (2.5 + Math.abs(h(4))), h(3) * 0.9);
  }, [f.seed]);

  // The camera's walking speed around this fragment (for the ash left behind).
  const speed = useMemo(() => {
    const a = introCameraAt(f.burn[0]).pos.clone();
    const b = introCameraAt(f.burn[1]).pos.clone();
    return a.distanceTo(b) / Math.max(0.1, f.burn[1] - f.burn[0]);
  }, [f]);

  // Where the sheet is (camera-frame metres) at arrival progress a, without the breath.
  const arrivalAt = useMemo(() => {
    const ctrl: [number, number, number] = [
      (f.from[0] + f.rest[0]) * 0.5 + (f.from[0] > 0 ? 0.9 : -0.9),
      (f.from[1] + f.rest[1]) * 0.5 + 0.7,
      (f.from[2] + f.rest[2]) * 0.45,
    ];
    return (a: number, out: Vector3) => {
      // Hanging: drifting a little further off (anticipation).
      const hang = Math.sin(Math.min(1, a / HANG) * Math.PI * 0.5);
      const hx = f.from[0] + 0.25 * hang * Math.sign(f.from[0] || 1);
      const hy = f.from[1] + 0.12 * hang;
      const hz = f.from[2] + 0.9 * hang;
      const s = carry((a - HANG) / (1 - HANG));
      return out.set(bez(hx, ctrl[0], f.rest[0], s), bez(hy, ctrl[1], f.rest[1], s), bez(hz, ctrl[2], f.rest[2], s));
    };
  }, [f]);

  useFrame(({ camera, clock, gl }) => {
    const g = group.current;
    if (!g) return;
    const t = introFrame.t;
    const on = introFrame.active && t >= f.arrive[0] - 0.05 && t <= f.burn[1] + 4.8;
    g.visible = on;
    if (wake.current) wake.current.visible = on;
    if (!on) return;

    // The camera's frame at this moment of the opening (no breath).
    const S = introCameraAt(t);
    _f.subVectors(S.look, S.pos).normalize();
    _r.crossVectors(_f, UP).normalize();
    _u.crossVectors(_r, _f).normalize();

    const a = span(t, f.arrive[0], f.arrive[1]);
    const s = spring((a - HANG) / (1 - HANG));
    arrivalAt(a, _p);
    let { x, y, z } = _p;
    // Breathing in the air (the only thing here that runs on its own).
    const w = clock.elapsedTime;
    x += Math.sin(w * 0.47 + f.seed) * 0.022;
    y += Math.sin(w * 0.61 + f.seed * 0.3) * 0.02;
    z += Math.sin(w * 0.38 + f.seed * 0.7) * 0.026;
    // Burning, it rises a little on its own heat and drifts with the air.
    const b = span(t, f.burn[0], f.burn[1]);
    y += b * b * 0.2;
    x += b * 0.08;
    // Portrait: further off, nearer the middle, so the sheet fits the width.
    const cam = camera as PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    let fit = 1;
    if (aspect < 1) {
      const hfov = 2 * Math.atan(Math.tan((cam.fov * Math.PI) / 360) * aspect);
      fit = Math.max(1, (f.size[0] * 1.1) / (2 * Math.tan(hfov / 2)) / f.rest[2]);
      z *= fit;
      x *= 0.12;
      y += (fit - 1) * 0.1;
    }
    const place = (px: number, py: number, pz: number, out: Vector3) => out.copy(S.pos).addScaledVector(_r, px).addScaledVector(_u, py).addScaledVector(_f, pz);
    place(x, y, z, g.position);

    // Facing the camera, with its settled tilt; arriving, still turning over.
    _m.lookAt(S.pos, g.position, _u);
    _q.setFromRotationMatrix(_m);
    const k = 1 - s;
    const hangTurn = (1 - Math.min(1, a / HANG)) * 0.35;
    _qt.setFromAxisAngle(_ax.set(1, 0, 0), f.tilt[0] + spin.x * k + Math.sin(w * 0.33 + f.seed) * 0.03);
    _q.multiply(_qt);
    _qt.setFromAxisAngle(_ax.set(0, 1, 0), f.tilt[1] + spin.y * k + hangTurn + Math.sin(w * 0.27 + f.seed * 2) * 0.035);
    _q.multiply(_qt);
    _qt.setFromAxisAngle(_ax.set(0, 0, 1), f.tilt[2] + spin.z * k);
    _q.multiply(_qt);
    // (Matrix4.lookAt(eye, target) points +z from the sheet to the camera: the face.)
    g.quaternion.copy(_q);

    // How squarely its face (or back) meets the lens and the light: it catches
    // the light as it turns through it.
    _n.set(0, 0, 1).applyQuaternion(_q);
    const facing = Math.abs(_n.dot(_ax.subVectors(S.pos, g.position).normalize()));
    const moving = 1 - ease(a, 0.85, 1);

    const u = res.uniforms;
    u.uTime.value = w;
    u.uPresence.value = ease(t, f.arrive[0], f.arrive[0] + 1.1);
    u.uReveal.value = span(t, f.ink[0], f.ink[1]);
    u.uBurn.value = b;
    u.uFlutter.value = 0.011 + 0.026 * k + 0.012 * b;
    // Before the sun, the sheet holds what little light there is (so it reads);
    // once the sun is up, the sun lights it. Turning, it flashes as it faces you.
    const base = 0.36 - 0.25 * Math.min(1, look.sun.intensity / 2.2);
    u.uFill.value = base + moving * 0.22 * Math.pow(facing, 6);
    res.material.roughness = 0.9 - 0.32 * moving;

    // The wake: puffs where the sheet was a moment ago, thicker the faster it came.
    const wk = wake.current;
    if (wk) {
      const pos = res.wakeGeo.getAttribute('position') as BufferAttribute;
      const att = res.wakeGeo.getAttribute('aWake') as BufferAttribute;
      const carry = Math.sin(Math.PI * Math.min(1, Math.max(0, (a - HANG) / (1 - HANG)) * 1.25));
      for (let i = 0; i < WAKE; i++) {
        const lag = (i + 1) * 0.028;
        arrivalAt(Math.max(0, a - lag), _p);
        if (fit > 1) _p.set(_p.x * 0.12, _p.y + (fit - 1) * 0.1, _p.z * fit);
        place(_p.x, _p.y, _p.z, _p);
        pos.setXYZ(i, _p.x, _p.y, _p.z);
        const fade = 1 - i / WAKE;
        att.setXY(i, 0.5 + i * 0.09, carry * fade * 0.16 * (a > HANG ? 1 : 0));
      }
      pos.needsUpdate = true;
      att.needsUpdate = true;
      res.wakeMat.uniforms.uScale.value = (size.height * gl.getPixelRatio()) / (2 * Math.tan((cam.fov * Math.PI) / 360));
      (res.wakeMat.uniforms.uColor.value as Color).copy(look.fogColor).multiplyScalar(1.35);
    }
  });

  return (
    <>
      <group ref={group} visible={false}>
        <mesh geometry={res.geo} material={res.material} renderOrder={3} name={`parchment-${f.id}`} userData={{ sheet: art.texture.image }} />
        <Ash fragment={f} art={art} speed={speed} />
      </group>
      <points ref={wake} geometry={res.wakeGeo} material={res.wakeMat} frustumCulled={false} renderOrder={2} visible={false} />
    </>
  );
}
