'use client';
/**
 * The physical half of each exhibit — the thing in the middle of the room that
 * performs its event in sync with the walls. Room-local coordinates: origin on
 * the floor at the room's centre, +z toward the portal (where you stand).
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, CatmullRomCurve3, Color, CurvePath, CylinderGeometry, DoubleSide, DynamicDrawUsage, Euler, type Group, type InstancedMesh, LineCurve3, type Mesh, MeshBasicMaterial, type PerspectiveCamera, MeshStandardMaterial, Object3D, PlaneGeometry, SphereGeometry, TorusGeometry, TubeGeometry, Vector3 } from 'three';
import { PRODIGY_PROGRAMME } from '@/content/prodigy';
import { merge, metricBox, place } from '@/systems/geometry/build';
import { useDisposable } from '@/systems/performance/useDisposable';
import { EYE_HEIGHT } from '@/config/world';
import { fitSize, makeCanvas, paragraph, text, toTexture } from '@/systems/textures/typeset';
import { CanvasPanel } from '../../shared/CanvasPanel';
import { Chair, Desk, Laptop, Monitor } from '../../shared/props';
import { useKit } from '../../underground/kit';
import { clamp01, codeScreen, hash, openSpan, type PieceProps, pointerNear, puzzleOrder, puzzleSpan, ramp, sstep, swell } from './common';
import { BALLOON_COLORS, contestT, LOOM_U, LOOM_WOVEN, PX_U, SORT, solveAt, sortStep, STAIRS } from './walls';

const dummy = new Object3D();
const easeIO = (x: number) => x * x * (3 - 2 * x);

// ─── Head Start: fourteen columns that sort themselves ─────────────────────

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
      {/* The chair faces +z (the doorway); the audience faces the slides and the lectern at -z. */}
      {rows.flatMap((r, ri) =>
        [-2.6, -1.3, 0, 1.3, 2.6].map((x) => <Chair key={`${ri}-${x}`} position={[x, r.y, r.z]} rotation={[0, Math.PI, 0]} />),
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
      const [from, home] = puzzleSpan(puzzleOrder(i));
      const k = easeIO(ramp(u, from, home));
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
              {/* Seats on the doorway side of each desk, facing the commit wall: the
                  visitor looks over the hackers' shoulders at their screens. */}
              {[-1, 0, 1].map((k) => (
                <group key={k}>
                  <Laptop position={[k * (tableLen / 3), 0.74, -0.05]} draw={(ctx, w, h) => codeScreen(ctx, w, h, k + row * 3 + side + 4)} drawKey={`codher-${side}-${row}-${k}`} />
                  <Chair position={[k * (tableLen / 3), 0, 0.72]} rotation={[0, Math.PI, 0]} />
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

// ─── Tech Talks: voices, carried from the stage around the room ────────────
//
// One line runs around the room at head height — across the back wall and
// down both side walls toward the audience — fed by a cable from the
// microphone. Scrolling through the visit, three speakers take the stage in
// turn (the series' alumni, industry experts and researchers): each one's
// phrase leaves the microphone, runs down the cable into the wall and travels
// outward along the line, reaching the room's edges and fading; the stage and
// the room's light follow the voice, and each speaker is named beneath the
// line as their voice fills the wall. Scroll back and it all rewinds.

/** The visit's scroll (0 → 1) as seconds of the talk. */
const TALK_SPAN = 14;
/** When each speaker's phrase leaves the microphone (s into the talk). */
const PHRASES = [0.4, 4.2, 8.0];
/** One phrase: syllables (s from its start) and their stress. */
const SYLLABLES: [number, number][] = [[0.05, 0.7], [0.26, 1], [0.45, 0.72], [0.68, 0.95], [0.86, 0.55], [1.1, 0.85], [1.3, 0.62], [1.55, 0.42]];
const PHRASE_LEN = 1.75;
/** m/s along the cable, and around the room. */
const C_CABLE = 7;
const C_ROOM = 3.4;
/** Height of the line (clear of the room's title anchor above it and the microphone below). */
const LINE_Y = 2.55;
const WAVE_A = 0.3;

function phraseEnvelope(tau: number) {
  if (tau < -0.3 || tau > PHRASE_LEN + 0.3) return 0;
  let e = 0;
  for (const [at, a] of SYLLABLES) {
    const x = (tau - at) / 0.085;
    e += a * Math.exp(-x * x);
  }
  return Math.min(1, e);
}

/** The voice at the microphone, `s` into the event: the waveform `v` and its loudness `e`. */
function voiceAt(s: number, out: { v: number; e: number }) {
  out.v = 0;
  out.e = 0;
  for (const start of PHRASES) {
    const tau = s - start;
    const e = phraseEnvelope(tau);
    if (e < 0.002) continue;
    out.e = Math.max(out.e, e);
    out.v += e * Math.sin(2 * Math.PI * (5.2 * tau + 0.35 * Math.sin(2 * Math.PI * 0.8 * tau)));
  }
  return out;
}

/** A soft vertical band of light (for the sweep that follows the voice across the wall). */
function sweepTexture() {
  const { canvas, ctx } = makeCanvas(128, 256);
  const g = ctx.createLinearGradient(0, 0, 128, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 256);
  ctx.globalCompositeOperation = 'destination-in';
  const v = ctx.createLinearGradient(0, 0, 0, 256);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(0.45, 'rgba(0,0,0,1)');
  v.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, 128, 256);
  return toTexture(canvas);
}

export function TalkSignal({ event, index, width, depth, clock, response }: PieceProps) {
  const kit = useKit();
  const stageZ = -depth / 2 + 2.2;
  const hx = width / 2 - 0.06;
  const zb = -depth / 2 + 0.06;
  const zEnd = depth / 2 - 0.7;
  /** Half the line's length: from the back wall's centre to either end by the portal. */
  const L = hx + (zEnd - zb);
  const speakers = useMemo(
    () =>
      (event.facts.find((f) => f.label === 'Speakers')?.value ?? '')
        .split('·')
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => x[0].toUpperCase() + x.slice(1)),
    [event.facts],
  );
  const topics = event.facts.find((f) => f.label === 'Topics')?.value ?? '';

  const res = useDisposable(() => {
    const accent = new Color(event.accent);
    // The line: a ribbon on the walls, sampled every 2.5 cm, as thin to the eye near as far.
    const eye = new Vector3(0, EYE_HEIGHT, depth / 2 + 0.4);
    const n = Math.ceil((2 * L) / 0.025) + 1;
    const ls = new Float32Array(n);
    const hw = new Float32Array(n);
    const p = new Vector3();
    for (let k = 0; k < n; k++) {
      ls[k] = -L + (2 * L * k) / (n - 1);
      const a = Math.abs(ls[k]);
      p.set(a <= hx ? ls[k] : Math.sign(ls[k]) * hx, LINE_Y, a <= hx ? zb : zb + (a - hx));
      hw[k] = 0.0011 * p.distanceTo(eye);
    }
    const line = new BufferGeometry();
    line.setAttribute('position', new BufferAttribute(new Float32Array(n * 6), 3).setUsage(DynamicDrawUsage));
    line.setAttribute('color', new BufferAttribute(new Float32Array(n * 6), 3).setUsage(DynamicDrawUsage));
    const idx: number[] = [];
    for (let k = 0; k < n - 1; k++) idx.push(2 * k, 2 * k + 1, 2 * k + 2, 2 * k + 1, 2 * k + 3, 2 * k + 2);
    line.setIndex(idx);
    // The cable: from the microphone, back across the stage, down, along the floor and up the wall to the line.
    const path = new CurvePath<Vector3>();
    const pts = [
      new Vector3(0, 0.415, stageZ - 0.12),
      new Vector3(0, 0.415, stageZ - 1.49),
      new Vector3(0, 0.012, stageZ - 1.52),
      new Vector3(0, 0.012, zb),
      new Vector3(0, LINE_Y, zb),
    ];
    for (let i = 0; i < pts.length - 1; i++) path.add(new LineCurve3(pts[i], pts[i + 1]));
    const CABLE_SEG = 120;
    const cable = new TubeGeometry(path, CABLE_SEG, 0.012, 6, false);
    cable.setAttribute('color', new BufferAttribute(new Float32Array(cable.attributes.position.count * 3), 3).setUsage(DynamicDrawUsage));
    const sweepMap = sweepTexture();
    return {
      accent,
      n,
      ls,
      hw,
      disp: new Float32Array(n),
      glow: new Float32Array(n),
      line,
      lineMat: new MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: DoubleSide }),
      cable,
      cableLen: path.getLength(),
      cableSeg: CABLE_SEG,
      cableMat: new MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
      sweepMap,
      sweepGeo: new PlaneGeometry(1.8, 3.4),
      sweepMats: [0, 1, 2, 3].map(() => new MeshBasicMaterial({ map: sweepMap, color: accent.clone().lerp(new Color('#ffe2c2'), 0.5), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false })),
      edge: new MeshBasicMaterial({ color: accent.clone(), toneMapped: false }),
      mic: new MeshStandardMaterial({ color: '#2a2a2e', emissive: accent.clone(), emissiveIntensity: 0.2, roughness: 0.4, metalness: 0.6 }),
      pole: new CylinderGeometry(0.018, 0.018, 1.45, 10).translate(0, 0.725, 0),
      foot: new CylinderGeometry(0.22, 0.26, 0.03, 24),
      head: new SphereGeometry(0.075, 18, 14).scale(1, 1.3, 1),
    };
  }, [event.accent, L, hx, zb, depth, stageZ]);

  // The speaker's name, one panel per speaker: the one on stage surfaces beneath the line once the voice fills the wall.
  const names = useDisposable(
    () =>
      speakers.map((name) => {
        const { canvas, ctx } = makeCanvas(1400, 360);
        const paint = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const size = fitSize(ctx, name, canvas.width * 0.9, { family: 'serif', size: 190 }, 190);
          text(ctx, name, canvas.width / 2, 200, { family: 'serif', italic: true, size, color: '#f3ece1', align: 'center' });
          text(ctx, topics.toUpperCase(), canvas.width / 2, 312, { family: 'mono', size: 40, color: 'rgba(239,233,223,0.62)', align: 'center', tracking: 0.22 });
        };
        paint();
        const map = toTexture(canvas);
        document.fonts?.ready.then(() => {
          paint();
          map.needsUpdate = true;
        });
        return { map, mat: new MeshBasicMaterial({ map, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }) };
      }),
    [speakers, topics],
  );
  const nameGeo = useDisposable(() => new PlaneGeometry(3.8, 0.98), []);
  // Beneath the line, in the part of the wall the reading card leaves open.
  const span = openSpan(index);
  const nameX = ((span[0] + span[1]) / 2 - 0.5) * (width - 0.3) + (span[0] < 0.3 ? -0.3 : 0.3);

  const nameRefs = useRef<(Mesh | null)[]>([]);
  const sweeps = useRef<(Mesh | null)[]>([]);
  const state = useMemo(() => ({ v: { v: 0, e: 0 }, stage: 0, wall: 0, idle: false }), []);
  const white = useMemo(() => new Color('#fff4e6'), []);
  const bone = useMemo(() => new Color('#efe9df'), []);

  useFrame((_, delta) => {
    const c = clock.current;
    if (!c.near) return;
    const dt = Math.min(delta, 0.1);
    const act = c.presence;
    const s = c.u < 0 ? -1 : c.u * TALK_SPAN;
    const { n, ls, hw, disp, glow } = res;

    // At the microphone.
    voiceAt(s, state.v);
    state.stage += (state.v.e - state.stage) * (1 - Math.exp(-dt * 3));
    res.mic.emissiveIntensity = 0.15 + 0.2 * act + 1.1 * state.v.e * act;
    res.edge.color.copy(res.accent).multiplyScalar(0.3 + 0.25 * act + 0.55 * state.stage * act);

    // Along the cable, then outward along the line: the same voice, later the further it has come.
    const lineLive = s > 0.5 && s < PHRASES[PHRASES.length - 1] + PHRASE_LEN + res.cableLen / C_CABLE + L / C_ROOM + 1;
    if (lineLive || !state.idle) {
      const wave = state.v;
      let wallEnergy = 0;
      for (let k = 0; k < n; k++) {
        const d = Math.abs(ls[k]);
        voiceAt(s - res.cableLen / C_CABLE - d / C_ROOM, wave);
        const att = 1 / (1 + 0.05 * d);
        disp[k] = WAVE_A * wave.v * att * act;
        glow[k] = wave.e * att * act;
        if (d < hx && glow[k] > wallEnergy) wallEnergy = glow[k];
      }
      const pos = res.line.attributes.position as BufferAttribute;
      const col = res.line.attributes.color as BufferAttribute;
      const base = 0.07 + 0.09 * act;
      for (let k = 0; k < n; k++) {
        const k0 = Math.max(0, k - 1);
        const k1 = Math.min(n - 1, k + 1);
        const dl = ls[k1] - ls[k0];
        const dy = disp[k1] - disp[k0];
        const len = Math.hypot(dl, dy) || 1;
        const nl = (-dy / len) * hw[k];
        const ny = (dl / len) * hw[k];
        for (let side = 0; side < 2; side++) {
          const sg = side === 0 ? 1 : -1;
          const l = ls[k] + nl * sg;
          const a = Math.abs(l);
          const vi = 2 * k + side;
          pos.setXYZ(vi, a <= hx ? l : Math.sign(l) * hx, LINE_Y + disp[k] + ny * sg, a <= hx ? zb : zb + (a - hx));
          const e = glow[k];
          col.setXYZ(
            vi,
            bone.r * base + res.accent.r * 1.15 * e + white.r * 0.3 * e * e * e,
            bone.g * base + res.accent.g * 1.15 * e + white.g * 0.3 * e * e * e,
            bone.b * base + res.accent.b * 1.15 * e + white.b * 0.3 * e * e * e,
          );
        }
      }
      pos.needsUpdate = true;
      col.needsUpdate = true;
      state.wall += (wallEnergy - state.wall) * (1 - Math.exp(-dt * 2.5));
      // Cable: brightness only.
      const cc = res.cable.attributes.color as BufferAttribute;
      const ring = cc.count / (res.cableSeg + 1);
      for (let i = 0; i <= res.cableSeg; i++) {
        const d = (i / res.cableSeg) * res.cableLen;
        voiceAt(s - d / C_CABLE, wave);
        // Inlaid across the stage and floor; the rise up the wall shows only as the voice climbs it.
        const b = (d < res.cableLen - LINE_Y ? 0.06 + 0.06 * act : 0) + 1.1 * wave.e * act;
        for (let j = 0; j < ring; j++) cc.setXYZ(i * ring + j, res.accent.r * b, res.accent.g * b, res.accent.b * b);
      }
      cc.needsUpdate = true;
      state.idle = !lineLive;
    }

    // A narrow light follows each phrase outward across the back wall.
    PHRASES.forEach((start, pi) => {
      const lc = (s - start - res.cableLen / C_CABLE - PHRASE_LEN * 0.45) * C_ROOM;
      const o = 0.1 * act * sstep(lc, 0, 1.2) * (1 - sstep(lc, hx - 1.8, hx - 0.4));
      for (let sd = 0; sd < 2; sd++) {
        const m = sweeps.current[pi * 2 + sd];
        if (!m) continue;
        m.visible = o > 0.002;
        m.position.set((sd ? 1 : -1) * Math.max(0, lc), LINE_Y - 0.25, zb + 0.02);
        (m.material as MeshBasicMaterial).opacity = o;
      }
    });

    // Each speaker, named beneath the line while their voice fills the wall.
    names.forEach((nm, i) => {
      const st = PHRASES[i] ?? 99;
      nm.mat.opacity = swell(s, st + 1.3, st + 2.1, st + 3.4, st + 3.9) * act;
      const m = nameRefs.current[i];
      if (m) {
        m.visible = nm.mat.opacity > 0.002;
        m.position.y = LINE_Y - 0.86 + 0.05 * sstep(s, st + 1.3, st + 3.9);
      }
    });

    // The room breathes with the voice on its wall.
    response.current = 1 + 0.12 * state.wall;
  });

  return (
    <group>
      {/* The stage, its lit edge, and the microphone. */}
      <mesh position={[0, 0.2, stageZ]} material={kit.oak}>
        <boxGeometry args={[6.4, 0.4, 3]} />
      </mesh>
      <mesh position={[0, 0.405, stageZ + 1.5]} material={res.edge}>
        <boxGeometry args={[6.4, 0.012, 0.03]} />
      </mesh>
      <group position={[0, 0.4, stageZ]}>
        <mesh geometry={res.foot} material={kit.steel} />
        <mesh geometry={res.pole} material={kit.steel} />
        <mesh geometry={res.head} material={res.mic} position={[0, 1.52, 0.02]} rotation={[0.3, 0, 0]} />
      </group>
      <mesh geometry={res.cable} material={res.cableMat} />
      <mesh geometry={res.line} material={res.lineMat} frustumCulled={false} />
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          ref={(el) => {
            sweeps.current[i] = el;
          }}
          geometry={res.sweepGeo}
          material={res.sweepMats[i]}
          visible={false}
          renderOrder={3}
        />
      ))}
      {names.map((nm, i) => (
        <mesh
          key={i}
          ref={(el) => {
            nameRefs.current[i] = el;
          }}
          geometry={nameGeo}
          material={nm.mat}
          position={[nameX, LINE_Y - 0.86, zb + 0.015]}
          visible={false}
          renderOrder={3}
        />
      ))}
      {/* The audience, facing the stage. */}
      {[0, 1].flatMap((row) => [-2.4, -1.2, 0, 1.2, 2.4].map((x) => <Chair key={`${row}-${x}`} position={[x + (row ? 0.6 : 0), 0, stageZ + 3.4 + row * 1.3]} rotation={[0, Math.PI, 0]} />))}
    </group>
  );
}

// ─── PatternX: the floor, the four terms, and the way on ───────────────────
//
// Foreground, the floor: an inlaid grid with a few lit cells scattered over
// it — no order yet. Midground, four plinths: three terms of a sequence, and
// an empty fourth. As you move through the room the cells find the grid, then
// slide into a path whose steps grow the way the sequence does (1, 2, 3, 4);
// the fourth term is built from the third; and a light runs down the path to
// its end at your feet, where the floor reads: a precursor to CodeX →.
// Everything is a function of the visit's scroll (walls.ts: PX_U).

/** A small panel of type, drawn once (again when the web fonts arrive). */
function typePanel(width: number, height: number, paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, ppm = 360) {
  const { canvas, ctx } = makeCanvas(width * ppm, height * ppm);
  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    paint(ctx, canvas.width, canvas.height);
  };
  draw();
  const map = toTexture(canvas);
  document.fonts?.ready.then(() => {
    draw();
    map.needsUpdate = true;
  });
  return { map, geo: new PlaneGeometry(width, height), mat: new MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false }) };
}

const CUBE = 0.19;
const PLINTH = { w: 0.86, h: 0.9, gap: 1.32, x0: -2.75, z: -2.5 };
/** The inlaid floor: a grid of 0.6 m cells. */
const FLOOR = { x0: -4.9, z0: -4.3, cols: 16, rows: 12, cell: 0.6, y: 0.03 };
const cellX = (i: number) => FLOOR.x0 + FLOOR.cell * (i + 0.5);
const cellZ = (j: number) => FLOOR.z0 + FLOOR.cell * (j + 0.5);
/** The path the cells find: steps of 1, 2, 3 and 4 toward the way out, from cell (1, 4) — in front of the plinths, in view all through the visit. */
const PATH: [number, number][] = (() => {
  const out: [number, number][] = [[1, 4]];
  let [i, j] = out[0];
  for (let k = 1; k <= 4; k++) {
    for (let n = 0; n < k; n++) out.push([++i, j]);
    if (k < 4) out.push([i, ++j]);
  }
  return out;
})();
/** Where each cell lies before it finds its place: scattered, turned, not on the grid. */
const SCATTER = PATH.map((_, k) => {
  let x = 0;
  let z = 0;
  for (let tries = 0; tries < 12; tries++) {
    x = FLOOR.x0 + 0.4 + hash(k * 17 + tries * 5 + 1) * (FLOOR.cols * FLOOR.cell - 0.8);
    z = -1.9 + hash(k * 29 + tries * 7 + 3) * 2.9;
    if (Math.abs(z - PLINTH.z) > 0.9) break;
  }
  return { x, z, r: (hash(k * 13 + 2) - 0.5) * 1.2, glow: 0.3 + 0.35 * hash(k * 3 + 9) };
});
const snap = (v: number, o: number) => o + FLOOR.cell * (Math.floor((v - o) / FLOOR.cell) + 0.5);

export function PatternRoom({ event, clock, response }: PieceProps) {
  const kit = useKit();
  const camera = useThree((st) => st.camera) as PerspectiveCamera;
  const tokens = useRef<InstancedMesh>(null);
  const given = useRef<InstancedMesh>(null);
  const answer = useRef<InstancedMesh>(null);
  const plinthRefs = useRef<(Group | null)[]>([]);
  const counts = STAIRS.map((t) => t.length);
  const res = useDisposable(() => {
    const accent = new Color(event.accent);
    const lines: BufferGeometry[] = [];
    const W = FLOOR.cols * FLOOR.cell;
    const D = FLOOR.rows * FLOOR.cell;
    for (let i = 0; i <= FLOOR.cols; i++) lines.push(place(metricBox(0.012, 0.004, D), { position: [FLOOR.x0 + i * FLOOR.cell, FLOOR.y + 0.002, FLOOR.z0 + D / 2] }));
    for (let j = 0; j <= FLOOR.rows; j++) lines.push(place(metricBox(W, 0.004, 0.012), { position: [FLOOR.x0 + W / 2, FLOOR.y + 0.002, FLOOR.z0 + j * FLOOR.cell] }));
    const plinth = metricBox(PLINTH.w, PLINTH.h, PLINTH.w);
    plinth.translate(0, PLINTH.h / 2, 0);
    const label = (n: number, value: string) =>
      typePanel(0.56, 0.15, (ctx, w, h) => {
        text(ctx, String(n).padStart(2, '0'), w * 0.04, h * 0.66, { family: 'mono', size: h * 0.36, color: 'rgba(239,233,223,0.6)', tracking: 0.2 });
        text(ctx, value, w * 0.96, h * 0.72, { family: 'serif', size: h * 0.62, color: '#efe9df', align: 'right' });
      });
    return {
      accent,
      base: accent.clone().lerp(new Color('#ffffff'), 0.3),
      bright: accent.clone().lerp(new Color('#ffffff'), 0.62),
      platform: place(metricBox(W, FLOOR.y, D), { position: [FLOOR.x0 + W / 2, FLOOR.y / 2, FLOOR.z0 + D / 2] }),
      platformMat: new MeshStandardMaterial({ color: '#15131b', roughness: 0.55, metalness: 0.2 }),
      grid: merge(lines),
      gridMat: new MeshBasicMaterial({ color: new Color('#3b3350') }),
      token: metricBox(FLOOR.cell * 0.86, 0.008, FLOOR.cell * 0.86),
      tokenMat: new MeshBasicMaterial({ toneMapped: false }),
      cube: metricBox(CUBE * 0.93, CUBE * 0.93, CUBE * 0.93),
      cubeMat: new MeshStandardMaterial({ roughness: 0.4, metalness: 0.04, emissive: new Color('#ffffff'), emissiveIntensity: 0.05 }),
      plinth,
      edge: metricBox(PLINTH.w, 0.012, 0.022),
      edgeMats: [0, 1, 2, 3].map(() => new MeshBasicMaterial({ color: accent.clone(), toneMapped: false })),
      labels: counts.map((n, p) => label(p + 1, String(n))),
      question: label(4, '?'),
      onward: typePanel(2.3, 0.62, (ctx, w, h) => {
        text(ctx, 'A PRECURSOR TO', w * 0.02, h * 0.3, { family: 'mono', size: h * 0.15, color: 'rgba(239,233,223,0.7)', tracking: 0.26 });
        text(ctx, `${event.facts.find((f) => f.label === 'Leads into')?.value ?? 'CodeX'}  →`, w * 0.02, h * 0.86, { family: 'serif', size: h * 0.5, color: '#' + accent.getHexString() });
      }),
    };
  }, [event.accent]);
  const at = useMemo(() => ({ a: new Vector3(), b: new Vector3(), c: new Color(), w: new Vector3(), hover: [0, 0, 0, 0] }), []);

  useFrame((_, delta) => {
    const c = clock.current;
    const tm = tokens.current;
    const gm = given.current;
    const am = answer.current;
    if (!tm || !gm || !am) return;
    if (!c.near && c.presence === 0 && tm.userData.placed) return;
    tm.userData.placed = true;
    const u = c.u;
    const act = c.presence;
    const U = PX_U;
    const dt = Math.min(delta, 0.1);

    // The floor: scattered → on the grid → along the path → lit, toward the way on.
    const lead = ((u - U.lead) / (U.codex - U.lead)) * (PATH.length + 1);
    for (let k = 0; k < PATH.length; k++) {
      const sc = SCATTER[k];
      const align = sstep(u, U.align + k * 0.004, U.align + 0.08 + k * 0.004);
      const go = sstep(u, U.path + k * 0.011, U.path + 0.12 + k * 0.011);
      const sx = sc.x + (snap(sc.x, FLOOR.x0) - sc.x) * align;
      const sz = sc.z + (snap(sc.z, FLOOR.z0) - sc.z) * align;
      const [pi, pj] = PATH[k];
      // Along the grid: across first, then along.
      const gx = sx + (cellX(pi) - sx) * sstep(go, 0, 0.55);
      const gz = sz + (cellZ(pj) - sz) * sstep(go, 0.45, 1);
      dummy.position.set(gx, FLOOR.y + 0.005, gz);
      dummy.rotation.set(0, sc.r * (1 - align), 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      tm.setMatrixAt(k, dummy.matrix);
      const lit = clamp01(lead - k);
      const b = (sc.glow + (0.55 - sc.glow) * align + 0.1 * go + 0.45 * lit) * (0.35 + 0.65 * act);
      at.c.copy(res.accent).multiplyScalar(b);
      tm.setColorAt(k, at.c);
    }
    tm.instanceMatrix.needsUpdate = true;
    if (tm.instanceColor) tm.instanceColor.needsUpdate = true;
    const onward = sstep(u, U.codex - 0.05, U.codex + 0.05);
    res.onward.mat.opacity = (0.12 + 0.88 * onward) * act;

    // The plinths answer the pointer: the nearest one's label and edge come up.
    plinthRefs.current.forEach((g, p) => {
      if (!g) return;
      g.getWorldPosition(at.w);
      at.w.y += PLINTH.h;
      const target = pointerNear(at.w, camera, 0.12);
      at.hover[p] += (target - at.hover[p]) * (1 - Math.exp(-dt * 10));
    });

    // Reading the three terms, the question, and the answer.
    const read = (p: number) => sstep(u, U.read + p * 0.035, U.read + p * 0.035 + 0.04);
    const solved = sstep(u, U.solved - 0.03, U.solved + 0.02);
    const asked = sstep(u, U.ask, U.ask + 0.04);
    for (let p = 0; p < 4; p++) {
      const lvl = 0.14 + 0.1 * act + (p < 3 ? 0.6 * read(p) : 0.3 * asked + 0.5 * solved) * act + 0.35 * at.hover[p];
      res.edgeMats[p].color.copy(res.accent).multiplyScalar(lvl);
      const lab = p < 3 ? res.labels[p] : res.labels[3];
      lab.mat.opacity = (0.35 + 0.35 * (p < 3 ? read(p) : solved) + 0.3 * at.hover[p]) * (0.4 + 0.6 * act) * (p < 3 ? 1 : solved);
    }
    res.question.mat.opacity = (0.35 + 0.35 * asked + 0.3 * at.hover[3]) * (0.4 + 0.6 * act) * (1 - solved);

    // The three terms on their plinths.
    let q = 0;
    for (let p = 0; p < 3; p++) {
      const cells = STAIRS[p];
      for (const [cc, r] of cells) {
        cubeAt(p, p + 1, cc, r, at.a);
        dummy.position.copy(at.a);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        gm.setMatrixAt(q, dummy.matrix);
        at.c.copy(res.base).multiplyScalar(0.62 + 0.28 * read(p) + 0.25 * at.hover[p]);
        gm.setColorAt(q, at.c);
        q++;
      }
    }
    gm.instanceMatrix.needsUpdate = true;
    if (gm.instanceColor) gm.instanceColor.needsUpdate = true;

    // The fourth, built from the third: its copy lifts across, then the new column drops in.
    const copy = STAIRS[2];
    const added = STAIRS[3].filter(([cc, r]) => !copy.some(([a, b]) => a === cc && b === r));
    for (let i = 0; i < ANSWER_CUBES; i++) {
      let visible = false;
      let bright = 0;
      if (i < copy.length) {
        const [cc, r] = copy[i];
        const k = sstep(u, U.copy, U.copy + 0.075);
        if (u >= U.copy) {
          visible = true;
          cubeAt(2, 3, cc, r, at.a);
          cubeAt(3, 4, cc, r, at.b);
          at.a.lerp(at.b, sstep(k, 0.25, 0.8));
          at.a.y += 0.3 * sstep(k, 0, 0.3) * (1 - sstep(k, 0.75, 1));
          bright = 1 - sstep(u, U.copy + 0.075, U.solved + 0.04);
        }
      } else if (i < copy.length + added.length) {
        const j = i - copy.length;
        const [cc, r] = added[j];
        const st = U.add + j * 0.018;
        if (u >= st) {
          visible = true;
          cubeAt(3, 4, cc, r, at.a);
          const f = sstep(u, st, st + 0.02);
          at.a.y += 0.45 * (1 - f * f);
          bright = 1 - sstep(u, st + 0.02, U.solved + 0.06);
        }
      }
      dummy.position.copy(visible ? at.a : at.b.set(0, -10, 0));
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(visible ? 1 : 0.0001);
      dummy.updateMatrix();
      am.setMatrixAt(i, dummy.matrix);
      at.c.copy(res.base).lerp(res.bright, bright).multiplyScalar(0.7 + 0.3 * solved + 0.3 * bright + 0.25 * at.hover[3]);
      am.setColorAt(i, at.c);
    }
    am.instanceMatrix.needsUpdate = true;
    if (am.instanceColor) am.instanceColor.needsUpdate = true;

    // Light follows the answer, then the way on.
    response.current = 1 + 0.08 * solved + 0.06 * onward;
  });

  return (
    <group>
      <mesh geometry={res.platform} material={res.platformMat} />
      <mesh geometry={res.grid} material={res.gridMat} />
      <instancedMesh ref={tokens} args={[res.token, res.tokenMat, PATH.length]} frustumCulled={false} />
      <mesh geometry={res.onward.geo} material={res.onward.mat} rotation={[-Math.PI / 2, 0, 0]} position={[cellX(PATH[PATH.length - 1][0]) + 1.55, FLOOR.y + 0.004, cellZ(PATH[PATH.length - 1][1])]} renderOrder={2} />
      {[0, 1, 2, 3].map((p) => (
        <group
          key={p}
          ref={(el) => {
            plinthRefs.current[p] = el;
          }}
          position={[PLINTH.x0 + p * PLINTH.gap, 0, PLINTH.z]}
        >
          <mesh geometry={res.plinth} material={kit.steel} />
          <mesh geometry={res.edge} material={res.edgeMats[p]} position={[0, PLINTH.h - 0.006, PLINTH.w / 2 + 0.011]} />
          <mesh geometry={res.labels[p].geo} material={res.labels[p].mat} position={[0, PLINTH.h - 0.2, PLINTH.w / 2 + 0.004]} renderOrder={2} />
          {p === 3 && <mesh geometry={res.question.geo} material={res.question.mat} position={[0, PLINTH.h - 0.2, PLINTH.w / 2 + 0.004]} renderOrder={2} />}
        </group>
      ))}
      <instancedMesh ref={given} args={[res.cube, res.cubeMat, GIVEN_CUBES]} frustumCulled={false} />
      <instancedMesh ref={answer} args={[res.cube, res.cubeMat, ANSWER_CUBES]} frustumCulled={false} />
    </group>
  );
}

const GIVEN_CUBES = STAIRS[0].length + STAIRS[1].length + STAIRS[2].length;
const ANSWER_CUBES = STAIRS[3].length;
/** Centre of cell (c, r) of a term `width` columns wide, standing on plinth p. */
function cubeAt(p: number, width: number, c: number, r: number, out: Vector3) {
  return out.set(PLINTH.x0 + p * PLINTH.gap + (c - (width - 1) / 2) * CUBE, PLINTH.h + CUBE / 2 + r * CUBE, PLINTH.z);
}

// ─── Open Source Mentorship Program: the loom ──────────────────────────────
//
// A loom stands in the room, held up between two posts — ACM-CEG and GDG-AU.
// From its top beam (the mentors) hangs the warp: the guidance every thread
// is woven through. On it, the project: a cloth already begun, its history in
// bone. As you scroll through the visit the cohort's contributions are woven
// in, one row at a time — a shuttle carries each thread across the warp, over
// and under, and the reed beats it into the cloth. Different hands, different
// greens; one cloth. When the last row is in, the reed lifts away and a light
// passes up through the finished piece. It all rewinds with the scroll
// (walls.ts: LOOM_U).

const LOOM = {
  x0: -1.35,
  x1: 2.35,
  z: -1.5,
  /** The breast beam (where the cloth starts) and the top beam (the mentors'). */
  y0: 0.62,
  top: 3.08,
  warps: 19,
  /** Rows of cloth already woven (the project's history), and the pitch between rows. */
  history: 8,
  pitch: 0.085,
  yarn: 0.032,
  /** Over and under: how far the weft swings either side of the warp. */
  swing: 0.03,
};
const LOOM_ROWS = LOOM.history + LOOM_U.rows;
const rowY = (r: number) => LOOM.y0 + (r + 0.5) * LOOM.pitch;
/** Where the shuttle passes (the shed), above the row it lays; and where the reed rests between beats. */
const SHED = 0.3;
const REED_REST = rowY(LOOM_ROWS - 1) + 0.55;

/** A row of weft: over and under the warp, in the direction the shuttle carries it. */
function weftRow(r: number) {
  const pts: Vector3[] = [];
  const inset = 0.09;
  pts.push(new Vector3(LOOM.x0 + inset, rowY(r), LOOM.z));
  for (let i = 0; i < LOOM.warps; i++) {
    const x = LOOM.x0 + inset + ((LOOM.x1 - LOOM.x0 - 2 * inset) * (i + 0.5)) / LOOM.warps;
    pts.push(new Vector3(x, rowY(r), LOOM.z + ((i + r) % 2 ? 1 : -1) * LOOM.swing));
  }
  pts.push(new Vector3(LOOM.x1 - inset, rowY(r), LOOM.z));
  if (r % 2) pts.reverse();
  return new TubeGeometry(new CatmullRomCurve3(pts, false, 'centripetal'), LOOM.warps * 6, LOOM.yarn, 6, false);
}

export function ContributionLoom({ event, clock, response }: PieceProps) {
  const kit = useKit();
  const res = useDisposable(() => {
    const green = new Color(event.accent);
    const bone = new Color('#efe9df');
    // The cohort's hands: greens and a pale sage, never the same twice in a row.
    const hands = [green.clone(), green.clone().lerp(bone, 0.42), green.clone().multiplyScalar(0.72), green.clone().lerp(new Color('#d9e8c4'), 0.55)];
    const colors = Array.from({ length: LOOM_ROWS }, (_, r) =>
      r < LOOM.history ? bone.clone().multiplyScalar(r % 3 === 1 ? 0.42 : 0.5) : hands[(r * 3 + Math.floor(hash(r) * 2)) % hands.length].clone(),
    );
    const width = LOOM.x1 - LOOM.x0;
    const warp: BufferGeometry[] = [];
    for (let i = 0; i < LOOM.warps; i++) {
      const x = LOOM.x0 + 0.09 + ((width - 0.18) * (i + 0.5)) / LOOM.warps;
      warp.push(place(new CylinderGeometry(0.0055, 0.0055, LOOM.top - LOOM.y0, 5), { position: [x, (LOOM.top + LOOM.y0) / 2, LOOM.z] }));
    }
    const frame = merge([
      // Posts, the top (mentors') beam, and the breast beam the cloth starts from.
      place(metricBox(0.09, LOOM.top + 0.12, 0.09), { position: [LOOM.x0 - 0.045, (LOOM.top + 0.12) / 2, LOOM.z] }),
      place(metricBox(0.09, LOOM.top + 0.12, 0.09), { position: [LOOM.x1 + 0.045, (LOOM.top + 0.12) / 2, LOOM.z] }),
      place(metricBox(width + 0.3, 0.1, 0.1), { position: [(LOOM.x0 + LOOM.x1) / 2, LOOM.top + 0.03, LOOM.z] }),
      place(metricBox(width + 0.3, 0.12, 0.12), { position: [(LOOM.x0 + LOOM.x1) / 2, LOOM.y0 - 0.06, LOOM.z] }),
      // Feet, so it stands.
      place(metricBox(0.14, 0.05, 0.7), { position: [LOOM.x0 - 0.045, 0.025, LOOM.z] }),
      place(metricBox(0.14, 0.05, 0.7), { position: [LOOM.x1 + 0.045, 0.025, LOOM.z] }),
    ]);
    const plaque = (name: string) =>
      typePanel(0.9, 0.26, (ctx, w, h) => {
        ctx.fillStyle = 'rgba(12,16,14,0.92)';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#' + green.getHexString();
        ctx.fillRect(0, 0, w * 0.018, h);
        text(ctx, name, w * 0.08, h * 0.68, { family: 'serif', size: h * 0.5, color: '#efe9df' });
      });
    const caption = (value: string, width: number) =>
      typePanel(width, 0.1, (ctx, w, h) => {
        text(ctx, value, w / 2, h * 0.7, { family: 'mono', size: h * 0.46, color: 'rgba(239,233,223,0.8)', tracking: 0.22, align: 'center' });
      });
    return {
      green,
      rows: Array.from({ length: LOOM_ROWS }, (_, r) => weftRow(r)),
      rowMats: colors.map((c) => new MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0, emissive: c.clone(), emissiveIntensity: 0.12 })),
      colors,
      warp: merge(warp),
      warpMat: new MeshBasicMaterial({ color: bone.clone().multiplyScalar(0.5), toneMapped: false }),
      frame,
      reed: metricBox(width + 0.04, 0.05, 0.08),
      shuttle: metricBox(0.24, 0.035, 0.055),
      shuttleMat: new MeshBasicMaterial({ color: green.clone().lerp(new Color('#ffffff'), 0.55).multiplyScalar(1.25), toneMapped: false }),
      acm: plaque('ACM-CEG'),
      gdg: plaque(event.facts.find((f) => f.label === 'With')?.value ?? 'GDG-AU'),
      mentors: caption(`MENTORS · ${(event.facts.find((f) => f.label === 'Mentors')?.value ?? '').toUpperCase()}`, 2.2),
      project: caption('THE PROJECT', 0.9),
    };
  }, [event.accent]);

  const rowRefs = useRef<(Mesh | null)[]>([]);
  const reed = useRef<Mesh>(null);
  const shuttle = useRef<Mesh>(null);

  useFrame(() => {
    const c = clock.current;
    if (!c.near && c.presence === 0 && rowRefs.current[0]?.userData.placed) return;
    if (rowRefs.current[0]) rowRefs.current[0].userData.placed = true;
    const u = c.u;
    const act = c.presence;
    const U = LOOM_U;
    const segs = LOOM.warps * 6;
    const whole = sstep(u, U.sweep, U.whole);
    let reedY = REED_REST;
    let shuttleOn = false;
    for (let r = 0; r < LOOM_ROWS; r++) {
      const m = rowRefs.current[r];
      if (!m) continue;
      let lift = 0;
      let drawn = 1;
      if (r >= LOOM.history) {
        const k = r - LOOM.history;
        const p = (u - (U.start + k * U.row)) / U.row;
        // Across (the shuttle carries the thread), then the reed comes down and beats it in, then lifts back.
        const across = sstep(p, 0, 0.6);
        const toShed = sstep(p, 0.6, 0.7);
        const beat = sstep(p, 0.7, 0.8);
        const back = sstep(p, 0.82, 1);
        drawn = across;
        lift = SHED * (1 - beat);
        if (p > 0 && p < 1) {
          const shedY = rowY(r) + SHED;
          reedY = p < 0.7 ? REED_REST + (shedY - REED_REST) * toShed : p < 0.82 ? rowY(r) + SHED * (1 - beat) : rowY(r) + (REED_REST - rowY(r)) * back;
          if (p < 0.62) {
            shuttleOn = true;
            const from = r % 2 ? LOOM.x1 - 0.09 : LOOM.x0 + 0.09;
            const to = r % 2 ? LOOM.x0 + 0.09 : LOOM.x1 - 0.09;
            shuttle.current?.position.set(from + (to - from) * across, shedY, LOOM.z + 0.05);
          }
        }
      }
      m.visible = drawn > 0.002;
      m.position.y = lift;
      res.rows[r].setDrawRange(0, Math.ceil(drawn * segs) * 6 * 6);
      // The light through the whole: up the cloth, row by row, then a settled glow on the cohort's rows.
      const passing = swell(whole * (LOOM_ROWS + 4) - r, 0, 1.2, 1.6, 3.6);
      const settled = r >= LOOM.history ? 0.12 * whole : 0;
      res.rowMats[r].emissiveIntensity = (0.1 + 0.08 * act + 0.9 * passing + settled) * (0.45 + 0.55 * act);
    }
    // Woven: the reed lifts clear, up under the mentors' beam.
    reedY += (LOOM.top - 0.16 - reedY) * sstep(u, LOOM_WOVEN, LOOM_WOVEN + 0.04);
    reed.current?.position.set((LOOM.x0 + LOOM.x1) / 2, reedY, LOOM.z + 0.07);
    if (shuttle.current) shuttle.current.visible = shuttleOn;
    res.warpMat.color.setScalar(0.3 + 0.25 * act);
    const plaques = 0.55 + 0.45 * act;
    res.acm.mat.opacity = res.gdg.mat.opacity = plaques;
    res.mentors.mat.opacity = res.project.mat.opacity = 0.35 + 0.55 * act;
    response.current = 1 + 0.1 * whole;
  });

  const mid = (LOOM.x0 + LOOM.x1) / 2;
  return (
    <group>
      <mesh geometry={res.frame} material={kit.steel} />
      <mesh geometry={res.warp} material={res.warpMat} />
      {res.rows.map((g, r) => (
        <mesh
          key={r}
          ref={(el) => {
            rowRefs.current[r] = el;
          }}
          geometry={g}
          material={res.rowMats[r]}
        />
      ))}
      <mesh ref={reed} geometry={res.reed} material={kit.steelLight} position={[mid, REED_REST, LOOM.z + 0.07]} />
      <mesh ref={shuttle} geometry={res.shuttle} material={res.shuttleMat} visible={false} />
      {/* The two organisations hold the frame; the mentors' beam carries the warp; the cloth is the project. */}
      <mesh geometry={res.acm.geo} material={res.acm.mat} position={[LOOM.x0 - 0.54, 1.9, LOOM.z + 0.05]} renderOrder={2} />
      <mesh geometry={res.gdg.geo} material={res.gdg.mat} position={[LOOM.x1 + 0.54, 1.9, LOOM.z + 0.05]} renderOrder={2} />
      <mesh geometry={res.mentors.geo} material={res.mentors.mat} position={[mid, LOOM.top + 0.18, LOOM.z + 0.06]} renderOrder={2} />
      <mesh geometry={res.project.geo} material={res.project.mat} position={[mid, LOOM.y0 - 0.06, LOOM.z + 0.065]} renderOrder={2} />
    </group>
  );
}
