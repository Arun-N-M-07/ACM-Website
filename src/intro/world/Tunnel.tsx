'use client';
/**
 * The tunnel: where the dark becomes architecture again.
 *
 * Beneath the garden, running north to the corridor under the red building,
 * a vaulted gallery — the building's own language carried underground: a
 * transverse arch every bay, its piers in dark CEG red, its voussoirs
 * striped cream and red like the porch's arches; board-marked concrete
 * between; a dark polished floor that holds reflections; and down the middle
 * a thin line of ACM blue that leads on and ends where the corridor's own
 * thread begins.
 *
 * Its light is controlled: an uplight at the foot of every pier. On the
 * loudest bar of the score (2:01) they come on in a wave that runs ahead of
 * the camera, away into the dark; the nearest ones are real lights (the
 * facility's pooled point lights), the rest glow. At the far end, a wall and
 * the lit mouth of the corridor — and in front of it, EVENTS.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, type InstancedMesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Path, Shape, ShapeGeometry, Vector3 } from 'three';
import { FLOOR_Y, UNDERGROUND } from '@/config/world';
import { merge, metricBox, place } from '@/systems/geometry/build';
import { useGainedLightAnchors } from '@/systems/lighting/lightPool';
import { useDisposable } from '@/systems/performance/useDisposable';
import { useKit } from '@/scenes/underground/kit';
import { introFrame } from '../state';
import { T } from '../timeline';

export const TUNNEL = {
  /** Open (south) end and the end wall (north) — the corridor mouth. */
  z0: 98,
  z1: UNDERGROUND.hall.north,
  halfWidth: 8,
  /** Where the vault springs, and how high it rises above that. */
  spring: 5.4,
  rise: 3.6,
  bay: 6,
} as const;

const C = UNDERGROUND.corridor;
/** Transverse arches, from the open end towards the wall. */
const RIBS = (() => {
  const out: number[] = [];
  for (let z = TUNNEL.z0 - 3; z > TUNNEL.z1 + 9; z -= TUNNEL.bay) out.push(z);
  return out;
})();

/** When the wave of light reaches each rib (film seconds). */
const igniteAt = (z: number) => T.tunnel - 0.15 + (TUNNEL.z0 - z) / 42;

/** A half-ellipse vault profile across the width (x, y) — springing to springing. */
function vaultProfile(a: number, b: number, segments: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const th = Math.PI - (Math.PI * i) / segments;
    pts.push([Math.cos(th) * a, Math.sin(th) * b]);
  }
  return pts;
}

/** A surface swept along z from a profile (for the vault). */
function sweep(profile: [number, number][], y0: number, z0: number, z1: number) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const n = profile.length;
  let len = 0;
  const along = [0];
  for (let i = 1; i < n; i++) {
    len += Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]);
    along.push(len);
  }
  for (const z of [z0, z1])
    for (let i = 0; i < n; i++) {
      pos.push(profile[i][0], y0 + profile[i][1], z);
      uv.push(along[i], z);
    }
  for (let i = 0; i < n - 1; i++) {
    const a = i;
    const b = i + 1;
    const c = n + i;
    const d = n + i + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** One transverse arch: two piers and a ring of voussoirs (cream / red alternating). */
function rib(z: number) {
  const w = TUNNEL.halfWidth;
  const pier = 0.9;
  const depth = 0.95;
  const red: BufferGeometry[] = [
    place(metricBox(pier, TUNNEL.spring, depth), { position: [-w + pier / 2, FLOOR_Y + TUNNEL.spring / 2, z] }),
    place(metricBox(pier, TUNNEL.spring, depth), { position: [w - pier / 2, FLOOR_Y + TUNNEL.spring / 2, z] }),
  ];
  const cream: BufferGeometry[] = [
    // Capitals where the arch springs.
    place(metricBox(pier + 0.24, 0.26, depth + 0.2), { position: [-w + pier / 2, FLOOR_Y + TUNNEL.spring - 0.13, z] }),
    place(metricBox(pier + 0.24, 0.26, depth + 0.2), { position: [w - pier / 2, FLOOR_Y + TUNNEL.spring - 0.13, z] }),
    // Plinths.
    place(metricBox(pier + 0.16, 0.34, depth + 0.14), { position: [-w + pier / 2, FLOOR_Y + 0.17, z] }),
    place(metricBox(pier + 0.16, 0.34, depth + 0.14), { position: [w - pier / 2, FLOOR_Y + 0.17, z] }),
  ];
  // The ring: voussoirs between an inner and an outer half-ellipse.
  const a0 = w - pier;
  const b0 = TUNNEL.rise - 0.35;
  const a1 = w;
  const b1 = TUNNEL.rise + 0.45;
  const count = 17;
  for (let i = 0; i < count; i++) {
    const t0 = Math.PI - (Math.PI * i) / count;
    const t1 = Math.PI - (Math.PI * (i + 1)) / count;
    const g = new BufferGeometry();
    const p = (t: number, a: number, b: number): [number, number] => [Math.cos(t) * a, FLOOR_Y + TUNNEL.spring + Math.sin(t) * b];
    const q = [p(t0, a0, b0), p(t1, a0, b0), p(t1, a1, b1), p(t0, a1, b1)];
    const zf = z + depth / 2;
    const zb = z - depth / 2;
    const v: number[] = [];
    // Front, back, inner (soffit), outer, and the two joints.
    const quad = (A: number[], B: number[], Cc: number[], D: number[]) => v.push(...A, ...B, ...Cc, ...A, ...Cc, ...D);
    const P = (k: number, zz: number) => [q[k][0], q[k][1], zz];
    quad(P(0, zf), P(1, zf), P(2, zf), P(3, zf));
    quad(P(1, zb), P(0, zb), P(3, zb), P(2, zb));
    quad(P(0, zb), P(1, zb), P(1, zf), P(0, zf));
    quad(P(3, zf), P(2, zf), P(2, zb), P(3, zb));
    quad(P(0, zf), P(3, zf), P(3, zb), P(0, zb));
    quad(P(2, zf), P(1, zf), P(1, zb), P(2, zb));
    g.setAttribute('position', new Float32BufferAttribute(v, 3));
    const uv = new Float32BufferAttribute(new Float32Array((v.length / 3) * 2), 2);
    g.setAttribute('uv', uv);
    g.computeVertexNormals();
    (i % 2 === 0 ? cream : red).push(g);
  }
  return { red, cream };
}

/**
 * The uplights' wash: each pier and arch is lit from its foot once the wave
 * of light has reached its rib — computed in the material, so the tunnel
 * holds its rhythm of light on every device (however few real lights there
 * are, and with or without reflections).
 */
const wash = {
  uFront: { value: 999 },
  uWash: { value: new Color('#ffb877') },
  /** 1 where there is no environment map: the floor fakes its reflection of the lit vault. */
  uSheen: { value: 0 },
};

function washed(m: MeshStandardMaterial, key: string) {
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, wash);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTWorld;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvTWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTWorld;\nuniform float uFront;\nuniform vec3 uWash;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          float hgt = max(vTWorld.y - (${FLOOR_Y.toFixed(1)}), 0.0);
          float side = smoothstep(4.2, 7.3, abs(vTWorld.x));
          float lit = smoothstep(uFront - 0.8, uFront + 0.8, vTWorld.z);
          float foot = exp(-hgt / 1.9) * side + exp(-hgt / 4.5) * 0.18;
          totalEmissiveRadiance += uWash * diffuseColor.rgb * foot * lit * 1.35;
        }`,
      );
  };
  m.customProgramCacheKey = () => `intro-tunnel-${key}`;
  return m;
}

/**
 * The floor under the same wave: the facility's polished floor, with a pool
 * of warm light spreading from each pier's uplight once it is on (so the
 * floor reads on devices with few real lights and no reflections).
 */
function washedFloor(base: MeshStandardMaterial) {
  const m = base.clone();
  const fx = (TUNNEL.halfWidth - 1.3).toFixed(2);
  const z0 = (RIBS[0] + 0.2).toFixed(2);
  const bay = TUNNEL.bay.toFixed(1);
  const zMin = (RIBS[RIBS.length - 1] - 3).toFixed(1);
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, wash);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTWorld;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvTWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTWorld;\nuniform float uFront, uSheen;\nuniform vec3 uWash;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          float graze = 1.0 - abs(dot(normalize(vViewPosition), normal));
          float g2 = graze * graze;
          float sheen = uSheen * g2 * g2 * g2 * 0.08;
          float dz = mod(vTWorld.z - ${z0} + ${bay} * 0.5, ${bay}) - ${bay} * 0.5;
          float dx = abs(vTWorld.x) - ${fx};
          float pool = exp(-(dx * dx * 0.55 + dz * dz) / 3.2);
          float spill = exp(-abs(dx) / 2.4) * 0.12;
          float lit = smoothstep(uFront - 0.8, uFront + 0.8, vTWorld.z) * step(${zMin}, vTWorld.z);
          totalEmissiveRadiance += (uWash * (0.05 + diffuseColor.rgb) * (pool + spill) * 0.9 + mix(uWash, vec3(0.8), 0.5) * sheen) * lit;
        }`,
      );
  };
  m.customProgramCacheKey = () => 'intro-tunnel-floor';
  return m;
}

export function Tunnel() {
  const kit = useKit();
  const floorMat = useDisposable(() => washedFloor(kit.floor), [kit.floor]);
  const fixtures = useRef<InstancedMesh>(null);
  const line = useRef<Object3D>(null);

  const res = useDisposable(() => {
    const w = TUNNEL.halfWidth;
    const len = TUNNEL.z0 - TUNNEL.z1;
    const zm = (TUNNEL.z0 + TUNNEL.z1) / 2;
    const reds: BufferGeometry[] = [];
    const creams: BufferGeometry[] = [];
    for (const z of RIBS) {
      const r = rib(z);
      reds.push(...r.red);
      creams.push(...r.cream);
    }
    // End wall with the corridor mouth, framed in cream stone.
    const mouthW = C.halfWidth * 2;
    const mouthH = C.height;
    const top = FLOOR_Y + TUNNEL.spring + TUNNEL.rise + 0.6;
    const wallZ = TUNNEL.z1 - 0.2;
    const walls = [
      // Side walls.
      place(metricBox(0.4, top - FLOOR_Y, len), { position: [-w - 0.2, (FLOOR_Y + top) / 2, zm] }),
      place(metricBox(0.4, top - FLOOR_Y, len), { position: [w + 0.2, (FLOOR_Y + top) / 2, zm] }),
      // End wall around the mouth.
      place(metricBox(w - mouthW / 2, top - FLOOR_Y, 0.4), { position: [-(w + mouthW / 2) / 2, (FLOOR_Y + top) / 2, wallZ] }),
      place(metricBox(w - mouthW / 2, top - FLOOR_Y, 0.4), { position: [(w + mouthW / 2) / 2, (FLOOR_Y + top) / 2, wallZ] }),
      place(metricBox(mouthW, top - FLOOR_Y - mouthH, 0.4), { position: [0, FLOOR_Y + mouthH + (top - FLOOR_Y - mouthH) / 2, wallZ] }),
    ];
    const frame = merge([
      place(metricBox(0.34, mouthH + 0.34, 0.6), { position: [-mouthW / 2 - 0.17, FLOOR_Y + (mouthH + 0.34) / 2, wallZ + 0.1] }),
      place(metricBox(0.34, mouthH + 0.34, 0.6), { position: [mouthW / 2 + 0.17, FLOOR_Y + (mouthH + 0.34) / 2, wallZ + 0.1] }),
      place(metricBox(mouthW + 0.68, 0.4, 0.6), { position: [0, FLOOR_Y + mouthH + 0.2, wallZ + 0.1] }),
    ]);
    const vault = sweep(vaultProfile(w, TUNNEL.rise + 0.6, 28), FLOOR_Y + TUNNEL.spring, TUNNEL.z0, TUNNEL.z1);
    // The mouth: a dark wall in the dark, with the arched opening the camera flies into.
    const fw = 60;
    const fTop = FLOOR_Y + 46;
    const face = new Shape();
    face.moveTo(-fw, FLOOR_Y - 1);
    face.lineTo(fw, FLOOR_Y - 1);
    face.lineTo(fw, fTop);
    face.lineTo(-fw, fTop);
    face.closePath();
    const hole = new Path();
    hole.moveTo(-w, FLOOR_Y);
    hole.lineTo(-w, FLOOR_Y + TUNNEL.spring);
    for (const [x, y] of vaultProfile(w, TUNNEL.rise + 0.6, 24).slice(1)) hole.lineTo(x, FLOOR_Y + TUNNEL.spring + y);
    hole.lineTo(w, FLOOR_Y);
    hole.closePath();
    face.holes.push(hole);
    const facade = new ShapeGeometry(face, 24).translate(0, 0, TUNNEL.z0);
    const floor = place(metricBox(w * 2, 0.1, len), { position: [0, FLOOR_Y - 0.05, zm] });
    return {
      frame,
      facade,
      mShell: new MeshStandardMaterial({ color: '#2a2826', roughness: 0.92, side: DoubleSide }),
      red: merge(reds),
      cream: merge(creams),
      walls: merge(walls),
      vault,
      floor,
      fixture: metricBox(0.34, 0.07, 0.34),
      line: metricBox(0.05, 0.012, 1).translate(0, 0, -0.5),
      mRed: washed(new MeshStandardMaterial({ color: '#4a1b13', roughness: 0.84 }), 'red'),
      mCream: washed(new MeshStandardMaterial({ color: '#8c7d66', roughness: 0.74 }), 'cream'),
      mFrame: new MeshStandardMaterial({ color: '#3a3430', roughness: 0.6, metalness: 0.2 }),
      mGlow: new MeshBasicMaterial({ color: '#ffffff' }),
      mLine: new MeshBasicMaterial({ color: new Color('#7fb2ff').multiplyScalar(1.5) }),
    };
  }, []);

  // A warm uplight at the foot of every pier: real (pooled) light when near.
  const anchorList = useMemo(
    () =>
      RIBS.flatMap((z) => [-1, 1].map((s) => ({ position: new Vector3(s * (TUNNEL.halfWidth - 1.3), FLOOR_Y + 0.35, z + 0.2), color: new Color('#ffc58c'), intensity: 7, distance: 13 }))),
    [],
  );
  const anchors = useGainedLightAnchors(anchorList);

  const dummy = useMemo(() => new Object3D(), []);
  const warm = useMemo(() => new Color('#ffcf98').multiplyScalar(2.2), []);
  const tmp = useMemo(() => new Color(), []);

  useFrame(({ scene }) => {
    const t = introFrame.t;
    const film = introFrame.active;
    wash.uSheen.value = scene.environment ? 0 : 1;
    const f = fixtures.current;
    if (f) {
      if (!f.userData.placed) {
        RIBS.forEach((z, i) =>
          [-1, 1].forEach((s, k) => {
            dummy.position.set(s * (TUNNEL.halfWidth - 1.3), FLOOR_Y + 0.04, z + 0.2);
            dummy.updateMatrix();
            f.setMatrixAt(i * 2 + k, dummy.matrix);
          }),
        );
        f.instanceMatrix.needsUpdate = true;
        f.userData.placed = true;
      }
      RIBS.forEach((z, i) => {
        // Before the film reaches the tunnel (or after it has gone), the lights stand ready: on.
        const on = !film ? 1 : Math.min(1, Math.max(0, (t - igniteAt(z)) / 0.18));
        tmp.copy(warm).multiplyScalar(0.04 + on);
        f.setColorAt(i * 2, tmp);
        f.setColorAt(i * 2 + 1, tmp);
        anchors[i * 2].gain = on;
        anchors[i * 2 + 1].gain = on;
      });
      if (f.instanceColor) f.instanceColor.needsUpdate = true;
    }
    // Where the wave of light has reached (z): everything south of it is lit.
    wash.uFront.value = !film ? -999 : TUNNEL.z0 - Math.max(0, (t - (T.tunnel - 0.15)) * 42);
    // The line leads on: drawn from the open end towards the wall, ahead of the camera.
    const l = line.current;
    if (l) {
      const k = !film ? 1 : Math.min(1, Math.max(0, (t - (T.tunnel - 0.4)) / 1.6));
      l.scale.set(1, 1, Math.max(0.001, k * (TUNNEL.z0 - (TUNNEL.z1 + 2))));
      l.visible = k > 0;
    }
  });

  return (
    <group name="intro-tunnel">
      <mesh geometry={res.floor} material={floorMat} />
      <mesh geometry={res.walls} material={res.mShell} />
      <mesh geometry={res.vault} material={res.mShell} />
      <mesh geometry={res.facade} material={res.mShell} />
      <mesh geometry={res.red} material={res.mRed} />
      <mesh geometry={res.cream} material={res.mCream} />
      <mesh geometry={res.frame} material={res.mFrame} />
      <instancedMesh ref={fixtures} args={[res.fixture, res.mGlow, RIBS.length * 2]} frustumCulled={false} />
      <group ref={line} position={[0, FLOOR_Y + 0.008, TUNNEL.z0]}>
        <mesh geometry={res.line} material={res.mLine} />
      </group>
    </group>
  );
}
