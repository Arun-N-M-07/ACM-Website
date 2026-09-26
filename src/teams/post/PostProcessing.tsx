'use client';
/**
 * PostProcessing for the portal and the Teams world.
 *
 * Only active where it's needed — standing before the portal, travelling, and
 * inside the Teams world. Everywhere else the canvas renders directly (R3F's
 * own loop), exactly as before.
 *
 * Built from three's own passes (no new dependency):
 *   RenderPass → UnrealBloomPass (not on low tier) → OutputPass (tone mapping
 *   + sRGB) → [FXAA when the pixel ratio is low] → FinalPass
 *
 * FinalPass is one fullscreen draw doing only what earns its place:
 *   uWarp        radial zoom blur towards uCenter (hold at 1.75 s, travel)
 *   uAberration  chromatic aberration, weighted to the edges (travel, a
 *                faint lens character inside the world)
 *   uFlash       bloom-out to warm white (hides the crossing)
 *   uDark        fade to black (the arrival starts from darkness)
 *   uBarrel      lens surge as the camera dives into a card
 *   uDim/uRect   with a domain open, everything but its card sinks to a deep
 *                blue-green with faint scanlines (the reference's detail room)
 * (Grain and the base vignette stay in the DOM overlay, as for the rest of
 * the site.)
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { HalfFloatType, Vector2, Vector4, WebGLRenderTarget } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { PORTAL_DWELL, segmentProgress } from '@/config/timeline';
import { useExperience } from '@/store/experience';
import { smoothstep } from '@/systems/camera/pose';
import { progress } from '@/systems/scroll/progress';
import { teams, teamsFrame } from '../state';

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uWarp: { value: 0 },
    uAberration: { value: 0 },
    uFlash: { value: 0 },
    uDark: { value: 0 },
    uCenter: { value: new Vector2(0.5, 0.5) },
    uBarrel: { value: 0 },
    uDim: { value: 0 },
    uRect: { value: new Vector4(0, 0, 1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uWarp;
    uniform float uAberration;
    uniform float uFlash;
    uniform float uDark;
    uniform vec2 uCenter;
    uniform float uBarrel;
    uniform float uDim;
    uniform vec4 uRect;
    varying vec2 vUv;
    void main() {
      // Lens surge: magnify towards the middle, pulling the edges in.
      vec2 uv = vUv;
      if (uBarrel > 0.001) {
        vec2 dc = uv - 0.5;
        float r2 = dot(dc, dc);
        uv = 0.5 + dc * (1.0 - uBarrel * (0.55 - r2 * 1.1));
      }
      vec2 dir = uv - uCenter;
      float edge = dot(dir, dir) * 2.4;
      vec2 ca = dir * uAberration * 0.03 * (0.25 + edge);
      vec3 col = vec3(0.0);
      if (uWarp < 0.002) {
        col = vec3(texture2D(tDiffuse, uv + ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - ca).b);
      } else {
        const int N = 12;
        float span = uWarp * 0.16;
        for (int i = 0; i < N; i++) {
          float s = 1.0 - span * float(i) / float(N - 1);
          vec2 p = uCenter + dir * s;
          col.r += texture2D(tDiffuse, p + ca).r;
          col.g += texture2D(tDiffuse, p).g;
          col.b += texture2D(tDiffuse, p - ca).b;
        }
        col /= float(N);
      }
      if (uDim > 0.001) {
        // Everything outside the open card sinks into a deep blue-green room.
        vec2 q = vUv;
        float inCard = smoothstep(0.0, 0.012, min(min(q.x - uRect.x, uRect.z - q.x), min(q.y - uRect.y, uRect.w - q.y)));
        float k = uDim * (1.0 - inCard);
        vec3 room = col * vec3(0.26, 0.36, 0.38) + vec3(0.006, 0.014, 0.016);
        float scan = 0.5 + 0.5 * sin(gl_FragCoord.y * 1.35);
        room *= 1.0 - 0.18 * scan;
        col = mix(col, room, k);
      }
      col = 1.0 - (1.0 - col) * (1.0 - uFlash * vec3(0.98, 0.95, 0.93));
      col *= 1.0 - uDark;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

function Composer() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const quality = useExperience((s) => s.quality);
  const dpr = gl.getPixelRatio();

  const res = useMemo(() => {
    const target = new WebGLRenderTarget(2, 2, { type: HalfFloatType });
    const composer = new EffectComposer(gl, target);
    const render = new RenderPass(scene, camera);
    composer.addPass(render);
    const bloom = quality === 'low' ? null : new UnrealBloomPass(new Vector2(256, 256), 0.4, 0.55, 1.05);
    if (bloom) composer.addPass(bloom);
    composer.addPass(new OutputPass());
    const fxaa = dpr < 1.5 ? new ShaderPass(FXAAShader) : null;
    if (fxaa) composer.addPass(fxaa);
    const final = new ShaderPass(FinalShader);
    composer.addPass(final);
    return { composer, target, bloom, fxaa, final };
  }, [gl, scene, camera, quality, dpr]);

  useEffect(() => {
    res.composer.setPixelRatio(dpr);
    res.composer.setSize(size.width, size.height);
    if (res.fxaa) (res.fxaa.material.uniforms.resolution.value as Vector2).set(1 / (size.width * dpr), 1 / (size.height * dpr));
  }, [res, size.width, size.height, dpr]);

  useEffect(
    () => () => {
      res.composer.dispose();
      res.target.dispose();
      res.bloom?.dispose();
    },
    [res],
  );

  const blend = useRef(0);
  useFrame((_, dt) => {
    const f = teamsFrame;
    const tr = f.travel;
    const h = f.hold;
    const st = teams().state;
    const travelling = st === 'portalEntering' || st === 'portalExiting';
    // Ramp in from nothing when the composer takes over (no pop).
    blend.current = Math.min(1, blend.current + dt * 1.5);
    const u = res.final.material.uniforms;
    const holdWarp = 0.4 * smoothstep(0.82, 1, h);
    const orbitWarp = f.inside ? 0.05 * Math.min(1, Math.abs(f.cVel)) : 0;
    u.uWarp.value = Math.max(travelling ? tr.warp : 0, holdWarp, orbitWarp);
    u.uAberration.value = Math.max(travelling ? tr.aberration : 0, 0.55 * smoothstep(0.75, 1, h), f.inside ? 0.12 * blend.current : 0);
    u.uFlash.value = travelling ? tr.flash : 0;
    u.uDark.value = tr.dark;
    u.uBarrel.value = f.dive * 0.5;
    // The detail room: only once the card's rectangle is known on screen.
    const r = f.cardRect;
    u.uDim.value = r.visible && f.inside ? smoothstep(0.35, 1, f.focus) * 0.92 : 0;
    if (r.visible) (u.uRect.value as Vector4).set(r.x / size.width, 1 - (r.y + r.h) / size.height, (r.x + r.w) / size.width, 1 - r.y / size.height);
    if (res.bloom) {
      const target = travelling ? 0.7 : f.inside ? 0.38 : 0.12 + 0.3 * smoothstep(0.3, 1, h);
      res.bloom.strength = target * blend.current;
    }
    res.composer.render(dt);
  }, 1);

  return null;
}

/** Decide whether the composer should run (with a little hysteresis). */
export function PostProcessing() {
  const [on, setOn] = useState(false);
  const wait = useRef(0);
  useFrame((_, dt) => {
    const st = teams().state;
    const nearPortal = progress.value > 0 && segmentProgress(progress.value, 'portal') > PORTAL_DWELL * 0.5 && progress.value <= 1;
    const want = teamsFrame.inside || st === 'portalEntering' || st === 'portalExiting' || (nearPortal && useExperience.getState().segment === 'portal');
    if (want === on) {
      wait.current = 0;
      return;
    }
    wait.current += dt;
    if (want || wait.current > 0.4) {
      wait.current = 0;
      setOn(want);
    }
  });
  return on ? <Composer /> : null;
}
