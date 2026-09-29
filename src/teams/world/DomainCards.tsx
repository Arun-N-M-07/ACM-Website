'use client';
/**
 * The domain cards: physical plates on articulated mounts off the spine.
 *
 * Each card is one object — a thick frosted slab under a polished coat, with
 * its lettering printed into the front face inside the same material (not a
 * separate plane floating above it), so the type shares the card's lighting,
 * reflections, perspective and depth:
 *
 *   body       physical transmission with real roughness: what's behind the
 *              card (the spine, the dust) reads as a soft, tinted silhouette
 *   coat       a clear, glossy clearcoat over the frosted body: crisp studio
 *              reflections slide across the surface, over the print as well
 *   print      the face texture's coverage, front face only, opaque where
 *              inked, satin (rougher) under the coat
 *   edges      a rounded bevel that catches the environment
 *
 * Motion is layered on top of the orbit: the cards near the camera trail the
 * orbit slightly (cardVel, a little behind the camera), the one under the
 * pointer leans towards the hit point and takes a soft sheen there, and every
 * response decays back to the pure scroll pose.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Color, CylinderGeometry, ExtrudeGeometry, type Group, Matrix4, type Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Shape, type Texture, Vector2, Vector3 } from 'three';
import { QUALITY } from '@/config/quality';
import { DOMAIN_COUNT, TEAM_DOMAINS, type TeamDomain } from '@/content/teams';
import { useExperience } from '@/store/experience';
import { smoothstep } from '@/systems/camera/pose';
import { useDisposable } from '@/systems/performance/useDisposable';
import { fontsReady, makeCanvas, toTexture } from '@/systems/textures/typeset';
import { FOCUS_PUSH } from '../camera';
import { cardPick } from '../controller';
import { cardAngle, cardCenter, cardY, O, spineAxis, type Composition } from '../layout';
import { stepSpring } from '../pointer';
import { teamsFrame } from '../state';
import { drawCardFace } from './cardFace';

function roundedRect(w: number, h: number, r: number) {
  const s = new Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s;
}

export const appearAt = (i: number, arrival: number) => {
  const start = 0.3 + (i / Math.max(1, DOMAIN_COUNT - 1)) * 0.35;
  return smoothstep(start, start + 0.2, arrival);
};

/** The print's colour (bone), before the coat. */
const INK = new Color('#f4f1ea');

const c = new Vector3();
const anchor = new Vector3();
const elbow = new Vector3();
const end = new Vector3();
const direction = new Vector3();
const up = new Vector3(0, 1, 0);
const front = new Matrix4();

function mount(mesh: Mesh | null, a: Vector3, b: Vector3) {
  if (!mesh) return;
  direction.subVectors(b, a);
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  mesh.scale.set(1, direction.length(), 1);
  mesh.quaternion.setFromUnitVectors(up, direction.normalize());
}

function DomainCard({ d, i, comp, env }: { d: TeamDomain; i: number; comp: Composition; env: Texture | null }) {
  const group = useRef<Group>(null);
  const armA = useRef<Mesh>(null);
  const armB = useRef<Mesh>(null);
  const arms = useRef<Group>(null);
  /** The last point the pointer touched on this card (so the lean eases out instead of snapping). */
  const held = useRef({ x: 0, y: 0 });
  /** The plate on its mount: tilt about x and y, and how far it's pressed in — each a spring. */
  const phys = useRef({ tx: { v: 0, dv: 0 }, ty: { v: 0, dv: 0 }, dz: { v: 0, dv: 0 }, touch: { v: 0, dv: 0 } });
  const quality = useExperience((s) => s.quality);
  const scale = QUALITY[quality].textureScale;

  const geo = useDisposable(() => {
    const slab = new ExtrudeGeometry(roundedRect(comp.cardW, comp.cardH, comp.corner), {
      depth: comp.cardDepth,
      bevelEnabled: true,
      bevelThickness: 0.022,
      bevelSize: 0.02,
      bevelSegments: 4,
      curveSegments: 10,
    });
    slab.translate(0, 0, -comp.cardDepth / 2);
    return { slab, arm: new CylinderGeometry(0.03, 0.055, 1, 10) };
  }, [comp.cardW, comp.cardH, comp.corner, comp.cardDepth]);

  const tex = useDisposable(() => {
    const w = Math.round((comp.portrait ? 900 : 1280) * Math.max(0.6, scale));
    const { canvas, ctx } = makeCanvas(w, Math.round((w * comp.cardH) / comp.cardW));
    return { canvas, ctx, texture: toTexture(canvas, { anisotropy: 8 }) };
  }, [comp.cardW, comp.cardH, comp.portrait, scale]);

  const mats = useDisposable(() => {
    const tone = new Color(d.tone);
    // Each plate is cut from the same stock but not identical: a little more or less frost.
    const frost = 0.6 + ((i * 3) % 5) * 0.025;
    const glass = new MeshPhysicalMaterial({
      color: new Color('#dfe3e4').lerp(tone, 0.3),
      metalness: 0,
      roughness: frost,
      // Every tier frosts (the low tier renders the transmission at half resolution — it's blurred anyway).
      transmission: quality === 'high' ? 0.9 : quality === 'medium' ? 0.86 : 0.84,
      thickness: 0.8,
      ior: 1.5,
      attenuationColor: tone.clone().lerp(new Color('#ffffff'), 0.4),
      attenuationDistance: 1.0,
      specularIntensity: 0.7,
      clearcoat: 0.85,
      clearcoatRoughness: 0.08,
      envMap: env,
      envMapIntensity: 0.9,
    });
    const uniforms = {
      uFace: { value: tex.texture },
      uCard: { value: new Vector2(comp.cardW, comp.cardH) },
      uInk: { value: INK.clone() },
      uInkK: { value: 1 },
      uInkLight: { value: 0.82 },
      uHit: { value: new Vector3() },
      /** A press on the surface (0..1): the touch landing. */
      uTouch: { value: 0 },
      /** The doorway opening in the surface (0 closed … 1 open from centre to corners). */
      uOpen: { value: 0 },
      /** The card's commit: its edges catch the light as it comes forward. */
      uCommit: { value: 0 },
      uTone: { value: new Color(d.tone) },
    };
    glass.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vCardP;\nvarying float vCardNz;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCardP = position;\nvCardNz = normal.z;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform sampler2D uFace;
uniform vec2 uCard;
uniform vec3 uInk;
uniform float uInkK;
uniform float uInkLight;
uniform vec3 uHit;
uniform float uTouch;
uniform float uOpen;
uniform float uCommit;
uniform vec3 uTone;
varying vec3 vCardP;
varying float vCardNz;`,
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
// The print: the face's coverage, on the front face only.
float inkA = texture2D(uFace, vCardP.xy / uCard + 0.5).a * smoothstep(0.55, 0.9, vCardNz) * uInkK;
// Where the pointer rests, the surface is touched: a little smoother, a little brighter.
vec2 hitD = vCardP.xy - uHit.xy;
float sheen = uHit.z * exp(-dot(hitD, hitD) * 6.0);
// A press gathers under the finger: a tighter, clearer spot in the frost.
float touchSpot = uTouch * exp(-dot(hitD, hitD) * 14.0);
// The rounded edge (between the face and the side) catches a little more light as the pointer nears.
float bevel = smoothstep(0.08, 0.45, vCardNz) * (1.0 - smoothstep(0.62, 0.96, vCardNz));
// The doorway: near the eye the surface opens from the centre outward — the
// frost clears and the print gives way inside a widening aperture, and the
// aperture's edge catches a little light as the material parts.
vec2 cq = vCardP.xy / (uCard * 0.5);
float cr = length(cq * vec2(1.0, 0.82));
float apR = uOpen * 1.75;
float opened = uOpen > 0.001 ? 1.0 - smoothstep(apR - 0.32, apR, cr) : 0.0;
float apRim = uOpen > 0.001 ? (smoothstep(apR - 0.32, apR - 0.08, cr) - smoothstep(apR - 0.08, apR + 0.06, cr)) * (1.0 - smoothstep(0.85, 1.0, uOpen)) : 0.0;
inkA *= 1.0 - opened;
diffuseColor.a = mix(diffuseColor.a, 1.0, inkA);`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor - 0.12 * sheen - 0.22 * touchSpot, 0.04, 1.0);
roughnessFactor = mix(roughnessFactor, 0.55, inkA);
roughnessFactor = mix(roughnessFactor, 0.02, opened);`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(0.92, 0.9, 0.86) * (0.03 * sheen + 0.03 * touchSpot);
totalEmissiveRadiance += vec3(0.86, 0.88, 0.92) * (0.07 * uHit.z + 0.1 * uCommit) * bevel;
totalEmissiveRadiance += mix(vec3(0.9, 0.88, 0.84), uTone, 0.4) * 0.16 * apRim;`,
        )
        .replace(
          '#include <lights_physical_fragment>',
          `#include <lights_physical_fragment>
// Inside the opening there is no surface left to reflect: the coat and the
// specular give way with the frost.
material.clearcoat *= 1.0 - opened;
material.specularF90 *= 1.0 - 0.9 * opened;
material.specularColor *= 1.0 - 0.9 * opened;`,
        )
        .replace(
          '#include <transmission_fragment>',
          `#include <transmission_fragment>
totalDiffuse = mix(totalDiffuse, uInk * uInkLight, inkA);`,
        );
    };
    glass.customProgramCacheKey = () => 'teams-card-v5';
    const mountMaterial = new MeshStandardMaterial({ color: '#5f676a', metalness: 0.75, roughness: 0.34, envMap: env, envMapIntensity: 0.9 });
    return { glass, uniforms, mountMaterial, base: glass.color.clone(), frost, transmission: glass.transmission };
  }, [d.tone, i, quality, env, tex, comp.cardW, comp.cardH]);

  useEffect(() => {
    let alive = true;
    const draw = () => {
      if (!alive) return;
      drawCardFace(tex.ctx, tex.canvas.width, tex.canvas.height, d, i, (comp.corner / comp.cardW) * tex.canvas.width, { portrait: comp.portrait, mode: 'settled', t: 1, seed: i });
      tex.texture.needsUpdate = true;
    };
    // Draw now, and again once the web fonts are certainly usable in canvas (only if drawing set one
    // loading — they are loaded before the world is built, so otherwise it would draw the same).
    draw();
    if (document.fonts && document.fonts.status !== 'loaded') void fontsReady().then(draw);
    return () => {
      alive = false;
    };
    // (Keyed on what the face reads, not the whole composition, which is new on every resize.)
  }, [tex, d, i, comp.corner, comp.cardW, comp.portrait]);

  useFrame(({ clock, camera }, dt) => {
    const g = group.current;
    if (!g) return;
    const f = teamsFrame;
    const reduced = useExperience.getState().reducedMotion;
    const appear = appearAt(i, f.reveal);
    const near = Math.max(0, 1 - Math.abs(f.focusK - i));
    // The chosen card answers the click at once (its own quick clock)…
    const selected = f.commit * near;
    // …and the rest of the ring gives way in order: neighbours first, the far cards later.
    const rank = Math.min(4, Math.abs(i - f.focusK));
    const others = smoothstep(0.03 + 0.06 * rank, 0.5 + 0.06 * rank, f.focus) * (1 - near);
    const a = cardAngle(i);
    // The threshold: as the eye closes on the chosen card its frost clears, so
    // the card becomes a window, then a doorway the member hand rises out of.
    cardCenter(i, comp, c, FOCUS_PUSH);
    const surface = (camera.position.x - c.x) * Math.sin(a) + (camera.position.z - c.z) * Math.cos(a);
    // The doorway opens over the last metre and a half before the eye reaches the surface.
    const open = f.focus > 0.3 ? near * (1 - smoothstep(0.08, 1.5, surface)) : 0;
    const clarity = open * open;

    // Proximity: the pointer's influence on this card (0..1, eased in quickly, out a little slower).
    const prox = reduced ? 0 : f.hoverAmt[i] * (1 - selected);
    const pressing = f.press.card === i && !reduced ? 1 : 0;
    if (pressing) {
      held.current.x = f.press.x;
      held.current.y = f.press.y;
    } else if (f.hover === i) {
      held.current.x = f.hoverAt.x;
      held.current.y = f.hoverAt.y;
    }
    const hx = held.current.x / (comp.cardW / 2);
    const hy = held.current.y / (comp.cardH / 2);
    // The pointer as a small force on a plate on its mount. Where it rests the
    // plate gives a little (that side goes back); a pointer moving across it
    // drags it a touch the same way; a press pushes in harder. Springs: quick
    // to answer, slower to recover, no bounce. Choosing the card hands the
    // force over to the commit — the plate straightens as it comes forward.
    const P = phys.current;
    const free = 1 - selected;
    const drag = Math.max(-1, Math.min(1, f.pointer.fvx * 0.35)) * prox;
    const lift = Math.max(-1, Math.min(1, f.pointer.fvy * 0.35)) * prox;
    stepSpring(P.ty, (hx * (0.028 * prox + 0.04 * pressing) + 0.02 * drag) * free, dt, 16, 6);
    stepSpring(P.tx, (-hy * (0.022 * prox + 0.03 * pressing) - 0.015 * lift) * free, dt, 16, 6);
    stepSpring(P.dz, -(0.02 * prox * (0.6 + 0.4 * f.pointer.energy) + 0.045 * pressing) * free, dt, 18, 7);
    stepSpring(P.touch, pressing, dt, 22, 5);
    // The local layer: cards near the camera trail the orbit a touch, then settle forward.
    const w = 1 - smoothstep(0.5, 2, Math.abs(i - f.c));
    const flex = reduced ? 0 : Math.max(-1.4, Math.min(1.4, f.cardVel)) * w * (1 - selected) * (1 - f.focus);

    cardCenter(i, comp, c, FOCUS_PUSH * selected + 1.0 * others + P.dz.v - 0.03 * Math.abs(flex) + (1 - appear) * 1.4);
    // The ring gives way in order: the neighbours part to either side (making room), the
    // far cards sink and dim.
    const side = Math.sign(i - f.focusK) * others * (rank <= 1.5 ? 0.45 : 0.18);
    c.y -= (0.25 + 0.08 * rank) * others;
    // Slide along the ring against the direction of travel (the plate's +x is screen right at rest).
    const along = -0.06 * flex + side;
    c.x += Math.cos(a) * along;
    c.z -= Math.sin(a) * along;
    c.y += (reduced ? 0 : Math.sin(clock.elapsedTime * 0.5 - i) * 0.012) * (1 - selected);
    g.position.copy(c);
    const toward = Math.max(-0.08, Math.min(0.08, (cardAngle(Math.max(0, f.c)) - a) * 0.1));
    g.rotation.set(P.tx.v, a + toward * (1 - selected) - 0.02 * flex + P.ty.v + Math.sign(i - f.focusK) * others * 0.12, 0, 'YXZ');
    // Chosen: a slight lift in scale as it snaps to attention.
    g.scale.setScalar((0.94 + appear * 0.06) * (1 + 0.035 * selected));
    // The rest of the ring has given way before the eye comes through the chosen card.
    g.visible = appear > 0.002 && (near > 0.5 ? true : others < 0.85);

    const glass = mats.glass;
    glass.color.copy(mats.base).multiplyScalar(1 - (0.7 + 0.06 * rank) * others);
    // Chosen, the studio's reflection in the coat quietens as the plate fills the view.
    glass.envMapIntensity = (0.72 + 0.18 * appear + 0.12 * prox) * (1 - 0.8 * others) * (1 - 0.45 * selected) * (1 - 0.85 * clarity);
    // Chosen, the plate clears a little and deepens even before the threshold; near the pointer
    // a touch more light passes through its body.
    const frost = mats.frost * (1 - 0.18 * selected);
    glass.roughness = frost + (0.03 - frost) * clarity;
    const trans = Math.min(1, mats.transmission + 0.03 * prox + 0.05 * selected);
    glass.transmission = trans + (1 - trans) * clarity;
    glass.attenuationDistance = 1 + 7 * clarity;
    const u = mats.uniforms;
    u.uInkK.value = appear * (1 - 0.95 * others) * (1 - clarity);
    u.uInkLight.value = 0.82 + 0.08 * prox;
    u.uHit.value.set(held.current.x, held.current.y, Math.max(prox, P.touch.v * 0.6));
    u.uTouch.value = P.touch.v;
    u.uOpen.value = open;
    u.uCommit.value = selected * (1 - open);

    // Articulated struts connect the moving plate to the same curve as the spine.
    spineAxis(cardY(i, comp), anchor).add(O);
    elbow.copy(anchor);
    elbow.x += Math.sin(a) * 2.1;
    elbow.z += Math.cos(a) * 2.1;
    elbow.y -= 0.28;
    end.copy(c);
    end.x -= (Math.sin(a) * comp.cardDepth) / 2;
    end.z -= (Math.cos(a) * comp.cardDepth) / 2;
    mount(armA.current, anchor, elbow);
    mount(armB.current, elbow, end);
    if (arms.current) arms.current.visible = g.visible && f.focus < 0.52;

    g.updateMatrixWorld();
    const pick = cardPick[i];
    // The pick plane is the front face of the slab.
    pick.matrix.multiplyMatrices(g.matrixWorld, front.makeTranslation(0, 0, comp.cardDepth / 2));
    pick.hw = comp.cardW / 2;
    pick.hh = comp.cardH / 2;
    pick.radius = comp.corner;
    pick.live = g.visible && appear > 0.9 && f.focus < 0.02;
  });

  return (
    <>
      <group ref={arms}>
        <mesh ref={armA} geometry={geo.arm} material={mats.mountMaterial} />
        <mesh ref={armB} geometry={geo.arm} material={mats.mountMaterial} />
      </group>
      <group ref={group} name={`card-${d.slug}`}>
        <mesh geometry={geo.slab} material={mats.glass} />
      </group>
    </>
  );
}

export function DomainCards({ comp, env }: { comp: Composition; env: Texture | null }) {
  useEffect(
    () => () => {
      for (const p of cardPick) p.live = false;
    },
    [],
  );
  return (
    <group name="domain-cards">
      {TEAM_DOMAINS.map((d, i) => (
        <DomainCard key={`${d.slug}-${comp.portrait}`} d={d} i={i} comp={comp} env={env} />
      ))}
    </group>
  );
}
