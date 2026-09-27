'use client';
/**
 * The prologue's air: the mist lying on the road, the purple gas the canister
 * releases, and the words the gas becomes — one volume, ray-marched.
 *
 *   mist      a low layer hugging the road; the rolling canister leaves a
 *             wake in it (thinned, stirred) that slowly fills back in
 *   release   two jets out of the canister's ends, along the ground; then a
 *             billow that spreads outward (its noise carried outward with
 *             it, so it rolls rather than grows), drifts down the road and
 *             rises; the mist is pushed aside ahead of it, piled up in a rim
 *   words     a slab of air where the gas is DENSER in the shape of the
 *             chapter's years (gasFields: letterField) — eroded and warped
 *             by the same noise as the rest of the gas, each word at its own
 *             depth, the slab's thickness varying, the gas around drawn thin
 *             into it. It condenses word by word, is readable for a moment,
 *             then loosens, rises and thins back into the gas. Nothing here
 *             is text, a mesh or particles: only density, and light.
 *   light     the road lamp behind: the gas is lit from behind (forward
 *             scattering — bright edges where it is thin, deep violet where
 *             it is dense), self-shadowed one step towards the lamp, with a
 *             little sky from above; the film's mist between you and it.
 *
 * Everything structural is a function of the beat (layout.ts), so it scrubs
 * and reverses exactly; only a slow drift in the noise runs on its own time
 * (the air is alive when the scroll stops), and less with reduced motion.
 *
 * Cost: rendered into a reduced-resolution target (the gas is soft; the
 * words' edges are gradients) and composited over the scene, only while the
 * prologue is on screen. Three segments per ray — before, through and after
 * the words' slab — so the slab gets fine steps and the rest coarse ones.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  BackSide,
  BoxGeometry,
  Color,
  CustomBlending,
  HalfFloatType,
  Mesh,
  OneFactor,
  OneMinusSrcAlphaFactor,
  PlaneGeometry,
  type PerspectiveCamera,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
} from 'three';
import { useExperience } from '@/store/experience';
import { useDisposable } from '@/systems/performance/useDisposable';
import { look } from '../look';
import { introFrame } from '../state';
import { T } from '../timeline';
import { letterField, noise3D } from './gasFields';
import { CAM_Z, CAN, dissolveAt, formAt, gasAmount, gasRadius, GROUND_Y, LETTERS, prologueOn, PX, ROLL_AXLE, ROLL_FROM, rollAt, type RollState, WORDS } from './layout';
import { LAMP, LAMP2 } from './RoadLamp';

const BOX_MIN = new Vector3(PX - 6, GROUND_Y - 0.05, 148);
const BOX_MAX = new Vector3(PX + 6, GROUND_Y + 3.8, CAM_Z + 2.4);

const VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
precision highp float;
precision highp sampler3D;
uniform sampler3D uNoise;
uniform sampler2D uLetters;
uniform vec3 uBoxMin, uBoxMax;
uniform float uTime, uGround;
uniform vec3 uCan, uAxle;
uniform float uCanL, uRel, uRadius, uAmount, uDrift;
uniform float uForm, uDissolve;
uniform vec3 uLetC;
uniform vec2 uLetSize;
uniform float uSlabZ, uSlabHalf;
uniform vec3 uFrom, uRollPos;
uniform float uWake;
uniform vec3 uLamp, uLampCol, uLamp2, uLamp2Col, uSky, uFogCol, uGasDeep, uGasLit, uMistCol;
uniform float uMistD;
uniform int uStepsA, uStepsB, uStepsC, uShadows;
uniform int uDebug;
varying vec3 vWorld;

float nz(vec3 p) { return texture(uNoise, p).r; }

vec2 hitBox(vec3 ro, vec3 rd, vec3 bmin, vec3 bmax) {
  vec3 inv = 1.0 / rd;
  vec3 t0 = (bmin - ro) * inv;
  vec3 t1 = (bmax - ro) * inv;
  vec3 tn = min(t0, t1);
  vec3 tf = max(t0, t1);
  return vec2(max(max(max(tn.x, tn.y), tn.z), 0.0), min(min(tf.x, tf.y), tf.z));
}

// The air at p: x the mist, y the smoke, z the smoke that has become words.
// 'cheap' is the shadow version: the large forms only.
vec3 fieldL(vec3 p, bool cheap, bool coarse) {
  float h = p.y - uGround;
  float mist = 0.0;
  if (!cheap) {
    // ── the mist on the road
    float nf = nz(vec3(p.x * 0.07 + uTime * 0.004, h * 0.18, p.z * 0.07 - uTime * 0.003));
    mist = 0.075 * exp(-h / 0.6) * (0.3 + 1.2 * nf);
    // the wake the canister leaves in it, filling back in behind
    vec2 a = uFrom.xz;
    vec2 ab = uRollPos.xz - a;
    float L = max(length(ab), 1e-3);
    vec2 dir = ab / L;
    float along = clamp(dot(p.xz - a, dir), 0.0, L);
    float across = length(p.xz - (a + dir * along));
    mist *= 1.0 - 0.8 * exp(-across * across / 0.12) * exp(-(L - along) / 2.4) * (1.0 - smoothstep(0.1, 0.5, h)) * uWake;
  }
  vec2 gc = uCan.xz + vec2(0.0, -uDrift);
  // (It spreads down the road more than back towards the lens.)
  vec2 rv = p.xz - gc;
  rv.y *= rv.y > 0.0 ? 1.45 : 0.85;
  float r = length(rv);
  if (!cheap) {
    // the mist is pushed aside by the smoke, and piled up in a rim ahead of it
    mist *= 1.0 - 0.9 * (1.0 - smoothstep(uRadius * 0.5, uRadius * 0.95, r)) * uAmount;
    mist += 0.1 * exp(-pow((r - uRadius) / 0.5, 2.0)) * exp(-h / 0.7) * uAmount * exp(-uRel / 5.0);
  }

  float smoke = 0.0;
  float word = 0.0;
  if (uAmount > 0.002) {
    vec3 c = vec3(gc.x, uGround, gc.y);
    vec3 rel = p - c;
    float dist = length(rel) + 1e-3;
    // Noise carried outward and up with the smoke: it rolls, it does not just grow.
    vec3 q = p - rel / dist * uRel * 0.22 - vec3(0.0, uRel * 0.07 + uTime * 0.012, -uTime * 0.008);
    // Billows at the scale of real smoke — masses, billows, and the small curling lobes on
    // them (0.1–0.3 m) — so light and shadow break across every one of them.
    float nb = nz(q * 0.3);
    float nd = coarse ? 0.5 : nz(q * 0.8 + 0.31);
    float nl = coarse ? 0.5 : nz(q * 2.4 + vec3(0.57, uTime * 0.01, 0.0));
    float billow = nb * 0.55 + nd * 0.3 + nl * 0.15;
    // ── the mass: thick, low at first, heaping up in the middle as it spreads
    float H = 0.35 + 2.9 * (1.0 - exp(-uRel / 3.5));
    float rn = r / max(uRadius, 0.05);
    float hn = h / max(H * (1.3 - 0.5 * rn), 0.08);
    float edge = rn + (billow - 0.5) * 0.75;
    float vert = hn + (nd - 0.5) * 0.55;
    float mass = (1.0 - smoothstep(0.52, 1.0, edge)) * (1.0 - smoothstep(0.58, 1.05, vert)) * smoothstep(-0.02, 0.06, h);
    // Puffy, cauliflower edges: the lobes stand out of the mass with gaps between them.
    // The small lobes cut into the surface (a cauliflower, not a dome): thresholded where the
    // mass thins, so its skin is lobes and the crevices between them.
    float puffy = smoothstep(0.46, 0.54, nb * 0.38 + nd * 0.34 + nl * 0.28 + (mass - 0.5) * 0.45);
    smoke = mass * (0.08 + 0.92 * puffy) * (0.35 + 2.1 * billow * billow);
    // a low skirt beyond it, lying on the road
    smoke += (1.0 - smoothstep(0.85, 1.6, rn)) * (1.0 - smoothstep(0.05, 0.5, h)) * 0.05 * (0.5 + billow);
    // ── the burst: a dense core swelling out of the canister
    float rc = 0.18 + 1.4 * (1.0 - exp(-uRel / 1.2));
    vec3 cc = uCan + vec3(0.0, 0.25 * (1.0 - exp(-uRel / 2.0)), -0.35 * (1.0 - exp(-uRel / 2.0)));
    vec3 dc = (p - cc) / vec3(rc * 1.35, rc * 0.7, rc);
    smoke += exp(-dot(dc, dc) * 1.6) * (1.0 - exp(-uRel / 0.25)) * exp(-uRel / 2.2) * (1.6 + 1.4 * billow);
    // ── the first breath: jets out of both ends, low along the ground
    float jetFade = exp(-uRel / 1.4);
    if (jetFade > 0.02) {
      float reach = 2.8 * (1.0 - exp(-uRel / 0.4));
      for (int s = 0; s < 2; s++) {
        float sg = s == 0 ? 1.0 : -1.0;
        vec3 e = uCan + uAxle * sg * uCanL * 0.5;
        vec3 d = p - e;
        float al = dot(d, uAxle * sg);
        if (al > 0.0 && al < reach * 1.2) {
          vec3 perp = d - uAxle * sg * al;
          perp.y *= 1.4;
          float w = 0.06 + 0.4 * al / (reach + 0.05);
          smoke += exp(-dot(perp, perp) / (w * w)) * (1.0 - smoothstep(reach * 0.55, reach * 1.15, al)) * jetFade * (1.6 + 2.6 * nd) * 1.6;
        }
      }
    }
    smoke *= uAmount;

    // ── the words, formed of the smoke itself
    if (uForm > 0.0 && uDissolve < 1.0) {
      vec2 lp = vec2((p.x - uLetC.x) / uLetSize.x + 0.5, (p.y - uLetC.y) / uLetSize.y + 0.5);
      if (lp.x > -0.1 && lp.x < 1.1 && lp.y > -0.25 && lp.y < 1.25) {
        float w1 = cheap ? 0.5 : nz(p * 0.33 + vec3(0.0, uTime * 0.012 - uDissolve * 0.3, uTime * 0.009));
        float w2 = cheap ? 0.5 : nz(p * 0.33 + vec3(0.47, 0.19 - uDissolve * 0.3, uTime * 0.011));
        // Curling edges: strong while it condenses and as it comes apart, faint while it is read.
        float legible = smoothstep(0.75, 1.0, uForm) * (1.0 - smoothstep(0.0, 0.25, uDissolve));
        float warp = 0.008 + 0.055 * (1.0 - legible) + 0.1 * uDissolve;
        vec2 wl = lp + (vec2(w1, w2) - 0.5) * warp * 2.0 - vec2(0.0, uDissolve * 0.16);
        vec4 m = texture(uLetters, wl);
        float order = m.b;
        // Each word at its own depth; the slab thicker and thinner along the words.
        float dz = p.z - uLetC.z - mix(0.24, -0.3, order);
        float th = 0.11 + 0.22 * w1;
        float slab = 1.0 - smoothstep(th * 0.4, th, abs(dz));
        float formed = smoothstep(order, order + 0.32, uForm * 1.32 + (w2 - 0.5) * 0.28);
        float gone = smoothstep(0.0, 0.85, uDissolve * 1.25 + (w1 - 0.5) * 0.55 - (1.0 - order) * 0.1);
        float live = formed * (1.0 - gone);
        // (Torn, billowing edges: the smoke parts, it isn't cut.)
        vec2 rl = lp + (vec2(nb, nd) - 0.5) * 0.3 + (vec2(nl, nb) - 0.5) * vec2(0.06, 0.22);
        float region = smoothstep(-0.12, 0.08, rl.x) * (1.0 - smoothstep(0.92, 1.12, rl.x)) * smoothstep(-0.28, 0.06, rl.y) * (1.0 - smoothstep(0.94, 1.26, rl.y));
        // The smoke is drawn into the words: in front of them (towards the lens) it parts, around
        // them in their slab it thins; behind them it stays — the words stand against it.
        float inFront = smoothstep(-0.05, 0.35, dz) * (1.0 - smoothstep(6.5, 8.0, dz));
        float inSlab = exp(-dz * dz / 0.3);
        smoke *= 1.0 - live * region * (0.9 * inFront + 0.75 * inSlab);
        if (!cheap) {
          // Fine fraying at the scale of the strokes, drifting up with the smoke.
          float e1 = nz(p * 0.9 + vec3(uTime * 0.02, -uDissolve * 0.5, 0.0));
          float e3 = nz(vec3(p.x * 2.6, p.y * 2.0 - uTime * 0.035 - uDissolve * 0.8, p.z * 2.6));
          float body = smoothstep(0.32, 0.76, m.r + (w1 - 0.5) * 0.24 + (e1 - 0.5) * 0.26 + (e3 - 0.5) * 0.3);
          // It gathers first as loose masses, then tightens into the forms; coming apart, the reverse.
          float tight = smoothstep(0.35, 0.95, formed) * (1.0 - smoothstep(0.0, 0.6, gone));
          float lump = smoothstep(0.08, 0.55, m.g + (w2 - 0.5) * 0.35) * (0.4 + 0.8 * e1);
          float shape = mix(lump * 0.8, body, tight);
          float inner = 0.4 + 1.0 * smoothstep(0.2, 0.8, e1);
          float e2 = nz(vec3(p.x * 1.4, p.y * 0.45 - uTime * 0.02 - uDissolve * 0.6, p.z * 1.4));
          float tendril = m.g * smoothstep(0.6, 0.85, e2) * (1.0 - body);
          word = (shape * 2.6 * inner * (0.6 + 0.8 * e3) + tendril * 1.2 + m.g * 0.12) * slab * live;
          // Wisps still drift across in front of the words now and then.
          float front = smoothstep(0.15, 0.45, dz) * (1.0 - smoothstep(0.7, 1.3, dz));
          float streak = smoothstep(0.5, 0.82, nz(vec3(p.x * 0.22 - uTime * 0.015, p.y * 0.9, p.z * 0.3)));
          smoke += front * streak * 0.7 * live * region;
        } else {
          word = smoothstep(0.35, 0.7, m.r) * 2.0 * slab * live;
        }
      }
    }
  }
  return vec3(mist, smoke, word);
}

vec3 field(vec3 p, bool cheap) { return fieldL(p, cheap, false); }

// Ray–capsule (the canister: segment pa–pb, radius r); -1 if missed.
float capsule(vec3 ro, vec3 rd, vec3 pa, vec3 pb, float r) {
  vec3 ba = pb - pa;
  vec3 oa = ro - pa;
  float baba = dot(ba, ba);
  float bard = dot(ba, rd);
  float baoa = dot(ba, oa);
  float rdoa = dot(rd, oa);
  float oaoa = dot(oa, oa);
  float a = baba - bard * bard;
  float b = baba * rdoa - baoa * bard;
  float c = baba * oaoa - baoa * baoa - r * r * baba;
  float h = b * b - a * c;
  if (h >= 0.0) {
    float t = (-b - sqrt(h)) / a;
    float y = baoa + t * bard;
    if (y > 0.0 && y < baba) return t;
    vec3 oc = (y <= 0.0) ? oa : ro - pb;
    b = dot(rd, oc);
    c = dot(oc, oc) - r * r;
    h = b * b - c;
    if (h > 0.0) return -b - sqrt(h);
  }
  return -1.0;
}

float hg(float mu, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (4.0 * 3.14159 * pow(max(1.0 + g2 - 2.0 * g * mu, 1e-3), 1.5));
}

// How much light reaches p from direction L through the smoke (short steps).
float shade(vec3 p, vec3 L, int n) {
  vec3 a = fieldL(p + L * 0.08, true, false);
  float od = (a.y + a.z) * 0.1;
  if (n > 1) {
    vec3 b = fieldL(p + L * 0.32, true, false);
    od += (b.y + b.z) * 0.3;
  }
  return exp(-od * 2.0 * 1.1);
}
// (The backlight: one longer step through the big forms only.)
float shadeBack(vec3 p, vec3 L) {
  vec3 a = fieldL(p + L * 0.35, true, true);
  return exp(-(a.y + a.z) * 0.35 * 2.0 * 1.1);
}

vec3 dbg = vec3(0.0);
// Adaptive steps: fine (a few cm) inside the smoke, where its lobes and the words' edges are,
// coarse through clear air. Thick smoke ends the ray early, so the fine steps are few.
void march(vec3 ro, vec3 rd, float t0, float t1, float jitter, inout vec3 acc, inout float trans) {
  float t = t0 + 0.05 * jitter;
  float coarse = 0.3;
  for (int i = 0; i < 96; i++) {
    if (i >= uStepsA || t >= t1 || trans < 0.012) break;
    vec3 p = ro + rd * t;
    vec3 f = field(p, false);
    // Nothing solid at the lens: the air thins to nothing in the last metre.
    float nearFade = smoothstep(0.3, 1.3, t);
    float mist = f.x * nearFade;
    float smoke = (f.y + f.z) * nearFade;
    float ds = clamp(coarse / (1.0 + 14.0 * smoke), 0.035, coarse);
    ds = min(ds, t1 - t);
    float sigma = mist * 1.1 + smoke * 2.0;
    dbg += vec3(f.y, f.z, f.x) * nearFade * ds;
    if (sigma > 0.0005) {
      // The far lamp behind the smoke: its light comes through thin smoke and rims it.
      vec3 L1 = uLamp - p;
      float d1 = length(L1);
      L1 /= d1;
      float ph1 = (hg(dot(rd, L1), 0.5) * 2.6 + 0.12) / (1.0 + 0.0035 * d1 * d1);
      // (Only worth the shadow where the backlight shows: looking towards it.)
      vec3 k1 = uLampCol * ph1 * (ph1 > 0.04 ? shadeBack(p, L1) : 0.5);
      // The lamp behind the lens and the sky above light the smoke's face and the tops of its
      // lobes: one direction, shadowed at the lobes' own scale.
      vec3 L2 = uLamp2 - p;
      float d2 = length(L2);
      L2 /= d2;
      float lit = smoke > 0.02 ? shade(p, normalize(L2 + vec3(0.0, 0.8, 0.0)), uShadows) : 1.0;
      vec3 k2 = uLamp2Col * lit * (hg(dot(rd, L2), 0.2) * 1.4 + 0.3) / (1.0 + 0.006 * d2 * d2);
      vec3 amb = uSky * (0.1 + 0.9 * lit);
      vec3 gasAlb = mix(uGasDeep, uGasLit, clamp(f.z * 0.45 + 0.12, 0.0, 1.0));
      vec3 alb = (mist * uMistCol + smoke * gasAlb) / max(mist + smoke, 1e-4);
      // The lamps' warm light, scattered by violet smoke, stays violet (it absorbs the warm end).
      vec3 key = k1 + k2;
      vec3 keyOnGas = mix(key, vec3(dot(key, vec3(0.3333))) * vec3(0.92, 0.86, 1.08), smoke / max(mist + smoke, 1e-4));
      vec3 S = alb * (amb + keyOnGas);
      // The film's mist between the lens and this point.
      S = mix(S, uFogCol, (1.0 - exp(-uMistD * t)) * 0.18 * (1.0 - 0.6 * f.z / max(f.z + 0.3, 1e-3)));
      float Tr = exp(-sigma * ds);
      acc += trans * S * (1.0 - Tr);
      trans *= Tr;
    }
    t += ds;
  }
}

void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorld - ro);
  vec2 bx = hitBox(ro, rd, uBoxMin, uBoxMax);
  float t1 = bx.y;
  // The road stops the ray; so does the canister.
  if (rd.y < -1e-4) t1 = min(t1, (uGround - ro.y) / rd.y);
  float tc = capsule(ro, rd, uCan - uAxle * uCanL * 0.46, uCan + uAxle * uCanL * 0.46, 0.063);
  if (tc > 0.0) t1 = min(t1, tc);
  float t0 = bx.x;
  if (t1 <= t0) discard;
  // Interleaved-gradient jitter: an even pattern (no clumps of dots).
  float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  vec3 acc = vec3(0.0);
  float trans = 1.0;
  march(ro, rd, t0, t1, jitter, acc, trans);
  if (uDebug == 1) { gl_FragColor = vec4(dbg.x * 0.6, dbg.y * 0.6, dbg.z * 2.0, 1.0); return; }
  gl_FragColor = vec4(acc, 1.0 - trans);
}`;

const COMPOSITE_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D uGas;
varying vec2 vUv;
void main() {
  gl_FragColor = texture2D(uGas, vUv);
}`;

const roll: RollState = { s: 0, v: 0, angle: 0, x: 0, z: 0, lift: 0, tilt: 0, yaw: 0, seen: 0 };

export function GasVolume() {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const quality = useExperience((s) => s.quality);
  const reduced = useExperience((s) => s.reducedMotion);
  const composite = useRef<Mesh>(null);
  const portrait = size.width < size.height * 0.9;

  const fields = useDisposable(() => ({ noise: noise3D(quality === 'low' ? 32 : 64), letters: letterField(WORDS, portrait) }), [quality, portrait]);

  const res = useDisposable(() => {
    // The most steps a ray may take (adaptive: fine in smoke, coarse in clear air).
    const steps = quality === 'high' ? [80, 0, 0] : quality === 'medium' ? [64, 0, 0] : [44, 0, 0];
    const mat = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: BackSide,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      uniforms: {
        uNoise: { value: fields.noise },
        uLetters: { value: fields.letters.texture },
        uBoxMin: { value: BOX_MIN.clone() },
        uBoxMax: { value: BOX_MAX.clone() },
        uTime: { value: 0 },
        uGround: { value: GROUND_Y },
        uCan: { value: new Vector3() },
        uAxle: { value: new Vector3(ROLL_AXLE.x, 0, ROLL_AXLE.z) },
        uCanL: { value: CAN.length },
        uRel: { value: 0 },
        uRadius: { value: 0 },
        uAmount: { value: 0 },
        uDrift: { value: 0 },
        uForm: { value: 0 },
        uDissolve: { value: 0 },
        // (Portrait stacks the words: the slab stands a little higher, clear of the smoke lying on the road.)
        uLetC: { value: new Vector3(LETTERS.x, LETTERS.y + (portrait ? 0.45 : 0), LETTERS.z) },
        uLetSize: { value: new Vector2(fields.letters.width, fields.letters.height) },
        uSlabZ: { value: LETTERS.z },
        uSlabHalf: { value: 0.7 },
        uFrom: { value: new Vector3(ROLL_FROM.x, GROUND_Y, ROLL_FROM.z) },
        uRollPos: { value: new Vector3() },
        uWake: { value: 0 },
        uLamp: { value: new Vector3(LAMP.x - 0.8, LAMP.y - 0.1, LAMP.z) },
        uLampCol: { value: new Color() },
        uLamp2: { value: new Vector3(LAMP2.x, LAMP2.y, LAMP2.z) },
        uLamp2Col: { value: new Color() },
        uShadows: { value: quality === 'low' ? 1 : 2 },
        uSky: { value: new Color() },
        uFogCol: { value: new Color() },
        uGasDeep: { value: new Color('#8a3fd6') },
        uGasLit: { value: new Color('#c795ff') },
        uMistCol: { value: new Color() },
        uMistD: { value: 0.08 },
        uStepsA: { value: steps[0] },
        uStepsB: { value: steps[1] },
        uStepsC: { value: steps[2] },
        uDebug: { value: 0 },
      },
    });
    const box = new BoxGeometry(BOX_MAX.x - BOX_MIN.x, BOX_MAX.y - BOX_MIN.y, BOX_MAX.z - BOX_MIN.z).translate((BOX_MIN.x + BOX_MAX.x) / 2, (BOX_MIN.y + BOX_MAX.y) / 2, (BOX_MIN.z + BOX_MAX.z) / 2);
    const target = new WebGLRenderTarget(2, 2, { type: HalfFloatType, depthBuffer: false });
    const compMat = new ShaderMaterial({
      vertexShader: COMPOSITE_VERT,
      fragmentShader: COMPOSITE_FRAG,
      uniforms: { uGas: { value: target.texture } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneMinusSrcAlphaFactor,
      toneMapped: false,
    });
    return { mat, box, target, compMat, quad: new PlaneGeometry(2, 2) };
  }, [fields, quality, portrait]);

  // The gas lives in a scene of its own: rendered apart, then laid over the world.
  const volume = useMemo(() => {
    const scene = new Scene();
    const mesh = new Mesh(res.box, res.mat);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return scene;
  }, [res]);

  useEffect(() => {
    const scale = quality === 'high' ? 0.62 : quality === 'medium' ? 0.52 : 0.42;
    res.target.setSize(Math.max(2, Math.round(size.width * scale)), Math.max(2, Math.round(size.height * scale)));
  }, [res, size.width, size.height, quality]);

  useFrame(({ camera, clock }) => {
    const t = introFrame.t;
    const on = introFrame.active && prologueOn(t);
    if (composite.current) composite.current.visible = on;
    if (!on) return;
    const u = res.mat.uniforms;
    rollAt(t, roll);
    u.uTime.value = clock.elapsedTime * (reduced ? 0.2 : 1);
    u.uDebug.value = (window as unknown as { __gasDebug?: number }).__gasDebug ?? 0;
    (u.uCan.value as Vector3).set(roll.x, GROUND_Y + CAN.r, roll.z);
    (u.uRollPos.value as Vector3).set(roll.x, GROUND_Y, roll.z);
    // The wake shows while it rolls and fills back in once it rests.
    u.uWake.value = roll.seen * (1 - Math.min(1, Math.max(0, (t - T.rest) / 6)));
    const rel = Math.max(0, t - T.release);
    u.uRel.value = rel;
    u.uRadius.value = gasRadius(t);
    u.uAmount.value = gasAmount(t);
    // The gas drifts down the road, towards where the words will stand.
    // …and, loosening, drifts on down the road ahead of the camera, thinning into the mist.
    u.uDrift.value = 3.4 * (1 - Math.exp(-rel / 3)) + Math.max(0, t - T.dissolve) * 1.5;
    // Fine steps where the action is: around the canister as it vents, around the words as they form.
    const toWords = Math.min(1, Math.max(0, (t - (T.release + 2)) / (T.form - T.release - 2)));
    u.uSlabZ.value = roll.z - 0.6 + (LETTERS.z - roll.z + 0.6) * toWords;
    u.uSlabHalf.value = 1.9 - 1.2 * toWords;
    u.uForm.value = formAt(t);
    u.uDissolve.value = dissolveAt(t);
    const lamp = look.practicals;
    (u.uLampCol.value as Color).set('#ffcf94').multiplyScalar(2.0 * lamp);
    (u.uLamp2Col.value as Color).set('#ffd6a6').multiplyScalar(1.5 * lamp);
    // The misty air's own light: what lights the mist lights the gas.
    (u.uSky.value as Color).copy(look.fogColor).multiplyScalar(1.05);
    (u.uFogCol.value as Color).copy(look.fogColor);
    (u.uMistCol.value as Color).copy(look.fogColor).multiplyScalar(1.15);
    u.uMistD.value = look.mist.density;
    camera.updateMatrixWorld();
    const prev = gl.getRenderTarget();
    const clear = gl.getClearAlpha();
    gl.setRenderTarget(res.target);
    gl.setClearAlpha(0);
    gl.clear(true, false, false);
    gl.render(volume, camera as PerspectiveCamera);
    gl.setRenderTarget(prev);
    gl.setClearAlpha(clear);
  });

  return <mesh ref={composite} geometry={res.quad} material={res.compMat} frustumCulled={false} renderOrder={30} visible={false} />;
}
