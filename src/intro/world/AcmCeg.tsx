'use client';
/**
 * ACM–CEG, rising out of the cloud into a golden light.
 *
 * Out of the cloud's top the rise levels into flight over a quiet white sea of cloud. The cloud stays
 * where it is; only its light changes (look.gold): a warmth wakes inside the cloud ahead and builds,
 * white to champagne to gold, as the name comes up. The name is already there, under the cloud's top,
 * far ahead — and it rises out of it, letter by letter, A, C, M, the dash, C, E, G, each beginning while
 * the one before is still coming up, so the word emerges as one continuous motion: straight up, no lean,
 * no overshoot, easing into its place. Nothing fades: the cloud hides what is still in it — the sea of
 * cloud in front of the name, and, at the cloud's top, the cloud the letters are rising through (the
 * veil below), its edge wavering. Inside it a letter is in the cloud's shade, a violet hint; out of it,
 * it stands in the open light, and the warmth catches its edges. The camera slows into its
 * composition and holds it (camera.ts), then tilts down and drops away through the cloud.
 *
 * Everything is a function of the beat: scroll back and the letters sink back into the cloud, G first,
 * and the light goes back into it.
 *
 * The name is an object, lit by the world: a rich violet lacquer, opaque — the faces a deep royal
 * violet, the rolled edges a lighter violet, the cast sides dark — with a restrained, satin reflection.
 * The colour takes in the world's light as white; the lacquer reflects the world as it is, so the gold
 * of the air shows only where the lacquer reflects the most, at the edges. Its light is analytic (the
 * same colours the sky and the cloud are drawn with) plus the light in the cloud behind it (a point
 * light raking the sides and edges that face it). No light of its own.
 *
 * It is set in Clash Display Bold (acmWordmark.ts), the dash drawn as the E's middle arm.
 *
 * Portrait screens stack it (ACM– over CEG), so it stays huge in a narrow frame.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { BufferAttribute, type BufferGeometry, Color, ExtrudeGeometry, type Group, type Mesh, Path, type PerspectiveCamera, ShaderMaterial, Shape, Vector2, Vector3 } from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CHAPTERS } from '@/config/timeline';
import { useDisposable } from '@/systems/performance/useDisposable';
import { ACM_CEG, introCameraAt, portraitOpen } from '../camera';
import { look } from '../look';
import { introFrame } from '../state';
import { ease, ease5, introChapterAt, T } from '../timeline';
import { WORDMARK, WORDMARK_TRACKING, type WordmarkGlyph } from './acmWordmark';
import { CLOUD_TOP } from './Clouds';

/** Cap height (m), and the depth the letters are cast to. */
const CAP = 56;
const DEPTH = 0.27 * CAP;
/**
 * The polished edge: how far it rounds over and how deep, in how many steps (smooth-shaded: see
 * letterGeometry). It is cut inside the letterform, so the silhouette stays the type's own weight.
 */
const BEVEL = { thickness: 2.4, size: 2, segments: 6 };

/** How far below its place a letter starts (cap heights: down in the cloud), and the beats it rises over, one after another. */
const RISE = { depth: 1.8, stagger: 0.45, beats: 2.4 };

/** How far from ACM-CEG the camera holds it (the end of the hold, where it is nearest), and its lens there. */
const HOLD = (() => {
  const c = introCameraAt(T.acmCegHold);
  return { distance: Math.hypot(c.pos.x - ACM_CEG.x, c.pos.y - ACM_CEG.y, c.pos.z - ACM_CEG.z), fov: c.fov };
})();

/**
 * Where the light lies, from the middle of the name (its dash, m): back in the cloud behind it, and low
 * — so the brightest of the cloud it lights rises from under the name, not straight behind its letters.
 */
const LIGHT_FROM_DASH = new Vector3(0, -24, -50);

/** The chapter rail's row for the chapter the name stands in (its label is shown while the name is). */
const RAIL_ROW = CHAPTERS.findIndex((c) => c.id === introChapterAt(T.acmCeg));

/**
 * How much of the frame's width the name, centred in it, may take and still stand clear of the chapter
 * rail's type: from where the label of its chapter begins. Infinity where the rail is hidden (small
 * landscape screens); null before the rail has come up.
 */
function railShare(width: number) {
  const rail = document.querySelector('.rail');
  if (!rail) return null;
  const label = rail.querySelectorAll('li')[RAIL_ROW]?.querySelector('.label');
  const r = label?.getBoundingClientRect();
  if (!r || !r.width) return Infinity;
  const gap = Math.max(24, width * 0.02);
  return (2 * (r.left - gap - width / 2)) / width;
}

/** A glyph's ink, left and right (cap units, from its origin). */
function inkX(g: WordmarkGlyph) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const c of g.outer)
    for (let i = 0; i < c.length; i += 2) {
      lo = Math.min(lo, c[i]);
      hi = Math.max(hi, c[i]);
    }
  return [lo, hi];
}
/** …and up and down. */
function inkY(g: WordmarkGlyph) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const c of g.outer)
    for (let i = 1; i < c.length; i += 2) {
      lo = Math.min(lo, c[i]);
      hi = Math.max(hi, c[i]);
    }
  return [lo, hi];
}

/** The letters, laid out (cap units): one line, or ACM– over CEG. Each line is centred on its ink. */
function layout(portrait: boolean) {
  const lines = portrait ? [WORDMARK.slice(0, 4), WORDMARK.slice(4)] : [WORDMARK];
  const gap = 0.3;
  const out: { glyph: WordmarkGlyph; x: number; y: number }[] = [];
  lines.forEach((glyphs, li) => {
    // Kerned positions from the shaped word, re-based to the line, and tracked out.
    const xs = glyphs.map((g, i) => g.x - glyphs[0].x + i * WORDMARK_TRACKING);
    const left = xs[0] + inkX(glyphs[0])[0];
    const right = xs[xs.length - 1] + inkX(glyphs[glyphs.length - 1])[1];
    const baseline = (lines.length - 1) * (1 + gap) * 0.5 - li * (1 + gap) - 0.5;
    glyphs.forEach((g, i) => out.push({ glyph: g, x: xs[i] - (left + right) / 2, y: baseline }));
  });
  return out;
}

/**
 * One letter, cast: extruded deep, with a rounded bevel cut inside the letterform, then shaded smooth
 * where the surface curves (the round bowls, the polished edge) and crisp where it turns a corner. The
 * faces stay dead flat, as a polished face is. Each vertex keeps whether it is on a face.
 */
function letterGeometry(glyph: WordmarkGlyph, x: number, y: number) {
  const pts = (flat: number[]) => {
    const v: Vector2[] = [];
    for (let i = 0; i < flat.length; i += 2) v.push(new Vector2(flat[i] * CAP, flat[i + 1] * CAP));
    return v;
  };
  const shapes = glyph.outer.map((o) => new Shape(pts(o)));
  for (const h of glyph.holes) shapes[0].holes.push(new Path(pts(h)));
  const g = new ExtrudeGeometry(shapes, {
    depth: DEPTH,
    bevelEnabled: true,
    bevelThickness: BEVEL.thickness,
    bevelSize: BEVEL.size,
    bevelOffset: -BEVEL.size,
    bevelSegments: BEVEL.segments,
    curveSegments: 1,
  });
  const p = g.getAttribute('position');
  const face = new Float32Array(p.count);
  const faces = g.groups[0];
  for (let i = faces.start; i < faces.start + faces.count; i++) face[i] = 1;
  g.setAttribute('aFace', new BufferAttribute(face, 1));
  g.translate(x * CAP, y * CAP, -DEPTH / 2);
  toCreasedNormals(g, (32 * Math.PI) / 180);
  // The faces (ExtrudeGeometry's first group): flat.
  const n = g.getAttribute('normal');
  const q = g.getAttribute('position');
  const f = g.getAttribute('aFace');
  for (let i = 0; i < n.count; i++) if (f.getX(i) > 0.5) n.setXYZ(i, 0, 0, q.getZ(i) > 0 ? 1 : -1);
  n.needsUpdate = true;
  return g;
}

/**
 * The cast letters for a layout, made once and kept. The opening streams out and back in as the
 * journey loops, and each time it comes back the name is already cast. Only the GPU's copy goes with
 * the component, and it is uploaded again when next drawn.
 */
const cast = new Map<boolean, { placed: ReturnType<typeof layout>; geos: BufferGeometry[] }>();
function castLetters(portrait: boolean) {
  let c = cast.get(portrait);
  if (!c) {
    const placed = layout(portrait);
    c = { placed, geos: placed.map(({ glyph, x, y }) => letterGeometry(glyph, x, y)) };
    cast.set(portrait, c);
  }
  return c;
}

const VERTEX = /* glsl */ `
attribute float aFace;
varying vec3 vW;
varying vec3 vN;
varying vec3 vNL;
varying vec3 vL;
varying float vFace;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vNL = normal;
  vL = position;
  vFace = aFace;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAGMENT = /* glsl */ `
#define PI 3.141592653589793
uniform vec3 uFace, uBevel, uSide;
uniform float uSpec, uRoughFace, uRoughEdge;
uniform vec3 uZenith, uMid, uHorizon, uSea;
uniform vec3 uGoldPos, uGold, uGoldTint;
uniform float uGoldReach, uLightGain, uGlowGain;
uniform float uShade, uHaze, uFogDensity;
uniform vec3 uHazeColor, uCloud;
uniform float uVeilY, uVeilBand, uVeilMax;
varying vec3 vW;
varying vec3 vN;
varying vec3 vNL;
varying vec3 vL;
varying float vFace;

float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

/** How far the light's warmth has reached at a point of the air (1 = there). */
float reachedAt(vec3 p) { return smoothstep(uGoldReach + 30.0, uGoldReach - 170.0, length(p - uGoldPos)); }

/**
 * The world's light arriving from direction d, as the name sees it: the sky above (its own colours),
 * the sunlit cloud sea below, and — where the light's warmth has reached the part of the air that
 * direction looks into — lit by it; and, looking back into the cloud behind the name, the cloud the
 * light lies in, glowing (what the polished edges turned towards it catch). (spread: how broad a view,
 * 0 a mirror's, 1 a matte face's.)
 */
vec3 atmos(vec3 d, float spread, vec3 p) {
  float h = d.y;
  vec3 sky = mix(uHorizon, uMid, smoothstep(0.0, 0.35, h));
  sky = mix(sky, uZenith, smoothstep(0.3, 0.95, h));
  float below = 1.0 - smoothstep(-0.05 - 0.3 * spread, 0.03 + 0.3 * spread, h);
  vec3 c = mix(sky, uSea, below);
  float r = reachedAt(p + d * 600.0);
  c = c * mix(vec3(1.0), uGoldTint, r * 0.6) + uGold * r * (0.18 + 0.2 * below);
  vec3 toL = uGoldPos - p;
  float n = mix(10.0, 2.0, spread);
  return c + uGold * uGlowGain * pow(max(dot(d, normalize(toL)), 0.0), n) * (n + 2.0) / 12.0;
}

/**
 * The cloud here, lit as Clouds lights it (a mass of middling density: its white, warmed where the
 * light has reached, the light it holds, a little of the light it passes, and the air between) — what
 * the letters are still rising through. (gold, tint: the light as Clouds draws it on this path.)
 */
vec3 cloudAt(vec3 p, vec3 rd, vec3 gold, vec3 tint) {
  vec3 toL = uGoldPos - p;
  float d = length(toL);
  float mu = dot(rd, toL / max(d, 1e-3));
  float hg = 0.64 / pow(1.36 - 1.2 * mu, 1.5);
  float r = reachedAt(p);
  float thin = 0.25;
  vec3 c = uCloud * mix(vec3(1.0), tint, r * 0.5);
  c += gold * (0.8 * exp(-d / 45.0) * 0.8 + (0.3 + 0.7 * hg * thin) / (1.0 + d * d / 8100.0) + r * (0.22 + 0.15) + 0.3 * r * hg * thin);
  float dist = length(p - cameraPosition);
  return mix(c, uHazeColor, 1.0 - exp(-uFogDensity * uFogDensity * dist * dist * 0.35));
}

void main() {
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vW);
  float NV = max(dot(N, V), 1e-3);
  // The colour is the piece's own: a rich violet face; the rolled edge a lighter amethyst (the edge
  // turned partly to the front); the sides cast deep, a darker violet.
  float bevel = (1.0 - vFace) * smoothstep(0.12, 0.6, abs(normalize(vNL).z));
  vec3 albedo = mix(mix(uSide, uBevel, bevel), uFace, vFace);
  // Satin faces, polished edges.
  float rough = mix(uRoughEdge, uRoughFace, vFace);
  // (The finish varies a little over the piece, fixed to the letter.)
  rough = clamp(rough + 0.05 * (noise3(vL * 0.05) - 0.5), 0.06, 1.0);
  // A lacquer, not a metal: its reflection is the world's own colour, faint face-on and rising at the
  // edges — which is where the gold of the cloud shows on it.
  vec3 F0 = vec3(0.045);
  vec3 diffuse = albedo;

  // The world's light: taken in by the colour — as white light: the air's warmth is carried by what
  // the lacquer reflects, not by what its colour takes in (a violet lit gold turns brown) — and
  // reflected (a lobe as broad as the finish).
  vec3 R = reflect(-V, N);
  // (Face-on the satin face reflects little, so its violet stays deep; the edges reflect the most.)
  float spec = uSpec * mix(mix(0.45, 1.0, bevel), 0.4, vFace);
  vec3 Fr = spec * (F0 + (max(vec3(1.0 - rough), F0) - F0) * pow(1.0 - NV, 5.0));
  vec3 fill = atmos(N, 1.0, vW);
  fill = vec3(dot(fill, vec3(0.2126, 0.7152, 0.0722)));
  // Still in the cloud, a letter stands in its shade; risen out of it, in the open light.
  float open = smoothstep(uVeilY - 6.0, uVeilY + 30.0, vW.y);
  vec3 col = (diffuse * fill + Fr * atmos(normalize(mix(R, N, rough * rough)), rough, vW)) * uShade * mix(0.35, 1.0, open);

  // The light in the cloud behind: a point light. It rakes the sides and the edges that face it.
  vec3 toL = uGoldPos - vW;
  float dl = length(toL);
  vec3 L = toL / dl;
  vec3 E = uGold * uLightGain * open / (1.0 + dl * dl / 3600.0);
  float NL = max(dot(N, L), 0.0);
  vec3 Hv = normalize(L + V);
  float NH = max(dot(N, Hv), 0.0);
  float a = max(rough * rough, 0.002);
  float a2 = a * a;
  float dd = NH * NH * (a2 - 1.0) + 1.0;
  float D = a2 / (PI * dd * dd);
  float k = (rough + 1.0) * (rough + 1.0) / 8.0;
  float G = NL / (NL * (1.0 - k) + k) * NV / (NV * (1.0 - k) + k);
  vec3 Fh = F0 + (1.0 - F0) * pow(1.0 - max(dot(V, Hv), 0.0), 5.0);
  col += (diffuse / PI * dot(E, vec3(0.2126, 0.7152, 0.0722)) + spec * D * G * Fh / max(4.0 * NL * NV, 1e-3) * E) * NL;

  // …and a little of the air between.
  col = mix(col, uHazeColor, uHaze);

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function AcmCeg() {
  const portrait = useThree((s) => s.size.width / Math.max(1, s.size.height) < 0.9);
  // (The rail is fixed: it is measured once it is up, and again only after a resize.)
  const rail = useRef({ share: Infinity, w: 0, h: 0 });
  const group = useRef<Group>(null);
  const letters = useRef<(Mesh | null)[]>([]);

  const res = useDisposable(() => {
    // (Kept between mounts: castLetters. Disposing them here only gives back the GPU's copy.)
    const { placed, geos } = castLetters(portrait);
    const uniforms = {
      // Rich violet lacquer: the face, the rolled edge, the cast sides; restrained reflection.
      uFace: { value: new Color('#50107b') },
      uBevel: { value: new Color('#5c2095') },
      uSide: { value: new Color('#1c0634') },
      uSpec: { value: 0.7 },
      uRoughFace: { value: 0.3 },
      uRoughEdge: { value: 0.18 },
      uZenith: { value: new Color() },
      uMid: { value: new Color() },
      uHorizon: { value: new Color() },
      uSea: { value: new Color() },
      uGoldPos: { value: new Vector3() },
      uGold: { value: new Color(0, 0, 0) },
      uGoldTint: { value: new Color(1, 1, 1) },
      uGoldReach: { value: 0 },
      uLightGain: { value: 16 },
      uGlowGain: { value: 2.4 },
      uShade: { value: 1 },
      uHaze: { value: 0.015 },
      uFogDensity: { value: 0 },
      uHazeColor: { value: new Color() },
      uCloud: { value: new Color() },
      uVeilY: { value: CLOUD_TOP },
      uVeilBand: { value: 12 },
      uVeilMax: { value: 0 },
    };
    const mat = new ShaderMaterial({ uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT });
    // The widest line's ink, edge to edge (m), how far the letters reach from the centre, the lowest
    // baseline (cap units), and the dash's middle (cap units, in the layout).
    const lo = Math.min(...placed.map((p) => p.x + inkX(p.glyph)[0]));
    const hi = Math.max(...placed.map((p) => p.x + inkX(p.glyph)[1]));
    const foot = Math.min(...placed.map((p) => p.y));
    const d = placed.find((p) => p.glyph.ch === '-') ?? placed[Math.floor(placed.length / 2)];
    const dash = new Vector2(d.x + (inkX(d.glyph)[0] + inkX(d.glyph)[1]) / 2, d.y + (inkY(d.glyph)[0] + inkY(d.glyph)[1]) / 2);
    return { placed, geos, mat, uniforms, span: (hi - lo) * CAP, foot, dash };
  }, [portrait]);

  useFrame(({ camera, size }) => {
    const g = group.current;
    if (!g) return;
    const t = introFrame.t;
    // Only above the cloud (it stands out over the cloud's sea, never under it).
    const on = introFrame.active && t > T.cloudOut - 1 && t < T.cloudTop + 1;
    g.visible = on;
    if (!on) return;
    // Fitted to the frame (stacked on a portrait screen): its widest line takes no more of the
    // frame's width, as seen from where the camera holds it (with the lens it holds it with, so the
    // name — and the cloud round it — never change size as the camera comes in), than leaves it clear
    // of the edges and of the chapter rail at the right (on a phone turned sideways, or a tablet,
    // the rail takes more of the frame than on a desktop) — huge on any screen, never cut. (Never
    // enlarged past its size.)
    const R = rail.current;
    if (R.w !== size.width || R.h !== size.height) {
      const measured = railShare(size.width);
      if (measured !== null) Object.assign(R, { share: measured, w: size.width, h: size.height });
    }
    const cam = camera as PerspectiveCamera;
    const tanH = Math.tan((HOLD.fov * Math.PI) / 360) * portraitOpen(cam.aspect) * cam.aspect;
    const share = Math.min(portrait ? 0.84 : 0.73, R.share);
    const scale = Math.min(1, (share * 2 * HOLD.distance * tanH) / res.span);
    g.scale.setScalar(scale);
    // The light lies in the cloud behind the name (the world's gold is placed by it).
    look.gold.pos.set(ACM_CEG.x + res.dash.x * CAP * scale, ACM_CEG.y + res.dash.y * CAP * scale, ACM_CEG.z).add(LIGHT_FROM_DASH);

    const u = res.uniforms;
    // (The sky high over the name, as its edges see it: soft — the sky's own zenith would draw a
    // hard blue line along every top edge.)
    (u.uZenith.value as Color).copy(look.dome.zenith).lerp(look.dome.mid, 0.65);
    (u.uMid.value as Color).copy(look.dome.mid);
    (u.uHorizon.value as Color).copy(look.dome.horizon);
    (u.uHazeColor.value as Color).copy(look.fogColor);
    // The cloud, as it is lit (as Clouds lights it from above): the cloud it stands in, and the sea
    // of cloud all round — daylight's white, until the gold reaches it (atmos).
    (u.uCloud.value as Color).copy(look.fogColor).lerp(CLOUD_LIGHT, 0.45).multiplyScalar(look.gold.day);
    (u.uSea.value as Color).copy(DAYLIGHT).multiplyScalar(look.gold.day);
    (u.uGoldPos.value as Vector3).copy(look.gold.pos);
    (u.uGold.value as Color).copy(look.gold.color);
    const gc = look.gold.color;
    const gm = Math.max(gc.r, gc.g, gc.b);
    (u.uGoldTint.value as Color).setRGB(gm > 0 ? gc.r / gm : 1, gm > 0 ? gc.g / gm : 1, gm > 0 ? gc.b / gm : 1);
    u.uGoldReach.value = look.gold.reach;
    u.uFogDensity.value = look.fogDensity;
    // The light building as the name comes up.
    u.uShade.value = 0.6 + 0.26 * ease(t, T.acmCegIn, T.acmCegFormed);
    // The letters rising out of the cloud, one after another, each beginning while the one before is
    // still coming up: straight up, easing into place (smootherstep: no overshoot, a long settle).
    res.placed.forEach((_, i) => {
      const m = letters.current[i];
      if (!m) return;
      const k = ease5(t, T.acmCegIn + i * RISE.stagger, T.acmCegIn + i * RISE.stagger + RISE.beats);
      m.position.y = -(1 - k) * RISE.depth * CAP;
      m.visible = k > 0.001;
    });
    // The cloud's top at its feet: its top, or (where the frame sets the name lower, stacked on a
    // portrait screen) lower still, so that the whole of its wavering edge stays under the name's
    // resting foot and the name at rest stands clear of it.
    const restFoot = ACM_CEG.y + scale * res.foot * CAP;
    look.nameFoot = restFoot;
    u.uVeilY.value = restFoot - 8;
  });

  return (
    <group ref={group} name="intro-acm-ceg" position={[ACM_CEG.x, ACM_CEG.y, ACM_CEG.z]} visible={false}>
      {res.geos.map((geo, i) => (
        <mesh key={i} ref={(el) => void (letters.current[i] = el)} geometry={geo} material={res.mat} />
      ))}
    </group>
  );
}

/** The light in the cloud's top (warm white, over the fog's colour). */
const CLOUD_LIGHT = new Color('#f4f1ea');
/** Daylight's white on the sea of cloud, where the gold has not reached (cool, beside it). */
const DAYLIGHT = new Color('#e6ecf1');
