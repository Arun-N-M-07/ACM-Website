'use client';
/**
 * ACM-CEG, the name, revealed by the sea of cloud.
 *
 * Out of the cloud's top the rise levels into flight. Ahead, far out over the cloud, the name rises
 * out of it: each letter surfaces in turn, huge (architecture, not a title), and settles. The camera
 * slows into its composition and holds it (camera.ts), and one light runs across the letters while it
 * does. Then the camera tilts down and drops away through the cloud.
 *
 * It is set as a title (acmWordmark.ts): Montserrat SemiBold, the site's own typeface, tracked wide,
 * the hyphen drawn as the E's middle arm and spaced as a stroke of the word, so it belongs to the mark.
 * It is cast as a gold piece. The letters are deep and heavy — cast a little past the type's outline,
 * so the strokes stand thicker than the SemiBold they come from — their edges rounded into a broad
 * polished bevel, their faces flat. The
 * metal is fully metallic gold, its polish varying a little over the piece as a hand-finished one's
 * does. It is lit as a jeweller lights gold, by a studio whose lights are brighter than white
 * (goldStudio.ts): the faces luminous champagne at their tops, running down through gold to deep
 * amber at their feet under a key from above; the sides dark amber; shadow beneath; and the
 * brightest light on the rolled edges and the curves, lines of light brighter than the metal's colour.
 *
 * The cloud reveals it. Below the cloud's top the letters are inside the cloud, veiled in its light,
 * so each one comes up out of it rather than from behind it: first a shape in the cloud, then, while it
 * still leans forward, a dark silhouette (its face looking down into the shadowed cloud), then the
 * light catching it as it straightens into place. The air between holds only a little of it (its own
 * haze, a light one: at this distance the film's fog would wash an identity out to a pale ghost of
 * its colour).
 *
 * Portrait screens stack it (ACM- over CEG), so it stays huge in a narrow frame instead of shrinking
 * into it.
 *
 * Everything is a function of the beat: it rises as you scroll up out of the cloud, and sinks back as
 * you scroll back.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, ExtrudeGeometry, type Group, type Mesh, MeshPhysicalMaterial, Path, type PerspectiveCamera, type Points, ShaderMaterial, Shape, Vector2 } from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CHAPTERS } from '@/config/timeline';
import { useDisposable } from '@/systems/performance/useDisposable';
import { ACM_CEG, introCameraAt } from '../camera';
import { look } from '../look';
import { introFrame } from '../state';
import { ease, introChapterAt, T } from '../timeline';
import { WORDMARK, WORDMARK_TRACKING, type WordmarkGlyph } from './acmWordmark';
import { CLOUD_TOP } from './Clouds';
import { goldStudio } from './goldStudio';

/** Cap height (m), and the depth the letters are cast to. */
const CAP = 56;
const DEPTH = 0.34 * CAP;
/**
 * The polished edge: how far it rounds over and how deep, in how many steps (smooth-shaded: see
 * letterGeometry). It is cut inside the letterform, so the silhouette stays the type's own weight.
 */
const BEVEL = { thickness: 3.8, size: 2.9, segments: 10 };
/**
 * How far the cast stands out past the type's own outline (m, at its base): the strokes thickened by
 * this on every side (counters closing as much), so the name has a monument's weight — the type's
 * silhouette, cast heavier — and its bevel rolls over that.
 */
const SWELL = 1.25;

/** How far from ACM-CEG the camera holds it (the end of the hold, where it is nearest). */
const HOLD_DISTANCE = (() => {
  const c = introCameraAt(T.acmCegHold).pos;
  return Math.hypot(c.x - ACM_CEG.x, c.y - ACM_CEG.y, c.z - ACM_CEG.z);
})();

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

/** The letters, laid out (cap units): one line, or ACM- over CEG. Each line is centred on its ink. */
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
 * faces stay dead flat, as a polished face is. Each vertex keeps its height in the letter (0 at the
 * baseline, 1 at the cap line) for the light from above.
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
    bevelOffset: SWELL - BEVEL.size,
    bevelSegments: BEVEL.segments,
    curveSegments: 1,
  });
  const p = g.getAttribute('position');
  const capY = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) capY[i] = Math.min(1, Math.max(0, p.getY(i) / CAP));
  g.setAttribute('aCapY', new BufferAttribute(capY, 1));
  g.translate(x * CAP, y * CAP, -DEPTH / 2);
  toCreasedNormals(g, (32 * Math.PI) / 180);
  // The faces (ExtrudeGeometry's first group): flat.
  const faces = g.groups[0];
  const n = g.getAttribute('normal');
  for (let i = faces.start; i < faces.start + faces.count; i++) n.setXYZ(i, 0, 0, p.getZ(i) > 0 ? 1 : -1);
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

const GOLD_PARS = /* glsl */ `
uniform float uSweep, uSweepAmt, uSweepW, uSweepY, uGlow, uHaze, uRoughVar, uRoughFace, uRoughEdge, uFaceWarp, uEdgeGain, uTopGain, uKeyLow, uKeyHigh, uVeilY, uVeilBand, uVeilMax, uBounceAmt;
uniform vec3 uGlowColor, uHazeColor, uSweepColor, uVeilColor, uBounce;
varying vec3 vAcmW;
varying vec3 vAcmL;
varying float vCapY;
varying float vAcmFace;
float acmHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float acmNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(acmHash(i), acmHash(i + vec3(1, 0, 0)), f.x), mix(acmHash(i + vec3(0, 1, 0)), acmHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(acmHash(i + vec3(0, 0, 1)), acmHash(i + vec3(1, 0, 1)), f.x), mix(acmHash(i + vec3(0, 1, 1)), acmHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
`;

/** The stroke of light across the whole word: after its last letter has settled (and held a breath). */
const SHIMMER: [number, number] = [T.acmCegIn + 2.7 + 6 * 0.42 + 0.6, T.acmCegHold - 1.2];

// ─── The air round it, at the end: a few points of light ────────────────────

/** How many points of light, and over which beats they come (once the last letter has settled) and go. */
const SPARKS = 64;
const SPARK_IN: [number, number] = [T.acmCeg - 0.2, T.acmCeg + 1.6];
const SPARK_OUT: [number, number] = [T.acmCegHold - 0.5, T.descend + 0.5];
const sparkHash = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Small white points in the air about the name, catching the light — only as the reveal ends: none
 * while the letters come up, then a few, each at its own beat, brightening and fading as the scroll
 * goes through the hold (a function of the beat: still when the scroll is). Sparse, and fine: the
 * name is the light; these are the air's.
 */
function sparkResources(width: number, foot: number) {
  const pos = new Float32Array(SPARKS * 3);
  const seed = new Float32Array(SPARKS * 3);
  for (let i = 0; i < SPARKS; i++) {
    pos[i * 3] = (sparkHash(i, 1) * 2 - 1) * width * 1.15;
    // (Most above the name, against the sky; a few low, against the cloud's shade.)
    pos[i * 3 + 1] = (sparkHash(i, 2) < 0.7 ? 0.9 + sparkHash(i, 7) * 1.6 : foot - 0.6 + sparkHash(i, 7) * 0.7) * CAP;
    pos[i * 3 + 2] = (sparkHash(i, 3) * 6 - 1.5) * CAP;
    // (Its beat, its size, how long it holds the light.)
    seed[i * 3] = SPARK_IN[0] + 0.3 + sparkHash(i, 4) * (SPARK_OUT[0] - SPARK_IN[0]);
    seed[i * 3 + 1] = 3 + Math.pow(sparkHash(i, 5), 2.2) * 4;
    seed[i * 3 + 2] = 0.6 + sparkHash(i, 6) * 1.4;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('aSpark', new BufferAttribute(seed, 3));
  const mat = new ShaderMaterial({
    uniforms: { uT: { value: 0 }, uAmt: { value: 0 }, uPx: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 aSpark;
      uniform float uT, uAmt, uPx;
      varying float vA;
      void main() {
        // Each point: a faint presence through the climax, brightest about its own beat.
        float d = (uT - aSpark.x) / aSpark.z;
        vA = uAmt * (0.12 + 0.88 * exp(-d * d));
        gl_PointSize = aSpark.y * uPx * (0.7 + 0.3 * vA);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        // A crisp core in a small soft halo: a point catching the light, not a blur.
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float a = vA * (smoothstep(0.42, 0.0, r) + 0.35 * pow(max(0.0, 1.0 - r), 3.0));
        if (a < 0.003) discard;
        // (Brighter than white, as a glint is: the frame's own bloom gives it its little halo.)
        gl_FragColor = vec4(vec3(3.2 * a), 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    fog: false,
  });
  return { geo, mat };
}

export function AcmCeg() {
  const gl = useThree((s) => s.gl);
  const portrait = useThree((s) => s.size.width / Math.max(1, s.size.height) < 0.9);
  // (The rail is fixed: it is measured once it is up, and again only after a resize.)
  const rail = useRef({ share: Infinity, w: 0, h: 0 });
  const group = useRef<Group>(null);
  const letters = useRef<(Mesh | null)[]>([]);
  const sparkPoints = useRef<Points>(null);
  // (Shared, and kept for the renderer's life: goldStudio.ts.)
  const studio = useMemo(() => goldStudio(gl), [gl]);

  const res = useDisposable(() => {
    // (Kept between mounts: castLetters. Disposing them here only gives back the GPU's copy.)
    const { placed, geos } = castLetters(portrait);
    const uniforms = {
      uSweep: { value: -1e4 },
      uSweepAmt: { value: 0 },
      uSweepW: { value: 4 },
      uSweepY: { value: ACM_CEG.y },
      uSweepColor: { value: new Color('#ffe2b0') },
      uGlow: { value: 0 },
      uGlowColor: { value: new Color('#8a5a1c') },
      uHaze: { value: 0.03 },
      uHazeColor: { value: new Color() },
      uRoughVar: { value: 0.06 },
      uRoughFace: { value: 0.15 },
      uRoughEdge: { value: 0.06 },
      uFaceWarp: { value: 0.1 },
      uEdgeGain: { value: 0.95 },
      uTopGain: { value: 1.45 },
      uBounce: { value: new Color(0.86, 0.74, 1.08) },
      uBounceAmt: { value: 0 },
      uKeyLow: { value: 0.42 },
      uKeyHigh: { value: 1.18 },
      uVeilY: { value: CLOUD_TOP },
      uVeilBand: { value: 12 },
      uVeilMax: { value: 0.92 },
      uVeilColor: { value: new Color() },
    };
    // Polished gold: fully metallic, its colour the metal's own (no lacquer over it: a clear coat's
    // white reflection is what makes metal read as paint).
    const mat = new MeshPhysicalMaterial({
      color: new Color('#f3c76c'),
      metalness: 1,
      roughness: 0.1,
      envMap: studio.texture,
      envMapIntensity: 1,
    });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aCapY;\nvarying vec3 vAcmW;\nvarying vec3 vAcmL;\nvarying float vCapY;\nvarying float vAcmFace;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvAcmW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvAcmL = transformed;\nvCapY = aCapY;\nvAcmFace = abs(objectNormal.z);');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${GOLD_PARS}`)
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          // Hand-finished: the faces a fine satin, the rolled edges mirror-polished (so the edges carry
          // the light and the faces the colour), the polish varying a little over the piece (fixed to the
          // letter, never swimming).
          roughnessFactor = clamp(mix(uRoughEdge, uRoughFace, smoothstep(0.86, 0.99, vAcmFace)) + uRoughVar * (acmNoise(vAcmL * 0.045) - 0.5), 0.04, 1.0);`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
          {
            // A cast face is flat to the eye, not to the light: a very slight, broad undulation (a
            // few degrees, fixed to the letter) moves the studio's windows across it, so no face is
            // one tone.
            float face = smoothstep(0.9, 0.995, vAcmFace);
            vec2 w = vec2(acmNoise(vAcmL * 0.018), acmNoise(vAcmL * 0.018 + 7.3)) - 0.5;
            normal = normalize(normal + vec3(w * uFaceWarp * face, 0.0));
          }`,
        )
        .replace(
          '#include <dithering_fragment>',
          `gl_FragColor.rgb = mix(gl_FragColor.rgb, uHazeColor, uHaze);
          {
            // The cloud it rises out of: below the cloud's top the letters are inside it, veiled in
            // its light, the veil's edge wavering as a cloud's top does (fixed in the world: the
            // letters rise up through it).
            vec3 wq = vec3(vAcmW.x, vAcmW.z, 1.7);
            float vy = vAcmW.y + uVeilBand * (0.8 * (acmNoise(wq * vec3(0.045, 0.045, 1.0)) - 0.5) + 0.35 * (acmNoise(wq * vec3(0.16, 0.16, 1.0) + 4.1) - 0.5));
            float veil = uVeilMax * (1.0 - smoothstep(uVeilY - uVeilBand, uVeilY + uVeilBand * 0.6, vy));
            gl_FragColor.rgb = mix(gl_FragColor.rgb, uVeilColor, veil);
          }
          #include <dithering_fragment>`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          // A little warmth of its own, so the gold holds its colour against the bright sky.
          totalEmissiveRadiance += uGlowColor * uGlow;`,
        )
        .replace(
          '#include <aomap_fragment>',
          `#include <aomap_fragment>
          {
            float edge = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
            // The rolled edges answer the light more strongly than the faces, as polished gold does;
            // and a key from above: each face a shade brighter at its top than at its foot.
            float lift = 1.0 + uEdgeGain * edge * edge;
            // The edges that face up take the key above most brightly of all: a thin line of light
            // along the tops of the letters, bright enough to bloom a little.
            vec3 wn = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
            lift *= 1.0 + uTopGain * smoothstep(0.35, 0.95, wn.y);
            reflectedLight.indirectSpecular *= lift * mix(uKeyLow, uKeyHigh, smoothstep(0.0, 1.0, vCapY));
            reflectedLight.directSpecular *= lift;
            // What looks down sees the cloud below — lit, as the name comes up, by the violet light
            // (look.violet): the undersides of the letters take a little of it.
            reflectedLight.indirectSpecular *= mix(vec3(1.0), uBounce, uBounceAmt * smoothstep(0.05, 0.75, -wn.y));
            // Once the whole word stands: one stroke of light across it, left to right — a thin
            // slanted line (leaning as a reflection on a slanted window does), the metal's own
            // reflection brightening as it passes over each face and running bright along the rolled
            // edges, with a softer glow either side of it.
            float bx = (vAcmW.x + (vAcmW.y - uSweepY) * 0.42 - uSweep) / uSweepW;
            float core = exp(-bx * bx);
            float glow = exp(-bx * bx * 0.06);
            float band = (core + 0.18 * glow) * uSweepAmt;
            reflectedLight.indirectSpecular *= 1.0 + band * (2.6 + 2.4 * edge);
            reflectedLight.directSpecular *= 1.0 + band * (2.6 + 2.4 * edge);
            // (The stroke itself: the light's reflection, warm white, on the faces and brightest on
            // the rolled edges.)
            reflectedLight.directSpecular += uSweepColor * core * uSweepAmt * (0.55 + 1.1 * edge);
          }`,
        );
    };
    mat.customProgramCacheKey = () => 'intro-acm-ceg-gold';
    // (Its own light haze instead of the film's fog: see above.)
    mat.fog = false;
    // The widest line's ink, edge to edge (m), how far the letters reach from the centre, and the
    // lowest baseline (cap units).
    const lo = Math.min(...placed.map((p) => p.x + inkX(p.glyph)[0]));
    const hi = Math.max(...placed.map((p) => p.x + inkX(p.glyph)[1]));
    const foot = Math.min(...placed.map((p) => p.y));
    const width = Math.max(Math.abs(lo), Math.abs(hi)) * CAP;
    const sparks = sparkResources(width, foot);
    return { placed, geos, mat, uniforms, width, span: (hi - lo) * CAP, foot, sparks };
  }, [portrait, studio]);

  useFrame(({ camera, size }) => {
    const g = group.current;
    if (!g) return;
    const t = introFrame.t;
    // Only above the cloud (it stands out over the cloud's sea, never under it).
    const on = introFrame.active && t > T.cloudOut - 1 && t < T.cloudTop + 1;
    g.visible = on;
    if (!on) return;
    // Fitted to the frame (stacked on a portrait screen): its widest line takes no more of the
    // frame's width, as seen from where the camera holds (the lens as it is), than leaves it clear
    // of the edges and of the chapter rail at the right (on a phone turned sideways, or a tablet,
    // the rail takes more of the frame than on a desktop) — huge on any screen, never cut. (Never
    // enlarged past its size.)
    const R = rail.current;
    if (R.w !== size.width || R.h !== size.height) {
      const measured = railShare(size.width);
      if (measured !== null) Object.assign(R, { share: measured, w: size.width, h: size.height });
    }
    const cam = camera as PerspectiveCamera;
    const tanH = Math.tan((cam.fov * Math.PI) / 360) * cam.aspect;
    const share = Math.min(portrait ? 0.86 : 0.78, R.share);
    const scale = Math.min(1, (share * 2 * HOLD_DISTANCE * tanH) / res.span);
    g.scale.setScalar(scale);
    res.placed.forEach((_, i) => {
      const m = letters.current[i];
      if (!m) return;
      // Surfacing in turn out of the cloud, and settling: it comes up past its place and back a
      // touch, with a little lean it loses as it stands.
      const k = ease(t, T.acmCegIn + i * 0.42, T.acmCegIn + 2.7 + i * 0.42);
      const over = Math.sin(Math.PI * Math.min(1, k * 1.15)) * 0.035 * (1 - k);
      m.position.y = -(1 - k) * CAP * 1.7 + over * CAP;
      m.rotation.x = (1 - k) * 0.3;
      m.visible = k > 0.001;
    });
    const u = res.uniforms;
    // Its own warmth comes up as it surfaces and holds through the composition.
    u.uGlow.value = 0.015 * ease(t, T.acmCegIn, T.acmCeg);
    (u.uHazeColor.value as Color).copy(look.fogColor);
    // The cloud it rises out of: its top, or (where the frame sets the name lower, stacked on a
    // portrait screen) lower still, so that the whole of its wavering edge stays under the name's
    // resting foot and the name at rest stands clear of it.
    const restFoot = ACM_CEG.y + scale * res.foot * CAP;
    u.uVeilY.value = Math.min(CLOUD_TOP + 14, restFoot - 1.25 * u.uVeilBand.value);
    (u.uVeilColor.value as Color).copy(look.fogColor).lerp(VEIL_LIGHT, 0.3).lerp(VEIL_VIOLET, 0.22 * look.violet);
    u.uBounceAmt.value = look.violet;
    // The stroke of light across it: once the last letter (G) has settled and the gold has held a
    // moment, from beyond the A to beyond the G — once, with the scroll (back with it, as it came).
    const s = ease(t, SHIMMER[0], SHIMMER[1]);
    const reach = res.width * scale * 1.15;
    u.uSweep.value = ACM_CEG.x - reach + s * reach * 2;
    u.uSweepW.value = res.width * scale * 0.03;
    u.uSweepY.value = ACM_CEG.y;
    u.uSweepAmt.value = Math.pow(Math.sin(Math.PI * s), 0.6) * 0.8;
    // The points of light in the air, at the end of the reveal.
    const su = res.sparks.mat.uniforms;
    su.uT.value = t;
    su.uAmt.value = ease(t, SPARK_IN[0], SPARK_IN[1]) * (1 - ease(t, SPARK_OUT[0], SPARK_OUT[1]));
    su.uPx.value = (size.height / 900) * gl.getPixelRatio();
    if (sparkPoints.current) sparkPoints.current.visible = su.uAmt.value > 0.001;
  });

  return (
    <group ref={group} name="intro-acm-ceg" position={[ACM_CEG.x, ACM_CEG.y, ACM_CEG.z]} visible={false}>
      {res.geos.map((geo, i) => (
        <mesh key={i} ref={(el) => void (letters.current[i] = el)} geometry={geo} material={res.mat} />
      ))}
      <points ref={sparkPoints} geometry={res.sparks.geo} material={res.sparks.mat} frustumCulled={false} renderOrder={8} visible={false} />
    </group>
  );
}

/** The light in the cloud's top, that the veil takes from it (warm white, over the fog's colour)… */
const VEIL_LIGHT = new Color('#f4f1ea');
/** …and, as the name comes up, the violet light in it (look.violet). */
const VEIL_VIOLET = new Color('#d2c2f2');
