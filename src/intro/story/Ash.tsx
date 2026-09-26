'use client';
/**
 * What is left of a fragment. Each particle is a real point of the sheet: it
 * stays paper until the fire reaches it (the same burn field the sheet's
 * shader uses), then it lets go — lifted by the heat, carried by the breeze,
 * turning in eddies, left behind as the camera walks on. A few glow for a
 * moment as embers; a few are larger scraps of paper, charred at the edges;
 * all of them cool from char to grey ash and dissolve into the mist.
 *
 * Stateless: every particle's position is a function of film time, so the
 * film can be rewound through a burn and the ash flies back into the page.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { BufferAttribute, BufferGeometry, Color, type PerspectiveCamera, type Points, ShaderMaterial, Vector2, Vector3 } from 'three';
import { useDisposable } from '@/systems/performance/useDisposable';
import { look } from '../look';
import { introFrame } from '../state';
import type { Fragment } from './fragments';
import type { ParchmentArt } from './parchmentTexture';

/** Must match the sheet's shader (local = uBurn · BURN_SPAN − burnTime). */
export const BURN_SPAN = 1.28;

export function Ash({ fragment, art, speed }: { fragment: Fragment; art: ParchmentArt; speed: number }) {
  const ref = useRef<Points>(null);
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);

  const res = useDisposable(() => {
    const n = art.ash.count;
    const geo = new BufferGeometry();
    const pos = new Float32Array(n * 3);
    const seeds = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 4; k++) {
        const v = Math.sin((i + 1) * (12.9898 + k * 7.13) + fragment.seed * 3.7) * 43758.5453;
        seeds[i * 4 + k] = v - Math.floor(v);
      }
    }
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('aUv', new BufferAttribute(art.ash.uv.slice(0, n * 2), 2));
    geo.setAttribute('aBurn', new BufferAttribute(art.ash.burn.slice(0, n), 1));
    geo.setAttribute('aSeed', new BufferAttribute(seeds, 4));
    geo.boundingSphere = null;
    const mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      uniforms: {
        uT: { value: 0 },
        uB0: { value: fragment.burn[0] },
        uB1: { value: fragment.burn[1] },
        uSize: { value: new Vector2(fragment.size[0], fragment.size[1]) },
        uCamSpeed: { value: speed },
        uWind: { value: new Vector3(0.22, 0, 0) },
        uScale: { value: 800 },
        uFog: { value: new Color() },
      },
      vertexShader: /* glsl */ `
        attribute vec2 aUv;
        attribute float aBurn;
        attribute vec4 aSeed;
        uniform float uT, uB0, uB1, uCamSpeed, uScale;
        uniform vec2 uSize;
        uniform vec3 uWind;
        varying float vLife, vKind, vEmber, vSpin;
        void main() {
          float tDetach = uB0 + (aBurn / ${BURN_SPAN.toFixed(2)}) * (uB1 - uB0);
          float age = uT - tDetach;
          float life = mix(2.4, 4.4, aSeed.y);
          vKind = step(0.9, aSeed.x);
          if (age < 0.0 || age > life) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            gl_PointSize = 0.0;
            vLife = 1.0;
            return;
          }
          vec3 p = vec3((aUv - 0.5) * uSize, 0.0);
          // Heat lifts it; the breeze carries it; eddies turn it; the camera walks on.
          float lift = (0.14 * age + 0.06 * age * age) * (0.55 + 0.9 * aSeed.z) * (vKind > 0.5 ? 0.6 : 1.0);
          p.y += lift;
          p.x += uWind.x * age * (0.4 + aSeed.w) + sin(age * (1.1 + aSeed.z * 2.2) + aSeed.x * 6.283) * 0.1 * age;
          p.z += uCamSpeed * 0.7 * age + sin(age * (1.6 + aSeed.w) + aSeed.y * 6.283) * 0.09 * age;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float s = mix(0.0045, 0.016, aSeed.z * aSeed.z) * (vKind > 0.5 ? 2.6 : 1.0);
          gl_PointSize = max(1.0, s * uScale / max(0.05, -mv.z));
          vLife = age / life;
          vEmber = (1.0 - smoothstep(0.0, 0.3 + 0.3 * aSeed.x, age)) * step(0.58, aSeed.w);
          vSpin = aSeed.w * 6.283 + age * (1.0 + aSeed.x * 3.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uFog;
        varying float vLife, vKind, vEmber, vSpin;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float cs = cos(vSpin), sn = sin(vSpin);
          c = vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs);
          // An irregular flake, a torn scrap for paper.
          float a = atan(c.y, c.x);
          float r = length(c * vec2(1.0, vKind > 0.5 ? 1.7 : 1.3));
          float edge = 0.42 + 0.07 * sin(a * 5.0 + vSpin) + 0.04 * sin(a * 11.0);
          float shape = 1.0 - smoothstep(edge - 0.08, edge, r);
          if (shape < 0.02) discard;
          vec3 charC = vec3(0.075, 0.062, 0.052);
          vec3 ashC = vec3(0.4, 0.385, 0.37);
          vec3 col = mix(charC, ashC, smoothstep(0.08, 0.75, vLife));
          if (vKind > 0.5) {
            vec3 paperC = vec3(0.6, 0.5, 0.36);
            col = mix(paperC, charC, clamp(smoothstep(0.0, 0.6, vLife) + smoothstep(0.22, 0.4, r), 0.0, 1.0));
          }
          // Cooling into the air.
          col = mix(col, uFog, smoothstep(0.25, 1.0, vLife) * 0.9);
          col += vec3(1.0, 0.4, 0.1) * 3.2 * vEmber;
          float alpha = shape * (1.0 - smoothstep(0.5, 1.0, vLife));
          gl_FragColor = vec4(col, alpha * 0.92);
        }`,
    });
    return { geo, mat };
  }, [art, fragment]);

  const fovScale = useMemo(() => ({ v: 800 }), []);
  useFrame(({ camera }) => {
    const u = res.mat.uniforms;
    u.uT.value = introFrame.t;
    (u.uFog.value as Color).copy(look.fogColor);
    const cam = camera as PerspectiveCamera;
    fovScale.v = (size.height * gl.getPixelRatio()) / (2 * Math.tan((cam.fov * Math.PI) / 360));
    u.uScale.value = fovScale.v;
    if (ref.current) ref.current.visible = introFrame.t >= fragment.burn[0] - 0.1 && introFrame.t <= fragment.burn[1] + 4.6;
  });

  return <points ref={ref} geometry={res.geo} material={res.mat} frustumCulled={false} renderOrder={6} />;
}
