'use client';
/**
 * THE CORE. An octagonal room at the heart of the team workspace.
 *
 * On a projection table, a hologram of everything you've just travelled
 * through: the campus above (every building from OpenStreetMap, the red
 * building in red), and beneath it — cut away — the shaft, the facility, the
 * events corridor with its rooms, the door, the team hall and this room, with
 * your route traced through all of it and a light running along it. "You are
 * here" pulses at the centre.
 *
 * Around the walls, a slow ring of names: the faculty, this year's team and
 * every office bearer before them — the people the chapter is made of.
 *
 * The door slides open as the tour walks up to it — the last stop.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AdditiveBlending,
  type BufferGeometry,
  BufferGeometry as Geometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  EdgesGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  type Group,
  LineBasicMaterial,
  type Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  RingGeometry,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { PALETTE } from '@/config/palette';
import { CAMPUS, CORRIDOR, DOOR, FLOOR_Y, TEAM_HALL, TEAM_LAYOUT, TEAM_ORIGIN, UNDERGROUND } from '@/config/world';
import { ALUMNI } from '@/content/alumni';
import { CHAPTER, yearsActive } from '@/content/chapter';
import { DIRECTORS, FACULTY } from '@/content/team';
import { smoothstep } from '@/systems/camera/pose';
import { TOUR_STOPS } from '@/systems/camera/tour';
import { tour } from '@/systems/characters/cues';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { merge, metricBox, place } from '@/systems/geometry/build';
import { useLightAnchor } from '@/systems/lighting/lightPool';
import { useDisposable } from '@/systems/performance/useDisposable';
import { fitSize, text } from '@/systems/textures/typeset';
import { CEG_INNER, CEG_OUTER } from '@/scenes/campus/cegModel';
import { type CampusData, loadCampus } from '@/scenes/campus/campusData';
import { CanvasPanel } from '@/scenes/shared/CanvasPanel';
import { useKit } from '@/scenes/underground/kit';

const R = TEAM_HALL.core.radius;
const CX = TEAM_ORIGIN[0];
const CZ = TEAM_ORIGIN[2] + TEAM_HALL.core.z;
const H = TEAM_HALL.height;
const APOTHEM = R * Math.cos(Math.PI / 8);
const SIDE = 2 * R * Math.sin(Math.PI / 8);
const BONE = PALETTE.bone;
const DIM = 'rgba(239,233,223,0.58)';

/** The hologram: world metres × SCALE, centred on the middle of the journey. */
const SCALE = 1 / 88;
/** Depth is exaggerated a little so the underground reads as its own layer. */
const DEPTH_X = 1.25;
const TABLE_R = 1.75;
const TABLE_Y = 0.9;
const SURFACE_Y = 0.98;
const CENTER_Z = (CAMPUS.well.z + CZ) / 2;
const REACH = TABLE_R / SCALE - 12;
const COOL = new Color('#9cc3ff');
const WARM = new Color('#ffb86b');

/** Every stop of the journey in world space, for the route line. */
function routePoints(): Vector3[] {
  const W = CAMPUS.well;
  // From above the lawn, down the light-well…
  const pts: [number, number, number][] = [
    [W.x, 26, W.z + 8],
    [W.x, 12, W.z + 2],
    [W.x, 0, W.z],
    [W.x, FLOOR_Y + 1, W.z],
    [0, FLOOR_Y + 1, UNDERGROUND.hall.north + 2],
  ];
  for (const r of CORRIDOR.rooms) pts.push([r.viewpoint[0] * 1.6, FLOOR_Y + 1, r.viewpoint[2]]);
  pts.push([0, FLOOR_Y + 1, DOOR.z + 3], [0, FLOOR_Y + 1, DOOR.z - 3]);
  for (const s of TOUR_STOPS) pts.push([s.view[0], FLOOR_Y + 1, s.view[2]]);
  return pts.map(([x, y, z]) => new Vector3(x, y, z));
}

/** Plans of the underground spaces, as line segments in world space. */
function planLines(): number[] {
  const out: number[] = [];
  const y = FLOOR_Y + 0.5;
  const rect = (x0: number, z0: number, x1: number, z1: number) => {
    out.push(x0, y, z0, x1, y, z0, x1, y, z0, x1, y, z1, x1, y, z1, x0, y, z1, x0, y, z1, x0, y, z0);
  };
  const H0 = UNDERGROUND.hall;
  rect(-H0.width / 2, H0.north, H0.width / 2, H0.south);
  const hw = UNDERGROUND.corridor.halfWidth;
  rect(-hw, DOOR.z, hw, CORRIDOR.start);
  for (const r of CORRIDOR.rooms) {
    const x0 = r.side * hw;
    const x1 = r.side * (hw + r.depth);
    rect(Math.min(x0, x1), r.z - r.length / 2, Math.max(x0, x1), r.z + r.length / 2);
  }
  const tz = TEAM_ORIGIN[2];
  rect(TEAM_ORIGIN[0] - TEAM_HALL.halfWidth, tz - TEAM_HALL.depth, TEAM_ORIGIN[0] + TEAM_HALL.halfWidth, tz);
  for (const b of TEAM_LAYOUT.bays) {
    const c = Math.cos(b.rotationY);
    const s = Math.sin(b.rotationY);
    const corner = (lx: number, lz: number) => [TEAM_ORIGIN[0] + b.x + lx * c + lz * s, tz + b.z - lx * s + lz * c];
    const q = [corner(-b.width / 2, -b.depth / 2), corner(b.width / 2, -b.depth / 2), corner(b.width / 2, b.depth / 2), corner(-b.width / 2, b.depth / 2)];
    for (let i = 0; i < 4; i++) out.push(q[i][0], y, q[i][1], q[(i + 1) % 4][0], y, q[(i + 1) % 4][1]);
  }
  for (let i = 0; i < 48; i++) {
    const a0 = (i / 48) * Math.PI * 2;
    const a1 = ((i + 1) / 48) * Math.PI * 2;
    out.push(CX + Math.sin(a0) * R, y, CZ + Math.cos(a0) * R, CX + Math.sin(a1) * R, y, CZ + Math.cos(a1) * R);
  }
  // The shaft.
  out.push(CAMPUS.well.x, 0, CAMPUS.well.z, CAMPUS.well.x, FLOOR_Y, CAMPUS.well.z);
  return out;
}

/** Building footprints (above ground) as outline edges. */
function campusEdges(data: CampusData | null): BufferGeometry | null {
  if (!data) return null;
  const geos: BufferGeometry[] = [];
  for (const b of data.buildings) {
    const cx = b.p.reduce((a, p) => a + p[0], 0) / b.p.length;
    const cz = -b.p.reduce((a, p) => a + p[1], 0) / b.p.length;
    if (Math.hypot(cx, cz - CENTER_Z) > REACH - 20) continue;
    const shape = new Shape(b.p.map(([x, y]) => new Vector2(x, y)));
    const ex = new ExtrudeGeometry(shape, { depth: b.h, bevelEnabled: false });
    ex.rotateX(-Math.PI / 2);
    geos.push(new EdgesGeometry(ex, 20));
    ex.dispose();
  }
  if (!geos.length) return null;
  // Lines only: merge positions directly (no normals / uvs needed).
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  return merged;
}

function mainBuilding() {
  const shape = new Shape(CEG_OUTER.map(([x, z]) => new Vector2(x, -z)));
  shape.holes.push(new Shape(CEG_INNER.map(([x, z]) => new Vector2(x, -z))));
  const g = new ExtrudeGeometry(shape, { depth: 13, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  return g;
}

function ringTexture(line: string, height: number, font: 'serif' | 'mono', color: string) {
  const c = document.createElement('canvas');
  c.width = 4096;
  c.height = height;
  const ctx = c.getContext('2d')!;
  const spec = { family: font, size: height * 0.62, tracking: font === 'mono' ? 0.3 : 0.04 } as const;
  const size = fitSize(ctx, line, c.width * 0.99, spec, height * 0.62, height * 0.18);
  text(ctx, line, 0, height * 0.72, { ...spec, size, color });
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  // Seen from inside the cylinder: mirror so the names read left to right.
  tex.repeat.x = -1;
  tex.anisotropy = 8;
  return tex;
}

function Hologram() {
  const [campus, setCampus] = useState<CampusData | null>(null);
  useEffect(() => {
    let alive = true;
    loadCampus().then((d) => {
      if (alive) setCampus(d);
    });
    return () => {
      alive = false;
    };
  }, []);
  const spin = useRef<Group>(null);
  const comet = useRef<Mesh>(null);
  const here = useRef<Mesh>(null);
  const res = useDisposable(() => {
    const curve = new CatmullRomCurve3(routePoints(), false, 'centripetal');
    const plan = new Geometry();
    plan.setAttribute('position', new Float32BufferAttribute(planLines(), 3));
    return {
      curve,
      route: new TubeGeometry(curve, 700, 0.75, 6, false),
      routeMat: new MeshBasicMaterial({ color: WARM.clone().multiplyScalar(1.6), transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
      plan,
      planMat: new LineBasicMaterial({ color: WARM.clone().multiplyScalar(1.5), transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false }),
      edgeMat: new LineBasicMaterial({ color: COOL.clone().multiplyScalar(1.3), transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false }),
      main: mainBuilding(),
      mainMat: new MeshBasicMaterial({ color: new Color(PALETTE.cegRed).multiplyScalar(1.3), transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, toneMapped: false }),
      ground: new RingGeometry(0, REACH, 96).rotateX(-Math.PI / 2),
      groundMat: new MeshBasicMaterial({ color: COOL, transparent: true, opacity: 0.045, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, toneMapped: false }),
      edge: new RingGeometry(REACH - 1.2, REACH, 96).rotateX(-Math.PI / 2),
      edgeRingMat: new MeshBasicMaterial({ color: COOL, transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
      // A faint floor for the underground level, so the two layers read apart.
      under: (() => {
        const g = new RingGeometry(0, REACH * 0.92, 72).rotateX(-Math.PI / 2);
        g.translate(0, FLOOR_Y, 0);
        return g;
      })(),
      comet: new SphereGeometry(3, 12, 10),
      cometMat: new MeshBasicMaterial({ color: new Color('#fff1d6').multiplyScalar(2), toneMapped: false }),
      hereRing: new TorusGeometry(6, 0.7, 8, 48).rotateX(Math.PI / 2),
      hereMat: new MeshBasicMaterial({ color: new Color(PALETTE.cegRed).multiplyScalar(2), transparent: true, toneMapped: false }),
    };
  }, []);
  const edges = useMemo(() => campusEdges(campus), [campus]);
  useEffect(() => () => edges?.dispose(), [edges]);
  const tmp = useMemo(() => new Vector3(), []);

  useFrame(({ clock }, dt) => {
    if (spin.current) spin.current.rotation.y += dt * 0.05;
    const t = (clock.elapsedTime * 0.06) % 1;
    if (comet.current) comet.current.position.copy(res.curve.getPointAt(t, tmp));
    if (here.current) {
      const k = (clock.elapsedTime * 0.8) % 1;
      here.current.scale.setScalar(1 + k * 2.2);
      res.hereMat.opacity = 1 - k;
    }
    // A faint flicker, like a projection.
    res.edgeMat.opacity = 0.5 + Math.sin(clock.elapsedTime * 13) * 0.03;
  });

  return (
    <group position={[0, TABLE_Y + 0.02, 0]}>
      <group ref={spin}>
        {/* World space inside, shrunk and centred on the journey. */}
        <group scale={[SCALE, SCALE * DEPTH_X, SCALE]} position={[0, SURFACE_Y, 0]}>
          <group position={[0, 0, -CENTER_Z]}>
            <mesh geometry={res.ground} material={res.groundMat} position={[0, 0, CENTER_Z]} />
            <mesh geometry={res.edge} material={res.edgeRingMat} position={[0, 0, CENTER_Z]} />
            <mesh geometry={res.under} material={res.groundMat} position={[0, 0, CENTER_Z]} />
            {edges && <lineSegments geometry={edges} material={res.edgeMat} />}
            <mesh geometry={res.main} material={res.mainMat} />
            <lineSegments geometry={res.plan} material={res.planMat} />
            <mesh geometry={res.route} material={res.routeMat} />
            <mesh ref={comet} geometry={res.comet} material={res.cometMat} />
            <mesh ref={here} geometry={res.hereRing} material={res.hereMat} position={[CX, FLOOR_Y + 1, CZ]} />
          </group>
        </group>
      </group>
    </group>
  );
}

export function CoreRoom() {
  const kit = useKit();
  const leftDoor = useRef<Group>(null);
  const rightDoor = useRef<Group>(null);
  const names = useRef<Mesh>(null);
  const motto = useRef<Mesh>(null);
  const open = useRef(0);

  const res = useDisposable(() => {
    const walls: BufferGeometry[] = [];
    for (let i = 1; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      walls.push(place(metricBox(SIDE + 0.25, H, 0.35), { position: [Math.sin(a) * APOTHEM, H / 2, Math.cos(a) * APOTHEM], rotation: [0, a, 0] }));
    }
    const doorSide = (SIDE - TEAM_HALL.core.doorWidth) / 2;
    walls.push(place(metricBox(doorSide, H, 0.35), { position: [-(TEAM_HALL.core.doorWidth / 2 + doorSide / 2), H / 2, APOTHEM] }));
    walls.push(place(metricBox(doorSide, H, 0.35), { position: [TEAM_HALL.core.doorWidth / 2 + doorSide / 2, H / 2, APOTHEM] }));
    walls.push(place(metricBox(TEAM_HALL.core.doorWidth, H - 3.2, 0.35), { position: [0, 3.2 + (H - 3.2) / 2, APOTHEM] }));
    // Light slots at the eight corners.
    const slots: BufferGeometry[] = [];
    for (let i = 0; i < 8; i++) {
      const a = ((i + 0.5) * Math.PI) / 4;
      slots.push(place(metricBox(0.025, H - 1.6, 0.025), { position: [Math.sin(a) * (R - 0.18), H / 2 + 0.3, Math.cos(a) * (R - 0.18)] }));
    }
    // Rings on the floor, radiating from the table.
    const rings: BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) rings.push(place(new RingGeometry(TABLE_R + 0.6 + i * 1.1, TABLE_R + 0.63 + i * 1.1, 96), { position: [0, 0.006, 0], rotation: [-Math.PI / 2, 0, 0] }));

    const everyone = [...new Set([...DIRECTORS.map((m) => m.name), ...FACULTY.map((f) => f.name), ...ALUMNI.flatMap((y) => y.bearers.map((b) => b.name))])];
    const namesLine = everyone.map((n) => n.toUpperCase()).join('   ·   ') + '   ·   ';
    const mottoLine = Array.from({ length: 5 }, () => `LEARN · BUILD · CONNECT · SINCE ${CHAPTER.established}`).join('       ') + '       ';
    return {
      walls: merge(walls),
      slots: merge(slots),
      rings: merge(rings),
      table: place(new CylinderGeometry(0.55, 0.75, TABLE_Y - 0.05, 32), { position: [0, (TABLE_Y - 0.05) / 2, 0] }),
      top: place(new CylinderGeometry(TABLE_R, TABLE_R, 0.05, 72), { position: [0, TABLE_Y - 0.02, 0] }),
      rim: place(new TorusGeometry(TABLE_R, 0.01, 8, 96), { position: [0, TABLE_Y + 0.005, 0], rotation: [Math.PI / 2, 0, 0] }),
      topMat: new MeshBasicMaterial({ color: '#050609' }),
      rimMat: new MeshBasicMaterial({ color: COOL.clone().multiplyScalar(0.9), toneMapped: false }),
      slotMat: new MeshBasicMaterial({ color: new Color('#ffd9ae').multiplyScalar(0.55), toneMapped: false }),
      ringMat: new MeshBasicMaterial({ color: COOL.clone().multiplyScalar(0.55), transparent: true, opacity: 0.6, toneMapped: false }),
      namesGeo: new CylinderGeometry(APOTHEM - 0.35, APOTHEM - 0.35, 0.62, 128, 1, true),
      namesMat: new MeshBasicMaterial({ map: ringTexture(namesLine, 96, 'serif', BONE), transparent: true, side: DoubleSide, depthWrite: false, toneMapped: false }),
      mottoGeo: new CylinderGeometry(APOTHEM - 0.36, APOTHEM - 0.36, 0.26, 128, 1, true),
      mottoMat: new MeshBasicMaterial({ map: ringTexture(mottoLine, 48, 'mono', 'rgba(239,233,223,0.55)'), transparent: true, side: DoubleSide, depthWrite: false, toneMapped: false }),
      shaft: new MeshBasicMaterial({ color: '#dfe9ff', transparent: true, opacity: 0.06, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
      shaftGeo: place(new ConeGeometry(2.4, H + 6, 32, 1, true), { position: [0, (H + 6) / 2, 0] }),
      oculus: place(metricBox(3.2, 0.04, 3.2), { position: [0, H - 0.02, 0] }),
      glass: new MeshStandardMaterial({ color: '#cfe0ee', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.18, depthWrite: false }),
      doorLeaf: place(metricBox(TEAM_HALL.core.doorWidth / 2, 3.2, 0.08), { position: [0, 1.6, 0] }),
      // A soft glow on the table where the projection starts.
      glowGeo: new RingGeometry(0, TABLE_R * 0.96, 72).rotateX(-Math.PI / 2),
      glowMat: new MeshBasicMaterial({ color: COOL.clone().multiplyScalar(0.25), transparent: true, opacity: 0.18, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
    };
  }, []);

  useLightAnchor([CX, FLOOR_Y + H - 1, CZ], '#e8efff', 90, 16);
  useLightAnchor([CX, FLOOR_Y + 2.6, CZ + R + 1.5], '#ffd2a0', 50, 10);

  useFrame((_, dt) => {
    const last = TOUR_STOPS.length - 1;
    const want = tour.inTeam && tour.index === last ? smoothstep(0.05, 0.4, tour.walk) : 0;
    open.current += (want - open.current) * (1 - Math.exp(-dt * 6));
    const slide = open.current * (TEAM_HALL.core.doorWidth / 2 + 0.1);
    if (leftDoor.current) leftDoor.current.position.x = -TEAM_HALL.core.doorWidth / 4 - slide;
    if (rightDoor.current) rightDoor.current.position.x = TEAM_HALL.core.doorWidth / 4 + slide;
    if (names.current) names.current.rotation.y += dt * 0.025;
    if (motto.current) motto.current.rotation.y -= dt * 0.04;
  });

  return (
    <group position={[CX, FLOOR_Y, CZ]} name="core">
      <mesh geometry={res.walls} material={kit.concreteDark} />
      <mesh geometry={res.slots} material={res.slotMat} />
      <mesh geometry={res.rings} material={res.ringMat} />
      <mesh geometry={res.oculus} material={kit.lightCool} />
      <mesh geometry={res.shaftGeo} material={res.shaft} renderOrder={5} />

      {/* The projection table. */}
      <mesh geometry={res.table} material={kit.steel} />
      <mesh geometry={res.top} material={res.topMat} />
      <mesh geometry={res.rim} material={res.rimMat} />
      <mesh geometry={res.glowGeo} material={res.glowMat} position={[0, TABLE_Y + 0.01, 0]} renderOrder={3} />
      <Hologram />
      <CanvasPanel
        width={1.9}
        height={0.12}
        pxPerMeter={480}
        position={[0, TABLE_Y - 0.05, TABLE_R + 0.02]}
        shading="glow"
        transparent
        drawKey="you-are-here"
        draw={(ctx, w, h) => text(ctx, '● YOU ARE HERE — THE WHOLE JOURNEY, BENEATH THE RED BUILDING', w / 2, h * 0.66, { family: 'mono', size: h * 0.34, color: 'rgba(239,233,223,0.8)', align: 'center', tracking: 0.12 })}
      />

      {/* The ring of names, and the motto above it. */}
      <mesh ref={names} geometry={res.namesGeo} material={res.namesMat} position={[0, 3.05, 0]} renderOrder={6} />
      <mesh ref={motto} geometry={res.mottoGeo} material={res.mottoMat} position={[0, 3.62, 0]} renderOrder={6} />

      {/* Door leaves + the sign on the outside. */}
      <group position={[0, 0, APOTHEM + 0.02]}>
        <group ref={leftDoor} position={[-TEAM_HALL.core.doorWidth / 4, 0, 0]}>
          <mesh geometry={res.doorLeaf} material={res.glass} renderOrder={4} />
        </group>
        <group ref={rightDoor} position={[TEAM_HALL.core.doorWidth / 4, 0, 0]}>
          <mesh geometry={res.doorLeaf} material={res.glass} renderOrder={4} />
        </group>
      </group>
      <CanvasPanel
        width={SIDE}
        height={1.4}
        pxPerMeter={200}
        position={[0, 4.4, APOTHEM + 0.19]}
        shading="glow"
        glowStrength={0.95}
        transparent
        drawKey="core-lock"
        draw={(ctx, w, h) => {
          const s = fitSize(ctx, 'THE CORE', w * 0.9, { family: 'sans', weight: 700, size: h, stretch: 'expanded', tracking: 0.14 }, h * 0.45);
          text(ctx, 'THE CORE', w / 2, h * 0.48, { family: 'sans', weight: 700, size: s, color: BONE, align: 'center', stretch: 'expanded', tracking: 0.14 });
          text(ctx, 'EVERY DOMAIN LEADS HERE — STEP INSIDE', w / 2, h * 0.82, { family: 'mono', size: h * 0.13, color: PALETTE.warm, align: 'center', tracking: 0.2 });
        }}
      />
      <CanvasPanel
        width={SIDE - 0.5}
        height={0.5}
        pxPerMeter={200}
        position={[0, H - 0.9, APOTHEM - 0.19]}
        rotation={[0, Math.PI, 0]}
        shading="glow"
        transparent
        drawKey="core-inner-lintel"
        draw={(ctx, w, h) => text(ctx, `${yearsActive()} YEARS · ONE CHAPTER`, w / 2, h * 0.65, { family: 'mono', size: h * 0.36, color: DIM, align: 'center', tracking: 0.3 })}
      />
    </group>
  );
}
