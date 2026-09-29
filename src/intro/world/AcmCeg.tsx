'use client';
/**
 * ACM-CEG, the name, revealed by the sea of cloud.
 *
 * Out of the cloud's top the rise levels into flight. Ahead, far out over the cloud, the name rises
 * out of it: each letter surfaces in turn, huge (architecture, not a title), and settles. The camera
 * slows into its composition and holds it (camera.ts), and one light runs across the letters while it
 * does. Then the camera tilts down and drops away through the cloud.
 *
 * It is set as a title (acmWordmark.ts): Montserrat, the site's own typeface, at a weight between
 * Medium and SemiBold, tracked wide, the hyphen drawn as the E's middle arm so it belongs to the
 * mark. It is cast as a gold piece. The letters are deep, their edges rounded into a broad polished
 * bevel that stays inside the letterform (the silhouette is the type's own), their faces dead flat.
 * The metal is fully metallic gold, its polish varying a little over the piece as a hand-finished
 * one's does. It is lit as a jeweller lights gold (goldStudio.ts): champagne on the faces,
 * deepening toward their feet under a key from above, deep amber on the sides, shadow beneath, and
 * the brightest light on the rolled edges, which answer it more strongly than the faces.
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
import { BufferAttribute, type BufferGeometry, Color, ExtrudeGeometry, type Group, type Mesh, MeshPhysicalMaterial, Path, type PerspectiveCamera, Shape, Vector2 } from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useDisposable } from '@/systems/performance/useDisposable';
import { ACM_CEG, introCameraAt } from '../camera';
import { look } from '../look';
import { introFrame } from '../state';
import { ease, T } from '../timeline';
import { WORDMARK, WORDMARK_TRACKING, type WordmarkGlyph } from './acmWordmark';
import { CLOUD_TOP } from './Clouds';
import { goldStudio } from './goldStudio';

/** Cap height (m), and the depth the letters are cast to. */
const CAP = 56;
const DEPTH = 0.2 * CAP;
/**
 * The polished edge: how far it rounds over and how deep, in how many steps (smooth-shaded: see
 * letterGeometry). It is cut inside the letterform, so the silhouette stays the type's own weight.
 */
const BEVEL = { thickness: 2.2, size: 1.7, segments: 7 };

/** How far from ACM-CEG the camera holds it (the end of the hold, where it is nearest). */
const HOLD_DISTANCE = (() => {
  const c = introCameraAt(T.acmCegHold).pos;
  return Math.hypot(c.x - ACM_CEG.x, c.y - ACM_CEG.y, c.z - ACM_CEG.z);
})();

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
    bevelOffset: -BEVEL.size,
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
uniform float uSweep, uSweepAmt, uGlow, uHaze, uRoughVar, uEdgeGain, uTopGain, uKeyLow, uKeyHigh, uVeilY, uVeilBand, uVeilMax;
uniform vec3 uGlowColor, uHazeColor, uSweepColor, uVeilColor;
varying vec3 vAcmW;
varying vec3 vAcmL;
varying float vCapY;
float acmHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float acmNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(acmHash(i), acmHash(i + vec3(1, 0, 0)), f.x), mix(acmHash(i + vec3(0, 1, 0)), acmHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(acmHash(i + vec3(0, 0, 1)), acmHash(i + vec3(1, 0, 1)), f.x), mix(acmHash(i + vec3(0, 1, 1)), acmHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
`;

export function AcmCeg() {
  const gl = useThree((s) => s.gl);
  const portrait = useThree((s) => s.size.width / Math.max(1, s.size.height) < 0.9);
  const group = useRef<Group>(null);
  const letters = useRef<(Mesh | null)[]>([]);
  // (Shared, and kept for the renderer's life: goldStudio.ts.)
  const studio = useMemo(() => goldStudio(gl), [gl]);

  const res = useDisposable(() => {
    // (Kept between mounts: castLetters. Disposing them here only gives back the GPU's copy.)
    const { placed, geos } = castLetters(portrait);
    const uniforms = {
      uSweep: { value: -1e4 },
      uSweepAmt: { value: 0 },
      uSweepColor: { value: new Color('#ffe2b0') },
      uGlow: { value: 0 },
      uGlowColor: { value: new Color('#8a5a1c') },
      uHaze: { value: 0.07 },
      uHazeColor: { value: new Color() },
      uRoughVar: { value: 0.04 },
      uEdgeGain: { value: 0.45 },
      uTopGain: { value: 0.9 },
      uKeyLow: { value: 0.8 },
      uKeyHigh: { value: 1.08 },
      uVeilY: { value: CLOUD_TOP },
      uVeilBand: { value: 12 },
      uVeilMax: { value: 0.92 },
      uVeilColor: { value: new Color() },
    };
    // Polished gold: fully metallic, its colour the metal's own (no lacquer over it: a clear coat's
    // white reflection is what makes metal read as paint).
    const mat = new MeshPhysicalMaterial({
      color: new Color('#f1c97c'),
      metalness: 1,
      roughness: 0.09,
      envMap: studio.texture,
      envMapIntensity: 1,
    });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aCapY;\nvarying vec3 vAcmW;\nvarying vec3 vAcmL;\nvarying float vCapY;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvAcmW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvAcmL = transformed;\nvCapY = aCapY;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${GOLD_PARS}`)
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          // Hand-finished: the polish varies a little over the piece (fixed to the letter, never swimming).
          roughnessFactor = clamp(roughnessFactor + uRoughVar * (acmNoise(vAcmL * 0.045) - 0.5), 0.05, 1.0);`,
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
            // One light running across the letters while the camera holds. On polished gold it is
            // the metal's own reflection that brightens as the light passes, most on the rolled
            // edges (where the surface turns from the eye), with a fine warm sparkle along them.
            float bx = (vAcmW.x - uSweep) / 22.0;
            float band = exp(-bx * bx) * uSweepAmt;
            reflectedLight.indirectSpecular *= 1.0 + band * (0.7 + 1.8 * edge);
            reflectedLight.directSpecular *= 1.0 + band * (0.7 + 1.8 * edge);
            totalEmissiveRadiance += uSweepColor * band * 0.35 * edge * edge;
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
    return { placed, geos, mat, uniforms, width: Math.max(Math.abs(lo), Math.abs(hi)) * CAP, span: (hi - lo) * CAP, foot };
  }, [portrait, studio]);

  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    const t = introFrame.t;
    // Only above the cloud (it stands out over the cloud's sea, never under it).
    const on = introFrame.active && t > T.cloudOut - 1 && t < T.cloudTop + 1;
    g.visible = on;
    if (!on) return;
    // Fitted to the frame (stacked on a portrait screen): its widest line takes no more of the
    // frame's width, as seen from where the camera holds (the lens as it is), than leaves it clear
    // of the edges — and, on a landscape screen, of the chapter rail at the right — huge on any
    // screen, never cut. (Never enlarged past its size.)
    const cam = camera as PerspectiveCamera;
    const tanH = Math.tan((cam.fov * Math.PI) / 360) * cam.aspect;
    const share = portrait ? 0.84 : 0.73;
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
    (u.uVeilColor.value as Color).copy(look.fogColor).lerp(VEIL_LIGHT, 0.3);
    // The light across it: once, left to right, while the camera holds.
    const s = ease(t, T.acmCeg + 0.5, T.acmCegHold - 0.5);
    u.uSweep.value = ACM_CEG.x - res.width * 1.2 + s * res.width * 2.4;
    u.uSweepAmt.value = Math.sin(Math.PI * s) * 0.55;
  });

  return (
    <group ref={group} name="intro-acm-ceg" position={[ACM_CEG.x, ACM_CEG.y, ACM_CEG.z]} visible={false}>
      {res.geos.map((geo, i) => (
        <mesh key={i} ref={(el) => void (letters.current[i] = el)} geometry={geo} material={res.mat} />
      ))}
    </group>
  );
}

/** The light in the cloud's top, that the veil takes from it (warm white, over the fog's colour). */
const VEIL_LIGHT = new Color('#f4f1ea');
