'use client';
/**
 * The EVENTS door: a four-part retracting portal. The opening is cut on both
 * diagonals into four triangular panels of dark steel that meet at its
 * centre; each runs in a channel recessed into the architecture around it —
 * the head, the two jambs, and a slot in the threshold.
 *
 * It is a mechanism, and it is the scroll's — as the camera crosses the lobby
 * towards it, it responds:
 *
 *   waking     the seams (the X between the panels) light as the camera
 *              comes within reach
 *   pressure   the seal lets go: every panel draws back a few centimetres
 *              with a tremor, and gas escapes at the seams
 *   the seam   the panels part at the centre — the X opens into light
 *   retracting each panel travels straight out along its own direction and
 *              into its channel — the top up into the head, the bottom down
 *              into the floor, the sides into the walls — heavy to start,
 *              heavy to stop, a small settle at the end; top and bottom
 *              first, the sides a moment after
 *   inside     light from the passage spills out across the lobby floor, and
 *              a cold gas held behind the door pours out over the threshold,
 *              low along the floor, towards you
 *
 * Scroll back and it all runs backwards: the gas draws back in, the panels
 * return and meet, the seams go dark.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  ExtrudeGeometry,
  type Group,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Shape,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';
import { FLOOR_Y } from '@/config/world';
import { useExperience } from '@/store/experience';
import { merge, metricBox, place } from '@/systems/geometry/build';
import { useGainedLightAnchors } from '@/systems/lighting/lightPool';
import { useDisposable } from '@/systems/performance/useDisposable';
import { introFrame } from '../state';
import { ease, span, T } from '../timeline';
import { hash } from './noise';
import { GATE, LOBBY, PASSAGE } from './lobbyLayout';

const W = GATE.width;
const H = GATE.height;
const THICK = 0.22;
/** Half the gap between leaves (m). */
const SEAM = 0.022;
/** How far the door's progress runs, in beats. */
const DOOR_BEATS = 6.5;

type LeafId = 'top' | 'bottom' | 'left' | 'right';
interface Leaf {
  id: LeafId;
  tri: [Vector2, Vector2, Vector2];
  /** The panel's outer edge (door-local): its origin, which rides in the channel. */
  hinge: [number, number];
  /** The direction it retracts in, and how far (fully into its channel). */
  slide: [number, number];
  travel: number;
  /** When it retracts (fractions of the door's progress). */
  from: number;
  to: number;
}

/** A triangle shrunk by `d` along each edge's inward normal (a uniform seam). */
function inset(a: Vector2, b: Vector2, c: Vector2, d: number): [Vector2, Vector2, Vector2] {
  const centroid = new Vector2().add(a).add(b).add(c).multiplyScalar(1 / 3);
  const lines = [
    [a, b],
    [b, c],
    [c, a],
  ].map(([p, q]) => {
    const e = new Vector2().subVectors(q, p).normalize();
    let n = new Vector2(-e.y, e.x);
    if (n.dot(new Vector2().subVectors(centroid, p)) < 0) n = n.negate();
    return { p: p.clone().addScaledVector(n, d), e };
  });
  const meet = (l1: (typeof lines)[0], l2: (typeof lines)[0]) => {
    const den = l1.e.x * l2.e.y - l1.e.y * l2.e.x;
    const t = ((l2.p.x - l1.p.x) * l2.e.y - (l2.p.y - l1.p.y) * l2.e.x) / den;
    return l1.p.clone().addScaledVector(l1.e, t);
  };
  return [meet(lines[2], lines[0]), meet(lines[0], lines[1]), meet(lines[1], lines[2])];
}

/** A heavy travel across its whole range: slow to start, slowing into the stop, a small settle there. */
function retract(x: number) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  // Heavy: a long ease in, a long ease out.
  const e = x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  // The settle at the end of the channel: a touch past, and back.
  const give = x > 0.84 ? Math.sin(Math.PI * ((x - 0.84) / 0.16)) * 0.012 : 0;
  return e + give;
}

export function Gate() {
  const pivots = useRef<(Group | null)[]>([]);
  const quality = useExperience((s) => s.quality);

  const res = useDisposable(() => {
    // Door-local: x across, y up from the middle, z towards the lobby.
    const bl = new Vector2(-W / 2, -H / 2);
    const br = new Vector2(W / 2, -H / 2);
    const tr = new Vector2(W / 2, H / 2);
    const tl = new Vector2(-W / 2, H / 2);
    const o = new Vector2(0, 0);
    const leaves: Leaf[] = [
      { id: 'top', tri: inset(tl, tr, o, SEAM), hinge: [0, H / 2], slide: [0, 1], travel: H / 2 + 0.14, from: 0.3, to: 0.84 },
      { id: 'bottom', tri: inset(br, bl, o, SEAM), hinge: [0, -H / 2], slide: [0, -1], travel: H / 2 + 0.14, from: 0.31, to: 0.85 },
      { id: 'left', tri: inset(bl, tl, o, SEAM), hinge: [-W / 2, 0], slide: [-1, 0], travel: W / 2 + 0.14, from: 0.36, to: 0.92 },
      { id: 'right', tri: inset(tr, br, o, SEAM), hinge: [W / 2, 0], slide: [1, 0], travel: W / 2 + 0.14, from: 0.37, to: 0.93 },
    ];
    const opts = { depth: THICK, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.016, bevelSegments: 2, curveSegments: 1 };
    // Each leaf's geometry is placed relative to its hinge, so turning its group swings it.
    const geos = leaves.map((l) => new ExtrudeGeometry(new Shape(l.tri), opts).translate(-l.hinge[0], -l.hinge[1], -THICK / 2));
    // Light along each leaf's two seam edges (the diagonals), on its face.
    const seams = leaves.map((l) => {
      const [p, q, c] = l.tri;
      const centre = new Vector2().add(p).add(q).add(c).multiplyScalar(1 / 3);
      const strip = (a: Vector2, b: Vector2) => {
        const len = a.distanceTo(b);
        const mid = new Vector2().addVectors(a, b).multiplyScalar(0.5);
        const toC = new Vector2().subVectors(centre, mid).normalize().multiplyScalar(0.035);
        return place(metricBox(0.026, len, 0.012), {
          position: [mid.x + toC.x - l.hinge[0], mid.y + toC.y - l.hinge[1], THICK / 2 + 0.024],
          rotation: [0, 0, Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2],
        });
      };
      // The leaf's seam edges are the two that meet at the centre.
      return merge([strip(q, c), strip(c, p)]);
    });
    const face = new MeshStandardMaterial({ color: '#23262b', roughness: 0.34, metalness: 0.82 });
    const seamMat = new MeshBasicMaterial({ color: new Color('#cfe0ff'), toneMapped: false });

    // The gas: soft puffs held behind the door, poured out over the threshold.
    const n = quality === 'low' ? 50 : 100;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const s0 = hash(i, 1);
      const s1 = hash(i, 2);
      const s2 = hash(i, 3);
      // Behind the door, mostly low (the gas is cold and heavy).
      pos.set([(s0 - 0.5) * W * 0.85, -H / 2 + 0.2 + Math.pow(s1, 2.2) * H * 0.5, -0.4 - s2 * 2.4], i * 3);
      seed.set([s0, s1, s2, hash(i, 4)], i * 4);
    }
    const gasGeo = new BufferGeometry();
    gasGeo.setAttribute('position', new BufferAttribute(pos, 3));
    gasGeo.setAttribute('aSeed', new BufferAttribute(seed, 4));
    const gasMat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uG: { value: 0 }, uTime: { value: 0 }, uScale: { value: 800 }, uColor: { value: new Color('#d6dee9') } },
      vertexShader: /* glsl */ `
        attribute vec4 aSeed;
        uniform float uG, uTime, uScale;
        varying float vA;
        void main() {
          // Each puff leaves at its own moment of the pour, and lives a while.
          float born = aSeed.w * 0.7;
          float life = 0.32 + aSeed.x * 0.26;
          float age = (uG - born) / life;
          vA = age > 0.0 && age < 1.0 ? sin(3.14159 * age) * (1.0 - age * 0.45) : 0.0;
          float a = clamp(age, 0.0, 1.0);
          vec3 p = position;
          // Out over the threshold into the lobby, spreading; the low puffs hug
          // the floor, the high ones lift a little — and all of it breathes.
          p.z += a * (2.0 + aSeed.y * 3.6);
          p.x *= 1.0 + a * 0.7;
          p.y += a * a * (aSeed.y > 0.6 ? 0.35 : -0.3);
          p.y = max(p.y, ${(-H / 2 + 0.15).toFixed(2)});
          p.x += sin(uTime * 0.35 + aSeed.z * 20.0) * 0.12;
          p.y += sin(uTime * 0.27 + aSeed.x * 17.0) * 0.06;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          // Close to the lens a puff is nothing (it would be a wall of grey, not a gas).
          float dist = -mv.z;
          vA *= smoothstep(1.2, 4.0, dist);
          gl_PointSize = (0.7 + a * 1.5) * (0.7 + aSeed.x * 0.6) * uScale / max(1.0, dist);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vA;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float r = dot(c, c) * 4.0;
          float a = exp(-r * 2.6) * vA * 0.075;
          if (a < 0.002) discard;
          gl_FragColor = vec4(uColor, a);
        }`,
    });

    // Behind the door, a line of light down the passage's ceiling (so the opening is lit, not a hole).
    const glowGeo = place(metricBox(0.22, 0.04, PASSAGE.z0 - PASSAGE.z1 - 0.6), { position: [0, H / 2 - 0.1, 0] });
    const glowMat = new MeshBasicMaterial({ color: new Color('#e6eeff'), toneMapped: false, blending: AdditiveBlending, transparent: true });

    // The light that spills out of the opening across the lobby floor.
    const spillGeo = new PlaneGeometry(W + 3, 10).rotateX(-Math.PI / 2).translate(0, 0, 5);
    const spillMat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uOpen: { value: 0 }, uColor: { value: new Color('#dfe8ff') } },
      vertexShader: /* glsl */ `
        varying vec2 vP;
        void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uOpen;
        uniform vec3 uColor;
        varying vec2 vP;
        void main() {
          // A pool of light shaped by the opening: widest at the door, fading out into the room.
          float along = vP.y;
          float halfW = ${(W / 2).toFixed(2)} * (0.45 + 0.55 * uOpen) + along * 0.28;
          float across = 1.0 - smoothstep(halfW * 0.55, halfW, abs(vP.x));
          float fall = exp(-along / 3.4);
          gl_FragColor = vec4(uColor * across * fall * uOpen * 0.3, 1.0);
        }`,
    });
    // The channels: recessed slots in the head and the jambs, and one across the threshold.
    const CH = THICK + 0.06;
    const channels = merge([
      place(metricBox(W + 0.3, 0.05, CH), { position: [0, H / 2 + 0.024, 0] }),
      place(metricBox(0.05, H + 0.3, CH), { position: [-W / 2 - 0.024, 0, 0] }),
      place(metricBox(0.05, H + 0.3, CH), { position: [W / 2 + 0.024, 0, 0] }),
      place(metricBox(W + 0.3, 0.02, CH), { position: [0, -H / 2 + 0.008, 0] }),
    ]);
    const channelMat = new MeshStandardMaterial({ color: '#07080a', roughness: 0.9, metalness: 0.2 });
    return { leaves, geos, seams, face, seamMat, gasGeo, gasMat, glowGeo, glowMat, spillGeo, spillMat, channels, channelMat };
  }, [quality]);

  const anchorList = useMemo(
    () => [
      // The door, lit from the lobby side…
      { position: new Vector3(0, FLOOR_Y + 5.2, GATE.z + 4.2), color: new Color('#e3ebff'), intensity: 16, distance: 11 },
      // …and the passage behind it, which the opening reveals.
      { position: new Vector3(0, FLOOR_Y + 4.8, (PASSAGE.z0 + PASSAGE.z1) / 2), color: new Color('#dfe7ff'), intensity: 24, distance: 12 },
    ],
    [],
  );
  const anchors = useGainedLightAnchors(anchorList);

  useFrame(({ camera, size, gl, clock }) => {
    const film = introFrame.active;
    const t = introFrame.t;
    // The door's progress (after the opening, it stands open).
    const d = film ? span(t, T.door, T.door + DOOR_BEATS) : 1;
    // Waking: the seams light (a flicker, then steady), easing as the leaves go.
    const wake = ease(d, 0, 0.12);
    const flick = d > 0.01 && d < 0.12 ? (hash(Math.floor(d * 90), 3) > 0.35 ? 1 : 0.35) : 1;
    let open = 0;
    res.leaves.forEach((l, i) => {
      const a = retract(span(d, l.from, l.to));
      open += a / 4;
      const g = pivots.current[i];
      if (!g) return;
      // Pressure: the seal lets go — the panels draw back a touch and tremble.
      const pressure = ease(d, 0.1, 0.19);
      // The seam: they part at the centre, a few centimetres, before they run.
      const part = ease(d, 0.2, 0.29) * 0.07;
      // A tremor under pressure, and a fainter one while they travel (the mechanism working).
      const moving = a > 0.001 && a < 0.999 ? 1 : 0;
      const tremor = pressure * (1 - ease(d, 0.2, 0.3)) * 0.004 + moving * 0.0015;
      const k = part + a * l.travel;
      g.position.set(l.hinge[0] + l.slide[0] * k + Math.sin(d * 301 + i) * tremor, l.hinge[1] + l.slide[1] * k + Math.cos(d * 277 + i * 2) * tremor, -0.035 * pressure);
      g.rotation.set(0, 0, 0);
    });
    // (A faint standing glow in the seams, so the door reads before it wakes.)
    const seam = wake * flick * (1 - 0.65 * open) + (film ? 0.22 : 0) * (1 - open);
    res.seamMat.color.set('#cfe0ff').multiplyScalar(0.3 + 2.2 * seam);
    anchors[0].gain = 0.35 + 0.65 * ease(d, 0, 0.25);
    anchors[1].gain = ease(open, 0, 0.6);
    res.glowMat.color.set('#e6eeff').multiplyScalar(0.25 + 1.6 * ease(open, 0, 0.7));
    res.spillMat.uniforms.uOpen.value = film ? open : 0;
    // The pour runs from the first gap to past the doorway.
    const u = res.gasMat.uniforms;
    u.uG.value = film ? span(t, T.door + DOOR_BEATS * 0.14, T.doorway + 2) : 0;
    u.uTime.value = clock.elapsedTime;
    const cam = camera as { fov?: number };
    u.uScale.value = (size.height * gl.getPixelRatio()) / (2 * Math.tan(((cam.fov ?? 54) * Math.PI) / 360));
  });

  return (
    <group name="intro-gate">
      <group position={[0, FLOOR_Y + H / 2, GATE.z]}>
        {res.leaves.map((l, i) => (
          <group
            key={l.id}
            position={[l.hinge[0], l.hinge[1], 0]}
            ref={(g) => {
              pivots.current[i] = g;
            }}
          >
            <mesh geometry={res.geos[i]} material={res.face} />
            <mesh geometry={res.seams[i]} material={res.seamMat} />
          </group>
        ))}
        <mesh geometry={res.channels} material={res.channelMat} />
        <points geometry={res.gasGeo} material={res.gasMat} frustumCulled={false} renderOrder={9} />
        <mesh geometry={res.glowGeo} material={res.glowMat} position={[0, 0, -(PASSAGE.z0 - PASSAGE.z1) / 2 - 0.2]} />
      </group>
      <mesh geometry={res.spillGeo} material={res.spillMat} position={[0, FLOOR_Y + 0.012, LOBBY.north + 0.05]} renderOrder={2} />
    </group>
  );
}
