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
 * The lights come up as the camera levels out in the lobby, and one light
 * runs once across the word, left to right — where the scroll is, not when.
 * It is the only light that moves on the letters: the faces' reflection of
 * the room is held as it is when the camera levels out (below), so the lens
 * crossing the lobby doesn't slide the room's bright panels over the steel,
 * lighting letters on its own.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { AdditiveBlending, Color, ExtrudeGeometry, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, ShaderChunk, ShaderMaterial, Vector3 } from 'three';
import { useKit } from '@/scenes/underground/kit';
import { merge, metricBox, place } from '@/systems/geometry/build';
import { useGainedLightAnchors } from '@/systems/lighting/lightPool';
import { useDisposable } from '@/systems/performance/useDisposable';
import { introCameraAt } from '../camera';
import { introFrame } from '../state';
import { ease, span, T } from '../timeline';
import { LOBBY, SIGN, SIGN_BASE, SIGN_LAYOUT, SIGN_X0, SIGN_Z } from './lobbyLayout';

/**
 * The light across the word: a soft bar of light, leaning a little, that
 * crosses at one speed and one strength — a bright core in a wide falloff —
 * from clear of the E to clear of the S (world units).
 */
const SWEEP = { lean: 0.35, core: 0.32, falloff: 1.2, coreShare: 0.6, strength: 2, from: T.lobby + 0.5, to: T.lobby + 3.7 } as const;
const SWEEP_MID = SIGN_BASE + SIGN.H / 2;
const SWEEP_CLEAR = 3 * SWEEP.falloff + SWEEP.lean * SIGN.H * 0.5;
const SWEEP_X0 = SIGN_X0 - SWEEP_CLEAR;
const SWEEP_X1 = SIGN_X0 + SIGN_LAYOUT.width + SWEEP_CLEAR;

// Where the light is on a letter: one coordinate across the whole word (the lobby's x, leaning with
// height), so it runs through the letters as one light, never letter by letter.
const SWEEP_BAND = /* glsl */ `
  float bx = vEvWorld.x - ${SWEEP.lean.toFixed(3)} * (vEvWorld.y - ${SWEEP_MID.toFixed(3)}) - uSweep;
  float band = ${SWEEP.coreShare.toFixed(3)} * exp(-bx * bx / ${(SWEEP.core * SWEEP.core).toFixed(4)})
    + ${(1 - SWEEP.coreShare).toFixed(3)} * exp(-bx * bx / ${(SWEEP.falloff * SWEEP.falloff).toFixed(4)});
`;

const FACE = /* glsl */ `
#include <emissivemap_fragment>
{
  // A hidden light from above: brightest at the top of each letter.
  float h = clamp((vEvWorld.y - ${SIGN_BASE.toFixed(2)}) / ${SIGN.H.toFixed(2)}, 0.0, 1.0);
  float wash = 0.2 + 0.8 * smoothstep(0.05, 1.0, h) * smoothstep(1.02, 0.7, h);
  // …and the warm slot below, grazing the letters' feet.
  float graze = smoothstep(0.45, 0.0, h);
  // The light that runs across the word.
  ${SWEEP_BAND}
  totalEmissiveRadiance += uFaceLight * (wash * uLight + band * uSweepAmt) + uGraze * graze * uLight * 0.9;
}
`;

// The faces reflect the room as seen from where the camera levels out in the lobby (uEye), wherever
// the lens is: flat polished faces a few metres from a moving camera would otherwise carry the room's
// lights across the word as the camera crosses the lobby — patches of glare coming and going on
// letters of their own. (Only the reflection's direction is held; its strength still follows the view.)
const FACE_REFLECTION = /* glsl */ `
{
  vec3 geometryViewDir = normalize((viewMatrix * vec4(normalize(uEye - vEvWorld), 0.0)).xyz);
  #include <lights_fragment_maps>
}
`;

// The edges catch the light as it passes: those turned towards it most.
const SIDE = /* glsl */ `
#include <emissivemap_fragment>
{
  ${SWEEP_BAND}
  vec3 nW = inverseTransformDirection(normal, viewMatrix);
  vec3 toLight = normalize(vec3(uSweep, ${SWEEP_MID.toFixed(3)}, ${(SIGN_Z + 1.2).toFixed(3)}) - vEvWorld);
  float facing = max(dot(nW, toLight), 0.0);
  float glint = pow(max(dot(nW, normalize(toLight + normalize(cameraPosition - vEvWorld))), 0.0), 24.0);
  totalEmissiveRadiance += uFaceLight * band * uSweepAmt * (0.3 * facing + 1.2 * glint);
}
`;

// The lobby's lamps are pooled (lightPool): the nearest few anchors get the real lights, and the pool
// moves them on as the camera crosses the room. Where the room's reflection lights the steel (the high
// and medium tiers) the lamps add a little light to the letters, evenly enough. Without it (the low
// tier) the letters would take their light from the lamps alone — two for the whole lobby: one end of
// the word lit until the pool moves the lamp on, a letter dimming by itself mid-sweep. There the letters
// keep to the lights that are theirs: the wash, the slot, the sweep.
const LAMPS = '#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )';
const LETTER_LIGHTS = ShaderChunk.lights_fragment_begin.replace(LAMPS, `${LAMPS} && defined( USE_ENVMAP )`);

const withWorldPosition = (shader: { vertexShader: string }) => {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vEvWorld;')
    .replace('#include <fog_vertex>', '#include <fog_vertex>\nvEvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
};

export function EventsTitle() {
  const kit = useKit();
  const res = useDisposable(() => {
    const opts = { depth: SIGN.depth, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.025, bevelSegments: 3, curveSegments: 14 };
    const letters = SIGN_LAYOUT.letters.map((l) => new ExtrudeGeometry(l.glyph.shape, opts).translate(SIGN_X0 + l.x, 0, -SIGN.depth / 2));
    const uniforms = {
      uLight: { value: 0.2 },
      uSweep: { value: SWEEP_X0 },
      uSweepAmt: { value: 0 },
      uEye: { value: introCameraAt(SWEEP.from).pos.clone() },
      uFaceLight: { value: new Color('#ffe6cc') },
      uGraze: { value: new Color('#ffc890') },
    };
    const face = new MeshStandardMaterial({ color: '#8d9299', roughness: 0.3, metalness: 0.78 });
    face.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      withWorldPosition(shader);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vEvWorld;\nuniform float uLight, uSweep, uSweepAmt;\nuniform vec3 uFaceLight, uGraze, uEye;')
        .replace('#include <emissivemap_fragment>', FACE)
        .replace('#include <lights_fragment_begin>', LETTER_LIGHTS)
        .replace('#include <lights_fragment_maps>', FACE_REFLECTION);
    };
    face.customProgramCacheKey = () => 'intro-events-sign-face';
    const side = new MeshStandardMaterial({ color: '#17191c', roughness: 0.26, metalness: 0.8 });
    side.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      withWorldPosition(shader);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vEvWorld;\nuniform float uSweep, uSweepAmt;\nuniform vec3 uFaceLight;')
        .replace('#include <emissivemap_fragment>', SIDE)
        .replace('#include <lights_fragment_begin>', LETTER_LIGHTS);
    };
    side.customProgramCacheKey = () => 'intro-events-sign-side';
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
    // One light across the word as the camera crosses the lobby: its place follows the beat alone
    // (scrolled back, it goes back), at one strength the whole way — it comes on and goes off clear of
    // the letters, so nothing on them ever switches.
    const sweep = film ? span(t, SWEEP.from, SWEEP.to) : 1;
    u.uSweep.value = SWEEP_X0 + sweep * (SWEEP_X1 - SWEEP_X0);
    u.uSweepAmt.value = film ? SWEEP.strength : 0;
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
