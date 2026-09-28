'use client';
/**
 * The prologue's air: the mist lying on the road, the purple smog the
 * canister releases, and the words the smog becomes — one volume, ray-marched.
 *
 *   mist      a low layer hugging the road; the rolling canister leaves a
 *             wake in it that slowly fills back in
 *   release   two jets out of the canister's ends, along the ground, and a
 *             dense core swelling out of it; then the smog FLOODS the air —
 *             its front runs out along the ground past the camera and on,
 *             far beyond anything in view, and rises into a ragged ceiling
 *             metres overhead. There is no shape to see from outside: the
 *             camera is in it — dense rolls, clear pockets, wisps, light in
 *             some places and none in others. The road mist is pushed aside
 *             ahead of the front.
 *   words     a slab of air where the smog is DENSER in the shape of the
 *             chapter's years (gasFields: letterField) — eroded and warped
 *             by the same noise as the rest of the smog, each word at its
 *             own depth, the smog between them and the camera drawn thin. It
 *             condenses word by word, is readable for a while as the camera
 *             travels slowly towards it, then loosens, rises and thins back
 *             into the smog. Nothing here is text, a mesh or particles: only
 *             density, and light.
 *   after     thinner, the smog stays: the first two sheets of the story are
 *             read in it (it parts around each as it forms); then it clears.
 *   light     the road lamp behind (forward scattering: bright edges where the
 *             smog is thin), a lamp across the lawn raking its face, the misty
 *             air's own light from above; each lobe shadows itself.
 *
 * Everything structural is a function of the beat (layout.ts), so it scrubs
 * and reverses exactly; only a slow drift in the noise runs on its own time
 * (the air is alive when the scroll stops), less with reduced motion.
 *
 * The volume is a box that travels with the camera (the smog's noise is fixed
 * in the world, so it doesn't move with it), rendered at reduced resolution
 * and composited over the scene. It can't see the scene's depth, so it stops
 * its rays at what is near: the road and the canister. The story's sheets are
 * drawn over it instead (so their torn edges are exact, at full resolution —
 * never a cut-out of the smog around them), carry their own veil of the smog
 * in front of them, and the smog parts around them as they come
 * (story/paperOccluders).
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
import { activePaper } from '../story/paperOccluders';
import { CAN, dissolveAt, floodRadius, formAt, unstableAt, gasAmount, GROUND_Y, LETTERS, ROLL_AXLE, ROLL_FROM, rollAt, type RollState, smogOn, WORDS } from './layout';
import { LAMP, LAMP2 } from './RoadLamp';

/** The volume around the camera: this far to each side, and from the road to this height. */
const REACH = 13;
const TOP = GROUND_Y + 7.5;

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
uniform float uCanL, uRel, uFlood, uHeight, uAmount;
uniform float uForm, uDissolve, uUnstable;
uniform vec3 uLetC;
uniform vec2 uRegion;
uniform vec2 uLetSize;
uniform vec3 uFrom, uRollPos;
uniform float uWake;
uniform float uPaperOn, uPaperPresence;
uniform vec3 uPaperC;
uniform vec3 uLamp, uLampCol, uLamp2, uLamp2Col, uSky, uFogCol, uGasDeep, uGasLit, uMistCol;
uniform float uMistD;
uniform int uStepsA, uShadows;
uniform int uDebug;
varying vec3 vWorld;

float nz(vec3 p) { return texture(uNoise, p).r; }
// How much fine detail the smog shows where the ray is: it fades with distance (aerial
// perspective), so far lobes smaller than a step never alias into sparkle.
float gDetail = 1.0;

vec2 hitBox(vec3 ro, vec3 rd, vec3 bmin, vec3 bmax) {
  vec3 inv = 1.0 / rd;
  vec3 t0 = (bmin - ro) * inv;
  vec3 t1 = (bmax - ro) * inv;
  vec3 tn = min(t0, t1);
  vec3 tf = max(t0, t1);
  return vec2(max(max(max(tn.x, tn.y), tn.z), 0.0), min(min(tf.x, tf.y), tf.z));
}

// The air at p: x the mist, y the smog, z the smog that has become words.
// 'cheap' is the shadow version (no mist, fewer octaves); 'coarse' fewer still.
vec3 fieldL(vec3 p, bool cheap, bool coarse) {
  float h = p.y - uGround;
  vec2 dc = p.xz - uCan.xz;
  float r = length(dc);
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
    // pushed aside by the smog, and piled up ahead of its front
    mist *= 1.0 - 0.85 * (1.0 - smoothstep(uFlood * 0.7, uFlood, r)) * step(0.001, uFlood);
    mist += 0.08 * exp(-pow((r - uFlood) / 0.8, 2.0)) * exp(-h / 0.7) * step(0.001, uFlood) * exp(-uRel / 5.0);
  }

  float smog = 0.0;
  float word = 0.0;
  if (uAmount > 0.002) {
    // The smog's noise is fixed in the world; early on it is carried outward from the canister
    // (it rolls out, it doesn't just appear), and the air drifts slowly all the time.
    vec3 outward = vec3(dc.x, 0.0, dc.y) / max(r, 0.3);
    vec3 q = p - outward * min(r, uFlood) * 0.18 - vec3(uTime * 0.018, uRel * 0.05 + uTime * 0.012, -uTime * 0.03);
    float nb = nz(q * 0.2);
    float nd = coarse ? 0.5 : mix(0.5, nz(q * 0.55 + 0.31), gDetail);
    float nl = (cheap || coarse) ? 0.5 : mix(0.5, nz(q * 1.6 + vec3(0.57, 0.0, 0.13)), gDetail * gDetail);
    float billow = nb * 0.55 + nd * 0.3 + nl * 0.15;
    // ── the flood: its front, ragged, runs out past everything
    float fill = 1.0 - smoothstep(uFlood - 3.0, uFlood + 0.5, r + (nb - 0.5) * 5.0);
    // ── a ragged ceiling metres overhead; denser low
    float vert = h / max(uHeight, 0.2) + (nd - 0.5) * 0.6 + (nb - 0.5) * 0.45;
    float hp = (1.0 - smoothstep(0.5, 1.05, vert)) * (0.55 + 0.45 * exp(-h / 1.6)) * smoothstep(-0.02, 0.06, h);
    // ── dense rolls and clear pockets at every scale: whole regions thick or thin (tens of metres),
    // billows within them, and lobes and wisps on the billows
    float regionN = coarse ? 0.5 : nz(q * 0.065 + 0.71);
    float thick = 0.3 + 1.4 * smoothstep(0.32, 0.72, regionN);
    float structure = smoothstep(0.42, 0.72, billow + (nl - 0.5) * 0.3);
    smog = fill * hp * thick * (0.012 + 1.5 * structure * structure) * 0.75;
    // The volume travels with the camera; the smog in it thins to nothing before any of its faces
    // (the ceiling over the camera, the walls metres around it), so no face of it is ever seen —
    // beyond, the film's own fog carries the air on.
    vec2 toWall = min(p.xz - uBoxMin.xz, uBoxMax.xz - p.xz);
    smog *= smoothstep(0.0, 3.5, min(toWall.x, toWall.y)) * (1.0 - smoothstep(uBoxMax.y - 2.2, uBoxMax.y - 0.3, p.y));
    // ── the burst: a dense core swelling out of the canister
    float rc = 0.18 + 1.4 * (1.0 - exp(-uRel / 1.2));
    vec3 cc = uCan + vec3(0.0, 0.25 * (1.0 - exp(-uRel / 2.0)), -0.35 * (1.0 - exp(-uRel / 2.0)));
    vec3 dq = (p - cc) / vec3(rc * 1.35, rc * 0.7, rc);
    smog += exp(-dot(dq, dq) * 1.6) * (1.0 - exp(-uRel / 0.25)) * exp(-uRel / 2.2) * (1.6 + 1.4 * billow);
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
          smog += exp(-dot(perp, perp) / (w * w)) * (1.0 - smoothstep(reach * 0.55, reach * 1.15, al)) * jetFade * (1.6 + 2.6 * nd) * 1.6;
        }
      }
    }
    smog *= uAmount;
    // ── it parts around a sheet as the sheet forms in it
    if (uPaperOn > 0.5) {
      vec3 dp = p - uPaperC;
      smog *= 1.0 - 0.75 * uPaperPresence * exp(-dot(dp, dp) / 2.4);
    }

    // ── the words, formed of the smog itself
    if (uForm > 0.0 && uDissolve < 1.0) {
      vec2 lp = vec2((p.x - uLetC.x) / uLetSize.x + 0.5, (p.y - uLetC.y) / uLetSize.y + 0.5);
      // (The bounds hold the whole soft region below, its fraying included: nothing here may
      // end on a line — a hard edge in the smog reads as a box in the air.)
      if (lp.x > -0.45 && lp.x < 1.45 && lp.y > -0.75 && lp.y < 1.75) {
        float w1 = cheap ? 0.5 : nz(p * 0.33 + vec3(0.0, uTime * 0.012 - uDissolve * 0.3, uTime * 0.009));
        float w2 = cheap ? 0.5 : nz(p * 0.33 + vec3(0.47, 0.19 - uDissolve * 0.3, uTime * 0.011));
        // Curling edges: strong while it condenses and as it comes apart, faint while it is read;
        // and before it goes it grows restless — the forms waver and fray, then loosen.
        float legible = smoothstep(0.75, 1.0, uForm) * (1.0 - smoothstep(0.0, 0.25, uDissolve));
        float warp = 0.008 + 0.055 * (1.0 - legible) + 0.045 * uUnstable + 0.1 * uDissolve;
        vec2 wl = lp + (vec2(w1, w2) - 0.5) * warp * 2.0 - vec2(0.0, uDissolve * 0.16);
        vec4 m = texture(uLetters, wl);
        float order = m.b;
        // Each word at its own depth, and every stroke pushed off the plane by the smog's own
        // billows: a body of air with thickness, not a sign standing in it.
        float dz = p.z - uLetC.z - mix(0.3, -0.36, order) - (nd - 0.5) * 0.55;
        float th = 0.14 + 0.26 * w1;
        float slab = 1.0 - smoothstep(th * 0.4, th, abs(dz));
        float formed = smoothstep(order, order + 0.32, uForm * 1.32 + (w2 - 0.5) * 0.28);
        float gone = smoothstep(0.0, 0.85, uDissolve * 1.25 + (w1 - 0.5) * 0.55 - (1.0 - order) * 0.1);
        float live = formed * (1.0 - gone);
        // Where the smog gives way to the words: a soft oval, frayed by the smog's own billows.
        vec2 ov = (lp - 0.5) / uRegion;
        float region = 1.0 - smoothstep(0.62, 1.0, length(ov) + (nb - 0.5) * 0.35 + (nl - 0.5) * 0.12);
        // The smog is drawn into the words: in front of them (towards the lens) it thins, around
        // them in their slab it thins; behind them it stays — the words stand against it.
        float inFront = smoothstep(-0.05, 0.4, dz) * (1.0 - smoothstep(6.5, 9.0, dz));
        float inSlab = exp(-dz * dz / 0.3);
        smog *= 1.0 - live * region * (0.85 * inFront + 0.75 * inSlab);
        if (!cheap) {
          // Fine fraying at the scale of the strokes, drifting up with the smog.
          float e1 = nz(p * 0.9 + vec3(uTime * 0.02, -uDissolve * 0.5, 0.0));
          float e3 = nz(vec3(p.x * 2.6, p.y * 2.0 - uTime * 0.035 - uDissolve * 0.8, p.z * 2.6));
          float fray = 0.3 + 0.25 * uUnstable;
          float body = smoothstep(0.3, 0.8, m.r + (w1 - 0.5) * (0.24 + 0.16 * uUnstable) + (e1 - 0.5) * 0.26 + (e3 - 0.5) * fray);
          // It gathers first as loose masses, then tightens into the forms; coming apart, the reverse.
          float tight = smoothstep(0.35, 0.95, formed) * (1.0 - smoothstep(0.0, 0.6, gone));
          float lump = smoothstep(0.08, 0.55, m.g + (w2 - 0.5) * 0.35) * (0.4 + 0.8 * e1);
          float shape = mix(lump * 0.8, body, tight);
          // Unevenly dense, as smog is: thick in places, thin in others.
          float inner = 0.3 + 1.2 * smoothstep(0.2, 0.8, e1);
          float e2 = nz(vec3(p.x * 1.4, p.y * 0.45 - uTime * 0.02 - uDissolve * 0.6, p.z * 1.4));
          // Clear air curling through the strokes: thin winding channels where the smog's drift
          // crosses them (a contour of its own noise), more of them as it grows restless.
          float e4 = nz(vec3(p.x * 0.55 + e1 * 0.35 + uTime * 0.01, p.y * 1.3 - uTime * 0.03 - uDissolve * 0.7, p.z * 0.6) + 0.61);
          float channel = smoothstep(0.58, 0.68, e4) * (1.0 - smoothstep(0.7, 0.84, e4));
          float tendril = m.g * smoothstep(0.6, 0.85, e2) * (1.0 - body);
          word = (shape * 2.6 * inner * (0.6 + 0.8 * e3) * (1.0 - (0.45 + 0.3 * uUnstable) * channel) + tendril * 1.2 + m.g * 0.12) * slab * live;
          // Wisps still drift across in front of the words now and then.
          float front = smoothstep(0.15, 0.45, dz) * (1.0 - smoothstep(0.7, 1.3, dz));
          float streak = smoothstep(0.5, 0.82, nz(vec3(p.x * 0.22 - uTime * 0.015, p.y * 0.9, p.z * 0.3)));
          smog += front * streak * 0.6 * live * region * uAmount;
        } else {
          word = smoothstep(0.35, 0.7, m.r) * 2.0 * slab * live;
        }
      }
    }
  }
  return vec3(mist, smog, word);
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
    gDetail = 1.0 - smoothstep(9.0, 14.0, t);
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
    const steps = quality === 'high' ? 84 : quality === 'medium' ? 64 : 44;
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
        uBoxMin: { value: new Vector3() },
        uBoxMax: { value: new Vector3() },
        uTime: { value: 0 },
        uGround: { value: GROUND_Y },
        uCan: { value: new Vector3() },
        uAxle: { value: new Vector3(ROLL_AXLE.x, 0, ROLL_AXLE.z) },
        uCanL: { value: CAN.length },
        uRel: { value: 0 },
        uFlood: { value: 0 },
        uHeight: { value: 0.4 },
        uAmount: { value: 0 },
        uForm: { value: 0 },
        uDissolve: { value: 0 },
        uUnstable: { value: 0 },
        // (Portrait stacks the words: the slab stands a little higher, clear of the smoke lying on the road.)
        // (Portrait's field is tall: raised, so its second line stands clear of the road's mist.)
        uLetC: { value: new Vector3(LETTERS.x, LETTERS.y + (portrait ? 0.8 : 0), LETTERS.z) },
        uLetSize: { value: new Vector2(fields.letters.width, fields.letters.height) },
        // The soft oval the words stand in (in the field's own units): portrait's stacked second line
        // runs out to its sides, so there it is wider — or the line's ends fade into the smog.
        uRegion: { value: new Vector2(portrait ? 0.78 : 0.66, 0.9) },
        uPaperOn: { value: 0 },
        uPaperPresence: { value: 0 },
        uPaperC: { value: new Vector3() },
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
        // Deep, a little desaturated: violet smog, not neon.
        uGasDeep: { value: new Color('#643c9c') },
        uGasLit: { value: new Color('#ae90da') },
        uMistCol: { value: new Color() },
        uMistD: { value: 0.08 },
        uStepsA: { value: steps },
        uDebug: { value: 0 },
      },
    });
    // A unit box, placed around the camera each frame.
    const box = new BoxGeometry(1, 1, 1);
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
    return { scene, mesh };
  }, [res]);

  useEffect(() => {
    // The march runs at a fraction of the screen, set by a budget of pixels — what the tier spends on
    // a 1440×900 frame — rather than a fixed share of its width: at the same share a phone's narrow
    // frame left the words only a few pixels tall (the stacked second line a smudge), while drawing a
    // fraction of what a desktop does. (Never below the tier's share; never above the screen's own.)
    const share = quality === 'high' ? 0.62 : quality === 'medium' ? 0.52 : 0.42;
    const budget = 1440 * 900 * share * share;
    const scale = Math.max(share, Math.min(1, Math.sqrt(budget / Math.max(1, size.width * size.height))));
    res.target.setSize(Math.max(2, Math.round(size.width * scale)), Math.max(2, Math.round(size.height * scale)));
  }, [res, size.width, size.height, quality]);

  useFrame(({ camera, clock }) => {
    const t = introFrame.t;
    const on = introFrame.active && t < T.release - 0.5 ? t >= T.prologue - 1 : introFrame.active && smogOn(t);
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
    u.uFlood.value = floodRadius(t);
    // The ceiling rises as it floods: from the ground to metres overhead.
    u.uHeight.value = 0.4 + 4.8 * (1 - Math.exp(-rel / 3.2));
    u.uAmount.value = gasAmount(t);
    u.uForm.value = formAt(t);
    u.uDissolve.value = dissolveAt(t);
    u.uUnstable.value = unstableAt(t);
    const lamp = look.practicals;
    (u.uLampCol.value as Color).set('#ffcf94').multiplyScalar(2.0 * lamp);
    (u.uLamp2Col.value as Color).set('#ffd6a6').multiplyScalar(1.5 * lamp);
    // The misty air's own light: what lights the mist lights the gas.
    (u.uSky.value as Color).copy(look.fogColor).multiplyScalar(1.05);
    (u.uFogCol.value as Color).copy(look.fogColor);
    (u.uMistCol.value as Color).copy(look.fogColor).multiplyScalar(1.15);
    u.uMistD.value = look.mist.density;
    // The volume travels with the camera (its noise stays fixed in the world).
    camera.updateMatrixWorld();
    const c = camera.position;
    (u.uBoxMin.value as Vector3).set(c.x - REACH, GROUND_Y - 0.05, c.z - REACH);
    (u.uBoxMax.value as Vector3).set(c.x + REACH, TOP, c.z + REACH);
    volume.mesh.position.set(c.x, (GROUND_Y - 0.05 + TOP) / 2, c.z);
    volume.mesh.scale.set(REACH * 2, TOP - GROUND_Y + 0.05, REACH * 2);
    // The sheet being read, if one is near.
    const paper = activePaper();
    u.uPaperOn.value = paper ? 1 : 0;
    if (paper) {
      (u.uPaperC.value as Vector3).copy(paper.center);
      u.uPaperPresence.value = paper.presence;
    }
    const prev = gl.getRenderTarget();
    const clear = gl.getClearAlpha();
    gl.setRenderTarget(res.target);
    gl.setClearAlpha(0);
    gl.clear(true, false, false);
    gl.render(volume.scene, camera as PerspectiveCamera);
    gl.setRenderTarget(prev);
    gl.setClearAlpha(clear);
  });

  return <mesh ref={composite} geometry={res.quad} material={res.compMat} frustumCulled={false} renderOrder={30} visible={false} />;
}
