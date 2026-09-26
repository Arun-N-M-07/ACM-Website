'use client';
/**
 * EVENTS — the last thing the film shows, and the door it goes through.
 *
 * Physical letters (glyphs.ts, extruded with bevelled edges) standing across
 * the end of the tunnel, in front of the corridor's lit mouth. They come out
 * of the dark as the tunnel is lit; on the bar after the loudest (2:04) the
 * light finds them — a hidden light from above brightens their faces and a
 * highlight runs across the word — and the nearer the camera comes the more
 * they are lit for real (the facility's pooled lights, placed at their feet).
 * Their sides are dark and metallic, so the edges catch every light there is.
 *
 * As the camera arrives, the word parts at its middle — EVE | NTS — like a
 * pair of doors, and the camera passes through into the Events.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, ExtrudeGeometry, type Group, MeshStandardMaterial, Vector3 } from 'three';
import { FLOOR_Y } from '@/config/world';
import { useGainedLightAnchors } from '@/systems/lighting/lightPool';
import { useDisposable } from '@/systems/performance/useDisposable';
import { introFrame } from '../state';
import { ease, T } from '../timeline';
import { layoutWord } from './glyphs';

/** Where the word stands (its face), and its size. */
export const EVENTS_Z = 31;
const H = 2.3;
const STROKE = 0.33;
const DEPTH = 0.42;
const BASE = FLOOR_Y + 0.42;
/** The gap at the word's middle, at rest and fully parted (m). */
const GAP = 0.9;
const PART = 0.95;

const FACE = /* glsl */ `
#include <emissivemap_fragment>
{
  // A hidden light from above: brightest at the top of each letter.
  float h = clamp((vEvWorld.y - ${BASE.toFixed(2)}) / ${H.toFixed(2)}, 0.0, 1.0);
  float wash = 0.12 + 0.88 * smoothstep(0.1, 1.0, h) * smoothstep(1.02, 0.7, h);
  // The highlight that runs across the word as the light finds it.
  float bx = (vEvWorld.x - uSweep) * 0.9;
  float band = exp(-bx * bx);
  totalEmissiveRadiance += uFaceLight * (wash * uLight + band * uSweepAmt);
}
`;

export function EventsTitle() {
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);

  const res = useDisposable(() => {
    const word = layoutWord('EVENTS', H, STROKE, 0.34);
    const split = 3;
    const leftWidth = word.letters[split - 1].x + word.letters[split - 1].glyph.width;
    const opts = { depth: DEPTH, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.028, bevelSegments: 2, curveSegments: 12 };
    const make = (i: number, offset: number) => {
      const l = word.letters[i];
      const g = new ExtrudeGeometry(l.glyph.shape, opts);
      g.translate(l.x - offset, 0, -DEPTH / 2);
      return g;
    };
    const lefts = [0, 1, 2].map((i) => make(i, leftWidth));
    const rightStart = word.letters[split].x;
    const rights = [3, 4, 5].map((i) => make(i, rightStart));
    const uniforms = {
      uLight: { value: 0 },
      uSweep: { value: -8 },
      uSweepAmt: { value: 0 },
      uFaceLight: { value: new Color('#ffe2c4') },
    };
    const face = new MeshStandardMaterial({ color: '#6c6057', roughness: 0.42, metalness: 0.32 });
    face.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vEvWorld;')
        .replace('#include <fog_vertex>', '#include <fog_vertex>\nvEvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vEvWorld;\nuniform float uLight, uSweep, uSweepAmt;\nuniform vec3 uFaceLight;')
        .replace('#include <emissivemap_fragment>', FACE);
    };
    face.customProgramCacheKey = () => 'intro-events-face';
    const side = new MeshStandardMaterial({ color: '#1b1714', roughness: 0.28, metalness: 0.75 });
    return { lefts, rights, face, side, uniforms };
  }, []);

  // Real light for the word when the camera is near: at its feet, and above.
  const anchorList = useMemo(
    () => [
      { position: new Vector3(-3.6, FLOOR_Y + 1.1, EVENTS_Z + 3.6), color: new Color('#ffcf9e'), intensity: 6, distance: 10 },
      { position: new Vector3(3.6, FLOOR_Y + 1.1, EVENTS_Z + 3.6), color: new Color('#ffcf9e'), intensity: 6, distance: 10 },
      { position: new Vector3(0, FLOOR_Y + 6.2, EVENTS_Z + 3.8), color: new Color('#e9eeff'), intensity: 10, distance: 14 },
    ],
    [],
  );
  const anchors = useGainedLightAnchors(anchorList);

  useFrame(() => {
    const t = introFrame.t;
    const film = introFrame.active;
    // Out of the dark with the tunnel; the light finds it on the 2:04 bar.
    const light = film ? 0.08 * ease(t, T.tunnel, T.tunnel + 1.5) + 0.92 * ease(t, T.events - 0.2, T.events + 1.4) : 1;
    const u = res.uniforms;
    u.uLight.value = light * 0.24;
    const sweep = film ? Math.min(1, Math.max(0, (t - (T.events - 0.1)) / 1.5)) : 1;
    u.uSweep.value = -7 + sweep * 14;
    u.uSweepAmt.value = film ? Math.sin(Math.PI * sweep) * 0.9 : 0;
    anchors.forEach((a) => (a.gain = light));
    // The doors: EVE and NTS part as the camera arrives.
    const part = film ? PART * ease(t, T.end - 1.85, T.end - 0.75) : PART;
    if (left.current) left.current.position.x = -GAP / 2 - part;
    if (right.current) right.current.position.x = GAP / 2 + part;
  });

  return (
    <group name="intro-events" position={[0, BASE, EVENTS_Z]}>
      <group ref={left}>
        {res.lefts.map((g, i) => (
          <mesh key={i} geometry={g} material={[res.face, res.side]} />
        ))}
      </group>
      <group ref={right}>
        {res.rights.map((g, i) => (
          <mesh key={i} geometry={g} material={[res.face, res.side]} />
        ))}
      </group>
    </group>
  );
}
