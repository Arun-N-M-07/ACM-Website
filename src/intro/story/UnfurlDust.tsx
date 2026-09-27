'use client';
/**
 * The snap of a sheet unfurling: as it pulls flat (flight.ts's SNAP), the air
 * it pushes shakes a little fine dust and fibre off its leading edge — flung
 * out, slowing, sinking, catching the light, gone into the air. (The ash's
 * counterpart: a sheet leaves as dust, and arrives shedding a little.)
 *
 * Stateless, in the sheet's own frame: every mote is a function of the beat,
 * so it scrubs and plays backwards with the scroll.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { BufferAttribute, BufferGeometry, Color, type PerspectiveCamera, type Points, ShaderMaterial, Vector2 } from 'three';
import { useDisposable } from '@/systems/performance/useDisposable';
import { look } from '../look';
import { introFrame } from '../state';
import { SNAP } from './flight';
import type { Fragment } from './fragments';

const COUNT = 80;
/** How long the dust lives (beats). */
export const DUST_LIFE = 1.8;

export function UnfurlDust({ fragment }: { fragment: Fragment }) {
  const ref = useRef<Points>(null);
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const f = fragment;
  const snapAt = f.arrive[0] + SNAP * (f.arrive[1] - f.arrive[0]);

  const res = useDisposable(() => {
    const geo = new BufferGeometry();
    const seeds = new Float32Array(COUNT * 4);
    for (let i = 0; i < COUNT; i++)
      for (let k = 0; k < 4; k++) {
        const v = Math.sin((i + 1) * (91.345 + k * 17.7) + f.seed * 5.3) * 43758.5453;
        seeds[i * 4 + k] = v - Math.floor(v);
      }
    geo.setAttribute('position', new BufferAttribute(new Float32Array(COUNT * 3), 3));
    geo.setAttribute('aSeed', new BufferAttribute(seeds, 4));
    const mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uK: { value: -1 },
        uDir: { value: -f.side },
        uSize: { value: new Vector2(f.size[0], f.size[1]) },
        uScale: { value: 800 },
        uColor: { value: new Color() },
        uFog: { value: new Color() },
      },
      vertexShader: /* glsl */ `
        attribute vec4 aSeed;
        uniform float uK, uDir, uScale;
        uniform vec2 uSize;
        varying float vA, vSpark;
        void main() {
          float k = uK;
          if (k <= 0.0 || k >= 1.0) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            gl_PointSize = 0.0;
            vA = 0.0;
            return;
          }
          // Shaken off the leading edge (the last of it to open)…
          vec3 p = vec3(uDir * uSize.x * (0.4 + 0.1 * aSeed.x), (aSeed.y - 0.5) * uSize.y * 0.92, 0.0);
          // …flung on, and out towards you, by the snap; the air slows it; it sinks.
          vec3 v = vec3(uDir * (0.3 + 0.55 * aSeed.z), (aSeed.w - 0.5) * 0.4 + 0.05, 0.12 + 0.45 * aSeed.x);
          float go = (1.0 - exp(-4.5 * k)) / (1.0 - exp(-4.5));
          p += v * go * 0.85;
          p.y -= 0.07 * k * k;
          p.x += sin(k * 5.0 + aSeed.y * 6.283) * 0.03 * k;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float s = mix(0.005, 0.016, aSeed.z * aSeed.z);
          gl_PointSize = max(1.0, s * uScale / max(0.05, -mv.z));
          vA = smoothstep(0.0, 0.05, k) * pow(1.0 - k, 1.6) * (0.35 + 0.65 * aSeed.w);
          // A few are fibres that catch the light as they turn.
          vSpark = step(0.8, aSeed.x) * (0.5 + 0.5 * sin(k * 30.0 + aSeed.w * 6.283));
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor, uFog;
        varying float vA, vSpark;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float a = exp(-dot(c, c) * 14.0) * vA;
          if (a < 0.004) discard;
          vec3 col = mix(uFog, uColor, 0.75) * (1.0 + 0.9 * vSpark);
          gl_FragColor = vec4(col, a);
        }`,
    });
    return { geo, mat };
  }, [f]);

  useFrame(({ camera }) => {
    const u = res.mat.uniforms;
    const k = (introFrame.t - snapAt) / DUST_LIFE;
    u.uK.value = k;
    if (ref.current) ref.current.visible = k > 0 && k < 1;
    if (k <= 0 || k >= 1) return;
    const cam = camera as PerspectiveCamera;
    u.uScale.value = (size.height * gl.getPixelRatio()) / (2 * Math.tan((cam.fov * Math.PI) / 360));
    // Paper dust in whatever light there is (it reads against the smog and the dark).
    (u.uColor.value as Color).set('#eadcbd').multiplyScalar(0.55 + 0.25 * Math.min(1, look.sun.intensity / 2.2));
    (u.uFog.value as Color).copy(look.fogColor);
  });

  // (After the sheet and its ash, which are drawn after the smog.)
  return <points ref={ref} geometry={res.geo} material={res.mat} frustumCulled={false} renderOrder={33} visible={false} />;
}
