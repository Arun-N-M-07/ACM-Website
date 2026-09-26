'use client';
/**
 * Mist that moves. The fog (look.ts, fog.ts) sets how much air there is
 * between the camera and anything; these layers give it body: banks of mist
 * standing in the garden at different depths, drifting slowly across it,
 * thinning from the ground up — so the space reads in depth, and never as a
 * flat grey sheet.
 *
 * Each bank is a large soft card turned to face the camera (about the
 * vertical only, so it stays standing), its density built from two scales of
 * noise drifting at different speeds. Banks fade as the camera comes near
 * (you never meet the plane) and follow the ground mist's amount and height,
 * so they sink and thin with it as the building is revealed; a few low veils
 * are left lying on the lawns for the hero.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, DoubleSide, InstancedBufferAttribute, InstancedMesh, Object3D, PlaneGeometry, ShaderMaterial, Vector3 } from 'three';
import { QUALITY } from '@/config/quality';
import { useExperience } from '@/store/experience';
import { useDisposable } from '@/systems/performance/useDisposable';
import { world } from '@/scenes/shared/blend';
import { look } from '../look';
import { hash, noiseTexture } from './noise';

interface Bank {
  x: number;
  z: number;
  w: number;
  h: number;
  opacity: number;
  seed: number;
}

/** Banks along and around the garden's axis, from the far end of the walk up to the forecourt. */
function makeBanks(count: number): Bank[] {
  const banks: Bank[] = [];
  for (let i = 0; i < count; i++) {
    const k = i / Math.max(1, count - 1);
    const z = 172 - k * 150 + (hash(i, 1) - 0.5) * 10;
    const side = hash(i, 2) < 0.5 ? -1 : 1;
    // Near the axis (where the camera walks) banks keep a clear lane; further
    // out they close in.
    const x = side * (8 + hash(i, 3) * 34);
    banks.push({ x, z, w: 34 + hash(i, 4) * 40, h: 9 + hash(i, 5) * 11, opacity: 0.55 + hash(i, 6) * 0.45, seed: hash(i, 7) * 100 });
  }
  // A few wide, low banks straddling the axis further ahead (these are what
  // the building comes out of).
  for (const [z, w] of [
    [70, 90],
    [46, 110],
    [26, 130],
    [96, 70],
  ] as const) banks.push({ x: 0, z, w, h: 14, opacity: 0.95, seed: z * 0.37 });
  return banks;
}

export function MistLayers() {
  const quality = useExperience((s) => s.quality);
  const count = quality === 'high' ? 26 : quality === 'medium' ? 18 : 11;
  const mesh = useRef<InstancedMesh>(null);

  const res = useDisposable(() => {
    const noise = noiseTexture(quality === 'low' ? 128 : 256);
    const geo = new PlaneGeometry(1, 1, 1, 1).translate(0, 0.5, 0);
    const mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      fog: false,
      uniforms: {
        uNoise: { value: noise },
        uTime: { value: 0 },
        uAmount: { value: 1 },
        uLift: { value: 1 },
        uColor: { value: new Color() },
        uGlow: { value: new Color() },
        uSun: { value: new Vector3(1, 0, 0) },
      },
      vertexShader: /* glsl */ `
        attribute vec4 aBank;   // w, h, opacity, seed
        uniform float uLift;
        varying vec2 vUv;
        varying float vOpacity;
        varying float vSeed;
        varying vec3 vWorld;
        void main() {
          vUv = uv;
          vOpacity = aBank.z;
          vSeed = aBank.w;
          // Stand the card at the instance's position and turn it about the
          // vertical to face the camera.
          vec3 base = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          vec3 toCam = cameraPosition - base;
          toCam.y = 0.0;
          vec3 side = normalize(vec3(toCam.z, 0.0, -toCam.x) + 1e-5);
          float h = aBank.y * uLift;
          vec3 p = base + side * position.x * aBank.x + vec3(0.0, position.y * h - 1.2, 0.0);
          vWorld = p;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uNoise;
        uniform float uTime, uAmount;
        uniform vec3 uColor, uGlow, uSun;
        varying vec2 vUv;
        varying float vOpacity;
        varying float vSeed;
        varying vec3 vWorld;
        void main() {
          vec2 uv = vUv;
          // Two scales of billow, drifting across at different speeds.
          vec2 p = vec2(uv.x * 1.6 + vSeed, uv.y * 0.55);
          float a = texture2D(uNoise, p * 0.9 + vec2(uTime * 0.006, 0.0)).r;
          float b = texture2D(uNoise, p * 2.3 + vec2(-uTime * 0.011, uTime * 0.002)).g;
          float n = smoothstep(0.28, 0.82, a * 0.65 + b * 0.45);
          // Soft sides; dense low, thinning upward.
          float sides = smoothstep(0.0, 0.28, uv.x) * smoothstep(1.0, 0.72, uv.x);
          float rise = pow(max(1.0 - uv.y, 0.0), 1.35) * smoothstep(0.0, 0.08, uv.y + 0.02);
          vec3 toFrag = vWorld - cameraPosition;
          float dist = length(toFrag);
          // You never meet the plane: banks fade out as the camera comes near.
          float near = smoothstep(7.0, 22.0, dist);
          float alpha = n * sides * rise * vOpacity * near * uAmount;
          if (alpha < 0.004) discard;
          // Lit from behind by the sun (forward scattering), a little light in the billows.
          vec3 dir = toFrag / max(dist, 1e-3);
          float toward = pow(max(dot(dir, uSun), 0.0), 4.0);
          vec3 col = mix(uColor, uGlow, toward * 0.9) * (0.92 + 0.16 * n);
          gl_FragColor = vec4(col, alpha * 0.62);
        }`,
    });
    return { noise, geo, mat };
  }, [quality]);

  const banks = useMemo(() => makeBanks(count), [count]);

  const attr = useMemo(() => {
    const a = new Float32Array(banks.length * 4);
    banks.forEach((b, i) => a.set([b.w, b.h, b.opacity, b.seed], i * 4));
    return new InstancedBufferAttribute(a, 4);
  }, [banks]);

  useMemo(() => {
    res.geo.setAttribute('aBank', attr);
  }, [res, attr]);

  const dummy = useMemo(() => new Object3D(), []);
  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    if (m.userData.placed !== banks.length) {
      banks.forEach((b, i) => {
        dummy.position.set(b.x, 0, b.z);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
      m.userData.placed = banks.length;
    }
    const u = res.mat.uniforms;
    u.uTime.value = clock.elapsedTime;
    // The banks follow the ground mist: as dense as it is, as high as it reaches.
    const amount = Math.min(1, look.mist.density / 0.06) * world.intro * (1 - look.cloud);
    u.uAmount.value = amount;
    u.uLift.value = Math.max(0.12, look.mist.height / 10);
    (u.uColor.value as Color).copy(look.fogColor);
    (u.uGlow.value as Color).copy(look.fogColor).lerp(look.sun.color, 0.35 + 0.45 * Math.min(1, Math.max(0, look.sun.intensity / 3)));
    (u.uSun.value as Vector3).copy(look.sun.dir);
    m.visible = amount > 0.004;
  });

  return <instancedMesh ref={mesh} name="intro-mist" args={[res.geo, res.mat, banks.length]} frustumCulled={false} renderOrder={4} />;
}
