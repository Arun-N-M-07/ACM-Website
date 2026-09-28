'use client';
/**
 * ACM-CEG — the identity, standing on the sea of cloud.
 *
 * Out of the cloud's top the rise levels into flight, and ahead, far out over
 * the cloud, the name rises out of it: each letter surfacing in turn, huge —
 * architecture, not a title — and settling. The camera slows into its
 * composition and holds it (camera.ts), and one light runs across the letters
 * while it does. Then the camera tilts down and drops away through the cloud.
 *
 * The letters are the chapter's own blade face (acmGlyphs.ts) — the face its
 * name is cut in on the stone in the garden, the first A spiked through the
 * cap line — here extruded deep in a dark violet lacquer: a clearcoat over a
 * faintly iridescent colour that turns from violet to blue as the light
 * crosses it, catching the high sun on its bevels. It is lit by the film's
 * sun, and the air between holds only a little of it (its own haze, a light
 * one: at this distance the film's fog would wash an identity out to a
 * pale ghost of its colour).
 *
 * Portrait screens stack it — ACM- over CEG — so it stays huge in a narrow
 * frame instead of shrinking into it.
 *
 * Everything is a function of the beat: it rises as you scroll up out of the
 * cloud, sinks back as you scroll back.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, ExtrudeGeometry, type Group, type Mesh, MeshPhysicalMaterial, Path, type PerspectiveCamera, Shape, Vector2 } from 'three';
import { useDisposable } from '@/systems/performance/useDisposable';
import { ACM_CEG, introCameraAt } from '../camera';
import { look } from '../look';
import { introFrame } from '../state';
import { ease, T } from '../timeline';
import { bladeGlyph, type BladeGlyph, type Pt } from './acmGlyphs';
import { chromeStudio } from './chromeStudio';

/** Cap height (m), extrusion depth, and the gap between letters (cap units). */
const CAP = 56;
const DEPTH = 0.2 * CAP;
const TRACKING = 0.1;

/** The hyphen, drawn in the face's own manner: a blade, waisted, its ends cut on the bias with a spur. */
function bladeHyphen(): BladeGlyph {
  const y0 = 0.4;
  const y1 = 0.53;
  const outer: Pt[] = [
    [0.02, y0 + 0.01],
    [0.2, y0 + 0.025],
    [0.36, y0],
    [0.5, y0 - 0.03],
    [0.47, y1 - 0.02],
    [0.3, y1 - 0.03],
    [0.12, y1],
    [-0.03, y1 + 0.03],
  ];
  return { outer, holes: [], width: 0.5 };
}

const glyphFor = (ch: string, first: boolean) => (ch === '-' ? bladeHyphen() : bladeGlyph(first && ch === 'A' ? 'A*' : ch));

/** How far from ACM-CEG the camera holds it (the end of the hold, where it is nearest). */
const HOLD_DISTANCE = (() => {
  const c = introCameraAt(T.acmCegHold).pos;
  return Math.hypot(c.x - ACM_CEG.x, c.y - ACM_CEG.y, c.z - ACM_CEG.z);
})();

/** The letters, laid out (cap units): one line, or ACM- over CEG. */
function layout(portrait: boolean) {
  const lines = portrait ? ['ACM-', 'CEG'] : ['ACM-CEG'];
  const gap = 0.3;
  const out: { glyph: BladeGlyph; x: number; y: number; order: number }[] = [];
  let order = 0;
  lines.forEach((text, li) => {
    const glyphs = [...text].map((ch, i) => glyphFor(ch, li === 0 && i === 0));
    const w = glyphs.reduce((a, g) => a + g.width, 0) + TRACKING * (glyphs.length - 1);
    let x = -w / 2;
    const baseline = (lines.length - 1) * (1 + gap) * 0.5 - li * (1 + gap) - 0.5;
    glyphs.forEach((g) => {
      out.push({ glyph: g, x, y: baseline, order: order++ });
      x += g.width + TRACKING;
    });
  });
  return out;
}

const SWEEP_PARS = /* glsl */ `
uniform float uSweep, uSweepAmt, uGlow, uHaze;
uniform vec3 uGlowColor, uHazeColor;
varying vec3 vAcmW;
`;

export function AcmCeg() {
  const gl = useThree((s) => s.gl);
  const portrait = useThree((s) => s.size.width / Math.max(1, s.size.height) < 0.9);
  const group = useRef<Group>(null);
  const letters = useRef<(Mesh | null)[]>([]);
  // (Shared, and kept for the renderer's life: chromeStudio.ts.)
  const studio = useMemo(() => chromeStudio(gl), [gl]);

  const res = useDisposable(() => {
    const placed = layout(portrait);
    const geos = placed.map(({ glyph, x, y }) => {
      const shape = new Shape(glyph.outer.map(([px, py]) => new Vector2(px * CAP, py * CAP)));
      for (const h of glyph.holes) shape.holes.push(new Path(h.map(([px, py]) => new Vector2(px * CAP, py * CAP))));
      const g = new ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: true, bevelThickness: 1.1, bevelSize: 0.8, bevelSegments: 3, curveSegments: 2 });
      g.translate(x * CAP, y * CAP, -DEPTH / 2);
      g.computeVertexNormals();
      return g;
    });
    const uniforms = {
      uSweep: { value: -1e4 },
      uSweepAmt: { value: 0 },
      uGlow: { value: 0 },
      uGlowColor: { value: new Color('#5b24d6') },
      uHaze: { value: 0.07 },
      uHazeColor: { value: new Color() },
    };
    // Deep violet lacquer: dark, saturated body; clearcoat; a faint iridescence that turns it towards blue in the light.
    const mat = new MeshPhysicalMaterial({
      color: new Color('#1f0752'),
      metalness: 0.12,
      roughness: 0.34,
      clearcoat: 1,
      clearcoatRoughness: 0.14,
      iridescence: 0.3,
      iridescenceIOR: 1.3,
      iridescenceThicknessRange: [200, 380],
      sheen: 0.25,
      sheenColor: new Color('#7a3cff'),
      sheenRoughness: 0.45,
      envMap: studio.texture,
      envMapIntensity: 0.4,
    });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vAcmW;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvAcmW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${SWEEP_PARS}`)
        .replace('#include <dithering_fragment>', 'gl_FragColor.rgb = mix(gl_FragColor.rgb, uHazeColor, uHaze);\n#include <dithering_fragment>')
        .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          // A little of its own violet light, so the name holds its colour against the bright sky.
          totalEmissiveRadiance += uGlowColor * uGlow * (0.35 + 0.65 * diffuseColor.rgb);
          // One light running across the letters while the camera holds them.
          float bx = (vAcmW.x - uSweep) / 26.0;
          totalEmissiveRadiance += vec3(0.86, 0.8, 1.0) * exp(-bx * bx) * uSweepAmt;
        }`,
      );
    };
    mat.customProgramCacheKey = () => 'intro-acm-ceg';
    // (Its own light haze instead of the film's fog: see above.)
    mat.fog = false;
    const width = Math.max(...placed.map((p) => Math.abs(p.x * CAP) + p.glyph.width * CAP));
    // The widest line, edge to edge (m).
    const span = (Math.max(...placed.map((p) => p.x + p.glyph.width)) - Math.min(...placed.map((p) => p.x))) * CAP;
    return { placed, geos, mat, uniforms, width, span };
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
    const share = portrait ? 0.84 : 0.76;
    g.scale.setScalar(Math.min(1, (share * 2 * HOLD_DISTANCE * tanH) / res.span));
    const n = res.placed.length;
    res.placed.forEach((p, i) => {
      const m = letters.current[i];
      if (!m) return;
      // Surfacing in turn out of the cloud, and settling: it comes up past its place and back a
      // touch, with a little lean it loses as it stands.
      const k = ease(t, T.acmCegIn + i * 0.42, T.acmCegIn + 2.7 + i * 0.42);
      const over = Math.sin(Math.PI * Math.min(1, k * 1.15)) * 0.035 * (1 - k);
      m.position.y = -(1 - k) * CAP * 1.7 + over * CAP;
      m.rotation.x = (1 - k) * 0.3;
      m.visible = k > 0.001;
      void n;
    });
    const u = res.uniforms;
    // Its own violet glow comes up as it surfaces and holds through the composition.
    u.uGlow.value = 0.1 * ease(t, T.acmCegIn, T.acmCeg);
    (u.uHazeColor.value as Color).copy(look.fogColor);
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
