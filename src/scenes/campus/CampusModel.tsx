'use client';
/**
 * The campus around the red building, from OpenStreetMap: every mapped
 * building footprint extruded to height, the real road network, grounds
 * (the stadium and track, pitches, the pool, gardens, parking) and dense
 * tree canopy scattered everywhere they aren't — as seen from the air over
 * Guindy. All of it merges to a handful of draw calls.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  IcosahedronGeometry,
  type InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Path,
  PlaneGeometry,
  Quaternion,
  Shape,
  ShapeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { QUALITY } from '@/config/quality';
import { CAMPUS } from '@/config/world';
import { rng } from '@/lib/random';
import { experience, useExperience } from '@/store/experience';
import { merge, paint, place } from '@/systems/geometry/build';
import { useDisposable } from '@/systems/performance/useDisposable';
import { makeCanvas, toTexture } from '@/systems/textures/typeset';
import { ModelSlot } from '../shared/ModelSlot';
import { type CampusData, GridIndex, loadCampus, pointInRing } from './campusData';
import { CEG_INNER, CEG_OUTER } from './cegModel';
import { groundWithWell } from './Grounds';

const GARDEN = CAMPUS.garden;

// ─── Textures ──────────────────────────────────────────────────────────────────

function facadeTextures(scale: number) {
  const size = Math.round(256 * scale);
  const a = makeCanvas(size, size);
  const e = makeCanvas(size, size);
  const r = rng(38);
  a.ctx.fillStyle = '#ffffff';
  a.ctx.fillRect(0, 0, size, size);
  e.ctx.fillStyle = '#000000';
  e.ctx.fillRect(0, 0, size, size);
  const cols = 4;
  const rows = 3;
  const cw = size / cols;
  const rh = size / rows;
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      const x = i * cw + cw * 0.28;
      const y = j * rh + rh * 0.28;
      a.ctx.fillStyle = '#3b3f45';
      a.ctx.fillRect(x, y, cw * 0.44, rh * 0.46);
      a.ctx.fillStyle = 'rgba(0,0,0,0.12)';
      a.ctx.fillRect(x - cw * 0.06, y + rh * 0.47, cw * 0.56, rh * 0.05);
      if (r() < 0.22) {
        e.ctx.fillStyle = r() < 0.5 ? '#ffcf8f' : '#ffe0ae';
        e.ctx.fillRect(x, y, cw * 0.44, rh * 0.46);
      }
    }
  return { map: toTexture(a.canvas, { repeat: true }), emissive: toTexture(e.canvas, { repeat: true }), tile: 11 };
}

/** Dry Chennai ground under the canopy: dust, patchy grass, leaf litter. One tile = 70 m. */
function groundTexture(scale: number) {
  const size = Math.round(512 * scale);
  const { canvas, ctx } = makeCanvas(size, size);
  const r = rng(600025);
  ctx.fillStyle = '#6a6040';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 420; i++) {
    const x = r() * size;
    const y = r() * size;
    const rad = (0.01 + r() * 0.07) * size;
    const pal = ['rgba(92,110,56,0.35)', 'rgba(120,104,70,0.35)', 'rgba(70,86,44,0.3)', 'rgba(140,120,84,0.25)'];
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, pal[i % pal.length]);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  return { texture: toTexture(canvas, { repeat: true }), tile: 70 };
}

// ─── Geometry ──────────────────────────────────────────────────────────────────

const WALLS = [
  { w: '#b1513f', roofs: ['#8f4a36', '#90867b'] },
  { w: '#ddd4c3', roofs: ['#c7c1b5', '#9d978d'] },
  { w: '#b7b1a6', roofs: ['#9b968d', '#86817a'] },
  { w: '#c98f6f', roofs: ['#8c5540', '#a39c91'] },
];

/** Split an ExtrudeGeometry's groups into caps (roof) and sides (walls). */
function splitExtrude(g: ExtrudeGeometry) {
  const pos = g.getAttribute('position') as BufferAttribute;
  const nor = g.getAttribute('normal') as BufferAttribute;
  const uv = g.getAttribute('uv') as BufferAttribute;
  const make = (start: number, count: number) => {
    const out = new BufferGeometry();
    out.setAttribute('position', new BufferAttribute((pos.array as Float32Array).slice(start * 3, (start + count) * 3), 3));
    out.setAttribute('normal', new BufferAttribute((nor.array as Float32Array).slice(start * 3, (start + count) * 3), 3));
    out.setAttribute('uv', new BufferAttribute((uv.array as Float32Array).slice(start * 2, (start + count) * 2), 2));
    return out;
  };
  const [caps, sides] = g.groups;
  const result = { roof: make(caps.start, caps.count), walls: make(sides.start, sides.count) };
  g.dispose();
  return result;
}

function toShape(ring: [number, number][], holes?: [number, number][][]) {
  const s = new Shape(ring.map(([x, z]) => new Vector2(x, -z)));
  for (const h of holes ?? []) s.holes.push(new Path(h.map(([x, z]) => new Vector2(x, -z))));
  return s;
}

interface Built {
  walls: BufferGeometry;
  roofs: BufferGeometry;
  roads: BufferGeometry;
  areas: BufferGeometry;
  trees: { x: number; z: number; h: number; r: number; c: string }[];
  palms: { x: number; z: number; h: number; lean: number }[];
}

function buildCampus(data: CampusData, treeCap: number, lowDetail: boolean): Built {
  const r = rng(1794);
  const walls: BufferGeometry[] = [];
  const roofs: BufferGeometry[] = [];
  const blockers = new GridIndex<[number, number][]>(40);

  for (const b of data.buildings) {
    const fam = WALLS[Math.min(WALLS.length - 1, Math.floor(b.v * WALLS.length))];
    const roofColor = fam.roofs[b.v * 97 % 1 < 0.55 ? 0 : 1];
    const g = new ExtrudeGeometry(toShape(b.p, b.holes), { depth: b.h, bevelEnabled: false, curveSegments: 1 });
    g.rotateX(-Math.PI / 2);
    const { roof, walls: side } = splitExtrude(g);
    // Shift facade UVs per building so windows don't line up across the campus.
    const uv = side.getAttribute('uv') as BufferAttribute;
    const du = b.v * 11;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) + du);
    walls.push(paint(side, new Color(fam.w).offsetHSL(0, 0, (b.v - 0.5) * 0.06)));
    roofs.push(paint(roof, roofColor));
    let x0 = Infinity;
    let z0 = Infinity;
    let x1 = -Infinity;
    let z1 = -Infinity;
    for (const [x, z] of b.p) {
      x0 = Math.min(x0, x);
      z0 = Math.min(z0, z);
      x1 = Math.max(x1, x);
      z1 = Math.max(z1, z);
    }
    blockers.insert(b.p, x0 - 2, z0 - 2, x1 + 2, z1 + 2);
  }

  // Roads: ribbons with rounded joints.
  const roadGeos: BufferGeometry[] = [];
  const roadIndex = new GridIndex<{ a: [number, number]; b: [number, number]; w: number }>(30);
  // Flat layers are stacked ≥ 1 cm apart (areas < roads < paths < the forecourt in Grounds.tsx) so
  // the depth buffer can always tell them apart; see the adaptive near plane in CameraRig.
  const lift: Record<string, number> = { primary: 0.13, secondary: 0.13, primary_link: 0.13, tertiary: 0.12, residential: 0.11, service: 0.1, living_street: 0.1, track: 0.1, footway: 0.145, path: 0.145 };
  for (const road of data.roads) {
    const paved = !['footway', 'path', 'track'].includes(road.k);
    const col = paved ? (road.k === 'primary' || road.k === 'secondary' ? '#34322f' : '#44413d') : '#a2957d';
    const y = lift[road.k] ?? 0.11;
    for (let i = 0; i < road.p.length - 1; i++) {
      const a = road.p[i];
      const bb = road.p[i + 1];
      const dx = bb[0] - a[0];
      const dz = bb[1] - a[1];
      const len = Math.hypot(dx, dz);
      if (len < 0.1) continue;
      const q = new PlaneGeometry(len, road.w);
      q.rotateX(-Math.PI / 2);
      q.rotateY(-Math.atan2(dz, dx));
      q.translate((a[0] + bb[0]) / 2, y, (a[1] + bb[1]) / 2);
      roadGeos.push(paint(q, col));
      roadIndex.insert({ a, b: bb, w: road.w }, Math.min(a[0], bb[0]) - road.w, Math.min(a[1], bb[1]) - road.w, Math.max(a[0], bb[0]) + road.w, Math.max(a[1], bb[1]) + road.w);
    }
    for (const p of road.p) roadGeos.push(paint(place(new CircleGeometry(road.w / 2, 10), { position: [p[0], y - 0.002, p[1]], rotation: [-Math.PI / 2, 0, 0] }), col));
  }

  // Grounds.
  const AREA: Record<string, { c: string; y: number; blocks: boolean }> = {
    wood: { c: '#3d5327', y: 0.015, blocks: false },
    park: { c: '#52703a', y: 0.025, blocks: false },
    grass: { c: '#58773a', y: 0.035, blocks: false },
    garden: { c: '#4f6d31', y: 0.045, blocks: false },
    stadium: { c: '#6f6a5a', y: 0.055, blocks: true },
    parking: { c: '#5f5b55', y: 0.055, blocks: true },
    water: { c: '#35607a', y: 0.065, blocks: true },
    track: { c: '#a14c35', y: 0.075, blocks: true },
    pitch: { c: '#5f7d3b', y: 0.085, blocks: true },
    pool: { c: '#3f8fb0', y: 0.09, blocks: true },
  };
  const areaGeos: BufferGeometry[] = [];
  const areaBlockers: [number, number][][] = [];
  for (const a of data.areas) {
    const spec = AREA[a.k];
    if (!spec) continue;
    const shape = toShape(a.p);
    if (pointInRing(a.p, CAMPUS.well.x, CAMPUS.well.z)) {
      const hole = new Path();
      hole.absarc(CAMPUS.well.x, -CAMPUS.well.z, CAMPUS.well.r + 0.5, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
    const g = new ShapeGeometry(shape, 24);
    g.rotateX(-Math.PI / 2);
    g.translate(0, spec.y, 0);
    areaGeos.push(paint(g, spec.c));
    if (spec.blocks) areaBlockers.push(a.p);
  }

  // Trees: dense canopy wherever nothing else is, thinning with distance.
  const near = (x: number, z: number) => {
    for (const s of roadIndex.query(x, z)) {
      const vx = s.b[0] - s.a[0];
      const vz = s.b[1] - s.a[1];
      const t = Math.max(0, Math.min(1, ((x - s.a[0]) * vx + (z - s.a[1]) * vz) / (vx * vx + vz * vz || 1)));
      const d = Math.hypot(x - (s.a[0] + vx * t), z - (s.a[1] + vz * t));
      if (d < s.w / 2 + 1.6) return true;
    }
    return false;
  };
  const inBuilding = (x: number, z: number) => blockers.query(x, z).some((ring) => pointInRing(ring, x, z));
  const inMain = (x: number, z: number) => pointInRing(CEG_OUTER, x, z) && !pointInRing(CEG_INNER, x, z);
  const inGarden = (x: number, z: number) => x > GARDEN.x0 - 1 && x < GARDEN.x1 + 1 && z > GARDEN.z0 - 1 && z < GARDEN.z1 + 1;
  const trees: Built['trees'] = [];
  const greens = ['#3e5c2b', '#48672f', '#53723a', '#35502a', '#5a773b', '#415f33', '#4d6a2c'];
  const step = lowDetail ? 9 : 6.5;
  const candidates: { x: number; z: number; w: number }[] = [];
  for (let x = -CAMPUS.radius; x < CAMPUS.radius; x += step)
    for (let z = -CAMPUS.radius; z < CAMPUS.radius; z += step) {
      const px = x + (r() - 0.5) * step * 0.9;
      const pz = z + (r() - 0.5) * step * 0.9;
      const d = Math.hypot(px, pz - 20);
      if (d > CAMPUS.radius - 20) continue;
      candidates.push({ x: px, z: pz, w: (1.25 - d / CAMPUS.radius) * r() });
    }
  candidates.sort((a, b) => b.w - a.w);
  for (const c of candidates) {
    if (trees.length >= treeCap) break;
    const { x, z } = c;
    if (inMain(x, z) || inGarden(x, z) || inBuilding(x, z) || near(x, z)) continue;
    // Keep procedural crowns out of the opening camera's immediate flight envelope.
    if (Math.abs(x) < 9 && z > GARDEN.z1 && z < GARDEN.z1 + 24) continue;
    if (areaBlockers.some((ring) => pointInRing(ring, x, z))) continue;
    // Keep the forecourt mostly open.
    if (x > -60 && x < 60 && z > 6 && z < 31 && r() > 0.12) continue;
    const flowering = r();
    const color = flowering < 0.035 ? '#b9552f' : flowering < 0.06 ? '#c7a23b' : greens[Math.floor(r() * greens.length)];
    const h = 7 + r() * 8;
    trees.push({ x, z, h, r: 2.6 + r() * 3.2, c: color });
  }
  // A few trees in the courtyard.
  for (let i = 0; i < 16; i++) {
    const x = -50 + r() * 100;
    const z = -30 + r() * 22;
    if (pointInRing(CEG_INNER, x, z)) trees.push({ x, z, h: 7 + r() * 5, r: 2.4 + r() * 2.2, c: greens[i % greens.length] });
  }

  // Coconut palms around the front garden.
  const palms: Built['palms'] = [];
  for (let i = 0; i < 14; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const z = GARDEN.z0 + 6 + Math.floor(i / 2) * 8.5 + r() * 2;
    palms.push({ x: side * (GARDEN.x1 - 2.5 - r() * 3), z, h: 9 + r() * 4, lean: (r() - 0.5) * 0.25 });
  }

  return { walls: merge(walls, true), roofs: merge(roofs, true), roads: merge(roadGeos, true), areas: merge(areaGeos, true), trees, palms };
}

function canopyGeometry() {
  return merge([
    new IcosahedronGeometry(1, 2),
    place(new IcosahedronGeometry(0.72, 1), { position: [0.62, -0.22, 0.28] }),
    place(new IcosahedronGeometry(0.66, 1), { position: [-0.55, -0.12, -0.38] }),
    place(new IcosahedronGeometry(0.58, 1), { position: [0.1, 0.35, -0.5] }),
  ]);
}

function palmFrondGeometry() {
  // Eight drooping fronds, each a folded quad strip.
  const fronds: BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const f = new PlaneGeometry(0.7, 3.6, 1, 6);
    const pos = f.getAttribute('position') as BufferAttribute;
    for (let v = 0; v < pos.count; v++) {
      const y = pos.getY(v) + 1.8;
      pos.setXYZ(v, pos.getX(v) * (1 - y / 4.2), -0.09 * y * y, y);
    }
    f.computeVertexNormals();
    f.rotateX(-0.25);
    f.rotateY(a);
    fronds.push(f);
  }
  return merge(fronds);
}

function ProceduralCampus() {
  const quality = useExperience((s) => s.quality);
  const q = QUALITY[quality];
  const [data, setData] = useState<CampusData | null>(null);
  useEffect(() => {
    let alive = true;
    loadCampus().then((d) => {
      if (!alive) return;
      if (d) setData(d);
      else experience().set({ campusReady: true });
    });
    return () => {
      alive = false;
    };
  }, []);

  const built = useDisposable(() => (data ? buildCampus(data, q.trees, quality === 'low') : null), [data, q.trees, quality]);
  const res = useDisposable(() => {
    const facade = facadeTextures(q.textureScale);
    facade.map.repeat.set(1 / facade.tile, 1 / facade.tile);
    facade.emissive.repeat.set(1 / facade.tile, 1 / facade.tile);
    const ground = groundTexture(q.textureScale);
    ground.texture.repeat.set(1 / ground.tile, 1 / ground.tile);
    return {
      facade,
      ground,
      mWalls: new MeshStandardMaterial({ vertexColors: true, map: facade.map, emissiveMap: facade.emissive, emissive: new Color('#ffffff'), emissiveIntensity: 0.85, roughness: 0.92 }),
      mFlat: new MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
      mGround: new MeshStandardMaterial({ map: ground.texture, roughness: 1 }),
      groundGeo: groundWithWell(CAMPUS.groundSize),
      canopy: canopyGeometry(),
      trunk: place(new CylinderGeometry(0.16, 0.3, 1, 6), { position: [0, 0.5, 0] }),
      palmTrunk: place(new CylinderGeometry(0.14, 0.22, 1, 7, 4), { position: [0, 0.5, 0] }),
      frond: palmFrondGeometry(),
      mCanopy: new MeshStandardMaterial({ color: '#ffffff', roughness: 0.92 }),
      mTrunk: new MeshStandardMaterial({ color: '#4d3e30', roughness: 1 }),
      mPalmTrunk: new MeshStandardMaterial({ color: '#8a7b64', roughness: 1 }),
      mFrond: new MeshStandardMaterial({ color: '#4f7a2e', roughness: 0.85, side: 2 }),
    };
  }, [q.textureScale]);

  const trunks = useRef<InstancedMesh>(null);
  const canopies = useRef<InstancedMesh>(null);
  const palmTrunks = useRef<InstancedMesh>(null);
  const fronds = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    if (!built) return;
    const t = trunks.current;
    const c = canopies.current;
    const pt = palmTrunks.current;
    const pf = fronds.current;
    if (!t || !c || !pt || !pf) return;
    const m = new Matrix4();
    const qn = new Quaternion();
    const s = new Vector3();
    const p = new Vector3();
    const col = new Color();
    const up = new Vector3(0, 1, 0);
    const r = rng(5);
    built.trees.forEach((tree, i) => {
      const trunkH = tree.h * 0.45;
      m.compose(p.set(tree.x, 0, tree.z), qn.identity(), s.set(1 + tree.r * 0.06, trunkH, 1 + tree.r * 0.06));
      t.setMatrixAt(i, m);
      const squash = 0.62 + r() * 0.2;
      m.compose(p.set(tree.x, trunkH + tree.r * squash * 0.72, tree.z), qn.setFromAxisAngle(up, r() * 6.28), s.set(tree.r, tree.r * squash, tree.r * (0.85 + r() * 0.3)));
      c.setMatrixAt(i, m);
      c.setColorAt(i, col.set(tree.c).offsetHSL(0, 0, (r() - 0.5) * 0.05));
    });
    built.palms.forEach((palm, i) => {
      m.compose(p.set(palm.x, 0, palm.z), qn.setFromAxisAngle(new Vector3(1, 0, 0), palm.lean), s.set(1, palm.h, 1));
      pt.setMatrixAt(i, m);
      const top = new Vector3(0, palm.h, 0).applyQuaternion(qn).add(p);
      m.compose(top, qn.setFromAxisAngle(up, i * 1.7), s.set(1.2, 1.2, 1.2));
      pf.setMatrixAt(i, m);
    });
    for (const mesh of [t, c, pt, pf]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    if (c.instanceColor) c.instanceColor.needsUpdate = true;
    experience().set({ campusReady: true });
  }, [built]);

  return (
    <group name="campus">
      <mesh geometry={res.groundGeo} material={res.mGround} receiveShadow />
      {built && (
        <>
          <mesh geometry={built.areas} material={res.mFlat} receiveShadow />
          <mesh geometry={built.roads} material={res.mFlat} receiveShadow />
          <mesh geometry={built.walls} material={res.mWalls} castShadow={q.shadows} receiveShadow />
          <mesh geometry={built.roofs} material={res.mFlat} castShadow={q.shadows} receiveShadow />
          <instancedMesh ref={trunks} args={[res.trunk, res.mTrunk, built.trees.length]} castShadow={q.shadows} />
          <instancedMesh ref={canopies} args={[res.canopy, res.mCanopy, built.trees.length]} castShadow={q.shadows} receiveShadow />
          <instancedMesh ref={palmTrunks} args={[res.palmTrunk, res.mPalmTrunk, built.palms.length]} castShadow={q.shadows} />
          <instancedMesh ref={fronds} args={[res.frond, res.mFrond, built.palms.length]} castShadow={q.shadows} />
        </>
      )}
    </group>
  );
}

export function CampusModel() {
  return (
    <ModelSlot id="cegCampus">
      <ProceduralCampus />
    </ModelSlot>
  );
}
