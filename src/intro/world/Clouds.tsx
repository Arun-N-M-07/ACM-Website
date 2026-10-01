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
 *
 * Over the cloud, the light that wakes inside it ahead of the flight (look.gold) lights it: the
 * cloud around the light glows from within; seen against the light, a mass's thin edges pass the
 * most of it (forward scattering) and burn gold while its dense core stays in shade; and as the
 * warmth travels out through the air, the cloud it reaches is lit by it, not painted — its white
 * turns to the light's champagne. The cloud itself stays where it is: only its light changes. (The
 * light lies in a cloud of its own behind ACM–CEG, with a bank beyond it.)
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
  /** The cloud the light lies in: where it sits from the light (world/AcmCeg.tsx places the light, behind the name). */
  lantern?: Vector3;
  /** The shelf of cloud in front of the name: how far under the name's feet its middle lies (m). */
  shelf?: number;
}

/**
 * The cloud round ACM–CEG: a shelf in front of it, its top just under the name's feet — the name rises
 * from behind it, up through its top, and stands on it — the cloud the light lies in, behind the name,
 * and the bank beyond. None of it moves.
 */
function nameMasses(): Mass[] {
  const out: Mass[] = [];
  const n = 15;
  for (let i = 0; i < n; i++) {
    const size = 95 + hash(i, 71) * 45;
    out.push({
      p: new Vector3(ACM_CEG.x + (i / (n - 1) - 0.5) * 640 + (hash(i, 72) - 0.5) * 30, 0, ACM_CEG.z + 28 + hash(i, 73) * 44),
      size,
      seed: hash(i, 74) * 100,
      shelf: -(0.44 * size + 8 + hash(i, 75) * 8),
    });
  }
  // The cloud the light lies in, round it.
  for (let i = 0; i < 3; i++) {
    const lantern = new Vector3((i - 1) * 34 + (hash(i, 61) - 0.5) * 10, -8 + hash(i, 62) * 8, -hash(i, 63) * 14);
    out.push({ p: lantern.clone().add(look.gold.pos), size: 96 + hash(i, 64) * 40, seed: hash(i, 65) * 100, lantern });
  }
  // The bank behind, its tops at about the name's middle: the light lies in it, behind the dash.
  for (let i = 0; i < 9; i++) {
    const size = 150 + hash(i, 51) * 70;
    out.push({
      p: new Vector3(ACM_CEG.x + (i / 8 - 0.5) * 640 + (hash(i, 52) - 0.5) * 50, ACM_CEG.y - 4 - size * 0.36 + hash(i, 53) * 8, ACM_CEG.z - 70 - hash(i, 54) * 170),
      size,
      seed: hash(i, 55) * 100,
    });
  }
  return out;
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
  return out.concat(NAME_MASSES);
}

const NAME_MASSES = nameMasses();

export function Clouds() {
  const quality = useExperience((s) => s.quality);
  const near = quality === 'high' ? 150 : quality === 'medium' ? 100 : 60;
  const far = quality === 'high' ? 70 : quality === 'medium' ? 50 : 30;
  const mesh = useRef<InstancedMesh>(null);
  const masses = useMemo(() => makeMasses(near, far), [near, far]);
  // (As many instances as the sea had before the name's masses joined it, and room for those. The sea
  // lists more masses than that — the nearest few, sorted last, are never drawn — which is the cloud as
  // it was composed and seen.)
  const count = near + far + NAME_MASSES.length;

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
        uGoldPos: { value: new Vector3() },
        uGold: { value: new Color(0, 0, 0) },
        uGoldTint: { value: new Color(1, 1, 1) },
        uGoldReach: { value: 0 },
        uDay: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute vec2 aMass;  // size, seed
        varying vec2 vUv;
        varying float vSeed;
        varying float vDist;
        varying float vHeight;
        varying vec3 vWorld;
        void main() {
          vUv = uv;
          vSeed = aMass.y;
          vec4 c = viewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          vDist = -c.z;
          vec3 world = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          vHeight = clamp((world.y - ${CLOUD_BASE.toFixed(1)}) / ${(CLOUD_TOP - CLOUD_BASE).toFixed(1)}, 0.0, 1.0);
          c.xy += position.xy * aMass.x;
          // (Where on the mass this is, in the world: across the camera's own right and up.)
          vWorld = world + aMass.x * (position.x * vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]) + position.y * vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]));
          gl_Position = projectionMatrix * c;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uNoise;
        uniform float uTime, uAmount, uFogDensity, uGoldReach, uDay;
        uniform vec3 uLit, uShade, uFog, uGoldPos, uGold, uGoldTint;
        varying vec2 vUv;
        varying float vSeed, vDist, vHeight;
        varying vec3 vWorld;
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
          // The light inside the cloud (look.gold).
          vec3 gold = uGold;
          vec3 goldTint = uGoldTint;
          #ifdef TONE_MAPPING
            // (Straight to the screen — the low tier — the cloud's colour is shown unencoded and
            // untone-mapped: give the gold the paler hue it takes on through the film's lens, or it
            // shows deeper and more orange than it is.)
            float ga = max(uGold.r, max(uGold.g, uGold.b));
            if (ga > 0.0) gold = pow(uGold / ga, vec3(0.25)) * ga;
            goldTint = pow(uGoldTint, vec3(0.25));
          #endif
          if (uGold.r + uGold.g + uGold.b > 0.0) {
            vec3 toL = uGoldPos - vWorld;
            float d = length(toL);
            vec3 L = toL / max(d, 1e-3);
            // Seen against the light, cloud scatters it forward (Henyey–Greenstein, g = 0.6)…
            float mu = dot(normalize(vWorld - cameraPosition), L);
            float hg = 0.64 / pow(1.36 - 1.2 * mu, 1.5);
            // …and its thin edges pass the most of it; a dense core holds it back.
            float thin = exp(-2.6 * body);
            float nearL = 1.0 / (1.0 + d * d / 8100.0);
            // The warmth it has spread through the air so far: the cloud there is lit by it — the white
            // daylight giving way to it, the shade filled with it (luminous, never muddy).
            float reached = smoothstep(uGoldReach + 30.0, uGoldReach - 170.0, d);
            col *= uDay * mix(vec3(1.0), goldTint, reached * 0.5);
            // The cloud the light lies in glows from within; the cloud before it passes it through, most
            // at its thin edges; and the cloud it has reached is lit by it, its crowns the most.
            float core = exp(-d / 45.0) * (0.6 + 0.4 * body);
            col += gold * (0.8 * core + nearL * (0.3 + 0.7 * hg * thin) + reached * (0.22 + 0.3 * top) + 0.3 * reached * hg * thin);
          }
          // Far masses dissolve into the air around them.
          float haze = 1.0 - exp(-uFogDensity * uFogDensity * vDist * vDist * 0.35);
          col = mix(col, uFog, haze);
          #ifdef TONE_MAPPING
            // (Drawn straight to the screen — the low tier, no film lens — the cloud's colour is clipped
            // there, not tone-mapped. Where the gold lights it, it keeps its hue as it clips: clipped
            // channel by channel, champagne turns yellow.)
            float gk = clamp((uGold.r + uGold.g + uGold.b) * 0.6, 0.0, 1.0);
            col = mix(col, col / max(1.0, max(col.r, max(col.g, col.b))), gk);
          #endif
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
      if (s.lantern) dummy.position.copy(look.gold.pos).add(s.lantern);
      if (s.shelf !== undefined) dummy.position.y = look.nameFoot + s.shelf;
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
    (u.uGoldPos.value as Vector3).copy(look.gold.pos);
    (u.uGold.value as Color).copy(look.gold.color);
    // The light's colour at unit brightness: what the cloud's white becomes where it is lit by it.
    const g = look.gold.color;
    const gm = Math.max(g.r, g.g, g.b);
    (u.uGoldTint.value as Color).setRGB(gm > 0 ? g.r / gm : 1, gm > 0 ? g.g / gm : 1, gm > 0 ? g.b / gm : 1);
    u.uGoldReach.value = look.gold.reach;
    u.uDay.value = look.gold.day;
  });

  return <instancedMesh ref={mesh} args={[res.geo, res.mat, count]} frustumCulled={false} renderOrder={7} />;
}
