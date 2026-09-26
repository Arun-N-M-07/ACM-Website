'use client';
/**
 * ParticleField — the dust of the Teams world.
 *
 * Two populations in one draw call:
 *   blooms   dense, petalled clusters flanking the spine at every card's
 *            level (behind the spine as seen from that card), in muted rose,
 *            violet, steel blue and bone — so each card, centred, is framed
 *            by colour behind glass
 *   ambient  fine dust through a wide cylinder around everything, for depth
 *
 * No simulation state: rest positions live in the geometry and all motion is
 * in the vertex shader, driven by a few uniforms —
 *   uTime      drift + the world's wave (shared with spine and cards)
 *   uVel       |scroll velocity|: clusters breathe outward and loosen
 *   uPointer   a world point on the pointer ray; dust nearby gives way
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
import { FLOW } from '../glsl';
import { cardAngle, cardY, O, SPINE_BOTTOM, SPINE_TOP, type Composition } from '../layout';
import { teamsFrame } from '../state';

const PALETTE = ['#e397b2', '#9b8cea', '#6f9ee6', '#e9dfcf', '#7fc4c6', '#c77fb0'].map((c) => new Color(c));
const COUNTS = { high: [14000, 5000], medium: [7500, 3000], low: [2400, 1600] } as const;

const VERT = /* glsl */ `
uniform float uTime;
uniform float uVel;
uniform float uReveal;
uniform float uDim;
uniform float uScale;
uniform vec3 uPointer;
uniform vec3 uPointerVel;
uniform float uPointerOn;
attribute vec3 aCenter;
attribute vec4 aSeed;
attribute vec3 color;
varying vec3 vColor;
varying float vAlpha;
varying float vSoft;
${FLOW}
void main() {
  vec3 p = position;
  vec3 d = p - aCenter;
  float dl = length(d) + 1e-4;
  // Drift, and the wave travelling down the world.
  p += flow(p * 0.45 + aSeed.xyz * 4.0, uTime * 0.18) * 0.06;
  p += (d / dl) * sin(uTime * 0.6 - p.y * 0.9) * 0.035;
  // Scroll speed loosens the clusters outward and sets them turning.
  float v = uVel * (0.4 + aSeed.x * 0.8);
  p += d * v * 0.45;
  float ang = v * 0.35 * (aSeed.y - 0.5);
  p.xz = aCenter.xz + mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * (p.xz - aCenter.xz);
  // The pointer parts the dust, and drags a wake after it as it moves.
  vec3 tp = p - uPointer;
  float fall = exp(-dot(tp, tp) * 0.9) * uPointerOn;
  p += normalize(tp + 1e-4) * fall * 0.3;
  float wake = exp(-dot(tp, tp) * 0.35) * uPointerOn;
  p += uPointerVel * wake * (0.14 + 0.1 * aSeed.x);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float bokeh = step(0.955, aSeed.w);
  float size = mix(0.014 + 0.026 * aSeed.w, 0.06 + 0.1 * aSeed.z, bokeh);
  gl_PointSize = clamp(size * uScale / -mv.z, 1.0, 42.0);
  float appear = smoothstep(aSeed.y * 0.6, aSeed.y * 0.6 + 0.4, uReveal);
  // Dust right at the lens would balloon: let it thin out as it comes close.
  float near = smoothstep(1.2, 3.5, -mv.z);
  vAlpha = appear * uDim * near * mix(0.55 + 0.45 * aSeed.z, 0.16, bokeh) * (1.0 + v * 0.6);
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

function build(comp: Composition, blooms: number, ambient: number) {
  const r = rng(6060);
  const total = blooms + ambient;
  const pos = new Float32Array(total * 3);
  const center = new Float32Array(total * 3);
  const seed = new Float32Array(total * 4);
  const col = new Float32Array(total * 3);
  // Two blooms per card level, flanking the spine on the far side from that card.
  const clusters: { c: Vector3; rad: number; a: Color; b: Color }[] = [];
  for (let k = -1; k <= DOMAIN_COUNT; k++) {
    for (const side of [-1, 1]) {
      const ang = cardAngle(k) + Math.PI + side * (0.62 + r() * 0.2);
      const rr = 1.35 + r() * 0.8;
      const y = cardY(k, comp) - 0.2 + (r() - 0.5) * comp.drop * 0.6;
      clusters.push({
        c: new Vector3(Math.sin(ang) * rr, y, Math.cos(ang) * rr),
        rad: (comp.portrait ? 1.1 : 1.45) * (0.75 + r() * 0.5),
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
    if (i < blooms) {
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
    } else {
      const th = r() * Math.PI * 2;
      const rad = 2 + Math.pow(r(), 0.7) * 13;
      x = Math.cos(th) * rad;
      z = Math.sin(th) * rad + (i % 2 === 0 ? r() * 60 : 0);
      y = SPINE_BOTTOM + r() * (SPINE_TOP - SPINE_BOTTOM);
      cx = 0;
      cy = y;
      cz = 0;
      tmp.copy(PALETTE[3]).lerp(PALETTE[2], r() * 0.6).multiplyScalar(0.7);
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
  g.computeBoundingSphere();
  return g;
}

const _ray = new Vector3();
const _cam = new Vector3();
const _right = new Vector3();
const _up = new Vector3();

export function ParticleField({ comp }: { comp: Composition }) {
  const quality = useExperience((s) => s.quality);
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const points = useRef<Points>(null);
  const [blooms, ambient] = COUNTS[quality];
  const geo = useDisposable(() => build(comp, blooms, ambient), [comp.portrait, comp.drop, comp.radius, blooms, ambient]);
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
          uPointer: { value: new Vector3() },
          uPointerVel: { value: new Vector3() },
          uPointerOn: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  );
  const vel = useRef(0);

  useFrame(({ clock, camera }, dt) => {
    const f = teamsFrame;
    const u = mat.uniforms;
    const reduced = useExperience.getState().reducedMotion;
    u.uTime.value = reduced ? 0 : clock.elapsedTime;
    vel.current += (Math.min(2, Math.abs(f.cVel)) - vel.current) * (1 - Math.exp(-dt * (Math.abs(f.cVel) > vel.current ? 5 : 1.6)));
    u.uVel.value = vel.current;
    u.uReveal.value = smoothstep(0.02, 0.4, f.arrival);
    u.uDim.value = 1 - 0.94 * f.focus;
    const cam = camera as typeof camera & { fov: number };
    u.uScale.value = (size.height * gl.getPixelRatio()) / (2 * Math.tan(((cam.fov ?? 45) * Math.PI) / 360));
    // A point on the pointer ray about as deep as the spine.
    if (f.pointer.active && f.inside && !reduced) {
      _cam.setFromMatrixPosition(camera.matrixWorld);
      _ray.set(f.pointer.fx, f.pointer.fy, 0.5).unproject(camera).sub(_cam).normalize();
      const depth = Math.min(12, _cam.distanceTo(O) * 0.85);
      (u.uPointer.value as Vector3).copy(_cam).addScaledVector(_ray, depth).sub(O);
      u.uPointerOn.value += (1 - u.uPointerOn.value) * (1 - Math.exp(-dt * 3));
      // The pointer's velocity at that depth, in world units per second (capped).
      const half = depth * Math.tan(((cam.fov ?? 45) * Math.PI) / 360);
      _right.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(f.pointer.fvx * half * (size.width / size.height));
      _up.setFromMatrixColumn(camera.matrixWorld, 1).multiplyScalar(f.pointer.fvy * half);
      const pv = u.uPointerVel.value as Vector3;
      pv.copy(_right).add(_up);
      if (pv.length() > 12) pv.setLength(12);
    } else u.uPointerOn.value *= Math.exp(-dt * 3);
  });

  return <points ref={points} geometry={geo} material={mat} position={O} frustumCulled={false} renderOrder={1} />;
}
