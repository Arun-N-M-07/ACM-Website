'use client';
/**
 * The cloud the drone rises through, and comes back down through.
 *
 * A layer of cloud lies high over the campus, centred on the drone's column
 * (the light-well). Rising, the camera looks down at the building as masses
 * of cloud slide in between the lens and the ground — the campus softens,
 * loses contrast and is gone — and inside, it is surrounded: bright above,
 * greyer below, drifting past; above, it is a sea of cloud tops under a
 * clear sky. Coming straight back down, the tops come up to meet it, it is
 * swallowed, and out of the base the campus is below again, the well at the
 * centre of the frame.
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
import { CAMPUS } from '@/config/world';
import { ACM_CEG } from '../camera';
import { look } from '../look';
import { introFrame } from '../state';
import { T } from '../timeline';
import { hash, noiseTexture } from './noise';

const _flash = new Color('#dfe6ff');

/** The cloud layer's base and top (m). */
export const CLOUD_BASE = 155;
export const CLOUD_TOP = 218;
/** Its centre: the drone's column. */
const CX = CAMPUS.well.x;
const CZ = CAMPUS.well.z;

interface Mass {
  p: Vector3;
  size: number;
  seed: number;
}

/**
 * The air between the flight over the cloud and ACM-CEG standing on it: the
 * cloud there stays a floor below the name (no mass rises into the line of
 * sight), so the name is seen whole, standing on the sea — not through it.
 */
const inSightLine = (x: number, z: number) => Math.abs(x - ACM_CEG.x) < 240 && z > ACM_CEG.z - 40 && z < CZ + 12;
const FLOOR_UNDER_NAME = ACM_CEG.y - 44;

function makeMasses(count: number, far: number): Mass[] {
  const out: Mass[] = [];
  // Out to the horizon: a sparse ring of big masses near the layer's top, so
  // from above the sea of cloud runs on into the haze instead of ending.
  for (let i = 0; i < far; i++) {
    const r = 300 + Math.pow(hash(i, 21), 0.8) * 900;
    const a = hash(i, 22) * Math.PI * 2;
    const y = CLOUD_TOP - 26 + hash(i, 23) * 18;
    const x = CX + Math.cos(a) * r;
    const z = CZ + Math.sin(a) * r;
    // (None of the far ring stands between the flight and the name.)
    if (inSightLine(x, z)) continue;
    out.push({ p: new Vector3(x, y, z), size: 150 + hash(i, 24) * 190, seed: hash(i, 25) * 100 });
  }
  for (let i = 0; i < count; i++) {
    // Dense around the column, a wide sea thinning outward; a few right on
    // the column so the camera passes through them both ways.
    const onColumn = i < 10;
    const r = onColumn ? 4 + hash(i, 1) * 22 : Math.pow(hash(i, 1), 0.62) * 300;
    const a = hash(i, 2) * Math.PI * 2;
    const x = CX + Math.cos(a) * r;
    const z = CZ + Math.sin(a) * r * 0.9;
    const y = CLOUD_BASE + 6 + Math.pow(hash(i, 3), 1.1) * (CLOUD_TOP - CLOUD_BASE - 12);
    const size = (onColumn ? 30 : 40) + hash(i, 4) * 70;
    // In the line of sight to the name, a mass is a floor below it, not a wall before it: it keeps
    // its size (the sea stays whole) but lies lower, its top under the name's foot.
    const py = !onColumn && inSightLine(x, z) ? Math.min(y, FLOOR_UNDER_NAME - size * 0.4) : y;
    out.push({ p: new Vector3(x, py, z), size, seed: hash(i, 5) * 100 });
  }
  // The sea carried on out to the name and past it — low and wide, so from the flight it is one
  // unbroken floor to the horizon, with the name standing on it (none of it rises into the view).
  for (let i = 0; i < 26; i++) {
    const x = ACM_CEG.x + (hash(i, 31) - 0.5) * 520;
    const z = CZ - 250 - hash(i, 32) * (CZ - 250 - (ACM_CEG.z - 260));
    const size = 140 + hash(i, 33) * 60;
    out.push({ p: new Vector3(x, FLOOR_UNDER_NAME - size * 0.42 - hash(i, 34) * 6, z), size, seed: hash(i, 35) * 100 });
  }
  return out;
}

export function Clouds() {
  const quality = useExperience((s) => s.quality);
  const near = quality === 'high' ? 150 : quality === 'medium' ? 100 : 60;
  const far = quality === 'high' ? 70 : quality === 'medium' ? 50 : 30;
  const count = near + far;
  const mesh = useRef<InstancedMesh>(null);
  const masses = useMemo(() => makeMasses(near, far), [near, far]);

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
          // (…and gone before the billboard's edge, however far the noise pushes it: a mass is never cut straight.)
          vec2 e = abs(q) * 2.0;
          body *= smoothstep(1.0, 0.82, max(e.x, e.y));
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
    // From the rise until the camera is well below it again.
    const on = introFrame.active && t > T.rise + 3 && t < T.cloudBase + 6;
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
    u.uAmount.value = Math.min(1, Math.max(0, (t - (T.rise + 3)) / 2));
    // Seen from below, the masses are their shaded bellies.
    const under = Math.min(1, Math.max(0, (CLOUD_BASE + 12 - cp.y) / 45));
    // Seen from below, the masses are their shaded bellies.
    // From above, in the open sun, the tops are bright.
    const above = Math.min(1, Math.max(0, (cp.y - CLOUD_TOP + 8) / 30));
    (u.uLit.value as Color).setScalar(1.1 - 0.2 * under + 0.4 * above).lerp(look.sun.color, 0.1 + 0.1 * above);
    (u.uShade.value as Color).set('#98a1aa').multiplyScalar(1 - 0.25 * under + 0.3 * above);
    // Lightning lights the cloud from within: cool, brief.
    (u.uLit.value as Color).lerp(_flash, Math.min(1, look.flash * 0.6)).multiplyScalar(1 + 1.4 * look.flash);
    (u.uShade.value as Color).lerp(_flash, Math.min(1, look.flash * 0.5)).multiplyScalar(1 + 1.8 * look.flash);
    (u.uFog.value as Color).copy(look.fogColor);
    u.uFogDensity.value = look.fogDensity;
  });

  return <instancedMesh ref={mesh} args={[res.geo, res.mat, count]} frustumCulled={false} renderOrder={7} />;
}
