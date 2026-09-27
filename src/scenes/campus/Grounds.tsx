'use client';
/**
 * The grounds in front of the red building: the paved forecourt between the
 * wings, the long front garden with its fountain pool (white railings, jets),
 * topiary and lamps, and the circular plaza at the garden's head holding the
 * glass light-well that slides open for the descent.
 */
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import {
  BufferAttribute,
  type BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  type Group,
  IcosahedronGeometry,
  type InstancedMesh,
  LatheGeometry,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Path,
  PlaneGeometry,
  RingGeometry,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  type Texture,
  TorusGeometry,
  Vector2,
} from 'three';
import { PALETTE } from '@/config/palette';
import { QUALITY } from '@/config/quality';
import { CAMPUS } from '@/config/world';
import { rng } from '@/lib/random';
import { useExperience } from '@/store/experience';
import { merge, metricBox, place } from '@/systems/geometry/build';
import { useDisposable } from '@/systems/performance/useDisposable';
import { progress } from '@/systems/scroll/progress';
import { lawnTexture } from '@/systems/textures/surfaces';
import { makeCanvas, toTexture } from '@/systems/textures/typeset';
import { look } from '@/intro/look';
import { introFrame } from '@/intro/state';
import { wellOpenAmount } from '@/intro/timeline';
import { world } from '../shared/blend';

const LAMP = new Color('#ffd49a').multiplyScalar(1.4);
/** An unlit globe in daylight: pale frosted glass. */
const LAMP_OFF = new Color('#aaa59c');

const W = CAMPUS.well;
const PL = CAMPUS.plaza;
const G = CAMPUS.garden;
const P = CAMPUS.pool;

/** Lamp posts along the garden's walks and the drive (x, z); the globe is at y = LAMP_Y. */
export const LAMP_SPOTS: [number, number][] = (() => {
  const spots: [number, number][] = [];
  for (let z = 40; z <= 96; z += 11) spots.push([G.x0 - 1.4, z], [G.x1 + 1.4, z]);
  for (let x = -50; x <= 50; x += 20) spots.push([x, 28.4]);
  return spots;
})();
export const LAMP_Y = 4.35;
const FRONT = CAMPUS.frontZ;
const RIM = 0.45;
const WATER_Y = 0.34;
const JETS = [58.5, 65.5, 72.5, 79.5, 86.5];

function pavingTexture(scale: number) {
  const size = Math.round(256 * scale);
  const { canvas, ctx } = makeCanvas(size, size);
  const r = rng(11);
  ctx.fillStyle = '#b9ae99';
  ctx.fillRect(0, 0, size, size);
  const n = 4;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const l = 64 + r() * 10;
      ctx.fillStyle = `hsl(36 16% ${l}%)`;
      ctx.fillRect((i * size) / n + 1, (j * size) / n + 1, size / n - 2, size / n - 2);
    }
  return { texture: toTexture(canvas, { repeat: true }), tile: 3.2 };
}

function tileTexture(scale: number) {
  const size = Math.round(128 * scale);
  const { canvas, ctx } = makeCanvas(size, size);
  ctx.fillStyle = '#2f7fa6';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(1, scale * 1.5);
  for (let i = 0; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo((i * size) / 8, 0);
    ctx.lineTo((i * size) / 8, size);
    ctx.moveTo(0, (i * size) / 8);
    ctx.lineTo(size, (i * size) / 8);
    ctx.stroke();
  }
  return { texture: toTexture(canvas, { repeat: true }), tile: 1.2 };
}

/** Tileable ripple normal map for the pool surface. */
function rippleNormal(): Texture {
  const size = 128;
  const { canvas, ctx } = makeCanvas(size, size);
  const img = ctx.createImageData(size, size);
  const h = (x: number, y: number) =>
    Math.sin((x / size) * Math.PI * 6 + Math.sin((y / size) * Math.PI * 4) * 1.5) * 0.5 + Math.sin((y / size) * Math.PI * 10 + (x / size) * Math.PI * 2) * 0.35;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = h(x + 1, y) - h(x - 1, y);
      const dy = h(x, y + 1) - h(x, y - 1);
      const i = (y * size + x) * 4;
      img.data[i] = 128 + dx * 60;
      img.data[i + 1] = 128 + dy * 60;
      img.data[i + 2] = 255;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  const t = toTexture(canvas, { repeat: true });
  t.colorSpace = '';
  return t;
}

function ringShape(r0: number, r1: number) {
  const s = new Shape();
  s.absarc(0, 0, r1, 0, Math.PI * 2, false);
  const hole = new Path();
  hole.absarc(0, 0, r0, 0, Math.PI * 2, true);
  s.holes.push(hole);
  return s;
}

/**
 * Fountain jets as water, not particles: a bright rising column and a thin
 * falling sheet around it (surfaces of revolution), both carrying a streak
 * texture that scrolls with the flow, plus a foam ring where they land.
 */
function streakTexture() {
  const { canvas, ctx } = makeCanvas(64, 256);
  const r = rng(21);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 90; i++) {
    const x = r() * 64;
    const y = r() * 256;
    const len = 20 + r() * 90;
    const g = ctx.createLinearGradient(0, y, 0, y + len);
    const a = 0.35 + r() * 0.65;
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, `rgba(255,255,255,${a})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, 1 + r() * 2.5, len);
    // Wrap vertically so the texture tiles.
    if (y + len > 256) ctx.fillRect(x, y - 256, 1 + r() * 2.5, len);
  }
  const tex = toTexture(canvas, { repeat: true });
  return tex;
}

function foamTexture() {
  const { canvas, ctx } = makeCanvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return toTexture(canvas);
}

function jetGeometries(h: number, spread: number) {
  const col = new LatheGeometry(
    [new Vector2(0.001, 0), new Vector2(0.055, 0.02), new Vector2(0.05, h * 0.55), new Vector2(0.038, h * 0.93), new Vector2(0.001, h)],
    14,
  );
  const sheetPts: Vector2[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    sheetPts.push(new Vector2(0.06 + spread * Math.pow(Math.sin((t * Math.PI) / 2), 0.9), h * (1 - t * t) + 0.02 * t));
  }
  const sheet = new LatheGeometry(sheetPts, 20);
  return { col, sheet };
}

function Fountains() {
  const res = useDisposable(() => {
    const streaks = streakTexture();
    const streaks2 = streaks.clone();
    streaks.repeat.set(3, 1.5);
    streaks2.repeat.set(5, 1);
    const foam = foamTexture();
    const tall = jetGeometries(5.4, 0.55);
    const small = jetGeometries(2.5, 0.38);
    const common = { color: new Color('#eef7ff'), transparent: true, depthWrite: false, side: DoubleSide, toneMapped: false } as const;
    return {
      streaks,
      streaks2,
      foam,
      tall,
      small,
      foamGeo: new CircleGeometry(1, 24).rotateX(-Math.PI / 2),
      colMat: new MeshBasicMaterial({ ...common, alphaMap: streaks, opacity: 0.85 }),
      sheetMat: new MeshBasicMaterial({ ...common, alphaMap: streaks2, opacity: 0.32 }),
      foamMat: new MeshBasicMaterial({ ...common, alphaMap: foam, opacity: 0.7 }),
    };
  }, []);
  useFrame((_, dt) => {
    if (progress.value > 0.3) return;
    // Up the column, down the sheet.
    res.streaks.offset.y -= dt * 1.6;
    res.streaks2.offset.y += dt * 0.9;
  });
  return (
    <group name="fountains">
      {JETS.map((z, i) => {
        const g = i === 0 ? res.tall : res.small;
        const r = i === 0 ? 0.95 : 0.6;
        return (
          <group key={z} position={[0, WATER_Y, z]}>
            <mesh geometry={g.col} material={res.colMat} renderOrder={4} />
            <mesh geometry={g.sheet} material={res.sheetMat} renderOrder={5} />
            <mesh geometry={res.foamGeo} material={res.foamMat} scale={[r, 1, r]} position={[0, 0.01, 0]} renderOrder={3} />
          </group>
        );
      })}
    </group>
  );
}

export function Grounds() {
  const quality = useExperience((s) => s.quality);
  const q = QUALITY[quality];
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);
  const shrubs = useRef<InstancedMesh>(null);
  const water = useRef<MeshStandardMaterial>(null);

  const res = useDisposable(() => {
    const paving = pavingTexture(q.textureScale);
    paving.texture.repeat.set(1 / paving.tile, 1 / paving.tile);
    const lawn = lawnTexture(q.textureScale);
    lawn.texture.repeat.set(1 / lawn.tile, 1 / lawn.tile);
    const tiles = tileTexture(q.textureScale);
    tiles.texture.repeat.set(1 / tiles.tile, 1 / tiles.tile);
    const ripple = rippleNormal();
    ripple.repeat.set(1 / 3, 1 / 3);

    // Forecourt paving between the wings, with the plaza and the pool surround.
    // Heights sit above every OpenStreetMap layer (≤ 0.145 m) with ≥ 1.5 cm between layers.
    const forecourt = place(new PlaneGeometry(117, 22), { position: [0.1, 0.165, FRONT + 11], rotation: [-Math.PI / 2, 0, 0] });
    const forecourtUv = forecourt.getAttribute('uv') as BufferAttribute;
    for (let i = 0; i < forecourtUv.count; i++) forecourtUv.setXY(i, forecourtUv.getX(i) * 117, forecourtUv.getY(i) * 22);
    const lawns = merge([
      place(new PlaneGeometry(40, 12), { position: [-33, 0.185, FRONT + 11.5], rotation: [-Math.PI / 2, 0, 0] }),
      place(new PlaneGeometry(40, 12), { position: [33, 0.185, FRONT + 11.5], rotation: [-Math.PI / 2, 0, 0] }),
    ]);
    const lawnUv = lawns.getAttribute('uv') as BufferAttribute;
    for (let i = 0; i < lawnUv.count; i++) lawnUv.setXY(i, lawnUv.getX(i) * 40, lawnUv.getY(i) * 12);

    const plaza = new ShapeGeometry(ringShape(W.r + 0.55, PL.r), 64);
    plaza.rotateX(-Math.PI / 2);
    plaza.translate(PL.x, 0.2, PL.z);
    const walks = merge([
      place(metricBox(3.2, 0.06, P.z1 - P.z0 + 3), { position: [P.x0 - 1.6 - 0.45, 0.19, (P.z0 + P.z1) / 2] }),
      place(metricBox(3.2, 0.06, P.z1 - P.z0 + 3), { position: [P.x1 + 1.6 + 0.45, 0.19, (P.z0 + P.z1) / 2] }),
      place(metricBox(P.x1 - P.x0 + 7.3, 0.06, 2.2), { position: [0, 0.19, P.z0 - 1.9] }),
      place(metricBox(P.x1 - P.x0 + 7.3, 0.06, 2.2), { position: [0, 0.19, P.z1 + 1.9] }),
      place(metricBox(4, 0.06, P.z0 - 2.9 - (PL.z + PL.r)), { position: [0, 0.19, (P.z0 - 2.9 + PL.z + PL.r) / 2] }),
      place(metricBox(4.5, 0.06, PL.z - PL.r - 30), { position: [0, 0.175, (PL.z - PL.r + 30) / 2] }),
    ]);

    // Raised fountain basin.
    const rim = merge([
      place(metricBox(P.x1 - P.x0 + 0.9, RIM, 0.45), { position: [0, RIM / 2, P.z0] }),
      place(metricBox(P.x1 - P.x0 + 0.9, RIM, 0.45), { position: [0, RIM / 2, P.z1] }),
      place(metricBox(0.45, RIM, P.z1 - P.z0), { position: [P.x0, RIM / 2, (P.z0 + P.z1) / 2] }),
      place(metricBox(0.45, RIM, P.z1 - P.z0), { position: [P.x1, RIM / 2, (P.z0 + P.z1) / 2] }),
      ...JETS.map((z, i) => place(new CylinderGeometry(i === 0 ? 0.9 : 0.55, i === 0 ? 1.0 : 0.62, 0.5, 20), { position: [0, 0.25, z] })),
      place(new TorusGeometry(W.r + 0.25, 0.22, 10, 72), { position: [W.x, 0.14, W.z], rotation: [Math.PI / 2, 0, 0] }),
    ]);
    const basinFloor = place(new PlaneGeometry(P.x1 - P.x0 - 0.1, P.z1 - P.z0 - 0.1), { position: [0, 0.12, (P.z0 + P.z1) / 2], rotation: [-Math.PI / 2, 0, 0] });
    const bfUv = basinFloor.getAttribute('uv') as BufferAttribute;
    for (let i = 0; i < bfUv.count; i++) bfUv.setXY(i, bfUv.getX(i) * (P.x1 - P.x0), bfUv.getY(i) * (P.z1 - P.z0));
    const waterGeo = place(new PlaneGeometry(P.x1 - P.x0 - 0.1, P.z1 - P.z0 - 0.1), { position: [0, WATER_Y, (P.z0 + P.z1) / 2], rotation: [-Math.PI / 2, 0, 0] });
    const wUv = waterGeo.getAttribute('uv') as BufferAttribute;
    for (let i = 0; i < wUv.count; i++) wUv.setXY(i, wUv.getX(i) * (P.x1 - P.x0), wUv.getY(i) * (P.z1 - P.z0));

    // White railings either side of the pool walks.
    const rails: BufferGeometry[] = [];
    for (const x of [P.x0 - 3.8, P.x1 + 3.8]) {
      for (let z = P.z0 - 1; z <= P.z1 + 1; z += 2.2) rails.push(place(metricBox(0.08, 1.05, 0.08), { position: [x, 0.52, z] }));
      rails.push(place(metricBox(0.07, 0.07, P.z1 - P.z0 + 2), { position: [x, 1.02, (P.z0 + P.z1) / 2] }));
      rails.push(place(metricBox(0.05, 0.05, P.z1 - P.z0 + 2), { position: [x, 0.55, (P.z0 + P.z1) / 2] }));
    }

    // Hedges framing the garden, and lamp posts along the drive and walks.
    const hedges = merge([
      place(metricBox(0.9, 0.9, G.z1 - G.z0 - 8), { position: [G.x0 + 1.2, 0.45, (G.z0 + G.z1) / 2] }),
      place(metricBox(0.9, 0.9, G.z1 - G.z0 - 8), { position: [G.x1 - 1.2, 0.45, (G.z0 + G.z1) / 2] }),
    ]);
    const lampSpots = LAMP_SPOTS;
    const lampPosts = merge(lampSpots.map(([x, z]) => place(new CylinderGeometry(0.06, 0.09, 4.2, 8), { position: [x, 2.1, z] })));
    const lampHeads = merge(lampSpots.map(([x, z]) => place(new SphereGeometry(0.22, 12, 8), { position: [x, 4.35, z] })));

    // Glass leaves over the well (two half discs).
    const leaf = new CircleGeometry(W.r + 0.1, 48, Math.PI / 2, Math.PI);
    leaf.rotateX(-Math.PI / 2);
    const leafRing = place(new TorusGeometry(W.r + 0.1, 0.05, 6, 48, Math.PI), { rotation: [Math.PI / 2, 0, Math.PI / 2] });

    return {
      textures: [paving.texture, lawn.texture, tiles.texture, ripple],
      forecourt,
      lawns,
      plaza,
      walks,
      rim,
      basinFloor,
      waterGeo,
      rails: merge(rails),
      hedges,
      lampPosts,
      lampHeads,
      leaf,
      leafRing,
      shrubGeo: new IcosahedronGeometry(1, 2),
      mPaving: new MeshStandardMaterial({ map: paving.texture, roughness: 0.9 }),
      mLawn: new MeshStandardMaterial({ map: lawn.texture, roughness: 1 }),
      mStone: new MeshStandardMaterial({ color: '#d8ccb4', roughness: 0.85 }),
      mTile: new MeshStandardMaterial({ map: tiles.texture, roughness: 0.4 }),
      mRail: new MeshStandardMaterial({ color: '#f3f2ee', roughness: 0.55 }),
      mHedge: new MeshStandardMaterial({ color: '#35522a', roughness: 1 }),
      mShrub: new MeshStandardMaterial({ color: '#3d5f2c', roughness: 0.95 }),
      mPost: new MeshStandardMaterial({ color: '#2c2e31', roughness: 0.5, metalness: 0.6 }),
      mLamp: new MeshBasicMaterial({ color: LAMP.clone() }),
      mGlass: new MeshStandardMaterial({ color: PALETTE.glass, roughness: 0.04, metalness: 0.5, transparent: true, opacity: 0.45, depthWrite: false }),
      mSteel: new MeshStandardMaterial({ color: '#2a2d31', roughness: 0.35, metalness: 0.85 }),
      mGlow: new MeshBasicMaterial({ color: new Color('#cfe0ff').multiplyScalar(1.3) }),
      glowGeo: new RingGeometry(W.r - 0.25, W.r - 0.05, 64).rotateX(-Math.PI / 2),
    };
  }, [q.textureScale]);

  // Topiary shrubs along the pool walks.
  useLayoutEffect(() => {
    const m = shrubs.current;
    if (!m) return;
    const mtx = new Matrix4();
    const r = rng(3);
    let i = 0;
    for (const x of [P.x0 - 2.6, P.x1 + 2.6])
      for (let z = P.z0 + 1.1; z < P.z1; z += 4.4) {
        const s = 0.55 + r() * 0.2;
        mtx.makeScale(s, s * 0.85, s).setPosition(x, s * 0.75, z + 2.2);
        m.setMatrixAt(i++, mtx);
      }
    m.count = i;
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [res]);

  useFrame((_, dt) => {
    // Lamps burn before dawn and go out as the day arrives (the opening).
    res.mLamp.color.copy(LAMP_OFF).lerp(LAMP, 1 + (look.practicals - 1) * world.intro);
    // The light-well's glass slides open as the opening's camera stands over it.
    const open = introFrame.active ? wellOpenAmount(introFrame.t) : 0;
    const slide = open * (W.r + 0.8);
    if (left.current) left.current.position.x = W.x - slide;
    if (right.current) right.current.position.x = W.x + slide;
    const n = water.current?.normalMap;
    if (n) {
      n.offset.x += dt * 0.02;
      n.offset.y += dt * 0.035;
    }
  });

  return (
    <group name="grounds">
      <mesh geometry={res.forecourt} material={res.mPaving} receiveShadow />
      <mesh geometry={res.lawns} material={res.mLawn} receiveShadow />
      <mesh geometry={res.plaza} material={res.mPaving} receiveShadow />
      <mesh geometry={res.walks} material={res.mStone} receiveShadow />
      <mesh geometry={res.rim} material={res.mStone} castShadow={q.shadows} receiveShadow />
      <mesh geometry={res.basinFloor} material={res.mTile} />
      <mesh geometry={res.waterGeo} renderOrder={2}>
        <meshStandardMaterial ref={water} attach="material" color="#3f97c0" roughness={0.06} metalness={0.25} transparent opacity={0.8} normalMap={res.textures[3]} />
      </mesh>
      <mesh geometry={res.rails} material={res.mRail} castShadow={q.shadows} />
      <mesh geometry={res.hedges} material={res.mHedge} castShadow={q.shadows} receiveShadow />
      <mesh geometry={res.lampPosts} material={res.mPost} />
      <mesh geometry={res.lampHeads} material={res.mLamp} />
      <instancedMesh ref={shrubs} args={[res.shrubGeo, res.mShrub, 40]} castShadow={q.shadows} receiveShadow />
      <Fountains />
      {/* The light-well: a glowing ring below two sliding glass leaves. */}
      <mesh geometry={res.glowGeo} material={res.mGlow} position={[W.x, 0.17, W.z]} />
      <group ref={left} position={[W.x, 0.24, W.z]}>
        <mesh geometry={res.leaf} material={res.mGlass} renderOrder={3} />
        <mesh geometry={res.leafRing} material={res.mSteel} />
      </group>
      <group ref={right} position={[W.x, 0.24, W.z]} rotation={[0, Math.PI, 0]}>
        <mesh geometry={res.leaf} material={res.mGlass} renderOrder={3} />
        <mesh geometry={res.leafRing} material={res.mSteel} />
      </group>
    </group>
  );
}

/** Ground-plane shape with a round hole at the light-well (used by the campus ground). */
export function groundWithWell(size: number) {
  const half = size / 2;
  const s = new Shape([new Vector2(-half, -half), new Vector2(half, -half), new Vector2(half, half), new Vector2(-half, half)]);
  const hole = new Path();
  hole.absarc(W.x, -W.z, W.r + 0.5, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const g = new ShapeGeometry(s, 48);
  g.rotateX(-Math.PI / 2);
  return g;
}
