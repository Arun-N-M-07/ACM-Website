'use client';
/**
 * One fragment of the story: a physical sheet in the air in front of the
 * camera.
 *
 * It travels with the walk (it is carried on the air the camera moves
 * through — so it can be read), with its own motion inside that frame. Every
 * part of it is a function of the scroll (the arrival's progress `a`), so it
 * can be stopped anywhere and played backwards.
 *
 * The arrival (flight.ts): each sheet is discovered in the air. It is first
 * a dark shape far off in the smog, to one side of the way ahead (the first
 * to the left, the next to the right…); as the air carries it closer its torn
 * edge shows, the smog parts around it and its fibres resolve (uForm), while
 * it comes rolled up at its leading edge like a scroll, fluttering and
 * banking on a swooping path with a wake of mist behind it; slowing, it turns
 * to face you and its roll runs out ahead of it until it snaps flat in front
 * of you, shaking a little dust off its edge (UnfurlDust); then its ink
 * surfaces.
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
import { BufferAttribute, BufferGeometry, Color, type Group, Matrix4, type Mesh, type PerspectiveCamera, PlaneGeometry, type Points, Quaternion, ShaderMaterial, type Texture, Vector3 } from 'three';
import { useDisposable } from '@/systems/performance/useDisposable';
import { introCameraAt } from '../camera';
import { patchMist } from '../fog';
import { look } from '../look';
import { introFrame } from '../state';
import { gasAmount } from '../prologue/layout';
import { ease, span } from '../timeline';
import { Ash } from './Ash';
import { bankAt, FLY, flightAt, flyAt, pitchAt, rolledAt, START_AHEAD, startFor, travelAt, yawAt } from './flight';
import type { Fragment } from './fragments';
import { paperOccluder } from './paperOccluders';
import { UnfurlDust } from './UnfurlDust';
import { createParchmentMaterial } from './parchmentMaterial';
import type { ParchmentArt } from './parchmentTexture';

const WAKE = 14;
/** The smog's own violet (prologue/GasVolume's), for the veil. */
const VEIL_TINT = new Color('#4a2f78');
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
  const sheetBack = useRef<Mesh>(null);
  const sheetFront = useRef<Mesh>(null);
  const wake = useRef<Points>(null);
  const occ = useMemo(() => paperOccluder(fragment.id), [fragment.id]);
  const size = useThree((s) => s.size);
  const f = fragment;

  const res = useDisposable(() => {
    const geo = new PlaneGeometry(f.size[0], f.size[1], 72, 50);
    const { material, back, uniforms } = createParchmentMaterial(art.texture, noise, f.size, art.lines, f.seed);
    patchMist(back);
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
    return { geo, material, back, uniforms, wakeGeo, wakeMat };
  }, [art, noise, f]);

  // The camera's walking speed around this fragment (for the ash left behind).
  const speed = useMemo(() => {
    const a = introCameraAt(f.burn[0]).pos.clone();
    const b = introCameraAt(f.burn[1]).pos.clone();
    return a.distanceTo(b) / Math.max(0.1, f.burn[1] - f.burn[0]);
  }, [f]);

  useFrame(({ camera, clock, gl }) => {
    const g = group.current;
    if (!g) return;
    const t = introFrame.t;
    const on = introFrame.active && t >= f.arrive[0] - 0.05 && t <= f.burn[1] + 4.8;
    g.visible = on;
    if (wake.current) wake.current.visible = on;
    if (!on) {
      occ.on = false;
      return;
    }

    // The camera's frame at this moment of the opening (no breath).
    const S = introCameraAt(t);
    _f.subVectors(S.look, S.pos).normalize();
    _r.crossVectors(_f, UP).normalize();
    _u.crossVectors(_r, _f).normalize();

    const a = span(t, f.arrive[0], f.arrive[1]);
    const fly = flyAt(a);
    const s = travelAt(a);
    let x = f.rest[0];
    let y = f.rest[1];
    let z = f.rest[2];
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
    // The flight: in from deep in the air ahead, to its side, whatever the frame's shape.
    const restX = aspect < 1 ? f.rest[0] * 0.12 : f.rest[0];
    const restY = f.rest[1] + (fit - 1) * 0.1;
    const restZ = f.rest[2] * fit;
    const tanHalf = Math.tan((cam.fov * Math.PI) / 360) * aspect;
    const edge = startFor(f.side, restX, restZ + START_AHEAD, tanHalf);
    flightAt(a, f.side, edge, f.seed, _p);
    x += _p.x;
    y += _p.y;
    z += _p.z;
    const place = (px: number, py: number, pz: number, out: Vector3) => out.copy(S.pos).addScaledVector(_r, px).addScaledVector(_u, py).addScaledVector(_f, pz);
    place(x, y, z, g.position);

    // Facing the camera, with its settled tilt; arriving, still turning over.
    _m.lookAt(S.pos, g.position, _u);
    _q.setFromRotationMatrix(_m);
    const k = 1 - s;
    // In flight: edgewise into its path, pitching as it flutters and banking as it swoops;
    // slowing, it turns to face you.
    _qt.setFromAxisAngle(_ax.set(1, 0, 0), f.tilt[0] + pitchAt(a, f.seed) + Math.sin(w * 0.33 + f.seed) * 0.03);
    _q.multiply(_qt);
    _qt.setFromAxisAngle(_ax.set(0, 1, 0), f.tilt[1] + yawAt(a, f.side) + Math.sin(w * 0.27 + f.seed * 2) * 0.035);
    _q.multiply(_qt);
    _qt.setFromAxisAngle(_ax.set(0, 0, 1), f.tilt[2] + bankAt(a, f.side));
    _q.multiply(_qt);
    // (Matrix4.lookAt(eye, target) points +z from the sheet to the camera: the face.)
    g.quaternion.copy(_q);
    // Rolled: the share of the width wound up at its leading edge (the side it travels towards).
    const W = f.size[0];
    const rolled = rolledAt(a);
    const dir = -f.side;
    const rollX = W / 2 - rolled * W;
    const rollR = Math.max(0.055, (rolled * W) / (2 * Math.PI * 1.5));

    // For the smog: where this sheet is, so the smog parts around it as it comes (while enough of it stands).
    occ.on = b < 0.55;
    occ.center.copy(g.position);
    occ.presence = ease(a, 0.1, 0.9);

    // How squarely its face (or back) meets the lens and the light: it catches
    // the light as it turns through it.
    _n.set(0, 0, 1).applyQuaternion(_q);
    const facing = Math.abs(_n.dot(_ax.subVectors(S.pos, g.position).normalize()));
    const moving = 1 - ease(a, 0.85, 1);

    const u = res.uniforms;
    u.uTime.value = w;
    u.uPresence.value = ease(t, f.arrive[0], f.arrive[0] + 0.6);
    // Discovered, not dealt: far off it is only a shape in the smog; its torn edge shows as it
    // comes, then its fibres resolve in towards the middle; the ink waits until it lies open.
    u.uForm.value = ease(a, 0.04, 0.6);
    u.uGhost.value = a < 1 ? 0.6 : 0;
    u.uRollDir.value = dir;
    u.uRollX.value = rolled > 0.001 ? rollX : 10;
    u.uRollR.value = rollR;
    u.uReveal.value = span(t, f.ink[0], f.ink[1]);
    u.uBurn.value = b;
    // (Burnt through, the sheet is gone — every fragment of it past the fire's front — while its ash
    // still falls: the sheet isn't drawn.)
    if (sheetBack.current) sheetBack.current.visible = b < 1;
    if (sheetFront.current) sheetFront.current.visible = b < 1;
    u.uFlutter.value = 0.011 + 0.03 * k + 0.012 * b;
    // Before the sun, the sheet holds what little light there is (so it reads);
    // once the sun is up, the sun lights it. Turning, it flashes as it faces you.
    const base = 0.36 - 0.25 * Math.min(1, look.sun.intensity / 2.2);
    u.uFill.value = base;
    // The smog between the lens and the sheet (it is drawn over the smog, so it carries its own):
    // a haze while it is far off in it, next to nothing once it is here — in the clearing it makes.
    const dist = g.position.distanceTo(S.pos);
    u.uVeil.value = gasAmount(t) * 0.85 * (1 - Math.exp(-0.3 * Math.max(0, dist - 1.6))) * (1 - 0.55 * occ.presence);
    (u.uVeilColor.value as Color).copy(look.fogColor).lerp(VEIL_TINT, 0.35).multiplyScalar(1.15);
    res.material.roughness = res.back.roughness = 0.9;
    void facing;
    void moving;

    // The wake: puffs where the sheet was a moment ago, thicker the faster it came.
    const wk = wake.current;
    const carry = a < FLY ? Math.sin(Math.PI * Math.min(1, fly * 1.1)) : 0;
    // (Once it has come to rest the wake is nothing — every puff at no strength, discarded as drawn:
    // it isn't drawn, or moved, at all.)
    if (wk && carry <= 0) wk.visible = false;
    else if (wk) {
      const pos = res.wakeGeo.getAttribute('position') as BufferAttribute;
      const att = res.wakeGeo.getAttribute('aWake') as BufferAttribute;
      for (let i = 0; i < WAKE; i++) {
        const lag = (i + 1) * 0.028;
        flightAt(Math.max(0, a - lag), f.side, edge, f.seed, _p);
        place(restX + _p.x, restY + _p.y, restZ + _p.z, _p);
        pos.setXYZ(i, _p.x, _p.y, _p.z);
        const fade = 1 - i / WAKE;
        att.setXY(i, 0.5 + i * 0.09, carry * fade * 0.16);
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
        {/* (Drawn after the smog — GasVolume's composite is 30 — so its torn edge covers the smog behind it exactly.
            Its back faces, then its front ones: two meshes in the same place, back first — see parchmentMaterial.) */}
        <mesh ref={sheetBack} geometry={res.geo} material={res.back} renderOrder={31} />
        <mesh ref={sheetFront} geometry={res.geo} material={res.material} renderOrder={31} name={`parchment-${f.id}`} userData={{ sheet: art.texture.image }} />
        <Ash fragment={f} art={art} speed={speed} />
        <UnfurlDust fragment={f} />
      </group>
      <points ref={wake} geometry={res.wakeGeo} material={res.wakeMat} frustumCulled={false} renderOrder={2} visible={false} />
    </>
  );
}
