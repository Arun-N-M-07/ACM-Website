'use client';
/**
 * ParticleField — the dust of the Teams world.
 *
 * Three populations in one draw call:
 *   blooms   dense, petalled clusters flanking the spine at every card's
 *            level (behind the spine as seen from that card), in muted rose,
 *            violet, steel blue and bone — so each card, centred, is framed
 *            by colour behind glass
 *   ambient  fine dust in the air round the column and along the way in
 *   air      the finest motes, world-fixed but wrapped round the camera's
 *            neighbourhood (a tiled volume), so there is always air between
 *            the eye and the cards for the hand to move through; they fade at
 *            the edges of the volume, so the wrap never shows
 *
 * No simulation state: rest positions live in the geometry and all motion is
 * in the vertex shader, driven by a few uniforms —
 *   uTime      drift + the world's wave (shared with spine and cards)
 *   uVel       |scroll velocity|: clusters breathe outward and loosen
 *   uImp*      the air's memory of recent forces (dust.ts): pointer strokes
 *              and a chosen card's landing. Each mote near one is kicked along
 *              it (and a little outward), with a distance falloff, and the
 *              kick carries on briefly and then settles (pointer.ts,
 *              `impulse`) — the hand disturbs the air, and the air settles
 *   uReveal    arrival: points fade up in a staggered order
 *   uDim       a card is open: the dust settles back
 *   uScale     pixels per world unit at distance 1 (size attenuation)
 */
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, type Points, ShaderMaterial, Vector3 } from 'three';
import { useRef } from 'react';
import { DOMAIN_COUNT } from '@/content/teams';
import { rng } from '@/lib/random';
import { useExperience } from '@/store/experience';
import { smoothstep } from '@/systems/camera/pose';
import { useDisposable } from '@/systems/performance/useDisposable';
import { DUST_IMPULSES, dustQa, impulsePos, impulseVel, now, pushImpulse } from '../dust';
import { FLOW } from '../glsl';
import { cardAngle, cardY, ENTRY_Z, LAST, O, spineAxis, type Composition } from '../layout';
import { IMPULSE_GLSL } from '../pointer';
import { teamsFrame, teamsWorldActive } from '../state';

const PALETTE = ['#e397b2', '#9b8cea', '#6f9ee6', '#e9dfcf', '#7fc4c6', '#c77fb0'].map((c) => new Color(c));
const COUNTS = { high: [14000, 3600, 2400], medium: [7500, 2200, 1500], low: [2400, 1000, 800] } as const;
/** The air volume wrapped round the camera (metres). */
const AIR = [10, 7, 10] as const;
/** …centred this far in front of the eye: the air between the camera and the cards. */
const AIR_AHEAD = 4;

const VERT = /* glsl */ `
uniform float uTime;
uniform float uVel;
uniform float uReveal;
uniform float uDim;
uniform float uScale;
uniform float uPxMax;
uniform vec3 uCam;
uniform vec3 uView;
uniform float uNow;
uniform float uImpR;
uniform float uImpGain;
uniform vec4 uImpP[${DUST_IMPULSES}];
uniform vec4 uImpV[${DUST_IMPULSES}];
attribute vec3 aCenter;
attribute vec4 aSeed;
attribute float aKind;
attribute vec3 color;
varying vec3 vColor;
varying float vAlpha;
varying float vSoft;
${FLOW}
${IMPULSE_GLSL}
void main() {
  vec3 p = position;
  float air = step(1.5, aKind);
  float edge = 1.0;
  if (air > 0.5) {
    // Wrapped round the space in front of the camera: always there, never moving with it.
    vec3 box = vec3(${AIR[0].toFixed(1)}, ${AIR[1].toFixed(1)}, ${AIR[2].toFixed(1)});
    vec3 c0 = uCam + uView * ${AIR_AHEAD.toFixed(1)};
    p = c0 + mod(position - c0 + box * 0.5, box) - box * 0.5;
    vec3 rel = abs(p - c0) / (box * 0.5);
    edge = 1.0 - smoothstep(0.62, 1.0, max(rel.x, max(rel.y, rel.z)));
  }
  // (The air's motes are their own centres: the cluster terms below leave them be.)
  vec3 ctr = air > 0.5 ? p : aCenter;
  vec3 d = p - ctr;
  float dl = length(d) + 1e-4;
  // Drift, and the wave travelling down the world.
  p += flow(p * 0.45 + aSeed.xyz * 4.0, uTime * 0.18) * 0.06;
  p += (d / dl) * sin(uTime * 0.6 - p.y * 0.9) * 0.035;
  // Scroll speed loosens the clusters outward and sets them turning.
  float v = uVel * (0.4 + aSeed.x * 0.8);
  p += d * v * 0.08;
  float ang = v * 0.35 * (aSeed.y - 0.5);
  p.xz = ctr.xz + mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * (p.xz - ctr.xz);
  // Recent forces: a mote near a stroke is carried along it (and a little
  // outward), most at the centre, nothing past the radius; the kick carries on
  // briefly after the push and then settles back.
  vec3 kick = vec3(0.0);
  for (int k = 0; k < ${DUST_IMPULSES}; k++) {
    float age = uNow - uImpP[k].w;
    if (age <= 0.0 || age > 1.5) continue;
    vec3 dk = p - uImpP[k].xyz;
    float along = dot(dk, uView);
    vec3 perp = dk - uView * along;
    float q = dot(perp, perp) / (uImpR * uImpR) + along * along / (9.0 * uImpR * uImpR);
    if (q >= 1.0) continue;
    float fall = (1.0 - q) * (1.0 - q);
    vec3 away = perp * inversesqrt(dot(perp, perp) + 1e-4);
    kick += (uImpV[k].xyz * 0.009 + away * uImpV[k].w) * fall * impulse(age, 5.5);
  }
  p += kick * (0.7 + 0.6 * aSeed.x) * uImpGain;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float bokeh = step(0.955, aSeed.w);
  float size = mix(mix(0.014 + 0.026 * aSeed.w, 0.06 + 0.1 * aSeed.z, bokeh), 0.012 + 0.018 * aSeed.w, air);
  float z = max(-mv.z, 0.05);
  // Projected size in device pixels. A mote smaller than a pixel spreads the
  // same light thinner instead of drawing as a full-brightness dot (which is
  // what reads as a starfield); a huge one near the lens is capped.
  float px = size * uScale / z;
  float drawn = clamp(px, 1.0, uPxMax);
  gl_PointSize = drawn;
  float energy = min(1.0, (px * px) / (drawn * drawn));
  float appear = smoothstep(aSeed.y * 0.6, aSeed.y * 0.6 + 0.4, uReveal);
  // Dust right at the lens would balloon: let it thin out as it comes close;
  // far away it sinks into the air.
  float near = mix(smoothstep(1.2, 3.5, z), smoothstep(0.5, 1.4, z), air);
  float haze = exp(-z * 0.03);
  float bright = mix(mix(0.55 + 0.45 * aSeed.z, 0.16, bokeh), 0.22 + 0.28 * aSeed.z, air);
  vAlpha = appear * uDim * near * haze * energy * edge * bright * (1.0 + v * 0.6);
  // Nothing to draw: skip rasterising it at all.
  if (vAlpha < 0.002) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); gl_PointSize = 0.0; }
  vSoft = bokeh;
  vColor = color;
}
`;

const FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vSoft;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c);
  float a = mix(smoothstep(0.5, 0.1, r), smoothstep(0.5, 0.35, r) * 0.8 + smoothstep(0.5, 0.0, r) * 0.2, vSoft);
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor * a * vAlpha, a * vAlpha);
}
`;

function build(comp: Composition, blooms: number, ambient: number, airCount: number) {
  const r = rng(6060);
  const total = blooms + ambient + airCount;
  const kind = new Float32Array(total);
  const pos = new Float32Array(total * 3);
  const center = new Float32Array(total * 3);
  const seed = new Float32Array(total * 4);
  const col = new Float32Array(total * 3);
  // Two blooms per card level, flanking the spine on the far side from that card.
  const clusters: { c: Vector3; rad: number; a: Color; b: Color }[] = [];
  for (let k = -1; k <= DOMAIN_COUNT; k++) {
    for (const side of [-1, 1]) {
      const ang = cardAngle(k) + Math.PI + side * (0.62 + r() * 0.2);
      const rr = 2.4 + r() * 1.3;
      const y = cardY(k, comp) - 0.2 + (r() - 0.5) * comp.drop * 0.6;
      clusters.push({
        c: new Vector3(Math.sin(ang) * rr, y, Math.cos(ang) * rr),
        rad: (comp.portrait ? 1.35 : 1.8) * (0.75 + r() * 0.5),
        a: PALETTE[Math.floor(r() * PALETTE.length)],
        b: PALETTE[Math.floor(r() * PALETTE.length)],
      });
    }
  }
  const tmp = new Color();
  for (let i = 0; i < total; i++) {
    let x: number;
    let y: number;
    let z: number;
    let cx: number;
    let cy: number;
    let cz: number;
    kind[i] = i < blooms ? 0 : i < blooms + ambient ? 1 : 2;
    if (kind[i] === 2) {
      // The air: anywhere in the volume (the shader wraps it round the camera).
      x = (r() - 0.5) * AIR[0];
      y = (r() - 0.5) * AIR[1];
      z = (r() - 0.5) * AIR[2];
      cx = x;
      cy = y;
      cz = z;
      tmp.copy(PALETTE[3]).lerp(PALETTE[2], r() * 0.3).multiplyScalar(0.8);
    } else if (i < blooms) {
      const cl = clusters[i % clusters.length];
      // A petalled shell: denser inside, lobed outside.
      const u = r() * 2 - 1;
      const th = r() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const petal = 0.72 + 0.28 * Math.cos(5 * th + cl.rad * 7) * Math.sin(3 * Math.acos(u));
      const rad = cl.rad * Math.pow(r(), 0.55) * petal;
      x = cl.c.x + s * Math.cos(th) * rad;
      y = cl.c.y + u * rad * 0.8;
      z = cl.c.z + s * Math.sin(th) * rad;
      cx = cl.c.x;
      cy = cl.c.y;
      cz = cl.c.z;
      tmp.copy(cl.a).lerp(cl.b, r());
    } else if (r() < 0.8) {
      // The air round the column and the ring: denser near the spine, thinning outward.
      const th = r() * Math.PI * 2;
      const rad = 1.4 + 7.6 * Math.pow(r(), 1.5);
      y = cardY(LAST, comp) - 3 + r() * (6.5 - cardY(LAST, comp));
      spineAxis(y, _ax);
      x = _ax.x + Math.cos(th) * rad;
      z = _ax.z + Math.sin(th) * rad;
      cx = x;
      cy = y;
      cz = z;
      tmp.copy(PALETTE[3]).lerp(PALETTE[2], r() * 0.35).multiplyScalar(0.75);
    } else {
      // …and a band of it along the way in, which the entrance flies through.
      x = (r() - 0.5) * 12;
      y = comp.lift + (r() - 0.5) * 7;
      z = ENTRY_Z - 2 + r() * 36;
      cx = x;
      cy = y;
      cz = z;
      tmp.copy(PALETTE[3]).lerp(PALETTE[2], r() * 0.35).multiplyScalar(0.75);
    }
    pos.set([x, y, z], i * 3);
    center.set([cx, cy, cz], i * 3);
    seed.set([r(), r(), r(), r()], i * 4);
    col.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('aCenter', new BufferAttribute(center, 3));
  g.setAttribute('aSeed', new BufferAttribute(seed, 4));
  g.setAttribute('color', new BufferAttribute(col, 3));
  g.setAttribute('aKind', new BufferAttribute(kind, 1));
  g.computeBoundingSphere();
  return g;
}

const _ray = new Vector3();
const _ax = new Vector3();
const _at = new Vector3();
const _cam = new Vector3();
const _right = new Vector3();
const _up = new Vector3();

export function ParticleField({ comp }: { comp: Composition }) {
  const quality = useExperience((s) => s.quality);
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const points = useRef<Points>(null);
  const prepared = useRef(false);
  const [blooms, ambient, airCount] = COUNTS[quality];
  const geo = useDisposable(() => build(comp, blooms, ambient, airCount), [comp.portrait, comp.drop, comp.radius, blooms, ambient, airCount]);
  const mat = useDisposable(
    () =>
      new ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uTime: { value: 0 },
          uVel: { value: 0 },
          uReveal: { value: 0 },
          uDim: { value: 1 },
          uScale: { value: 800 },
          uPxMax: { value: 20 },
          uCam: { value: new Vector3() },
          uView: { value: new Vector3(0, 0, -1) },
          uNow: { value: 0 },
          uImpR: { value: 0.9 },
          uImpGain: { value: 1 },
          uImpP: { value: impulsePos },
          uImpV: { value: impulseVel },
        },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  );
  const vel = useRef(0);
  const lastSample = useRef(0);

  useFrame(({ clock, camera }, dt) => {
    const f = teamsFrame;
    // The air takes up the motion quickly and gives it back more slowly (the environmental layer).
    vel.current += (Math.min(2, Math.abs(f.cVel)) - vel.current) * (1 - Math.exp(-dt * (Math.abs(f.cVel) > vel.current ? 6 : 3.2)));
    // Preserve that small velocity memory while resident but unseen; no
    // projection, pointer sampling or GPU-uniform writes are needed there.
    if (!teamsWorldActive() && prepared.current) return;
    prepared.current = true;
    const u = mat.uniforms;
    const reduced = useExperience.getState().reducedMotion;
    u.uTime.value = reduced ? 0 : clock.elapsedTime;
    u.uVel.value = vel.current;
    u.uReveal.value = smoothstep(0.02, 0.4, f.arrival);
    // Once through a card, a little of the dust stays: the depth field behind the member hand.
    u.uDim.value = 1 - 0.78 * f.focus;
    const cam = camera as typeof camera & { fov: number };
    u.uScale.value = (size.height * gl.getPixelRatio()) / (2 * Math.tan(((cam.fov ?? 45) * Math.PI) / 360));
    // The same largest mote in CSS pixels at every pixel ratio.
    u.uPxMax.value = (quality === 'low' ? 14 : 20) * gl.getPixelRatio();
    _cam.setFromMatrixPosition(camera.matrixWorld);
    (u.uCam.value as Vector3).copy(_cam).sub(O);
    camera.getWorldDirection(u.uView.value as Vector3);
    const t = now();
    u.uNow.value = t;
    // Once through a card the air is closer and the stir smaller.
    const through = f.focus > 0.98;
    u.uImpR.value = through ? 0.6 : 0.9;
    u.uImpGain.value = dustQa.gain;
    // The hand in the air: while the pointer moves, a stroke is laid down every
    // 80 ms at the depth of what it's over (the card plane, or the air behind the hand), with
    // the pointer's velocity carried to that depth (m/s, capped).
    const moving = Math.hypot(f.pointer.vx, f.pointer.vy) > 0.06;
    const settled = f.focus < 0.02 || through;
    if (f.pointer.active && f.inside && !reduced && settled && moving && t - lastSample.current >= 0.08) {
      lastSample.current = t;
      // In the air between the eye and the cards (the stroke reaches ~2.7 m either way along the view).
      const depth = through ? 2 : 3.2;
      _ray.set(f.pointer.x, f.pointer.y, 0.5).unproject(camera).sub(_cam).normalize();
      _at.copy(_cam).addScaledVector(_ray, depth).sub(O);
      const half = depth * Math.tan(((cam.fov ?? 45) * Math.PI) / 360);
      _right.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(f.pointer.vx * half * (size.width / size.height));
      _up.setFromMatrixColumn(camera.matrixWorld, 1).multiplyScalar(f.pointer.vy * half);
      _right.add(_up);
      if (_right.length() > 4) _right.setLength(4);
      pushImpulse(_at.x, _at.y, _at.z, _right.x, _right.y, _right.z, 0.012, t);
    }
  });

  return <points ref={points} geometry={geo} material={mat} position={O} frustumCulled={false} renderOrder={1} />;
}
