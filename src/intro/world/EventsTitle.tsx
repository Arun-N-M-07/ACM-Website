'use client';
/**
 * EVENTS — dimensional lettering mounted on the lobby's feature wall, above
 * the door it names (Gate.tsx).
 *
 * Letters are exact outlines (glyphs.ts), extruded deep with bevelled edges:
 * faces of polished steel washed by a hidden light from above, sides dark
 * and metallic so the edges catch every light there is — the same letters
 * the lobby has always had, now doing what architectural lettering does:
 * standing a hand's width off the wall, lit from a slot of warm light in a
 * ledge beneath them, a soft glow thrown back onto the stone behind.
 *
 * The lights come up as the camera levels out in the lobby, and a highlight
 * runs once across the word — where the scroll is, not when.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { AdditiveBlending, Color, ExtrudeGeometry, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, ShaderMaterial, Vector3 } from 'three';
import { useKit } from '@/scenes/underground/kit';
import { merge, metricBox, place } from '@/systems/geometry/build';
import { useGainedLightAnchors } from '@/systems/lighting/lightPool';
import { useDisposable } from '@/systems/performance/useDisposable';
import { introFrame } from '../state';
import { ease, T } from '../timeline';
import { LOBBY, SIGN, SIGN_BASE, SIGN_LAYOUT, SIGN_X0 } from './lobbyLayout';

const FACE = /* glsl */ `
#include <emissivemap_fragment>
{
  // A hidden light from above: brightest at the top of each letter.
  float h = clamp((vEvWorld.y - ${SIGN_BASE.toFixed(2)}) / ${SIGN.H.toFixed(2)}, 0.0, 1.0);
  float wash = 0.2 + 0.8 * smoothstep(0.05, 1.0, h) * smoothstep(1.02, 0.7, h);
  // …and the warm slot below, grazing the letters' feet.
  float graze = smoothstep(0.45, 0.0, h);
  // The highlight that runs across the word.
  float bx = (vEvWorld.x - uSweep) * 0.9;
  float band = exp(-bx * bx);
  totalEmissiveRadiance += uFaceLight * (wash * uLight + band * uSweepAmt) + uGraze * graze * uLight * 0.9;
}
`;

export function EventsTitle() {
  const kit = useKit();
  const res = useDisposable(() => {
    const opts = { depth: SIGN.depth, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.025, bevelSegments: 3, curveSegments: 14 };
    const letters = SIGN_LAYOUT.letters.map((l) => new ExtrudeGeometry(l.glyph.shape, opts).translate(SIGN_X0 + l.x, 0, -SIGN.depth / 2));
    const uniforms = {
      uLight: { value: 0.2 },
      uSweep: { value: -12 },
      uSweepAmt: { value: 0 },
      uFaceLight: { value: new Color('#ffe6cc') },
      uGraze: { value: new Color('#ffc890') },
    };
    const face = new MeshStandardMaterial({ color: '#8d9299', roughness: 0.3, metalness: 0.78 });
    face.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vEvWorld;')
        .replace('#include <fog_vertex>', '#include <fog_vertex>\nvEvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vEvWorld;\nuniform float uLight, uSweep, uSweepAmt;\nuniform vec3 uFaceLight, uGraze;')
        .replace('#include <emissivemap_fragment>', FACE);
    };
    face.customProgramCacheKey = () => 'intro-events-sign-face';
    const side = new MeshStandardMaterial({ color: '#17191c', roughness: 0.26, metalness: 0.8 });
    // The mount: a ledge of dark steel under the letters with a slot of warm light in it.
    const w = SIGN_LAYOUT.width + 1.4;
    const ledge = place(metricBox(w, 0.12, 0.62), { position: [0, SIGN_BASE - 0.36, LOBBY.north + 0.31] });
    const slot = place(metricBox(w - 0.3, 0.02, 0.05), { position: [0, SIGN_BASE - 0.29, LOBBY.north + 0.52] });
    const slotMat = new MeshBasicMaterial({ color: new Color('#ffcf98'), toneMapped: false });
    // The glow the lettering throws back onto the stone behind it.
    const haloGeo = new PlaneGeometry(w + 3, SIGN.H + 3);
    const haloMat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uGlow: { value: 0 }, uColor: { value: new Color('#ffb877') } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uGlow;
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          vec2 q = (vUv - vec2(0.5, 0.42)) * vec2(1.0, 2.6);
          float r = dot(q, q);
          gl_FragColor = vec4(uColor * exp(-r * 5.5) * 0.22 * uGlow, 1.0);
        }`,
    });
    return { letters, ledge, slot, slotMat, haloGeo, haloMat, face, side, uniforms };
  }, []);

  // Real light on the lettering: warm from the ledge, cool from the ceiling in front.
  const anchorList = useMemo(
    () => [
      { position: new Vector3(-3.4, SIGN_BASE - 0.1, LOBBY.north + 1.1), color: new Color('#ffcf9e'), intensity: 7, distance: 6 },
      { position: new Vector3(3.4, SIGN_BASE - 0.1, LOBBY.north + 1.1), color: new Color('#ffcf9e'), intensity: 7, distance: 6 },
      { position: new Vector3(0, SIGN_BASE + SIGN.H + 1.6, LOBBY.north + 4), color: new Color('#e9eeff'), intensity: 14, distance: 12 },
    ],
    [],
  );
  const anchors = useGainedLightAnchors(anchorList);

  useFrame(() => {
    const t = introFrame.t;
    const film = introFrame.active;
    // The lettering's lights come up as the camera comes down into the lobby.
    const light = film ? 0.2 + 0.8 * ease(t, T.shaft + 3, T.lobby + 0.5) : 1;
    const u = res.uniforms;
    u.uLight.value = light * 0.26;
    // One highlight across the word, as the camera crosses the lobby.
    const sweep = film ? Math.min(1, Math.max(0, (t - (T.lobby + 0.5)) / 3.2)) : 1;
    u.uSweep.value = SIGN_X0 - 1.5 + sweep * (SIGN_LAYOUT.width + 3);
    u.uSweepAmt.value = film ? Math.sin(Math.PI * sweep) * 0.7 : 0;
    res.slotMat.color.set('#ffcf98').multiplyScalar(0.1 + 1.5 * light);
    res.haloMat.uniforms.uGlow.value = light;
    anchors.forEach((a) => (a.gain = light));
  });

  return (
    <group name="intro-events">
      <group position={[0, SIGN_BASE, LOBBY.north + SIGN.standoff + SIGN.depth / 2]}>
        {res.letters.map((g, i) => (
          <mesh key={i} geometry={g} material={[res.face, res.side]} />
        ))}
      </group>
      <mesh geometry={res.ledge} material={kit.steel} />
      <mesh geometry={res.slot} material={res.slotMat} />
      <mesh geometry={res.haloGeo} material={res.haloMat} position={[0, SIGN_BASE + SIGN.H / 2, LOBBY.north + 0.13]} renderOrder={1} />
    </group>
  );
}
