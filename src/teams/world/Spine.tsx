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
} from 'three';
import { smoothstep } from '@/systems/camera/pose';
import { useDisposable } from '@/systems/performance/useDisposable';
import { teamsFrame } from '../state';
import { useExperience } from '@/store/experience';
import { filamentPoints, spineGeometry } from './spineGeometry';

function spineMaterial(env: Texture | null) {
  const mat = new MeshPhysicalMaterial({
    color: new Color('#cbc5d9'),
    metalness: 0.9,
    roughness: 0.32,
    iridescence: 0.45,
    iridescenceIOR: 1.5,
    iridescenceThicknessRange: [220, 700],
    clearcoat: 0.4,
    clearcoatRoughness: 0.1,
    envMap: env,
    envMapIntensity: 1.15,
  });
  const uniforms = { uTime: { value: 0 }, uSil: { value: 1 }, uLit: { value: 1 }, uDim: { value: 1 }, uWave: { value: 1 } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWave;\nvarying float vSpineY;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvSpineY = position.y;\ntransformed += objectNormal * sin(position.y * 1.35 - uTime * 0.9) * 0.012 * uWave;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uSil;\nuniform float uLit;\nuniform float uDim;\nvarying float vSpineY;')
      .replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
        {
          float fres = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.4);
          vec3 tint = mix(vec3(0.55, 0.47, 1.0), vec3(1.0, 0.58, 0.72), 0.5 + 0.5 * sin(vSpineY * 0.6 + uTime * 0.25));
          gl_FragColor.rgb += tint * fres * 0.16 * uLit;
          vec3 sil = tint * fres * 1.2;
          gl_FragColor.rgb = mix(sil * uSil, gl_FragColor.rgb, uLit) * uDim;
        }`,
      );
  };
  mat.customProgramCacheKey = () => 'teams-spine';
  return { mat, uniforms };
}

export function Spine({ env }: { env: Texture | null }) {
  const group = useRef<Group>(null);
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
    const tube = new TubeGeometry(curve, 1600, 0.012, 5, false);
    const thread = new MeshBasicMaterial({ color: new Color('#83bbff').multiplyScalar(1.3), transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false });
    const bead = new SphereGeometry(0.035, 10, 8);
    const beadMat = new MeshBasicMaterial({ color: new Color('#eef5ff').multiplyScalar(2), toneMapped: false });
    return { mat, uniforms, curve, tube, thread, bead, beadMat };
  }, [env]);
  const bead = useRef<Group>(null);
  const beadT = useRef(0);

  useFrame(({ clock }, dt) => {
    const f = teamsFrame;
    const reduced = useExperience.getState().reducedMotion;
    const t = reduced ? 0 : clock.elapsedTime;
    const u = res.uniforms;
    u.uTime.value = t;
    u.uSil.value = smoothstep(0.05, 0.3, f.reveal);
    u.uLit.value = smoothstep(0.25, 0.7, f.reveal);
    u.uDim.value = 1 - 0.998 * smoothstep(0.25, 0.9, f.focus);
    u.uWave.value = 1 + Math.min(3, Math.abs(f.cVel) * 2.2);
    // Turns a little with the orbit (counter to it, for parallax) and drifts.
    if (group.current) {
      group.current.visible = f.reveal > 0.001;
      group.current.rotation.y = -Math.max(0, f.c) * 0.035 + Math.sin(t * 0.05) * 0.015;
    }
    // The thread draws itself in on arrival; a bead of light runs down it.
    const drawn = smoothstep(0.24, 0.92, f.reveal);
    res.tube.setDrawRange(0, Math.floor(drawn * 1600) * 30);
    res.thread.opacity = 0.55 * (1 - 0.99 * f.focus);
    if (!reduced) beadT.current = (beadT.current + dt * 0.018) % 1;
    if (bead.current) {
      bead.current.visible = drawn > 0.99 && f.focus < 0.5;
      res.curve.getPointAt(beadT.current, bead.current.position);
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
