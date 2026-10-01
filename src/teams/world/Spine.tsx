'use client';
/**
 * The spine — the Teams world's central object.
 *
 * Geometry: procedural vertebrae (spineGeometry.ts). Material: a physically
 * based iridescent metal (thin-film interference over a near-mirror base with
 * a clearcoat), lit mostly by the world's studio environment, so its colour
 * slides between violet, rose and cyan as the camera orbits. A small shader
 * hook adds:
 *   uTime   a slow wave that travels down the column (the "breath" that also
 *           moves the cards and the dust, so the world moves as one system)
 *   uSil    arrival: the silhouette appears first, as a fresnel rim…
 *   uLit    …then the surface lights and the reflections come on
 *   uDim    a chosen card pushes the spine back into the dark
 *
 * The journey's signal thread winds round it, drawing itself in on arrival.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import {
  type BufferGeometry,
  CatmullRomCurve3,
  Color,
  type Group,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  SphereGeometry,
  type Texture,
  TubeGeometry,
  Vector3,
} from 'three';
import { smoothstep } from '@/systems/camera/pose';
import { useDisposable } from '@/systems/performance/useDisposable';
import { teamsFrame, teamsWorldActive } from '../state';
import { useExperience } from '@/store/experience';
import { cardY, O, spineAxis, type Composition } from '../layout';
import { filamentPoints, spineGeometry } from './spineGeometry';

const _ax = new Vector3();

/**
 * Torsion about the column's own (curved) axis — the spine's secondary
 * response: it twists a little with the orbit's velocity, heavier and later
 * than the camera and the cards, and relaxes back without springing. Points
 * on the axis stay put, so the card mounts never detach.
 */
const TWIST = /* glsl */ `
uniform float uTwist;
uniform float uTwistY;
vec2 spineTwist(float y) {
  float tw = uTwist * (0.55 + 0.45 * exp(-pow((y - uTwistY) * 0.25, 2.0)));
  return vec2(cos(tw), sin(tw));
}
vec2 twistXZ(vec2 xz, float y, vec2 cs) {
  vec2 ax = vec2(0.48 * sin(y * 0.32), 0.42 * sin(y * 0.27)); // layout.spineAxis
  vec2 r = xz - ax;
  return ax + vec2(r.x * cs.x + r.y * cs.y, -r.x * cs.y + r.y * cs.x);
}
`;

function spineMaterial(env: Texture | null) {
  const mat = new MeshPhysicalMaterial({
    color: new Color('#cbc5d9'),
    metalness: 0.68,
    roughness: 0.38,
    iridescence: 0.25,
    iridescenceIOR: 1.5,
    iridescenceThicknessRange: [220, 700],
    clearcoat: 0.4,
    clearcoatRoughness: 0.1,
    envMap: env,
    envMapIntensity: 0.85,
  });
  const uniforms = { uTime: { value: 0 }, uSil: { value: 1 }, uLit: { value: 1 }, uDim: { value: 1 }, uWave: { value: 1 }, uTwist: { value: 0 }, uTwistY: { value: 0 }, uEmph: { value: 0 }, uEmphY: { value: 0 } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;\nuniform float uWave;\nvarying float vSpineY;\n${TWIST}`)
      .replace(
        '#include <beginnormal_vertex>',
        '#include <beginnormal_vertex>\nvec2 spineCS = spineTwist(position.y);\nobjectNormal.xz = vec2(objectNormal.x * spineCS.x + objectNormal.z * spineCS.y, -objectNormal.x * spineCS.y + objectNormal.z * spineCS.x);',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvSpineY = position.y;\ntransformed.xz = twistXZ(transformed.xz, position.y, spineCS);\ntransformed += objectNormal * sin(position.y * 1.35 - uTime * 0.9) * 0.012 * uWave;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uSil;\nuniform float uLit;\nuniform float uDim;\nuniform float uEmph;\nuniform float uEmphY;\nvarying float vSpineY;')
      .replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
        {
          float fres = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.4);
          vec3 tint = mix(vec3(0.55, 0.47, 1.0), vec3(1.0, 0.58, 0.72), 0.5 + 0.5 * sin(vSpineY * 0.6 + uTime * 0.25));
          gl_FragColor.rgb += tint * fres * 0.16 * uLit;
          vec3 sil = tint * fres * 1.2;
          gl_FragColor.rgb = mix(sil * uSil, gl_FragColor.rgb, uLit) * uDim;
          // A chosen card draws the column's attention to its level: that band
          // lifts a little, the rest recedes (never a glow — a shift in weight).
          float band = exp(-pow((vSpineY - uEmphY) / 1.4, 2.0));
          gl_FragColor.rgb *= 1.0 + uEmph * (0.32 * band - 0.28 * (1.0 - band));
        }`,
      );
  };
  mat.customProgramCacheKey = () => 'teams-spine-v3';
  return { mat, uniforms };
}

export function Spine({ env, comp }: { env: Texture | null; comp: Composition }) {
  const group = useRef<Group>(null);
  const prepared = useRef(false);
  const [geo, setGeo] = useState<BufferGeometry | null>(null);
  useEffect(() => {
    let alive = true;
    void spineGeometry().then((g) => alive && setGeo(g));
    return () => {
      alive = false;
    };
  }, []);

  const res = useDisposable(() => {
    const { mat, uniforms } = spineMaterial(env);
    const curve = new CatmullRomCurve3(filamentPoints(), false, 'centripetal');
    const tube = new TubeGeometry(curve, 640, 0.012, 5, false);
    const thread = new MeshBasicMaterial({ color: new Color('#83bbff').multiplyScalar(1.3), transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false });
    // The thread is wound round the column: it twists with it.
    thread.onBeforeCompile = (shader) => {
      shader.uniforms.uTwist = uniforms.uTwist;
      shader.uniforms.uTwistY = uniforms.uTwistY;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${TWIST}`)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.xz = twistXZ(transformed.xz, position.y, spineTwist(position.y));');
    };
    thread.customProgramCacheKey = () => 'teams-spine-thread';
    const bead = new SphereGeometry(0.035, 10, 8);
    const beadMat = new MeshBasicMaterial({ color: new Color('#eef5ff').multiplyScalar(2), toneMapped: false });
    return { mat, uniforms, curve, tube, thread, bead, beadMat };
  }, [env]);
  const bead = useRef<Group>(null);
  const beadT = useRef(0);

  useFrame(({ clock, camera }, dt) => {
    const f = teamsFrame;
    const reduced = useExperience.getState().reducedMotion;
    // Keep the bead's global phase, but not the curve sampling/material work
    // while this resident world is hidden by Intro or Events.
    if (!reduced) beadT.current = (beadT.current + dt * 0.018) % 1;
    if (!teamsWorldActive() && prepared.current) return;
    prepared.current = true;
    const t = reduced ? 0 : clock.elapsedTime;
    const u = res.uniforms;
    u.uTime.value = t;
    u.uSil.value = smoothstep(0.05, 0.3, f.reveal);
    u.uLit.value = smoothstep(0.25, 0.7, f.reveal);
    // A chosen card pushes the spine back into the dark — gone before the glass clears.
    u.uDim.value = 1 - 0.998 * smoothstep(0.12, 0.5, f.focus);
    u.uWave.value = 1 + Math.min(3, Math.abs(f.spineVel) * 2.2);
    // It also answers a selection: a slight turn as the card leaves the ring.
    const twist = reduced ? 0 : Math.max(-0.05, Math.min(0.05, 0.035 * f.spineVel)) * (1 - f.focus) + 0.03 * Math.sin(Math.PI * Math.min(1, f.focus * 1.6));
    u.uTwist.value = twist;
    u.uTwistY.value = camera.position.y - O.y;
    u.uEmph.value = reduced ? 0 : f.commit * (1 - smoothstep(0.1, 0.42, f.focus));
    u.uEmphY.value = cardY(f.focusK, comp);
    // Turns a little with the orbit (counter to it, for parallax) and drifts.
    if (group.current) {
      // Out of the way before the eye comes through the chosen card (it looks on past the axis).
      group.current.visible = f.reveal > 0.001 && f.focus < 0.52;
      group.current.rotation.y = 0;
    }
    // The thread draws itself in on arrival; a bead of light runs down it.
    const drawn = smoothstep(0.24, 0.92, f.reveal);
    res.tube.setDrawRange(0, Math.floor(drawn * 640) * 30);
    res.thread.opacity = 0.18 * (1 - 0.99 * f.focus);
    if (bead.current) {
      bead.current.visible = drawn > 0.99 && f.focus < 0.5;
      const p = bead.current.position;
      res.curve.getPointAt(beadT.current, p);
      // …and the bead on it.
      const tw = twist * (0.55 + 0.45 * Math.exp(-(((p.y - u.uTwistY.value) * 0.25) ** 2)));
      spineAxis(p.y, _ax);
      const rx = p.x - _ax.x;
      const rz = p.z - _ax.z;
      p.x = _ax.x + rx * Math.cos(tw) + rz * Math.sin(tw);
      p.z = _ax.z - rx * Math.sin(tw) + rz * Math.cos(tw);
    }
  });

  return (
    <group ref={group} name="spine">
      {geo && <mesh geometry={geo} material={res.mat} frustumCulled={false} />}
      <mesh geometry={res.tube} material={res.thread} frustumCulled={false} />
      <group ref={bead}>
        <mesh geometry={res.bead} material={res.beadMat} />
      </group>
    </group>
  );
}
