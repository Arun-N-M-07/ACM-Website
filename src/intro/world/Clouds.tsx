'use client';
/**
 * The cloud the camera rises into.
 *
 * A layer of cloud lies over the campus (its base a little above where the
 * camera is still looking down at the building). As the camera climbs into
 * it, masses of cloud slide in between the lens and the ground — the campus
 * softens, loses contrast and is gone — and inside, the camera is surrounded:
 * bright above, greyer below, drifting past. Diving out of the bottom, the
 * same masses go by overhead and the light goes with them.
 *
 * Each mass is a soft, lit billboard (noise-shaped, brighter on its sunward
 * top, greyer underneath), sorted back to front every frame so their soft
 * edges layer correctly, and faded as the camera passes through them — there
 * is no plane to meet. The scene's fog does the rest (look.ts: white, dense).
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, DynamicDrawUsage, InstancedBufferAttribute, type InstancedMesh, Object3D, PlaneGeometry, ShaderMaterial, Vector3 } from 'three';
import { useExperience } from '@/store/experience';
import { useDisposable } from '@/systems/performance/useDisposable';
import { look } from '../look';
import { introFrame } from '../state';
import { T } from '../timeline';
import { hash, noiseTexture } from './noise';

/** The cloud layer's base and top (m). */
export const CLOUD_BASE = 104;
export const CLOUD_TOP = 222;

interface Mass {
  p: Vector3;
  size: number;
  seed: number;
}

function makeMasses(count: number): Mass[] {
  const out: Mass[] = [];
  for (let i = 0; i < count; i++) {
    // Concentrated around the path (x ≈ 0, z 110–200), thinning outward.
    const r = Math.pow(hash(i, 1), 0.7);
    const a = hash(i, 2) * Math.PI * 2;
    const x = Math.cos(a) * r * 190;
    const z = 150 + Math.sin(a) * r * 150;
    const y = CLOUD_BASE + 8 + Math.pow(hash(i, 3), 1.2) * (CLOUD_TOP - CLOUD_BASE - 20);
    out.push({ p: new Vector3(x, y, z), size: 36 + hash(i, 4) * 64, seed: hash(i, 5) * 100 });
  }
  return out;
}

export function Clouds() {
  const quality = useExperience((s) => s.quality);
  const count = quality === 'high' ? 150 : quality === 'medium' ? 100 : 60;
  const mesh = useRef<InstancedMesh>(null);
  const masses = useMemo(() => makeMasses(count), [count]);

  const res = useDisposable(() => {
    const geo = new PlaneGeometry(1, 1);
    const seeds = new InstancedBufferAttribute(new Float32Array(count * 2), 2);
    seeds.setUsage(DynamicDrawUsage);
    geo.setAttribute('aMass', seeds);
    const mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      uniforms: {
        uNoise: { value: noiseTexture(quality === 'low' ? 128 : 256) },
        uTime: { value: 0 },
        uAmount: { value: 0 },
        uLit: { value: new Color('#ffffff') },
        uShade: { value: new Color('#9aa3ab') },
        uFog: { value: new Color() },
        uFogDensity: { value: 0.02 },
      },
      vertexShader: /* glsl */ `
        attribute vec2 aMass;  // size, seed
        varying vec2 vUv;
        varying float vSeed;
        varying float vDist;
        varying float vHeight;
        void main() {
          vUv = uv;
          vSeed = aMass.y;
          vec4 c = viewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          vDist = -c.z;
          vec3 world = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          vHeight = clamp((world.y - ${CLOUD_BASE.toFixed(1)}) / ${(CLOUD_TOP - CLOUD_BASE).toFixed(1)}, 0.0, 1.0);
          c.xy += position.xy * aMass.x;
          gl_Position = projectionMatrix * c;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uNoise;
        uniform float uTime, uAmount, uFogDensity;
        uniform vec3 uLit, uShade, uFog;
        varying vec2 vUv;
        varying float vSeed, vDist, vHeight;
        void main() {
          vec2 q = vUv - 0.5;
          float r = length(q) * 2.0;
          vec2 p = vUv * 1.3 + vec2(vSeed, vSeed * 0.37);
          float a = texture2D(uNoise, p + vec2(uTime * 0.004, 0.0)).r;
          float b = texture2D(uNoise, p * 2.2 - vec2(0.0, uTime * 0.006)).g;
          float n = a * 0.65 + b * 0.45;
          float body = smoothstep(1.0, 0.18, r + (0.5 - n) * 0.85);
          // You pass through, never meet a surface: masses fade as they come close.
          float near = smoothstep(4.0, 26.0, vDist);
          float alpha = body * near * uAmount;
          if (alpha < 0.004) discard;
          // Lit from above: bright tops, greyer undersides, and light inside the billows.
          // Volume: a sunlit crown, a shadowed belly, light caught in the billows.
          float top = clamp(0.5 - q.y * 1.7 + (n - 0.5) * 0.9, 0.0, 1.0);
          float lit = smoothstep(0.15, 0.95, top) * (0.55 + 0.45 * vHeight);
          vec3 col = mix(uShade, uLit, lit);
          col *= 0.9 + 0.2 * smoothstep(0.35, 0.75, n);
          // Far masses dissolve into the air around them.
          float haze = 1.0 - exp(-uFogDensity * uFogDensity * vDist * vDist * 0.35);
          col = mix(col, uFog, haze);
          gl_FragColor = vec4(col, alpha * 0.96);
        }`,
    });
    return { geo, mat, seeds };
  }, [count, quality]);

  const dummy = useMemo(() => new Object3D(), []);
  const order = useMemo(() => masses.map((_, i) => i), [masses]);
  const tmp = useMemo(() => new Vector3(), []);

  useFrame(({ camera, clock }) => {
    const m = mesh.current;
    if (!m) return;
    const t = introFrame.t;
    // Around the cloud only (and hidden once the dark has taken over).
    const on = introFrame.active && t > T.cloudIn - 4 && t < T.tunnel + 0.5;
    m.visible = on;
    if (!on) return;
    // Back to front, so soft edges layer properly.
    const cp = camera.position;
    order.sort((i, j) => tmp.copy(masses[j].p).distanceToSquared(cp) - tmp.copy(masses[i].p).distanceToSquared(cp));
    order.forEach((k, i) => {
      const s = masses[k];
      dummy.position.copy(s.p);
      // A slow drift across the layer.
      dummy.position.x += Math.sin(clock.elapsedTime * 0.02 + s.seed) * 6;
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      res.seeds.setXY(i, s.size, s.seed);
    });
    m.instanceMatrix.needsUpdate = true;
    res.seeds.needsUpdate = true;
    const u = res.mat.uniforms;
    u.uTime.value = clock.elapsedTime;
    // Present from just before the camera reaches the layer; darkening as it dives out below.
    u.uAmount.value = Math.min(1, Math.max(0, (t - (T.cloudIn - 2.5)) / 2)) * (1 - look.dark);
    const dim = 1 - Math.min(1, Math.max(0, (t - T.descent) / 2.2)) * 0.75;
    (u.uLit.value as Color).setScalar(1.0 * dim).lerp(look.sun.color, 0.08);
    (u.uShade.value as Color).set('#7e8892').multiplyScalar(0.55 + 0.45 * dim);
    (u.uFog.value as Color).copy(look.fogColor);
    u.uFogDensity.value = look.fogDensity;
  });

  return <instancedMesh ref={mesh} args={[res.geo, res.mat, count]} frustumCulled={false} renderOrder={7} />;
}
