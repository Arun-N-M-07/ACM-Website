'use client';
/**
 * The physical half of each exhibit — the thing in the middle of the room that
 * performs its event in sync with the walls. Room-local coordinates: origin on
 * the floor at the room's centre, +z toward the portal (where you stand).
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Euler,
  type Group,
  type InstancedMesh,
  Line,
  LineBasicMaterial,
  Matrix4,
  type Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import { PRODIGY_PROGRAMME } from '@/content/prodigy';
import { merge, metricBox, place } from '@/systems/geometry/build';
import { useDisposable } from '@/systems/performance/useDisposable';
import { fitSize, paragraph, text } from '@/systems/textures/typeset';
import { CanvasPanel } from '../../shared/CanvasPanel';
import { Chair, Desk, Laptop, Monitor } from '../../shared/props';
import { useKit } from '../../underground/kit';
import { codeScreen, hash, type PieceProps, ramp, sstep } from './common';
import { BALLOON_COLORS, BOOTED, contestT, epochs, OPEN_AT, SORT, solveAt, sortStep } from './walls';

const dummy = new Object3D();
const easeIO = (x: number) => x * x * (3 - 2 * x);

// ─── Head First: fourteen columns that sort themselves ─────────────────────

export function SortColumns({ event, clock }: PieceProps) {
  const inst = useRef<InstancedMesh>(null);
  const n = SORT.values.length;
  const slot = (i: number) => -4.2 + i * (8.4 / (n - 1));
  const res = useDisposable(() => {
    const geo = metricBox(0.48, 1, 0.48);
    geo.translate(0, 0.5, 0);
    return {
      geo,
      mat: new MeshStandardMaterial({ roughness: 0.35, metalness: 0.1, emissive: new Color('#ffffff'), emissiveIntensity: 0.12 }),
      base: place(metricBox(9.3, 0.08, 0.9), { position: [0, 0.04, 0] }),
    };
  }, []);
  const colors = useMemo(() => {
    const cool = new Color(event.accent);
    return { cool, hot: new Color('#e8c07a'), done: new Color('#9fd3a8'), tmp: new Color() };
  }, [event.accent]);

  useFrame(() => {
    const m = inst.current;
    if (!m) return;
    const k = sortStep(clock.current.u);
    const s0 = Math.floor(k);
    const f = easeIO(k - s0);
    const A = SORT.states[Math.min(s0, SORT.states.length - 1)].a;
    const B = SORT.states[Math.min(s0 + 1, SORT.states.length - 1)].a;
    const done = clock.current.u > 0.86;
    SORT.values.forEach((v, idx) => {
      const ia = A.indexOf(v);
      const ib = B.indexOf(v);
      const moving = ia !== ib;
      const x = slot(ia) + (slot(ib) - slot(ia)) * f;
      const lift = moving ? Math.sin(Math.PI * f) * 0.35 * (ib < ia ? 1 : 0.4) : 0;
      dummy.position.set(x, 0.08 + lift, 0);
      dummy.scale.set(1, 0.25 + v * 0.13, 1);
      dummy.updateMatrix();
      m.setMatrixAt(idx, dummy.matrix);
      const c = done ? colors.done : moving ? colors.hot : colors.cool;
      colors.tmp.copy(c).multiplyScalar(done ? 0.8 : moving ? 1 : 0.55 + v * 0.03);
      m.setColorAt(idx, colors.tmp);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  const kit = useKit();
  return (
    <group position={[0, 0, -2.3]}>
      <mesh geometry={res.base} material={kit.steel} />
      <instancedMesh ref={inst} args={[res.geo, res.mat, n]} frustumCulled={false} />
    </group>
  );
}

// ─── CodeX: the contest floor, with a balloon for every solve ──────────────

export function ContestFloor({ clock }: PieceProps) {
  const desks = useMemo(() => [-2.7, 0, 2.7].flatMap((x) => [-3, -1.1].map((z) => ({ x, z }))), []);
  const balloons = useRef<InstancedMesh>(null);
  const strings = useRef<InstancedMesh>(null);
  const total = desks.length * BALLOON_COLORS.length;
  const res = useDisposable(
    () => ({
      ball: new SphereGeometry(0.17, 18, 14).scale(1, 1.18, 1),
      ballMat: new MeshStandardMaterial({ roughness: 0.25, metalness: 0.05, emissive: new Color('#ffffff'), emissiveIntensity: 0.18 }),
      string: new CylinderGeometry(0.004, 0.004, 1, 4).translate(0, 0.5, 0),
      stringMat: new MeshBasicMaterial({ color: '#d8d2c6' }),
    }),
    [],
  );
  useEffect(() => {
    const m = balloons.current;
    if (!m) return;
    for (let d = 0; d < desks.length; d++) for (let p = 0; p < BALLOON_COLORS.length; p++) m.setColorAt(d * BALLOON_COLORS.length + p, new Color(BALLOON_COLORS[p]));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [desks.length]);
  useFrame(({ clock: c }) => {
    const b = balloons.current;
    const s = strings.current;
    if (!b || !s) return;
    const ct = contestT(clock.current.u);
    const t = c.elapsedTime;
    desks.forEach((d, team) => {
      BALLOON_COLORS.forEach((_, p) => {
        const i = team * BALLOON_COLORS.length + p;
        const k = sstep(ct, solveAt(team, p), solveAt(team, p) + 0.08);
        const anchorX = d.x - 0.5 + p * 0.2;
        const topY = 0.78 + k * (1.5 + p * 0.14) + Math.sin(t * 1.3 + i) * 0.04 * k;
        const sway = Math.sin(t * 0.9 + i * 1.7) * 0.08 * k;
        dummy.position.set(anchorX + sway, topY, d.z + Math.cos(t * 0.7 + i) * 0.05 * k);
        dummy.scale.setScalar(k > 0.001 ? 0.3 + 0.7 * Math.min(1, k * 3) : 0.0001);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        b.setMatrixAt(i, dummy.matrix);
        dummy.position.set(anchorX, 0.78, d.z);
        dummy.scale.set(1, k > 0.001 ? Math.max(0.01, topY - 0.95) : 0.0001, 1);
        dummy.rotation.set(0, 0, -Math.atan2(sway, Math.max(0.2, topY - 0.95)));
        dummy.updateMatrix();
        s.setMatrixAt(i, dummy.matrix);
      });
    });
    b.instanceMatrix.needsUpdate = true;
    s.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      {desks.map((d, i) => (
        <group key={i} position={[d.x, 0, d.z]}>
          <Desk width={1.6} depth={0.75} />
          <Monitor position={[0.1, 0.74, -0.15]} drawKey={`codex-m${i}`} draw={(ctx, w, h) => codeScreen(ctx, w, h, i + 2)} />
          <Chair position={[0, 0, -0.75]} />
        </group>
      ))}
      <instancedMesh ref={balloons} args={[res.ball, res.ballMat, total]} frustumCulled={false} />
      <instancedMesh ref={strings} args={[res.string, res.stringMat, total]} frustumCulled={false} />
    </group>
  );
}

// ─── C.O.D.E: the interview table ──────────────────────────────────────────

export function InterviewTable() {
  const kit = useKit();
  const geo = useDisposable(
    () => ({
      sheets: merge([0, 1, 2, 3].map((i) => place(metricBox(0.21, 0.004, 0.297), { position: [-0.45 + i * 0.012, 0.745 + i * 0.004, 0.05], rotation: [0, 0.12 * i, 0] }))),
      glasses: merge([-0.55, 0.6].map((x) => place(new CylinderGeometry(0.035, 0.03, 0.11, 12), { position: [x, 0.795, -0.2] }))),
    }),
    [],
  );
  return (
    <group position={[0.6, 0, -1.6]}>
      <Desk width={1.8} depth={0.9} />
      <Chair position={[0, 0, 0.8]} rotation={[0, Math.PI, 0]} />
      <Chair position={[0, 0, -0.8]} />
      <Laptop position={[0.3, 0.74, 0.05]} rotation={[0, Math.PI, 0]} draw={(ctx, w, h) => codeScreen(ctx, w, h, 3)} drawKey="code-laptop" />
      <mesh geometry={geo.sheets} material={kit.paper} />
      <mesh geometry={geo.glasses} material={kit.glass} />
    </group>
  );
}

// ─── Bell Labs: the memory hierarchy, powering up ──────────────────────────

const TIERS = [
  { label: 'DISK', w: 3 },
  { label: 'MAIN MEMORY', w: 2.4 },
  { label: 'CACHE', w: 1.75 },
  { label: 'REGISTERS', w: 1.1 },
];

export function BootTower({ clock }: PieceProps) {
  const kit = useKit();
  const packets = useRef<InstancedMesh>(null);
  const strips = useRef<MeshBasicMaterial>(null);
  const res = useDisposable(
    () => ({
      tiers: merge(TIERS.map((t, i) => place(metricBox(t.w, 0.22, 1.3 - i * 0.14), { position: [0, 0.45 + i * 0.62, 0] }))),
      edges: merge(TIERS.map((t, i) => place(metricBox(t.w + 0.02, 0.02, 1.32 - i * 0.14), { position: [0, 0.57 + i * 0.62, 0] }))),
      spine: place(new CylinderGeometry(0.035, 0.035, 2.4, 10), { position: [0, 1.3, -0.25] }),
      packet: metricBox(0.07, 0.07, 0.07),
      packetMat: new MeshBasicMaterial({ color: new Color('#ffcf8a').multiplyScalar(1.6), toneMapped: false }),
    }),
    [],
  );
  useFrame(({ clock: c }) => {
    const u = clock.current.u;
    const on = sstep(u, 0.04, BOOTED);
    const flicker = u > 0.04 && u < 0.14 ? (Math.sin(c.elapsedTime * 43) > 0.2 ? 1 : 0.25) : 1;
    if (strips.current) strips.current.color.set('#ffb347').multiplyScalar(0.05 + 1.5 * on * flicker);
    const m = packets.current;
    if (!m) return;
    const live = u > BOOTED - 0.05;
    for (let i = 0; i < 10; i++) {
      const lane = (i % 5) - 2;
      const ph = (c.elapsedTime * (0.35 + hash(i) * 0.3) + hash(i * 9)) % 1;
      const up = i % 2 === 0;
      const y = 0.57 + (up ? ph : 1 - ph) * 1.86;
      dummy.position.set(lane * 0.18, y, 0.5 - (Math.floor(y / 0.62) * 0.07));
      dummy.scale.setScalar(live ? 1 : 0.0001);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <group position={[0, 0, -2]}>
      <mesh geometry={res.tiers} material={kit.black} />
      <mesh geometry={res.edges}>
        <meshBasicMaterial ref={strips} color="#ffb347" toneMapped={false} />
      </mesh>
      <mesh geometry={res.spine} material={kit.steelLight} />
      <instancedMesh ref={packets} args={[res.packet, res.packetMat, 10]} frustumCulled={false} />
      {TIERS.map((t, i) => (
        <CanvasPanel
          key={t.label}
          width={t.w * 0.9}
          height={0.16}
          pxPerMeter={320}
          position={[0, 0.45 + i * 0.62, (1.3 - i * 0.14) / 2 + 0.005]}
          shading="glow"
          transparent
          drawKey={`tier-${t.label}`}
          draw={(ctx, w, h) => text(ctx, t.label, w / 2, h * 0.72, { family: 'mono', weight: 500, size: h * 0.6, color: '#ffe2b0', align: 'center', tracking: 0.2 })}
        />
      ))}
    </group>
  );
}

// ─── Machine Learning 101: gradient descent, on a real surface ─────────────

const loss = (x: number, z: number) =>
  0.06 * (x * x + z * z) - 0.55 * Math.exp(-((x - 0.7) ** 2 + (z + 0.4) ** 2) / 0.45) - 0.25 * Math.exp(-((x + 1.1) ** 2 + (z - 1) ** 2) / 0.3) + 0.08 * Math.sin(2.1 * x) * Math.cos(1.7 * z);

const PATH = (() => {
  const pts: Vector3[] = [];
  let x = -1.85;
  let z = 1.75;
  const e = 1e-3;
  for (let i = 0; i < 140; i++) {
    pts.push(new Vector3(x, loss(x, z), z));
    const gx = (loss(x + e, z) - loss(x - e, z)) / (2 * e);
    const gz = (loss(x, z + e) - loss(x, z - e)) / (2 * e);
    // A little momentum-free descent, capped so the steps stay visible.
    const step = Math.min(0.08, 0.35 * Math.hypot(gx, gz));
    const len = Math.hypot(gx, gz) || 1;
    x -= (gx / len) * step;
    z -= (gz / len) * step;
  }
  return pts;
})();

export function LossLandscape({ event, clock }: PieceProps) {
  const kit = useKit();
  const ball = useRef<Mesh>(null);
  const trail = useRef<Line>(null);
  const LIFT = 1.75;
  const SCALE_Y = 1.1;
  const res = useDisposable(() => {
    const g = new PlaneGeometry(4.4, 4.4, 56, 56);
    g.rotateX(-Math.PI / 2);
    const pos = g.getAttribute('position') as BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, loss(pos.getX(i), pos.getZ(i)) * SCALE_Y);
    g.computeVertexNormals();
    const trailGeo = new BufferGeometry();
    trailGeo.setAttribute('position', new BufferAttribute(new Float32Array(PATH.length * 3), 3));
    const accent = new Color(event.accent);
    return {
      g,
      fill: new MeshStandardMaterial({ color: accent.clone().multiplyScalar(0.7), emissive: accent, emissiveIntensity: 0.35, roughness: 0.5, transparent: true, opacity: 0.7, side: DoubleSide }),
      wire: new MeshBasicMaterial({ color: accent.clone().multiplyScalar(1.6), wireframe: true, transparent: true, opacity: 0.5, toneMapped: false }),
      trailGeo,
      trailMat: new LineBasicMaterial({ color: '#ffe8a8' }),
      ballGeo: new SphereGeometry(0.16, 24, 18),
      ballMat: new MeshBasicMaterial({ color: new Color('#ffe8a8').multiplyScalar(1.5), toneMapped: false }),
      plinth: place(metricBox(3.2, 0.9, 3.2), { position: [0, 0.45, 0] }),
    };
  }, [event.accent]);
  const line = useMemo(() => new Line(res.trailGeo, res.trailMat), [res]);
  useFrame(() => {
    const k = epochs(clock.current.u) * (PATH.length - 1);
    const i = Math.floor(k);
    const f = k - i;
    const a = PATH[i];
    const b = PATH[Math.min(i + 1, PATH.length - 1)];
    if (ball.current) ball.current.position.set(a.x + (b.x - a.x) * f, (a.y + (b.y - a.y) * f) * SCALE_Y + 0.1, a.z + (b.z - a.z) * f);
    const arr = res.trailGeo.getAttribute('position') as BufferAttribute;
    for (let n = 0; n <= i; n++) arr.setXYZ(n, PATH[n].x, PATH[n].y * SCALE_Y + 0.03, PATH[n].z);
    arr.needsUpdate = true;
    res.trailGeo.setDrawRange(0, i + 1);
  });
  return (
    <group position={[0, 0, -2.1]}>
      <mesh geometry={res.plinth} material={kit.concreteDark} />
      {/* Tilted toward you, so the landscape reads as a landscape. */}
      <group position={[0, LIFT, 0]} rotation={[0.42, 0, 0]}>
        <mesh geometry={res.g} material={res.fill} />
        <mesh geometry={res.g} material={res.wire} />
        <primitive object={line} ref={trail} />
        <mesh ref={ball} geometry={res.ballGeo} material={res.ballMat} />
      </group>
    </group>
  );
}

// ─── Schr0ding3r5: the box opens when the flag is found ────────────────────

export function FlagBox({ event, clock }: PieceProps) {
  const kit = useKit();
  const lid = useRef<Group>(null);
  const dials = useRef<Group>(null);
  const glow = useRef<MeshBasicMaterial>(null);
  const beam = useRef<MeshBasicMaterial>(null);
  const res = useDisposable(
    () => ({
      plinth: place(metricBox(1.8, 0.8, 1.8), { position: [0, 0.4, 0] }),
      box: place(metricBox(1.2, 0.9, 1.2), { position: [0, 1.25, 0] }),
      lid: place(metricBox(1.24, 0.12, 1.24), { position: [0, 0.06, 0.62] }),
      slab: place(metricBox(0.9, 0.04, 0.9), { position: [0, 1.66, 0] }),
      dial: new CylinderGeometry(0.08, 0.08, 0.05, 16).rotateX(Math.PI / 2),
      beam: new CylinderGeometry(0.5, 0.75, 4, 32, 1, true).translate(0, 2, 0),
    }),
    [],
  );
  useFrame(({ clock: c }) => {
    const u = clock.current.u;
    const open = sstep(u, OPEN_AT, OPEN_AT + 0.1);
    if (lid.current) lid.current.rotation.x = -open * 1.9;
    if (dials.current) dials.current.children.forEach((d, i) => (d.rotation.z = u < OPEN_AT ? c.elapsedTime * (2 + i) : (i + 1) * 0.9));
    if (glow.current) glow.current.color.set(event.accent).multiplyScalar(0.3 + open * 2.2);
    if (beam.current) beam.current.opacity = 0.09 * open;
  });
  return (
    <group position={[0, 0, -1.8]}>
      <mesh geometry={res.plinth} material={kit.concreteDark} />
      <mesh geometry={res.box} material={kit.steel} />
      <mesh geometry={res.slab}>
        <meshBasicMaterial ref={glow} color={event.accent} toneMapped={false} />
      </mesh>
      <group ref={lid} position={[0, 1.7, -0.62]}>
        <mesh geometry={res.lid} material={kit.steelLight} />
      </group>
      <group ref={dials} position={[0, 1.2, 0.61]}>
        {[-0.36, -0.12, 0.12, 0.36].map((x) => (
          <mesh key={x} geometry={res.dial} material={kit.steelLight} position={[x, 0, 0]} />
        ))}
      </group>
      <mesh geometry={res.beam} position={[0, 1.66, 0]} renderOrder={4}>
        <meshBasicMaterial ref={beam} color={event.accent} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ─── MasterClass: the lecture hall ─────────────────────────────────────────

export function LectureHall({ event, depth, clock }: PieceProps) {
  const kit = useKit();
  const rows = useMemo(() => [-1.4, -0.2, 1].map((z, r) => ({ z, y: r * 0.28 })), []);
  const bubbles = useRef<Group>(null);
  const risers = useDisposable(() => merge(rows.map((r) => place(metricBox(6.8, Math.max(0.02, r.y), 1.2), { position: [0, r.y / 2, r.z] }))), [rows]);
  useFrame(({ clock: c }) => {
    const g = bubbles.current;
    if (!g) return;
    const q = ramp(clock.current.u, 0.74, 0.8);
    g.children.forEach((b, i) => {
      const k = (c.elapsedTime * 0.25 + hash(i)) % 1;
      b.visible = q > 0 && i < Math.ceil(q * g.children.length);
      b.position.y = 1.5 + k * 1.8;
      b.scale.setScalar(Math.min(1, k * 5) * (1 - Math.max(0, k - 0.8) * 5));
    });
  });
  return (
    <group>
      <mesh geometry={risers} material={kit.oak} />
      {rows.flatMap((r, ri) =>
        [-2.6, -1.3, 0, 1.3, 2.6].map((x) => <Chair key={`${ri}-${x}`} position={[x, r.y, r.z]} rotation={[0, 0, 0]} />),
      )}
      <group position={[-3.2, 0, -depth / 2 + 1.6]}>
        <mesh position={[0, 0.55, 0]} material={kit.oak}>
          <boxGeometry args={[0.7, 1.1, 0.5]} />
        </mesh>
        <mesh position={[0, 1.12, 0.04]} rotation={[0.3, 0, 0]} material={kit.oak}>
          <boxGeometry args={[0.8, 0.04, 0.55]} />
        </mesh>
      </group>
      <group ref={bubbles}>
        {Array.from({ length: 6 }, (_, i) => (
          <group key={i} position={[-2.4 + (i % 3) * 2.4, 1.5, -1.2 + Math.floor(i / 3) * 1.2]} visible={false}>
            <CanvasPanel
              width={0.42}
              height={0.42}
              pxPerMeter={300}
              shading="glow"
              transparent
              drawKey={`q-${i}`}
              draw={(ctx, w, h) => {
                ctx.fillStyle = event.accent;
                ctx.beginPath();
                ctx.arc(w / 2, h / 2, w * 0.46, 0, Math.PI * 2);
                ctx.fill();
                text(ctx, '?', w / 2, h * 0.7, { family: 'serif', weight: 700, size: h * 0.6, color: '#1b1814', align: 'center' });
              }}
            />
          </group>
        ))}
      </group>
    </group>
  );
}

// ─── OffCamp: opportunities, flying out ────────────────────────────────────

export function PaperPlanes({ depth, clock }: PieceProps) {
  const inst = useRef<InstancedMesh>(null);
  const N = 14;
  const res = useDisposable(() => {
    const g = new BufferGeometry();
    // A folded paper plane: two wings and a keel.
    const v = [0, 0, 0.32, -0.16, 0.02, -0.18, 0, 0.02, -0.12, 0, 0, 0.32, 0, 0.02, -0.12, 0.16, 0.02, -0.18, 0, 0, 0.32, 0, 0.02, -0.12, 0, -0.07, -0.14];
    g.setAttribute('position', new BufferAttribute(new Float32Array(v), 3));
    g.computeVertexNormals();
    return { g, mat: new MeshStandardMaterial({ color: '#f5f1e8', roughness: 0.8, side: DoubleSide, emissive: new Color('#ffffff'), emissiveIntensity: 0.15 }) };
  }, []);
  const q = useMemo(() => new Quaternion(), []);
  const eul = useMemo(() => new Euler(), []);
  const mtx = useMemo(() => new Matrix4(), []);
  const p = useMemo(() => new Vector3(), []);
  const s = useMemo(() => new Vector3(1, 1, 1), []);
  useFrame(({ clock: c }) => {
    const m = inst.current;
    if (!m) return;
    const launched = Math.floor(ramp(clock.current.u, 0.05, 0.75) * N);
    for (let i = 0; i < N; i++) {
      if (i >= launched) {
        mtx.makeScale(0.0001, 0.0001, 0.0001);
        m.setMatrixAt(i, mtx);
        continue;
      }
      // From the board, across the room, out over your head.
      const speed = 0.12 + hash(i) * 0.08;
      const k = (c.elapsedTime * speed + hash(i * 5)) % 1;
      const x = (hash(i * 3) - 0.5) * 7 + Math.sin(k * 6 + i) * 0.6;
      const z = -depth / 2 + 1 + k * (depth + 3);
      const y = 1.6 + hash(i * 7) * 2 + Math.sin(k * Math.PI) * 0.8;
      p.set(x, y, z);
      eul.set(-0.15 + Math.cos(k * Math.PI) * 0.25, Math.PI, Math.cos(k * 6 + i) * 0.35);
      q.setFromEuler(eul);
      mtx.compose(p, q, s);
      m.setMatrixAt(i, mtx);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={inst} args={[res.g, res.mat, N]} frustumCulled={false} />;
}

// ─── Prodigy: nine pieces that fly together ────────────────────────────────

const PIECES = [...PRODIGY_PROGRAMME.slice(0, 4).map((p) => p.title), 'Prodigy', ...PRODIGY_PROGRAMME.slice(4, 8).map((p) => p.title)];

export function PuzzlePieces({ event, width, depth, clock }: PieceProps) {
  const group = useRef<Group>(null);
  const PW = Math.min(2.7, (width - 5) / 3);
  const PH = PW * 0.52;
  const targets = useMemo(
    () => PIECES.map((_, i) => new Vector3(((i % 3) - 1) * (PW + 0.08), 3 - (Math.floor(i / 3) - 1) * (PH + 0.08), -depth / 2 + 0.7)),
    [PW, PH, depth],
  );
  const starts = useMemo(
    () => PIECES.map((_, i) => ({ p: new Vector3((hash(i * 3) - 0.5) * (width - 3), 0.8 + hash(i * 5) * 4, (hash(i * 7) - 0.3) * depth * 0.6), r: new Euler(hash(i) * 3, hash(i * 2) * 3, hash(i * 4) * 3) })).map((st) => ({ ...st, p: st.p.setZ(Math.min(st.p.z, depth / 2 - 4)) })),
    [width, depth],
  );
  const geo = useDisposable(() => metricBox(PW, PH, 0.14), [PW, PH]);
  const kit = useKit();
  useFrame(({ clock: c }) => {
    const g = group.current;
    if (!g) return;
    const u = clock.current.u;
    g.children.forEach((piece, i) => {
      const order = i === 4 ? 8 : i < 4 ? i : i - 1;
      const k = easeIO(ramp(u, 0.06 + order * 0.08, 0.2 + order * 0.08));
      const st = starts[i];
      const t = targets[i];
      const float = (1 - k) * Math.sin(c.elapsedTime * 0.8 + i) * 0.15;
      piece.position.set(st.p.x + (t.x - st.p.x) * k, st.p.y + (t.y - st.p.y) * k + float, st.p.z + (t.z - st.p.z) * k);
      piece.rotation.set(st.r.x * (1 - k), st.r.y * (1 - k), st.r.z * (1 - k));
    });
  });
  return (
    <group ref={group}>
      {PIECES.map((label, i) => (
        <group key={label}>
          <mesh geometry={geo} material={i === 4 ? kit.redLine : kit.paper} />
          <CanvasPanel
            width={PW - 0.04}
            height={PH - 0.04}
            pxPerMeter={220}
            position={[0, 0, 0.075]}
            shading="glow"
            glowStrength={0.95}
            drawKey={`piece-${label}`}
            draw={(ctx, w, h) => {
              const center = label === 'Prodigy';
              ctx.fillStyle = center ? event.accent : (i % 2 ? '#ece5d6' : '#e0d7c4');
              ctx.fillRect(0, 0, w, h);
              if (center) {
                const s = fitSize(ctx, 'Prodigy', w * 0.8, { family: 'serif', size: h * 0.6 }, h * 0.6);
                text(ctx, 'Prodigy', w / 2, h * 0.66, { family: 'serif', italic: true, size: s, color: '#fbf6ee', align: 'center' });
              } else {
                text(ctx, String(i < 4 ? i + 1 : i).padStart(2, '0'), w * 0.06, h * 0.22, { family: 'mono', size: h * 0.12, color: 'rgba(26,26,28,0.5)' });
                paragraph(ctx, label, w * 0.06, h * 0.56, w * 0.88, h * 0.2, { family: 'sans', weight: 700, size: h * 0.17, color: '#1a1a1c' }, 2);
              }
            }}
          />
        </group>
      ))}
    </group>
  );
}

// ─── CodHer: hack tables, and the trophy ───────────────────────────────────

export function HackNight({ event, width, clock }: PieceProps) {
  const kit = useKit();
  const trophy = useRef<Group>(null);
  const gold = useDisposable(() => new MeshStandardMaterial({ color: event.accent, emissive: new Color(event.accent), emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.3 }), [event.accent]);
  const cups = useDisposable(() => [new CylinderGeometry(0.22, 0.28, 0.12, 24), new CylinderGeometry(0.05, 0.08, 0.3, 16), new CylinderGeometry(0.3, 0.1, 0.38, 24)], []);
  const tableLen = Math.min(4.6, width * 0.3);
  useFrame(({ clock: c }) => {
    const g = trophy.current;
    if (!g) return;
    const k = sstep(clock.current.u, 0.84, 0.95);
    g.position.y = 0.9 + k * 0.5;
    g.rotation.y = c.elapsedTime * 0.5;
    g.scale.setScalar(0.4 + 0.6 * k);
  });
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (tableLen / 2 + 0.9), 0, -1.4]}>
          {[0, 1].map((row) => (
            <group key={row} position={[0, 0, row * -1.8]}>
              <Desk width={tableLen} depth={0.8} />
              {[-1, 0, 1].map((k) => (
                <group key={k}>
                  <Laptop position={[k * (tableLen / 3), 0.74, 0.05]} rotation={[0, Math.PI, 0]} draw={(ctx, w, h) => codeScreen(ctx, w, h, k + row * 3 + side + 4)} drawKey={`codher-${side}-${row}-${k}`} />
                  <Chair position={[k * (tableLen / 3), 0, -0.72]} />
                </group>
              ))}
            </group>
          ))}
        </group>
      ))}
      <mesh position={[0, 0.45, 0.6]} material={kit.concreteDark}>
        <boxGeometry args={[0.9, 0.9, 0.9]} />
      </mesh>
      <group ref={trophy} position={[0, 0.9, 0.6]}>
        <mesh geometry={cups[0]} material={gold} position={[0, 0.06, 0]} />
        <mesh geometry={cups[1]} material={gold} position={[0, 0.27, 0]} />
        <mesh geometry={cups[2]} material={gold} position={[0, 0.6, 0]} />
      </group>
    </group>
  );
}
