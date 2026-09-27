'use client';
/**
 * ASSOCIATION FOR COMPUTING MACHINERY — the chapter's name, standing in the
 * world rather than floating over it.
 *
 * A slab of dark stone stands in the garden mist, off the walk, turned to
 * face whoever stops before it. The name is set on its face in the blade
 * letterforms (acmGlyphs.ts), cut from brushed steel, a finger's depth, held
 * off the stone — architectural lettering, the kind that is lit, not
 * printed. A thin red line is inlaid beneath it. It is in the same mist, the
 * same pre-dawn light, as everything else: it comes out of the mist as the
 * camera turns to it, and goes back into it as the camera moves on.
 *
 * Its moment is physical, and it is the scroll's: the camera turns aside
 * after the second fragment burns and walks up to the stone; the uplight in
 * its plinth wakes and the letters catch it from below; one light runs
 * across the metal; the camera holds, reads, and moves on. The name's
 * letterforms keep their character — sharp, a spike on the first A — but in
 * steel and shadow, not a floating chrome title.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Color, ExtrudeGeometry, type Group, MeshBasicMaterial, MeshStandardMaterial, Path, Shape, Vector2, Vector3 } from 'three';
import { merge, metricBox, place } from '@/systems/geometry/build';
import { useGainedLightAnchors } from '@/systems/lighting/lightPool';
import { useDisposable } from '@/systems/performance/useDisposable';
import { patchMist } from '../fog';
import { introFrame } from '../state';
import { ease, span, T } from '../timeline';
import { setName } from './acmGlyphs';
import { chromeStudio } from './chromeStudio';
import { noiseTexture } from './noise';
import { STONE, STONE_FOCUS, STONE_YAW } from './stoneLayout';

/** The letters: plate depth, bevel, and how far they stand off the stone. */
const PLATE = 0.065;
const STANDOFF = 0.035;
/** Where the lettering's middle sits on the stone (m above the plinth). */
const MID = STONE_FOCUS[1] - STONE.plinth;

const LETTER_PARS = /* glsl */ `
varying vec3 vAcmO;
varying vec3 vAcmN;
varying vec3 vAcmUp;
`;
const LETTER_FRAG_PARS = /* glsl */ `
varying vec3 vAcmO;
varying vec3 vAcmN;
varying vec3 vAcmUp;
uniform float uSweep, uSweepAmt, uLift;
uniform vec3 uWarm;
`;
/** Faces steel; the plate's edges darker, with a trace of red in the metal. */
const LETTER_COLOR = /* glsl */ `
#include <alphamap_fragment>
float acmSide = 1.0 - smoothstep(0.55, 0.9, abs(vAcmN.z));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.34, 0.07, 0.08), acmSide);
`;
/** Faces tipped a little up at the top of the name, down at its foot: a brushed, restrained chrome read. */
const LETTER_NORMAL = /* glsl */ `
#include <normal_fragment_maps>
{
  float hy = clamp((vAcmO.y - ${(STONE.plinth + MID).toFixed(2)}) / 1.7, -0.5, 0.5);
  normal = normalize(normal + vAcmUp * hy * 0.4 * (1.0 - acmSide));
}
`;
const LETTER_EMISSIVE = /* glsl */ `
#include <emissivemap_fragment>
{
  // The uplight below: warmest at the letters' feet.
  float lift = smoothstep(${(MID + 1.2).toFixed(2)}, ${(MID - 1.1).toFixed(2)}, vAcmO.y);
  totalEmissiveRadiance += uWarm * diffuseColor.rgb * lift * uLift * 0.16;
  // One light running across the metal.
  float bx = (vAcmO.x - uSweep) * 1.8;
  totalEmissiveRadiance += vec3(1.0, 0.95, 0.88) * exp(-bx * bx) * uSweepAmt * (1.0 - acmSide * 0.6);
}
`;

/** Stone: dark basalt with a little variation (so it reads as stone, not a black box). */
const STONE_FRAG = /* glsl */ `
#include <map_fragment>
{
  float n = texture2D(uStoneNoise, vStone.xy * 0.18).r * 0.6 + texture2D(uStoneNoise, vStone.zy * 0.9).g * 0.4;
  diffuseColor.rgb *= 0.78 + 0.44 * n;
}
`;

export function AcmStone() {
  const gl = useThree((s) => s.gl);
  const group = useRef<Group>(null);
  const studio = useDisposable(() => chromeStudio(gl), [gl]);

  const res = useDisposable(() => {
    const W = STONE.width;
    const H = STONE.height;
    const D = STONE.depth;
    const P = STONE.plinth;
    const body = merge([
      place(metricBox(W, H, D), { position: [0, P + H / 2, 0] }),
      // A plinth, a little proud all round.
      place(metricBox(W + 0.8, P, D + 1), { position: [0, P / 2, 0.15] }),
    ]);
    // The uplight: a slot of warm light in the plinth before the face.
    const slot = place(metricBox(W - 0.7, 0.025, 0.06), { position: [0, P + 0.012, D / 2 + 0.3] });
    // A thin red line inlaid beneath the name.
    const inlay = place(metricBox(W * 0.62, 0.016, 0.01), { position: [0, P + MID - 1.12, D / 2 + 0.004] });

    // The name, cut from steel plate and held off the face.
    const name = setName(STONE.cap);
    const letters = merge(
      name.letters.map((l) => {
        const c = l.cap;
        const shape = new Shape(l.glyph.outer.map(([x, y]) => new Vector2(x * c, y * c)));
        for (const h of l.glyph.holes) shape.holes.push(new Path(h.map(([x, y]) => new Vector2(x * c, y * c))));
        return new ExtrudeGeometry(shape, { depth: PLATE, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 2, curveSegments: 1 }).translate(
          l.x,
          l.y + P + MID,
          D / 2 + STANDOFF,
        );
      }),
    );

    const noise = noiseTexture(128);
    // Dark basalt, so the steel letters stand clear of it.
    const stoneMat = new MeshStandardMaterial({ color: '#141518', roughness: 0.78, metalness: 0.05 });
    stoneMat.onBeforeCompile = (shader) => {
      shader.uniforms.uStoneNoise = { value: noise };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vStone;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvStone = position;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vStone;\nuniform sampler2D uStoneNoise;')
        .replace('#include <map_fragment>', STONE_FRAG);
    };
    stoneMat.customProgramCacheKey = () => 'intro-acm-stone';
    patchMist(stoneMat);

    const uniforms = {
      uSweep: { value: -10 },
      uSweepAmt: { value: 0 },
      uLift: { value: 0 },
      uWarm: { value: new Color('#ffc58f') },
    };
    const letterMat = new MeshStandardMaterial({ color: '#cfd3d8', metalness: 1, roughness: 0.3, envMap: studio.texture, envMapIntensity: 0.5 });
    letterMat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${LETTER_PARS}`)
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvAcmO = position;\nvAcmN = normal;\nvAcmUp = normalize((modelViewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${LETTER_FRAG_PARS}`)
        .replace('#include <alphamap_fragment>', LETTER_COLOR)
        .replace('#include <normal_fragment_maps>', LETTER_NORMAL)
        .replace('#include <emissivemap_fragment>', LETTER_EMISSIVE);
    };
    letterMat.customProgramCacheKey = () => 'intro-acm-letters';
    patchMist(letterMat);

    const slotMat = new MeshBasicMaterial({ color: new Color('#ffcf98'), toneMapped: false });
    const inlayMat = new MeshBasicMaterial({ color: new Color('#8a1720') });
    patchMist(inlayMat);
    return { body, slot, inlay, letters, noise, stoneMat, letterMat, slotMat, inlayMat, uniforms, width: name.letters.reduce((m, l) => Math.max(m, Math.abs(l.x), Math.abs(l.x + l.glyph.width * l.cap)), 0) };
  }, [studio]);

  useEffect(() => gl.initTexture(res.noise), [gl, res]);

  // Real light for the stone's face, from the slot in its plinth.
  const anchorList = useMemo(() => {
    const c = Math.cos(STONE_YAW);
    const s = Math.sin(STONE_YAW);
    const local = new Vector3(0, STONE.plinth + 0.5, STONE.depth / 2 + 1.1);
    // A key from above and in front of the face (a lamp on the path), raking down the letters: their
    // top edges and faces catch it, the stone between them doesn't.
    const key = new Vector3(0.6, STONE.plinth + STONE.height + 1.6, STONE.depth / 2 + 2.6);
    const world = (v: Vector3) => new Vector3(STONE.x + v.x * c + v.z * s, v.y, STONE.z - v.x * s + v.z * c);
    return [
      { position: world(local), color: new Color('#ffcf9e'), intensity: 16, distance: 8 },
      { position: world(key), color: new Color('#f1eee8'), intensity: 70, distance: 12 },
    ];
  }, []);
  const anchors = useGainedLightAnchors(anchorList);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const film = introFrame.active;
    const t = introFrame.t;
    // Behind the camera once the mist has cleared: not drawn.
    const on = film && t < T.clearing + 6;
    g.visible = on;
    anchors[0].gain = on ? ease(t, T.acm - 1, T.acmLit) : 0;
    anchors[1].gain = on ? ease(t, T.acmTurn, T.acm + 2) * (1 - ease(t, T.acmGone, T.acmGone + 6)) : 0;
    if (!on) return;
    // The uplight wakes as the camera comes to the stone, and stays on.
    const lamp = ease(t, T.acm - 1, T.acmLit);
    const u = res.uniforms;
    u.uLift.value = lamp;
    res.slotMat.color.set('#ffcf98').multiplyScalar(0.08 + 1.6 * lamp);
    // One light across the name.
    const sweep = span(t, T.acmLit - 0.5, T.acmHold + 1.5);
    u.uSweep.value = -res.width - 0.8 + sweep * (2 * res.width + 1.6);
    u.uSweepAmt.value = Math.sin(Math.PI * sweep) * 0.55;
    res.letterMat.envMapIntensity = 0.5 + 1.0 * lamp;
  });

  return (
    <group ref={group} name="intro-acm-stone" position={[STONE.x, 0, STONE.z]} rotation={[0, STONE_YAW, 0]}>
      <mesh geometry={res.body} material={res.stoneMat} />
      <mesh geometry={res.letters} material={res.letterMat} />
      <mesh geometry={res.slot} material={res.slotMat} />
      <mesh geometry={res.inlay} material={res.inlayMat} />
    </group>
  );
}
