'use client';
/**
 * Sets for the domains that run things.
 *
 *  - Events, "showtime": a stage, a truss, an LED wall. House lights dip, the
 *    follow-spot swings off the stage onto you, confetti.
 *  - HR, "your badge": an org chart of the chapter draws itself; the director
 *    hands you a badge and a new node — you — joins the chart.
 *  - Sponsorship, "the pitch": you take a seat at the table; the deck runs
 *    with your scroll.
 *  - External Marketing, "outreach": a map of everywhere the chapter reaches
 *    lights up; your phone buzzes — @acmceg — follow.
 *  - Internal Marketing, "across campus": the open-call banner unfurls and a
 *    poster flies past you onto the wall.
 *  - Logistics, "everything, on time": crates ride the conveyor, the checklist
 *    ticks itself off, and the last item is you — scanned and checked in.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  type Group,
  InstancedMesh,
  type Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Vector3,
} from 'three';
import { PALETTE } from '@/config/palette';
import { EYE_HEIGHT, TEAM_ORIGIN } from '@/config/world';
import { CHAPTER } from '@/content/chapter';
import { DOMAINS } from '@/content/domains';
import { EVENTS, FLAGSHIPS } from '@/content/events';
import { SET_COPY } from '@/content/meetings';
import { NEWSLETTER } from '@/content/newsletter';
import { DIRECTORS, FACULTY } from '@/content/team';
import { rng } from '@/lib/random';
import { lerp, smoothstep } from '@/systems/camera/pose';
import { focusOn, releaseFocus, window01 } from '@/systems/characters/cues';
import { npcAnchors } from '@/systems/characters/registry';
import { merge, metricBox, place } from '@/systems/geometry/build';
import { useDisposable } from '@/systems/performance/useDisposable';
import { fitSize, paragraph, text } from '@/systems/textures/typeset';
import { drawPoster } from '../../events/roomGraphics';
import { CanvasPanel } from '../../shared/CanvasPanel';
import { Chair, Desk, Laptop } from '../../shared/props';
import { useKit } from '../../underground/kit';
import { BayGroup, BayShell, BONE, CameraSpace, cue, DIM, releaseCues, type SetProps, useBayFrame, useStopClock } from './shared';

const role = (members: SetProps['members'], r: string) => members.filter((m) => m.role === r);
const ease = (x: number) => smoothstep(0, 1, x);

// ─── Events: showtime ───────────────────────────────────────────────────────

const STAGE = { x: -0.6, w: 6.6, d: 2.9, h: 0.45, z: -3.8 };
const TRUSS_Y = 4.7;
const CONFETTI = 220;
const CONFETTI_COLORS = ['#d4a24c', '#b5452f', '#5b8fd6', '#efe9df', '#7f9c86', '#c9b28f'];

function drawLedWall(ctx: CanvasRenderingContext2D, w: number, h: number, u: number, t: number) {
  ctx.fillStyle = '#060607';
  ctx.fillRect(0, 0, w, h);
  if (u < 0.27) {
    // Between shows: the season's events cycle.
    const i = Math.floor(t / 2.6) % EVENTS.length;
    const e = EVENTS[i];
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, e.accent);
    g.addColorStop(1, '#0a0a0c');
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    text(ctx, 'ACM-CEG PRESENTS', w * 0.05, h * 0.2, { family: 'mono', size: h * 0.06, color: 'rgba(239,233,223,0.75)', tracking: 0.3 });
    const s = fitSize(ctx, e.title, w * 0.9, { family: 'serif', size: h * 0.36 }, h * 0.36);
    text(ctx, e.title, w * 0.05, h * 0.6, { family: 'serif', size: s, color: BONE });
    text(ctx, `${e.kind} — ${e.cadence}`.toUpperCase(), w * 0.05, h * 0.78, { family: 'mono', size: h * 0.055, color: 'rgba(239,233,223,0.8)', tracking: 0.2 });
  } else if (u < 0.6) {
    // You're on.
    const g = ctx.createRadialGradient(w / 2, h * 0.55, h * 0.05, w / 2, h * 0.55, w * 0.55);
    g.addColorStop(0, '#3a2a12');
    g.addColorStop(1, '#060607');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    text(ctx, '★  TONIGHT’S HEADLINER  ★', w / 2, h * 0.24, { family: 'mono', size: h * 0.065, color: '#d4a24c', align: 'center', tracking: 0.3 });
    const pulse = 1 + Math.sin(t * 4) * 0.015;
    text(ctx, 'YOU', w / 2, h * 0.72, { family: 'sans', weight: 800, size: h * 0.5 * pulse, color: BONE, align: 'center', stretch: 'expanded', tracking: 0.06 });
  } else {
    // Every event starts here.
    ctx.fillStyle = '#0b0b0d';
    ctx.fillRect(0, 0, w, h);
    text(ctx, 'EVERY EVENT STARTS HERE', w * 0.05, h * 0.2, { family: 'mono', size: h * 0.065, color: '#d4a24c', tracking: 0.3 });
    const list = FLAGSHIPS.length ? FLAGSHIPS : EVENTS.slice(-2);
    list.forEach((e, i) => {
      text(ctx, e.title, w * 0.05, h * (0.48 + i * 0.26), { family: 'serif', size: h * 0.22, color: BONE });
      paragraph(ctx, e.summary, w * 0.4, h * (0.38 + i * 0.26), w * 0.55, h * 0.065, { family: 'sans', size: h * 0.052, color: 'rgba(239,233,223,0.72)' }, 2);
    });
  }
  // LED pixel grid.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  const step = Math.max(3, Math.round(h / 90));
  for (let y = 0; y < h; y += step) ctx.fillRect(0, y, w, 1);
  for (let x = 0; x < w; x += step) ctx.fillRect(x, 0, 1, h);
}

/** A volumetric-looking follow-spot cone from `from` to a moving target. */
function SpotBeam({ beam }: { beam: { current: { from: Vector3; to: Vector3; on: number } } }) {
  const g = useRef<Group>(null);
  const res = useDisposable(() => {
    const geo = new CylinderGeometry(0.07, 1, 1, 32, 1, true);
    geo.translate(0, -0.5, 0);
    geo.rotateX(-Math.PI / 2);
    const mat = new MeshBasicMaterial({ color: new Color('#ffe2b0'), transparent: true, opacity: 0.1, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, toneMapped: false });
    return { geo, mat };
  }, []);
  useFrame(() => {
    const el = g.current;
    if (!el) return;
    const b = beam.current;
    el.visible = b.on > 0.01;
    if (!el.visible) return;
    el.position.copy(b.from);
    el.lookAt(b.to);
    const len = b.from.distanceTo(b.to);
    el.scale.set(0.42 + len * 0.05, 0.42 + len * 0.05, len);
    res.mat.opacity = 0.11 * b.on;
  });
  return (
    <group ref={g}>
      <mesh geometry={res.geo} material={res.mat} renderOrder={4} />
    </group>
  );
}

export function StageSet({ bay, stop, members }: SetProps) {
  const kit = useKit();
  const clock = useStopClock(stop);
  const frame = useBayFrame(bay);
  const [host] = role(members, 'host');
  const [crew] = role(members, 'crew');
  const houseLights = useRef(1);
  const confetti = useRef<InstancedMesh>(null);
  const cam = useMemo(() => new Vector3(), []);
  const fwd = useMemo(() => new Vector3(), []);
  const floorY = useMemo(() => frame.world(0, 0).y, [frame]);
  const you = useMemo(() => new Vector3(), []);
  const beam = useRef({ from: frame.world(STAGE.x + 3.2, STAGE.z + 1.1, TRUSS_Y - 0.2), to: new Vector3(), on: 0 });
  const poolRef = useRef<Mesh>(null);
  const poolRes = useDisposable(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,236,200,1)');
    grad.addColorStop(0.6, 'rgba(255,220,170,0.55)');
    grad.addColorStop(1, 'rgba(255,220,170,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const map = new CanvasTexture(c);
    const geo = new PlaneGeometry(1.8, 1.8);
    geo.rotateX(-Math.PI / 2);
    return { map, geo };
  }, []);
  const poolMat = useDisposable(() => new MeshBasicMaterial({ map: poolRes.map, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false }), [poolRes]);
  const geo = useDisposable(
    () => ({
      stage: merge([
        place(metricBox(STAGE.w, STAGE.h, STAGE.d), { position: [STAGE.x, STAGE.h / 2, STAGE.z] }),
        // Steps up at the right.
        place(metricBox(0.9, STAGE.h / 2, 0.4), { position: [STAGE.x + STAGE.w / 2 - 0.6, STAGE.h / 4, STAGE.z + STAGE.d / 2 + 0.2] }),
      ]),
      edge: place(metricBox(STAGE.w, 0.03, 0.03), { position: [STAGE.x, STAGE.h + 0.005, STAGE.z + STAGE.d / 2 - 0.02] }),
      truss: merge([
        place(metricBox(STAGE.w + 0.6, 0.3, 0.3), { position: [STAGE.x, TRUSS_Y, STAGE.z + 0.9] }),
        place(metricBox(0.3, TRUSS_Y, 0.3), { position: [STAGE.x - STAGE.w / 2 - 0.15, TRUSS_Y / 2, STAGE.z + 0.9] }),
        place(metricBox(0.3, TRUSS_Y, 0.3), { position: [STAGE.x + STAGE.w / 2 + 0.15, TRUSS_Y / 2, STAGE.z + 0.9] }),
      ]),
      cans: merge(
        [-2.6, -1.3, 0, 1.3, 2.6].map((dx) => place(new CylinderGeometry(0.12, 0.1, 0.3, 14), { position: [STAGE.x + dx, TRUSS_Y - 0.3, STAGE.z + 1.05], rotation: [0.9, 0, 0] })),
      ),
      lenses: merge([-2.6, -1.3, 0, 1.3, 2.6].map((dx) => place(new CylinderGeometry(0.1, 0.1, 0.01, 14), { position: [STAGE.x + dx, TRUSS_Y - 0.42, STAGE.z + 1.17], rotation: [0.9, 0, 0] }))),
      spot: merge([place(new CylinderGeometry(0.16, 0.13, 0.55, 16), { position: [STAGE.x + 3.2, TRUSS_Y - 0.2, STAGE.z + 1.1], rotation: [Math.PI / 2, 0, 0] })]),
      mic: merge([
        place(new CylinderGeometry(0.012, 0.012, 1.45, 8), { position: [STAGE.x - 1.9, STAGE.h + 0.72, STAGE.z + 0.9] }),
        place(new CylinderGeometry(0.16, 0.16, 0.02, 16), { position: [STAGE.x - 1.9, STAGE.h + 0.01, STAGE.z + 0.9] }),
        place(new CylinderGeometry(0.025, 0.018, 0.13, 10), { position: [STAGE.x - 1.9, STAGE.h + 1.48, STAGE.z + 0.95], rotation: [0.5, 0, 0] }),
      ]),
      console: merge([place(metricBox(1.3, 0.9, 0.7), { position: [0, 0.45, 0] }), place(metricBox(1.3, 0.05, 0.75), { position: [0, 0.92, 0.02], rotation: [0.18, 0, 0] })]),
      wedges: merge([-1.6, 1.0].map((dx) => place(metricBox(0.5, 0.3, 0.38), { position: [STAGE.x + dx, STAGE.h + 0.15, STAGE.z + STAGE.d / 2 - 0.3], rotation: [-0.5, 0, 0] }))),
    }),
    [],
  );
  const confettiRes = useDisposable(() => {
    const geo = new PlaneGeometry(0.05, 0.028);
    const mat = new MeshBasicMaterial({ side: DoubleSide, toneMapped: false });
    return { geo, mat };
  }, []);
  const seeds = useMemo(() => {
    const rnd = rng(2004);
    return Array.from({ length: CONFETTI }, (_, i) => ({
      side: i % 2 ? 1 : -1,
      vx: 0.4 + rnd() * 1.6,
      vy: 7 + rnd() * 4,
      vz: 0.6 + rnd() * 2.6,
      spin: 3 + rnd() * 9,
      phase: rnd() * 6.28,
      flutter: 0.1 + rnd() * 0.2,
      color: new Color(CONFETTI_COLORS[i % CONFETTI_COLORS.length]).multiplyScalar(1.1),
    }));
  }, []);
  useEffect(() => {
    const m = confetti.current;
    if (!m) return;
    seeds.forEach((s, i) => m.setColorAt(i, s.color));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [seeds]);
  const dummy = useMemo(() => new Object3D(), []);

  useFrame(({ camera }) => {
    const c = clock.current;
    const u = c.meet;
    camera.getWorldPosition(cam);
    // House lights dip for the spotlight moment.
    const moment = c.here ? window01(u, 0.24, 0.66, 0.08) : 0;
    houseLights.current = 1 - 0.7 * moment;
    // Follow-spot: finds the host, then swings out and lands on you — a pool of
    // light at your feet you can see from where you stand.
    const b = beam.current;
    const hostPos = host ? npcAnchors.get(host.member.id)?.position : undefined;
    const swing = smoothstep(0.26, 0.36, u);
    fwd.set(0, 0, -1.3).applyQuaternion(camera.quaternion);
    you.set(cam.x + fwd.x, floorY + 0.02, cam.z + fwd.z);
    if (hostPos) b.to.set(hostPos.x, floorY + STAGE.h + 0.02, hostPos.z).lerp(you, swing);
    b.on = c.here ? window01(u, 0.1, 0.72, 0.06) : 0;
    const pool = poolRef.current;
    if (pool) {
      pool.visible = b.on > 0.01;
      pool.position.copy(b.to);
      pool.scale.setScalar(0.9 + 0.15 * b.from.distanceTo(b.to) * 0.1);
      poolMat.opacity = 0.55 * b.on;
    }

    // Confetti from two cannons at the stage lip, scrubbed by scroll.
    const m = confetti.current;
    if (m) {
      const tau = (u - 0.34) * 9;
      m.visible = c.here && tau > 0 && u < 0.99;
      if (m.visible) {
        const k = 3.2;
        const gk = 1.1; // terminal fall speed
        const decay = (1 - Math.exp(-k * tau)) / k;
        seeds.forEach((s, i) => {
          const x0 = STAGE.x + s.side * (STAGE.w / 2 - 0.3);
          let y = STAGE.h + 0.3 + (s.vy + gk) * decay - gk * tau;
          const x = x0 - s.side * s.vx * decay * 1.6 + Math.sin(tau * 2.4 + s.phase) * s.flutter;
          const z = STAGE.z + STAGE.d / 2 + s.vz * decay + Math.cos(tau * 2 + s.phase) * s.flutter;
          const landed = y < 0.012;
          if (landed) y = 0.012;
          dummy.position.set(x, y, z);
          if (landed) dummy.rotation.set(-Math.PI / 2, 0, s.phase);
          else dummy.rotation.set(tau * s.spin, tau * s.spin * 0.7 + s.phase, s.phase);
          dummy.updateMatrix();
          m.setMatrixAt(i, dummy.matrix);
        });
        m.instanceMatrix.needsUpdate = true;
      }
    }

    if (!c.here) {
      releaseCues(members);
      return;
    }
    if (host) {
      const k = cue(host.member.id);
      k.look = Math.max(smoothstep(0.5, 1, c.walk) * 0.5, window01(u, 0.08, 0.96, 0.08));
      k.turn = k.look;
      k.wave = window01(u, 0.14, 0.26, 0.03);
      k.point = window01(u, 0.3, 0.48, 0.05);
      k.pointAt = cam;
    }
    if (crew) {
      const k = cue(crew.member.id);
      k.look = window01(u, 0.54, 0.94, 0.08);
      k.turn = k.look * 0.7;
    }
  });

  return (
    <>
    <BayGroup bay={bay}>
      <BayShell bay={bay} lightGain={houseLights}>
        <mesh geometry={geo.stage} material={kit.black} />
        <mesh geometry={geo.edge} material={kit.lightWarm} />
        <mesh geometry={geo.truss} material={kit.steel} />
        <mesh geometry={geo.cans} material={kit.black} />
        <mesh geometry={geo.lenses} material={kit.lightWarm} />
        <mesh geometry={geo.spot} material={kit.steelLight} />
        <mesh geometry={geo.mic} material={kit.steel} />
        <mesh geometry={geo.wedges} material={kit.black} />
        <CanvasPanel
          width={6.0}
          height={2.9}
          pxPerMeter={170}
          position={[STAGE.x, STAGE.h + 0.25 + 1.45, -5.12]}
          shading="glow"
          glowStrength={1}
          drawKey="stage-led"
          draw={(ctx, w, h) => drawLedWall(ctx, w, h, 0, 0)}
          animate={(ctx, w, h, t) => {
            const k = clock.current;
            if (!k.near) return false;
            drawLedWall(ctx, w, h, k.here ? k.meet : 0, t);
            return true;
          }}
          animateEvery={0.15}
        />
        <group position={[2.65, 0, -0.35]} rotation={[0, -0.9 + Math.PI, 0]}>
          <mesh geometry={geo.console} material={kit.black} />
          <CanvasPanel width={1.2} height={0.68} pxPerMeter={300} position={[0, 0.95, 0.03]} rotation={[-Math.PI / 2 + 0.18, 0, 0]} shading="glow" glowStrength={0.8} drawKey="stage-desk" draw={drawFaders} />
        </group>
        <instancedMesh ref={confetti} args={[confettiRes.geo, confettiRes.mat, CONFETTI]} frustumCulled={false} visible={false} />
      </BayShell>
    </BayGroup>
      <SpotBeam beam={beam} />
      <mesh ref={poolRef} geometry={poolRes.geo} material={poolMat} renderOrder={5} visible={false} />
    </>
  );
}

function drawFaders(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#111214';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 16; i++) {
    const x = w * (0.05 + i * 0.058);
    ctx.fillStyle = '#26282c';
    ctx.fillRect(x, h * 0.2, w * 0.012, h * 0.65);
    ctx.fillStyle = i % 5 === 0 ? '#d4a24c' : '#b9bcc2';
    ctx.fillRect(x - w * 0.012, h * (0.3 + ((i * 37) % 50) / 100), w * 0.036, h * 0.06);
    ctx.fillStyle = i % 3 ? '#0cce6b' : '#e8c07a';
    ctx.beginPath();
    ctx.arc(x + w * 0.006, h * 0.1, h * 0.02, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── HR: your badge ─────────────────────────────────────────────────────────

const ORG = (() => {
  const nodes: { label: string; sub?: string; row: number; col: number; of: number; you?: boolean }[] = [];
  nodes.push({ label: 'ACM-CEG', sub: 'Student chapter', row: 0, col: 0, of: 1 });
  const fac = FACULTY;
  fac.forEach((f, i) => nodes.push({ label: f.name, sub: f.role, row: 1, col: i, of: fac.length }));
  const bearers = DIRECTORS.filter((d) => d.domain === 'office');
  bearers.forEach((b, i) => nodes.push({ label: b.name, sub: b.role, row: 2, col: i, of: bearers.length }));
  const doms = DOMAINS.filter((d) => d.id !== 'office');
  doms.forEach((d, i) => nodes.push({ label: d.name, row: 3, col: i, of: doms.length }));
  return nodes;
})();

function drawOrgChart(ctx: CanvasRenderingContext2D, w: number, h: number, shown: number, you: boolean) {
  ctx.fillStyle = '#121216';
  ctx.fillRect(0, 0, w, h);
  text(ctx, 'THE CHAPTER', w * 0.03, h * 0.08, { family: 'mono', size: h * 0.035, color: DIM, tracking: 0.24 });
  const rowY = [0.2, 0.42, 0.62, 0.84].map((f) => f * h);
  const pos = (n: (typeof ORG)[number]) => {
    const span = n.row === 3 ? 0.94 : n.row === 0 ? 0 : 0.7;
    const x = n.of === 1 ? 0.5 : 0.5 - span / 2 + (span * n.col) / (n.of - 1);
    return [x * w, rowY[n.row]] as const;
  };
  // Links first.
  ctx.strokeStyle = 'rgba(239,233,223,0.28)';
  ctx.lineWidth = h * 0.004;
  ORG.slice(0, shown).forEach((n) => {
    if (n.row === 0) return;
    const [x, y] = pos(n);
    const [px, py] = n.row === 1 ? pos(ORG[0]) : [w * 0.5, rowY[n.row - 1]];
    ctx.beginPath();
    ctx.moveTo(px, py + h * 0.05);
    ctx.bezierCurveTo(px, (py + y) / 2, x, (py + y) / 2, x, y - h * 0.05);
    ctx.stroke();
  });
  ORG.slice(0, shown).forEach((n) => {
    const [x, y] = pos(n);
    const bw = n.row === 3 ? w * 0.085 : w * 0.16;
    const bh = h * (n.sub ? 0.1 : 0.075);
    ctx.fillStyle = n.row === 0 ? PALETTE.cegRed : '#1f2026';
    ctx.fillRect(x - bw / 2, y - bh / 2, bw, bh);
    const size = fitSize(ctx, n.label, bw * 0.9, { family: 'sans', weight: 600, size: h * 0.034 }, h * 0.034, h * 0.018);
    text(ctx, n.label, x, y + (n.sub ? -h * 0.004 : h * 0.012), { family: 'sans', weight: 600, size, color: BONE, align: 'center' });
    if (n.sub) text(ctx, n.sub.toUpperCase(), x, y + h * 0.032, { family: 'mono', size: h * 0.02, color: DIM, align: 'center', tracking: 0.14 });
  });
  if (you) {
    // The newest member.
    const x = w * 0.9;
    const y = h * 0.2;
    ctx.setLineDash([h * 0.012, h * 0.01]);
    ctx.strokeStyle = PALETTE.acm;
    ctx.lineWidth = h * 0.005;
    ctx.beginPath();
    ctx.moveTo(w * 0.58, y);
    ctx.lineTo(x - w * 0.07, y);
    ctx.stroke();
    ctx.strokeRect(x - w * 0.07, y - h * 0.055, w * 0.14, h * 0.11);
    ctx.setLineDash([]);
    text(ctx, 'YOU', x, y + h * 0.004, { family: 'sans', weight: 700, size: h * 0.045, color: '#8fb6ff', align: 'center' });
    text(ctx, 'NEWEST MEMBER', x, y + h * 0.038, { family: 'mono', size: h * 0.02, color: '#8fb6ff', align: 'center', tracking: 0.16 });
  }
}

function drawBadge(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const r = w * 0.06;
  ctx.fillStyle = '#f6f2ea';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, r);
  ctx.fill();
  ctx.fillStyle = PALETTE.cegRed;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h * 0.24, [r, r, 0, 0]);
  ctx.fill();
  // Lanyard slot.
  ctx.fillStyle = '#d8d1c4';
  ctx.beginPath();
  ctx.roundRect(w * 0.38, h * 0.03, w * 0.24, h * 0.025, h * 0.012);
  ctx.fill();
  text(ctx, 'ACM-CEG', w * 0.08, h * 0.15, { family: 'sans', weight: 800, size: h * 0.075, color: '#fbf6ee', stretch: 'expanded', tracking: 0.06 });
  text(ctx, 'STUDENT CHAPTER', w * 0.08, h * 0.205, { family: 'mono', size: h * 0.03, color: 'rgba(251,246,238,0.85)', tracking: 0.2 });
  // Photo.
  ctx.fillStyle = '#d9d2c6';
  ctx.fillRect(w * 0.08, h * 0.3, w * 0.36, h * 0.3);
  ctx.fillStyle = '#6f6a63';
  ctx.beginPath();
  ctx.ellipse(w * 0.26, h * 0.41, w * 0.065, h * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.12, h * 0.6);
  ctx.quadraticCurveTo(w * 0.26, h * 0.44, w * 0.4, h * 0.6);
  ctx.fill();
  text(ctx, 'NAME', w * 0.5, h * 0.33, { family: 'mono', size: h * 0.028, color: '#8a8378', tracking: 0.2 });
  text(ctx, 'You', w * 0.5, h * 0.4, { family: 'serif', italic: true, size: h * 0.07, color: '#1b1b1d' });
  text(ctx, 'ROLE', w * 0.5, h * 0.48, { family: 'mono', size: h * 0.028, color: '#8a8378', tracking: 0.2 });
  text(ctx, 'Member', w * 0.5, h * 0.55, { family: 'sans', weight: 600, size: h * 0.05, color: '#1b1b1d' });
  text(ctx, 'College of Engineering Guindy', w * 0.08, h * 0.7, { family: 'sans', size: h * 0.036, color: '#3a3a3e' });
  text(ctx, `Anna University, Chennai · est. ${CHAPTER.established}`, w * 0.08, h * 0.75, { family: 'sans', size: h * 0.03, color: '#6a6a70' });
  // Barcode.
  ctx.fillStyle = '#1b1b1d';
  let x = w * 0.08;
  let i = 0;
  while (x < w * 0.92) {
    const bw = w * (0.004 + ((i * 7919) % 5) * 0.003);
    if (i % 2 === 0) ctx.fillRect(x, h * 0.8, bw, h * 0.1);
    x += bw;
    i++;
  }
  text(ctx, 'ACM · CEG · 2026 · 0001', w / 2, h * 0.95, { family: 'mono', size: h * 0.028, color: '#1b1b1d', align: 'center', tracking: 0.2 });
}

/** Walk path from the HR desk, round its end, to arm's length in front of you (bay-local). */
const HR_PATH: [number, number][] = [
  [0, -2.4],
  [1.55, -2.1],
  [1.55, -0.9],
  [0.25, 4.75],
];

function alongPath(path: [number, number][], s: number): [number, number] {
  const lens = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1]));
  let d = Math.min(1, Math.max(0, s)) * lens.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const f = lens[i] ? Math.min(1, d / lens[i]) : 0;
      return [lerp(path[i][0], path[i + 1][0], f), lerp(path[i][1], path[i + 1][1], f)];
    }
    d -= lens[i];
  }
  return path[path.length - 1];
}

export function PeopleDeskSet({ bay, stop, members }: SetProps) {
  const kit = useKit();
  const clock = useStopClock(stop);
  const frame = useBayFrame(bay);
  const [hr] = members;
  const badge = useRef<Group>(null);
  const straps = useRef<Mesh>(null);
  const visible = useRef(false);
  const from = useMemo(() => new Vector3(), []);
  const tmp = useMemo(() => new Vector3(), []);
  const strapGeo = useDisposable(() => {
    // Two lanyard straps from the badge's top corners up out of frame.
    const g = new BufferGeometry();
    const w = 0.012;
    const q = (x0: number, x1: number) => [x0 - w, 0.07, 0, x0 + w, 0.07, 0, x1 - w, 0.42, -0.12, x1 + w, 0.42, -0.12];
    g.setAttribute('position', new BufferAttribute(new Float32Array([...q(-0.018, -0.1), ...q(0.018, 0.1)]), 3));
    g.setIndex([0, 1, 2, 1, 3, 2, 4, 5, 6, 5, 7, 6]);
    return g;
  }, []);
  const strapMat = useDisposable(() => new MeshBasicMaterial({ color: new Color(PALETTE.acm).multiplyScalar(0.9), side: DoubleSide }), []);
  const orgAnimate = useMemo(() => {
    let last = '';
    return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const k = clock.current;
      const u = k.here ? k.meet : k.meet >= 1 ? 1 : 0;
      const shown = Math.round(ORG.length * (0.25 + 0.75 * smoothstep(0.02, 0.42, u)));
      const you = u > 0.55;
      const key = `${shown}-${you}`;
      if (key === last) return false;
      last = key;
      drawOrgChart(ctx, w, h, shown, you);
      return true;
    };
  }, [clock]);
  const geo = useDisposable(
    () => ({
      badges: merge([0, 1, 2, 3].map((i) => place(metricBox(0.1, 0.004, 0.145), { position: [-0.6 + i * 0.012, 0.745 + i * 0.004, -1.35], rotation: [0, 0.1 * i, 0] }))),
      spool: place(new CylinderGeometry(0.07, 0.07, 0.05, 20), { position: [-0.25, 0.77, -1.35] }),
      plant: merge([place(new CylinderGeometry(0.16, 0.12, 0.34, 16), { position: [2.9, 0.17, -3.6] })]),
      leaves: merge([0, 1, 2, 3, 4].map((i) => place(metricBox(0.08, 0.6, 0.02), { position: [2.9 + Math.sin(i * 1.3) * 0.08, 0.62, -3.6 + Math.cos(i * 1.3) * 0.08], rotation: [Math.sin(i) * 0.4, i * 1.3, Math.cos(i) * 0.4] }))),
    }),
    [],
  );

  useFrame(({ camera }) => {
    const c = clock.current;
    const u = c.meet;
    visible.current = c.here && u > 0.34 && u < 0.93;
    const g = badge.current;
    if (g && visible.current) {
      // From the director's hand to in front of you, a gentle swing, then down around your neck.
      const a = hr ? npcAnchors.get(hr.member.id) : undefined;
      if (a) from.copy(a.hand);
      tmp.copy(from);
      camera.worldToLocal(tmp);
      const inn = ease(smoothstep(0.36, 0.52, u));
      const out = smoothstep(0.8, 0.93, u);
      g.position.set(lerp(tmp.x, 0, inn), lerp(tmp.y, -0.02, inn) - out * 0.55, lerp(tmp.z, -0.46, inn) + out * 0.1);
      g.rotation.set(-out * 0.6, (1 - inn) * Math.PI * 2, Math.sin(u * 60) * 0.04 * inn * (1 - out));
      g.scale.setScalar(0.6 + 0.4 * inn);
      if (straps.current) straps.current.visible = inn > 0.9;
    }
    if (!c.here) {
      releaseCues(members);
      releaseFocus(stop);
      return;
    }
    if (hr) {
      const k = cue(hr.member.id);
      // Up from the desk, round it, and over to you; back again once you've got it.
      const s = smoothstep(0.16, 0.36, u) - smoothstep(0.74, 0.95, u);
      const [bx, bz] = alongPath(HR_PATH, s);
      const [hx, hz] = frame.hall(bx, bz);
      k.pos = { x: TEAM_ORIGIN[0] + hx, z: TEAM_ORIGIN[2] + hz };
      k.stand = window01(u, 0.13, 0.98, 0.02);
      k.look = Math.max(smoothstep(0.5, 1, c.walk) * 0.6, window01(u, 0.08, 0.97, 0.06));
      k.turn = window01(u, 0.34, 0.76, 0.04);
      k.extend = window01(u, 0.35, 0.5, 0.05);
      k.wave = window01(u, 0.6, 0.72, 0.03);
      const a = npcAnchors.get(hr.member.id);
      if (a) focusOn(stop, a.head, window01(u, 0.2, 0.5, 0.1) * 0.55);
    }
  });

  return (
    <>
      <BayGroup bay={bay}>
        <BayShell bay={bay}>
          <Desk position={[0, 0, -1.55]} width={2.2} depth={0.85} />
          <Chair position={[0, 0, -2.4]} />
          <Laptop position={[0.45, 0.74, -1.6]} rotation={[0, Math.PI, 0]} />
          <mesh geometry={geo.badges} material={kit.paper} />
          <mesh geometry={geo.spool} material={kit.acmLine} />
          <mesh geometry={geo.plant} material={kit.concreteDark} />
          <mesh geometry={geo.leaves} material={kit.fabric} />
          <mesh position={[0, 2.45, -5.19]} material={kit.black}>
            <boxGeometry args={[8.1, 3.0, 0.05]} />
          </mesh>
          <CanvasPanel
            width={8}
            height={2.9}
            pxPerMeter={170}
            position={[0, 2.45, -5.15]}
            shading="glow"
            glowStrength={0.95}
            drawKey="hr-org"
            draw={(ctx, w, h) => drawOrgChart(ctx, w, h, 1, false)}
            animate={orgAnimate}
            animateEvery={0.08}
          />
        </BayShell>
      </BayGroup>
      <CameraSpace visible={visible}>
        <group ref={badge}>
          <mesh ref={straps} geometry={strapGeo} material={strapMat} visible={false} />
          <CanvasPanel width={0.1} height={0.145} pxPerMeter={5200} shading="glow" glowStrength={1} transparent drawKey="hr-badge" draw={drawBadge} renderOrder={10} />
        </group>
      </CameraSpace>
    </>
  );
}

// ─── Sponsorship: the pitch ─────────────────────────────────────────────────

const SLIDE_AT = [0.06, 0.3, 0.52, 0.74];

function drawSlide(ctx: CanvasRenderingContext2D, w: number, h: number, i: number, local: number) {
  const s = SET_COPY.pitchSlides[i];
  ctx.fillStyle = i === 0 ? '#101114' : '#f4f1ea';
  ctx.fillRect(0, 0, w, h);
  const ink = i === 0 ? BONE : '#141416';
  const sub = i === 0 ? 'rgba(239,233,223,0.7)' : '#55555c';
  ctx.fillStyle = PALETTE.cegRed;
  ctx.fillRect(0, 0, w, h * 0.015);
  text(ctx, `${String(i + 1).padStart(2, '0')} / ${String(SET_COPY.pitchSlides.length).padStart(2, '0')}`, w * 0.93, h * 0.08, { family: 'mono', size: h * 0.03, color: sub, align: 'right', tracking: 0.2 });
  text(ctx, 'ACM-CEG · SPONSORSHIP', w * 0.06, h * 0.08, { family: 'mono', size: h * 0.03, color: sub, tracking: 0.2 });
  if (i === 1) {
    // Reach: counters run up as the slide plays.
    const k = ease(Math.min(1, local * 2.2));
    text(ctx, s.title, w * 0.06, h * 0.26, { family: 'serif', size: h * 0.1, color: ink });
    CHAPTER.legacy.stats.slice(0, 2).forEach((st, j) => {
      const n = parseInt(st.value, 10);
      const shown = Number.isFinite(n) ? `${Math.round(n * k)}${st.value.replace(/^\d+/, '')}` : st.value;
      const x = w * (0.06 + j * 0.44);
      text(ctx, shown, x, h * 0.66, { family: 'serif', size: h * 0.3, color: j === 0 ? PALETTE.cegRed : ink });
      text(ctx, st.label.toUpperCase(), x + w * 0.005, h * 0.78, { family: 'mono', size: h * 0.035, color: sub, tracking: 0.2 });
    });
    return;
  }
  text(ctx, s.title, w * 0.06, h * 0.42, { family: 'serif', italic: i === 0, size: h * (i === 0 ? 0.16 : 0.12), color: ink });
  paragraph(ctx, s.body, w * 0.06, h * 0.58, w * 0.8, h * 0.07, { family: 'sans', size: h * 0.052, color: sub }, 3);
  if (i === 2) {
    ctx.fillStyle = '#8c83c4';
    ctx.fillRect(w * 0.06, h * 0.78, w * 0.1 * ease(Math.min(1, local * 3)), h * 0.012);
  }
}

function drawDeck(ctx: CanvasRenderingContext2D, w: number, h: number, u: number) {
  let i = 0;
  for (let k = 0; k < SLIDE_AT.length; k++) if (u >= SLIDE_AT[k]) i = k;
  const start = SLIDE_AT[i];
  const end = SLIDE_AT[i + 1] ?? 1;
  const local = Math.min(1, Math.max(0, (u - start) / (end - start)));
  // Push transition over the first sliver of each slide.
  const tr = i > 0 ? ease(Math.min(1, (u - start) / 0.03)) : 1;
  if (tr < 1) {
    ctx.save();
    ctx.translate(-w * tr, 0);
    drawSlide(ctx, w, h, i - 1, 1);
    ctx.restore();
    ctx.save();
    ctx.translate(w * (1 - tr), 0);
    drawSlide(ctx, w, h, i, local);
    ctx.restore();
  } else drawSlide(ctx, w, h, i, local);
}

export function PitchSet({ bay, stop, members }: SetProps) {
  const kit = useKit();
  const clock = useStopClock(stop);
  const frame = useBayFrame(bay);
  const [presenter] = members;
  const pts = useMemo(
    () => ({
      screen: frame.world(-0.6, -5.1, 2.55),
      seat: frame.world(-0.6, 0.65, 1.22),
    }),
    [frame],
  );
  const tableGeo = useDisposable(() => {
    const top = new CylinderGeometry(1, 1, 0.04, 48);
    top.scale(1.5, 1, 0.75);
    return merge([place(top, { position: [-0.6, 0.74, -1.3] }), place(new CylinderGeometry(0.08, 0.2, 0.72, 16), { position: [-0.6, 0.36, -1.3] })]);
  }, []);
  const glassGeo = useDisposable(
    () => merge([-1.5, -0.6, 0.3].map((x, i) => place(new CylinderGeometry(0.035, 0.03, 0.1, 12), { position: [x + 0.2, 0.81, -0.95 - (i % 2) * 0.6] }))),
    [],
  );
  const padGeo = useDisposable(() => merge([-1.5, -0.6, 0.3].map((x) => place(metricBox(0.21, 0.006, 0.28), { position: [x, 0.763, -0.85] }))), []);
  const deckAnimate = useMemo(() => {
    let last = -1;
    return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const k = clock.current;
      const u = k.here ? k.meet : k.meet >= 1 ? 1 : 0;
      const q = Math.round(u * 400) / 400;
      if (q === last) return false;
      last = q;
      drawDeck(ctx, w, h, q);
      return true;
    };
  }, [clock]);

  useFrame(() => {
    const c = clock.current;
    const u = c.meet;
    if (!c.here) {
      releaseCues(members);
      releaseFocus(stop);
      return;
    }
    if (presenter) {
      const k = cue(presenter.member.id);
      k.look = Math.max(smoothstep(0.5, 1, c.walk) * 0.6, window01(u, 0.04, 0.22, 0.06), window01(u, 0.7, 0.98, 0.06));
      k.turn = k.look * 0.8;
      k.point = Math.max(window01(u, 0.24, 0.4, 0.05), window01(u, 0.5, 0.64, 0.05));
      k.pointAt = pts.screen;
      k.wave = window01(u, 0.86, 0.96, 0.03);
    }
    // Take a seat for the pitch; stand up at the end.
    focusOn(stop, pts.screen, ease(window01(u, 0.04, 0.94, 0.14)), 0, pts.seat);
  });

  return (
    <BayGroup bay={bay}>
      <BayShell bay={bay}>
        <mesh position={[-0.6, 2.55, -5.19]} material={kit.black}>
          <boxGeometry args={[5.7, 3.25, 0.05]} />
        </mesh>
        <CanvasPanel width={5.6} height={3.15} pxPerMeter={200} position={[-0.6, 2.55, -5.15]} shading="glow" glowStrength={0.95} drawKey="pitch-deck" draw={(ctx, w, h) => drawDeck(ctx, w, h, 0)} animate={deckAnimate} animateEvery={0.05} />
        <mesh geometry={tableGeo} material={kit.oak} />
        <mesh geometry={glassGeo} material={kit.glass} />
        <mesh geometry={padGeo} material={kit.paper} />
        {[
          [-1.5, -0.35, Math.PI],
          [0.3, -0.35, Math.PI],
          [-2.35, -1.3, Math.PI / 2],
          [1.15, -1.3, -Math.PI / 2],
          [-1.5, -2.25, 0],
          [0.3, -2.25, 0],
        ].map(([x, z, r], i) => (
          <Chair key={i} position={[x, 0, z]} rotation={[0, r, 0]} />
        ))}
      </BayShell>
    </BayGroup>
  );
}

// ─── External Marketing: outreach ──────────────────────────────────────────

const REACH = [
  { label: 'Instagram', sub: '@acmceg', a: -2.5 },
  { label: 'LinkedIn', sub: 'ACM-CEG', a: -1.7 },
  { label: 'OffCamp', sub: 'internships · scholarships · jobs', a: -0.9 },
  { label: NEWSLETTER.title, sub: 'the newsletter', a: -0.15 },
  { label: 'Prodigy', sub: 'for school students', a: 0.6 },
  { label: 'CodHer', sub: 'women in tech', a: 1.35 },
  { label: 'Alumni', sub: '500+ network', a: 2.1 },
  { label: 'auceg.acm.org', sub: 'the website', a: 2.85 },
];

function drawReach(ctx: CanvasRenderingContext2D, w: number, h: number, u: number, t: number) {
  ctx.fillStyle = '#0f0d0c';
  ctx.fillRect(0, 0, w, h);
  text(ctx, 'WHERE IT ALL GOES OUT', w * 0.03, h * 0.08, { family: 'mono', size: h * 0.035, color: DIM, tracking: 0.24 });
  const cx = w * 0.5;
  const cy = h * 0.54;
  const lit = smoothstep(0.26, 0.62, u) * REACH.length;
  REACH.forEach((n, i) => {
    const x = cx + Math.cos(n.a - Math.PI / 2) * w * 0.36;
    const y = cy + Math.sin(n.a - Math.PI / 2) * h * 0.36;
    const on = Math.min(1, Math.max(0, lit - i));
    ctx.strokeStyle = on > 0 ? `rgba(207,122,88,${0.25 + 0.6 * on})` : 'rgba(239,233,223,0.12)';
    ctx.lineWidth = h * (on > 0 ? 0.006 : 0.003);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo((cx + x) / 2, (cy + y) / 2 - h * 0.08, x, y);
    ctx.stroke();
    if (on >= 1) {
      // Packets travelling out along the link.
      for (let p = 0; p < 3; p++) {
        const f = (t * 0.45 + p / 3 + i * 0.13) % 1;
        const qx = (1 - f) * (1 - f) * cx + 2 * (1 - f) * f * ((cx + x) / 2) + f * f * x;
        const qy = (1 - f) * (1 - f) * cy + 2 * (1 - f) * f * ((cy + y) / 2 - h * 0.08) + f * f * y;
        ctx.fillStyle = '#f2b38f';
        ctx.beginPath();
        ctx.arc(qx, qy, h * 0.008, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = on > 0 ? '#cf7a58' : '#2a2624';
    ctx.beginPath();
    ctx.arc(x, y, h * 0.028, 0, Math.PI * 2);
    ctx.fill();
    const right = x >= cx;
    text(ctx, n.label, x + (right ? h * 0.05 : -h * 0.05), y, { family: 'sans', weight: 600, size: h * 0.045, color: on > 0 ? BONE : 'rgba(239,233,223,0.4)', align: right ? 'left' : 'right' });
    text(ctx, n.sub, x + (right ? h * 0.05 : -h * 0.05), y + h * 0.045, { family: 'mono', size: h * 0.026, color: on > 0 ? DIM : 'rgba(239,233,223,0.25)', align: right ? 'left' : 'right' });
  });
  ctx.fillStyle = PALETTE.cegRed;
  ctx.beginPath();
  ctx.arc(cx, cy, h * 0.085, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, 'ACM-CEG', cx, cy + h * 0.016, { family: 'sans', weight: 800, size: h * 0.042, color: '#fbf6ee', align: 'center' });
}

function drawProfile(ctx: CanvasRenderingContext2D, w: number, h: number, following: boolean) {
  ctx.fillStyle = '#0c0c0d';
  ctx.fillRect(0, 0, w, h);
  const u = w / 100;
  // Notification banner.
  ctx.fillStyle = 'rgba(58,58,62,0.95)';
  ctx.beginPath();
  ctx.roundRect(u * 4, u * 6, w - u * 8, u * 20, u * 5);
  ctx.fill();
  text(ctx, following ? 'You’re following @acmceg' : '@acmceg wants to say hi 👋', u * 9, u * 14.5, { family: 'sans', weight: 600, size: u * 4.4, color: '#f4f4f4' });
  text(ctx, 'now', w - u * 9, u * 14.5, { family: 'sans', size: u * 3.6, color: '#9a9aa0', align: 'right' });
  text(ctx, 'Tap to see the chapter’s feed', u * 9, u * 21, { family: 'sans', size: u * 3.6, color: '#b8b8be' });
  // Profile.
  ctx.fillStyle = PALETTE.cegRed;
  ctx.beginPath();
  ctx.arc(u * 18, u * 45, u * 11, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, 'ACM', u * 18, u * 47, { family: 'sans', weight: 800, size: u * 5, color: '#fbf6ee', align: 'center' });
  text(ctx, 'acmceg', u * 34, u * 42, { family: 'sans', weight: 700, size: u * 5.4, color: '#f4f4f4' });
  text(ctx, 'ACM-CEG Student Chapter', u * 34, u * 49, { family: 'sans', size: u * 3.8, color: '#c8c8cc' });
  paragraph(ctx, 'College of Engineering Guindy · events, contests, OffCamp opportunities.', u * 6, u * 64, w - u * 12, u * 5, { family: 'sans', size: u * 3.6, color: '#d8d8dc' }, 2);
  // Follow button.
  ctx.fillStyle = following ? '#2a2a2e' : '#3d7be0';
  ctx.beginPath();
  ctx.roundRect(u * 6, u * 76, w - u * 12, u * 11, u * 2.5);
  ctx.fill();
  text(ctx, following ? 'Following ✓' : 'Follow', w / 2, u * 83.5, { family: 'sans', weight: 700, size: u * 4.6, color: '#ffffff', align: 'center' });
  // Feed grid: the season's events.
  const cell = (w - u * 2) / 3;
  EVENTS.slice(0, 9).forEach((e, i) => {
    const x = u + (i % 3) * cell;
    const y = u * 92 + Math.floor(i / 3) * cell;
    if (y > h) return;
    ctx.fillStyle = e.accent;
    ctx.fillRect(x + u * 0.4, y + u * 0.4, cell - u * 0.8, cell - u * 0.8);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x + u * 0.4, y + cell * 0.62, cell - u * 0.8, cell * 0.38 - u * 0.4);
    text(ctx, e.title, x + u * 2, y + cell * 0.86, { family: 'serif', size: u * 4.4, color: '#fbf6ee' });
  });
}

export function OutreachSet({ bay, stop, members }: SetProps) {
  const kit = useKit();
  const clock = useStopClock(stop);
  const [caller] = members;
  const phone = useRef<Group>(null);
  const visible = useRef(false);
  const phoneGeo = useDisposable(() => {
    const body = metricBox(0.078, 0.162, 0.008);
    return { body };
  }, []);
  const ringGeo = useDisposable(() => {
    const ring = new CylinderGeometry(0.23, 0.23, 0.03, 40, 1, true);
    ring.rotateX(Math.PI / 2);
    return {
      ring: place(ring, { position: [-2.2, 1.6, -3.2] }),
      stand: merge([place(new CylinderGeometry(0.015, 0.02, 1.6, 8), { position: [-2.2, 0.8, -3.22] }), place(new CylinderGeometry(0.22, 0.22, 0.02, 20), { position: [-2.2, 0.01, -3.22] })]),
    };
  }, []);
  const profileAnimate = useMemo(() => {
    let last: boolean | null = null;
    return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const f = clock.current.meet > 0.72;
      if (f === last) return false;
      last = f;
      drawProfile(ctx, w, h, f);
      return true;
    };
  }, [clock]);

  useFrame(() => {
    const c = clock.current;
    const u = c.meet;
    visible.current = c.here && u > 0.44 && u < 0.96;
    const g = phone.current;
    if (g && visible.current) {
      // Your phone buzzes up from below the frame, gets tapped, and goes back in your pocket.
      const inn = ease(smoothstep(0.44, 0.56, u));
      const out = smoothstep(0.86, 0.96, u);
      const shake = u > 0.46 && u < 0.52 ? Math.sin(u * 900) * 0.004 : 0;
      g.position.set(0.075 + shake, -0.34 + 0.29 * inn - 0.34 * out, -0.36);
      g.rotation.set(-0.3 * (1 - inn) + 0.12, -0.16, -0.05 + 0.05 * (1 - inn));
    }
    if (!c.here) {
      releaseCues(members);
      return;
    }
    if (caller) {
      const k = cue(caller.member.id);
      // On a call; notices you mid-sentence, hangs up to say hi.
      k.look = Math.max(smoothstep(0.5, 1, c.walk) * 0.4, window01(u, 0.16, 0.95, 0.08));
      k.turn = k.look;
      k.activity = u > 0.4 ? 'presenting' : null;
      k.wave = window01(u, 0.2, 0.32, 0.03);
    }
  });

  return (
    <>
      <BayGroup bay={bay}>
        <BayShell bay={bay}>
          <mesh position={[0, 2.5, -5.19]} material={kit.black}>
            <boxGeometry args={[8.1, 3.1, 0.05]} />
          </mesh>
          <CanvasPanel
            width={8}
            height={3}
            pxPerMeter={170}
            position={[0, 2.5, -5.15]}
            shading="glow"
            glowStrength={0.95}
            drawKey="reach"
            draw={(ctx, w, h) => drawReach(ctx, w, h, 0, 0)}
            animate={(ctx, w, h, t) => {
              const k = clock.current;
              if (!k.near) return false;
              drawReach(ctx, w, h, k.here ? k.meet : k.meet >= 1 ? 1 : 0, t);
              return true;
            }}
            animateEvery={0.1}
          />
          <mesh geometry={ringGeo.ring} material={kit.lightWarm} />
          <mesh geometry={ringGeo.stand} material={kit.steel} />
          <Desk position={[2.4, 0, -3.0]} width={1.6} depth={0.7} height={1.05} />
          <Laptop position={[2.4, 1.05, -3.0]} rotation={[0, 0, 0]} />
        </BayShell>
      </BayGroup>
      <CameraSpace visible={visible}>
        <group ref={phone}>
          <mesh geometry={phoneGeo.body} material={kit.black} />
          <CanvasPanel width={0.071} height={0.152} pxPerMeter={7000} position={[0, 0, 0.0045]} shading="glow" glowStrength={1} drawKey="phone-profile" draw={(ctx, w, h) => drawProfile(ctx, w, h, false)} animate={profileAnimate} animateEvery={0.05} renderOrder={10} />
        </group>
      </CameraSpace>
    </>
  );
}

// ─── Internal Marketing: across campus ─────────────────────────────────────

const POSTER = { w: 0.84, h: 1.19 };
/** Poster slots on the wall (bay-local x, y); the empty one is for the welcome poster. */
const SLOTS: [number, number][] = [
  [-3.6, 3.3],
  [-2.6, 3.25],
  [-1.6, 3.32],
  [-0.6, 3.28],
  [0.4, 3.3],
  [1.4, 3.26],
  [2.4, 3.31],
  [3.4, 3.28],
  [-3.6, 1.9],
  [-2.6, 1.95],
  [-1.6, 1.9],
  [-0.6, 1.93],
  [0.4, 1.88],
  [2.4, 1.92],
  [3.4, 1.9],
];
const OPEN_SLOT: [number, number] = [1.4, 1.9];

function drawWelcomePoster(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const u = w / 100;
  ctx.fillStyle = PALETTE.cegRed;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(251,246,238,0.35)';
  ctx.lineWidth = u * 0.4;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(w * 0.72, h * 0.3, u * (10 + i * 9), 0, Math.PI * 2);
    ctx.stroke();
  }
  text(ctx, 'NOW JOINING', u * 7, h * 0.52, { family: 'mono', size: u * 4, color: '#fbf6ee', tracking: 0.3 });
  text(ctx, 'You.', u * 6, h * 0.7, { family: 'serif', italic: true, size: u * 30, color: '#fbf6ee' });
  paragraph(ctx, CHAPTER.membership.howToJoin, u * 7, h * 0.8, w - u * 14, u * 5, { family: 'sans', size: u * 3.8, color: 'rgba(251,246,238,0.9)' }, 3);
  text(ctx, 'ACM-CEG · COLLEGE OF ENGINEERING GUINDY', u * 7, h - u * 5, { family: 'mono', size: u * 2.6, color: 'rgba(251,246,238,0.8)', tracking: 0.18 });
}

/** A roll-up banner stand, portrait. */
function drawBanner(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#4f9d95';
  ctx.fillRect(0, 0, w, h);
  const u = w / 100;
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath();
  ctx.arc(w * 0.9, h * 0.34, w * 0.62, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, 'ACM-CEG', u * 8, u * 16, { family: 'mono', weight: 500, size: u * 7, color: '#fbf6ee', tracking: 0.24 });
  const [a, b] = SET_COPY.banner.split('—').map((x) => x.trim());
  paragraph(ctx, a.toUpperCase(), u * 8, h * 0.3, w - u * 16, u * 26, { family: 'sans', weight: 800, size: u * 24, color: '#fbf6ee', stretch: 'condensed' }, 3);
  if (b) paragraph(ctx, b, u * 8, h * 0.62, w - u * 16, u * 12, { family: 'serif', italic: true, size: u * 11, color: '#fbf6ee' }, 3);
  paragraph(ctx, CHAPTER.membership.openTo, u * 8, h * 0.84, w - u * 16, u * 6, { family: 'sans', size: u * 5, color: 'rgba(251,246,238,0.88)' }, 3);
}

export function PosterWallSet({ bay, stop, members }: SetProps) {
  const kit = useKit();
  const clock = useStopClock(stop);
  const frame = useBayFrame(bay);
  const [pinner] = members;
  const banner = useRef<Group>(null);
  const flyer = useRef<Group>(null);
  const flyerVisible = useRef(false);
  const cam = useMemo(() => new Vector3(), []);
  const slotWorld = useMemo(() => frame.world(OPEN_SLOT[0], -5.12, OPEN_SLOT[1]), [frame]);
  const bannerWorld = useMemo(() => frame.world(-2.9, -2.3, 1.4), [frame]);
  const tmp = useMemo(() => new Vector3(), []);
  const pinGeo = useDisposable(
    () =>
      merge(
        [...SLOTS, OPEN_SLOT].map(([x, y]) => place(new CylinderGeometry(0.018, 0.018, 0.02, 10), { position: [x, y + POSTER.h / 2 - 0.05, -5.1], rotation: [Math.PI / 2, 0, 0] })),
      ),
    [],
  );
  const standGeo = useDisposable(
    () => ({
      cassette: merge([place(metricBox(0.98, 0.1, 0.22), { position: [0, 0.05, 0] }), place(metricBox(0.3, 0.02, 0.5), { position: [0, 0.01, 0] })]),
      rail: place(metricBox(0.96, 0.03, 0.03), { position: [0, 2.2, 0.01] }),
      pole: place(new CylinderGeometry(0.01, 0.01, 2.2, 6), { position: [0, 1.1, -0.05] }),
    }),
    [],
  );

  useFrame(({ camera }) => {
    const c = clock.current;
    const u = c.meet;
    camera.getWorldPosition(cam);
    // The roll-up banner rises out of its stand.
    const rise = c.here ? ease(smoothstep(0.18, 0.36, u)) : c.meet >= 1 ? 1 : 0;
    if (banner.current) {
      banner.current.scale.y = Math.max(0.001, rise);
      banner.current.visible = rise > 0.002;
    }
    // The welcome poster flies from in front of you onto the empty slot.
    flyerVisible.current = c.here ? u > 0.42 : c.meet >= 1;
    const f = flyer.current;
    if (f) {
      f.visible = flyerVisible.current;
      if (f.visible) {
        const k = ease(smoothstep(0.42, 0.58, c.here ? u : 1));
        // Start just in front of the camera, end on the wall (bay-local, since the flyer lives in the bay group).
        tmp.set(0, -0.1, -1.1).applyQuaternion(camera.quaternion).add(cam);
        f.parent?.worldToLocal(tmp);
        f.position.set(lerp(tmp.x, OPEN_SLOT[0], k), lerp(tmp.y, OPEN_SLOT[1], k) + Math.sin(k * Math.PI) * 0.4, lerp(tmp.z, -5.1, k));
        f.rotation.set(0, (1 - k) * -0.6, (1 - k) * Math.PI * 1.5);
        f.scale.setScalar(lerp(0.35, 1, k));
      }
    }
    if (!c.here) {
      releaseCues(members);
      return;
    }
    if (pinner) {
      const k = cue(pinner.member.id);
      k.look = Math.max(smoothstep(0.5, 1, c.walk) * 0.5, window01(u, 0.12, 0.44, 0.06), window01(u, 0.62, 0.96, 0.06));
      k.turn = k.look;
      k.point = Math.max(window01(u, 0.24, 0.38, 0.04), window01(u, 0.62, 0.84, 0.05));
      k.pointAt = u < 0.5 ? bannerWorld : slotWorld;
    }
  });

  return (
    <BayGroup bay={bay}>
      <BayShell bay={bay}>
        <mesh position={[0, 2.6, -5.2]} material={kit.cork}>
          <boxGeometry args={[8.6, 3.2, 0.04]} />
        </mesh>
        {SLOTS.map(([x, y], i) => (
          <CanvasPanel
            key={i}
            width={POSTER.w}
            height={POSTER.h}
            pxPerMeter={260}
            position={[x, y, -5.16]}
            rotation={[0, 0, ((i * 7) % 5) * 0.012 - 0.024]}
            drawKey={`im-poster-${i}`}
            glowStrength={1.2}
            draw={(ctx, w, h) => drawPoster(ctx, w, h, EVENTS[i % EVENTS.length], i % EVENTS.length)}
          />
        ))}
        <mesh geometry={pinGeo} material={kit.redLine} />
        {/* Roll-up banner stand: the banner group scales up from the cassette. */}
        <group position={[-2.9, 0, -2.3]} rotation={[0, 0.35, 0]}>
          <mesh geometry={standGeo.cassette} material={kit.steelLight} />
          <group ref={banner} scale={[1, 0.001, 1]}>
            <CanvasPanel width={0.94} height={2.1} pxPerMeter={300} position={[0, 1.15, 0]} shading="glow" glowStrength={0.95} drawKey="im-banner" draw={drawBanner} />
            <mesh geometry={standGeo.rail} material={kit.steelLight} />
            <mesh geometry={standGeo.pole} material={kit.steel} />
          </group>
        </group>
        <group ref={flyer} visible={false}>
          <CanvasPanel width={POSTER.w} height={POSTER.h} pxPerMeter={300} shading="glow" glowStrength={0.95} drawKey="im-welcome" draw={drawWelcomePoster} />
        </group>
        <mesh position={[3.2, 0.45, -3.9]} material={kit.oak}>
          <boxGeometry args={[1.2, 0.9, 0.6]} />
        </mesh>
      </BayShell>
    </BayGroup>
  );
}

// ─── Logistics: everything, on time ────────────────────────────────────────

const CONVEYOR = { z: -1.2, y: 0.72, x0: -4.2, x1: 4.2 };
const CRATES = 7;
const CRATE_LABELS = ['CHAIRS', 'MICS', 'EXT. CORDS', 'PROJECTOR', 'BANNERS', 'WATER', 'LANYARDS'];
const TICK_AT = (i: number, n: number) => (i === n - 1 ? 0.7 : 0.08 + i * 0.075);

function drawChecklist(ctx: CanvasRenderingContext2D, w: number, h: number, u: number) {
  ctx.fillStyle = '#f5f5f1';
  ctx.fillRect(0, 0, w, h);
  text(ctx, 'EVENT DAY — CHECKLIST', w * 0.06, h * 0.11, { family: 'mono', weight: 500, size: h * 0.055, color: '#1b1b1d', tracking: 0.2 });
  const items = SET_COPY.checklist;
  items.forEach((item, i) => {
    const y = h * (0.24 + i * 0.105);
    const done = u > TICK_AT(i, items.length);
    const last = i === items.length - 1;
    ctx.strokeStyle = '#1b1b1d';
    ctx.lineWidth = h * 0.005;
    ctx.strokeRect(w * 0.06, y - h * 0.045, h * 0.055, h * 0.055);
    if (done) {
      ctx.strokeStyle = last ? '#1f6f3f' : '#1f3f8f';
      ctx.lineWidth = h * 0.012;
      ctx.beginPath();
      ctx.moveTo(w * 0.06 + h * 0.01, y - h * 0.02);
      ctx.lineTo(w * 0.06 + h * 0.025, y);
      ctx.lineTo(w * 0.06 + h * 0.07, y - h * 0.07);
      ctx.stroke();
    }
    text(ctx, item, w * 0.06 + h * 0.1, y, { family: 'serif', italic: true, size: h * 0.058, color: done ? (last ? '#1f6f3f' : '#55555c') : '#1b1b1d' });
    if (done && !last) {
      ctx.fillStyle = 'rgba(27,27,29,0.5)';
      ctx.fillRect(w * 0.06 + h * 0.1, y - h * 0.018, w * 0.4, h * 0.004);
    }
  });
  if (u > TICK_AT(items.length - 1, items.length)) {
    ctx.save();
    ctx.translate(w * 0.78, h * 0.78);
    ctx.rotate(-0.2);
    ctx.strokeStyle = '#1f6f3f';
    ctx.lineWidth = h * 0.012;
    ctx.strokeRect(-w * 0.16, -h * 0.07, w * 0.32, h * 0.14);
    text(ctx, 'ALL SET', 0, h * 0.03, { family: 'sans', weight: 800, size: h * 0.08, color: '#1f6f3f', align: 'center', tracking: 0.1 });
    ctx.restore();
  }
}

export function WarehouseSet({ bay, stop, members }: SetProps) {
  const kit = useKit();
  const clock = useStopClock(stop);
  const [checker] = members;
  const crates = useRef<(Mesh | null)[]>([]);
  const scan = useRef<Mesh>(null);
  const scanVisible = useRef(false);
  const crateMat = useDisposable(() => new MeshStandardMaterial({ color: '#8c6a45', roughness: 0.85 }), []);
  const laserMat = useDisposable(() => new MeshBasicMaterial({ color: new Color('#ff2a2a').multiplyScalar(1.6), transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false, toneMapped: false }), []);
  const geo = useDisposable(
    () => ({
      frame: merge([
        place(metricBox(CONVEYOR.x1 - CONVEYOR.x0, 0.06, 0.08), { position: [0, CONVEYOR.y - 0.05, CONVEYOR.z - 0.34] }),
        place(metricBox(CONVEYOR.x1 - CONVEYOR.x0, 0.06, 0.08), { position: [0, CONVEYOR.y - 0.05, CONVEYOR.z + 0.34] }),
        ...[-3.8, -1.3, 1.3, 3.8].flatMap((x) => [
          place(metricBox(0.05, CONVEYOR.y - 0.05, 0.05), { position: [x, (CONVEYOR.y - 0.05) / 2, CONVEYOR.z - 0.32] }),
          place(metricBox(0.05, CONVEYOR.y - 0.05, 0.05), { position: [x, (CONVEYOR.y - 0.05) / 2, CONVEYOR.z + 0.32] }),
        ]),
      ]),
      rollers: merge(
        Array.from({ length: 42 }, (_, i) => place(new CylinderGeometry(0.03, 0.03, 0.64, 10), { position: [CONVEYOR.x0 + 0.1 + i * 0.2, CONVEYOR.y - 0.03, CONVEYOR.z], rotation: [Math.PI / 2, 0, 0] })),
      ),
      tunnels: merge([
        place(metricBox(0.9, 0.75, 0.9), { position: [CONVEYOR.x0 - 0.1, CONVEYOR.y + 0.3, CONVEYOR.z] }),
        place(metricBox(0.9, 0.75, 0.9), { position: [CONVEYOR.x1 + 0.1, CONVEYOR.y + 0.3, CONVEYOR.z] }),
      ]),
      crate: metricBox(0.55, 0.4, 0.45),
      shelves: merge(
        [-2.7, 0.5].flatMap((cx) => [
          ...[0.05, 0.85, 1.65, 2.45].map((y) => place(metricBox(3, 0.04, 0.8), { position: [cx, y + 0.02, -4.6] })),
          ...[-1.5, 1.5].flatMap((dx) => [place(metricBox(0.05, 3.1, 0.05), { position: [cx + dx, 1.55, -4.22] }), place(metricBox(0.05, 3.1, 0.05), { position: [cx + dx, 1.55, -4.98] })]),
        ]),
      ),
      boxes: merge(
        [-2.7, 0.5].flatMap((cx, r) =>
          [0.07, 0.87, 1.67].flatMap((y, l) =>
            [0, 1, 2, 3].map((k) => {
              const w = 0.5 + ((k + l + r) % 3) * 0.1;
              const h = 0.35 + ((k * 3 + l) % 3) * 0.1;
              return place(metricBox(w, h, 0.6), { position: [cx - 1.1 + k * 0.72, y + 0.04 + h / 2, -4.6] });
            }),
          ),
        ),
      ),
    }),
    [],
  );

  useFrame(() => {
    const c = clock.current;
    const u = c.here ? c.meet : c.meet >= 1 ? 1 : 0;
    // Crates ride the belt with your scroll (and keep creeping while you're here).
    const span = CONVEYOR.x1 - CONVEYOR.x0 + 0.4;
    crates.current.forEach((m, i) => {
      if (!m) return;
      const s = (i / CRATES) * span + u * 7;
      m.position.set(CONVEYOR.x0 - 0.2 + (s % span), CONVEYOR.y + 0.2, CONVEYOR.z);
    });
    // The scanner line sweeps down your view.
    scanVisible.current = c.here && u > 0.6 && u < 0.7;
    const l = scan.current;
    if (l && scanVisible.current) {
      const k = (u - 0.6) / 0.1;
      l.position.set(0, 0.2 - 0.4 * k, -0.5);
      laserMat.opacity = 0.85 * Math.sin(Math.PI * k);
    }
    if (!c.here) {
      releaseCues(members);
      return;
    }
    if (checker) {
      const k = cue(checker.member.id);
      k.look = Math.max(smoothstep(0.5, 1, c.walk) * 0.4, window01(u, 0.14, 0.34, 0.05), window01(u, 0.56, 0.98, 0.06));
      k.turn = window01(u, 0.54, 0.98, 0.06);
      k.extend = window01(u, 0.58, 0.72, 0.04);
      k.wave = window01(u, 0.8, 0.9, 0.03);
    }
  });

  return (
    <>
      <BayGroup bay={bay}>
        <BayShell bay={bay}>
          <mesh geometry={geo.frame} material={kit.steel} />
          <mesh geometry={geo.rollers} material={kit.steelLight} />
          <mesh geometry={geo.tunnels} material={kit.black} />
          <mesh geometry={geo.shelves} material={kit.steel} />
          <mesh geometry={geo.boxes} material={crateMat} />
          {Array.from({ length: CRATES }, (_, i) => (
            <mesh
              key={i}
              ref={(m) => {
                crates.current[i] = m;
              }}
              geometry={geo.crate}
              material={crateMat}
            >
              <CanvasPanel width={0.46} height={0.16} pxPerMeter={320} position={[0, 0.05, 0.226]} drawKey={`crate-${i}`} glowStrength={1.2} draw={(ctx, w, h) => drawCrateLabel(ctx, w, h, CRATE_LABELS[i % CRATE_LABELS.length])} />
            </mesh>
          ))}
          <mesh position={[3.35, 2.05, -5.14]} material={kit.steel}>
            <boxGeometry args={[1.9, 2.5, 0.05]} />
          </mesh>
          <CanvasPanel
            width={1.8}
            height={2.4}
            pxPerMeter={220}
            position={[3.35, 2.05, -5.1]}
            drawKey="checklist"
            glowStrength={1.6}
            draw={(ctx, w, h) => drawChecklist(ctx, w, h, 0)}
            animate={(() => {
              let last = '';
              return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
                const k = clock.current;
                const u = k.here ? k.meet : k.meet >= 1 ? 1 : 0;
                const key = SET_COPY.checklist.map((_, i) => (u > TICK_AT(i, SET_COPY.checklist.length) ? 1 : 0)).join('');
                if (key === last) return false;
                last = key;
                drawChecklist(ctx, w, h, u);
                return true;
              };
            })()}
            animateEvery={0.06}
          />
        </BayShell>
      </BayGroup>
      <CameraSpace visible={scanVisible}>
        <mesh ref={scan} material={laserMat} renderOrder={10}>
          <planeGeometry args={[1.4, 0.004]} />
        </mesh>
      </CameraSpace>
    </>
  );
}

function drawCrateLabel(ctx: CanvasRenderingContext2D, w: number, h: number, label: string) {
  ctx.fillStyle = '#e9e2d2';
  ctx.fillRect(0, 0, w, h);
  text(ctx, label, w * 0.06, h * 0.66, { family: 'sans', weight: 800, size: h * 0.46, color: '#1b1b1d', stretch: 'expanded' });
  ctx.fillStyle = '#b5452f';
  ctx.fillRect(w * 0.84, h * 0.2, w * 0.1, h * 0.6);
}
