'use client';
/**
 * Sets for the domains that make things.
 *
 *  - CP Wing, "the grind": a whiteboard full of formulas, and two directors
 *    watching Striver explain binary search on a laptop at 2× — the camera
 *    leans in over their shoulders to watch along.
 *  - Web & App, "the terminal wall": fifteen screens of builds, diffs, app
 *    previews and deploys. The dev spins round, hits enter, and the whole wall
 *    ripples into one picture — a live map of the build you're walking through.
 *  - VDM, "the studio": a white cyclorama and softboxes. The photographer
 *    swings the camera round — flash — and your photo lands on the design
 *    display, laid into a poster.
 *  - Content, "the newsroom": the editor looks up, and the front page of
 *    today's Stack'D spins into your hands.
 *
 * Everything is a pure function of the stop's scroll clock, so it scrubs.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { BufferAttribute, BufferGeometry, CylinderGeometry, DoubleSide, type Group, type MeshBasicMaterial, MeshStandardMaterial } from 'three';
import { PALETTE } from '@/config/palette';
import { EYE_HEIGHT, TEAM_ORIGIN } from '@/config/world';
import { CHAPTER } from '@/content/chapter';
import { EVENTS } from '@/content/events';
import { SET_COPY } from '@/content/meetings';
import { NEWSLETTER } from '@/content/newsletter';
import { fx } from '@/systems/camera/effects';
import { lerpAngle, smoothstep } from '@/systems/camera/pose';
import { focusOn, releaseFocus, window01 } from '@/systems/characters/cues';
import { merge, metricBox, place } from '@/systems/geometry/build';
import { useDisposable } from '@/systems/performance/useDisposable';
import { paragraph, text } from '@/systems/textures/typeset';
import { CanvasPanel } from '../../shared/CanvasPanel';
import { Chair, Desk, Monitor } from '../../shared/props';
import { useKit } from '../../underground/kit';
import { BayGroup, BayShell, BONE, CameraSpace, cue, releaseCues, type SetProps, useBayFrame, useStopClock } from './shared';
import { drawBrowser, drawCode, drawDeploy, drawGitGraph, drawLighthouse, drawPhoneApp, drawStandings, drawTerminal, drawVideo, drawWhiteboard } from './screens';

const role = (members: SetProps['members'], r: string) => members.filter((m) => m.role === r);
/** Eased window for camera moves. */
const ease = (x: number) => smoothstep(0, 1, x);

// ─── CP Wing: the grind ─────────────────────────────────────────────────────

const LAPTOP = { x: 1.25, z: -1.95, w: 0.52, d: 0.36, lidH: 0.34, tilt: -0.24 };

export function GrindSet({ bay, stop, members }: SetProps) {
  const kit = useKit();
  const clock = useStopClock(stop);
  const frame = useBayFrame(bay);
  const [writer] = role(members, 'board');
  const watchers = role(members, 'watch');
  const pts = useMemo(() => {
    const hingeZ = LAPTOP.z - LAPTOP.d / 2 + 0.01;
    const sy = 0.74 + 0.022 + Math.cos(LAPTOP.tilt) * LAPTOP.lidH * 0.5;
    const sz = hingeZ + Math.sin(LAPTOP.tilt) * LAPTOP.lidH * 0.5;
    return {
      board: frame.world(-1.9, -5.1, 2.4),
      screen: frame.world(LAPTOP.x, sz, sy),
      eye: frame.world(1.1, 0.02, 1.42),
    };
  }, [frame]);
  const geo = useDisposable(
    () => ({
      boardFrame: merge([
        place(metricBox(7.84, 0.05, 0.05), { position: [-0.6, 3.745, -5.15] }),
        place(metricBox(7.84, 0.05, 0.05), { position: [-0.6, 0.955, -5.15] }),
        place(metricBox(0.05, 2.84, 0.05), { position: [-4.5, 2.35, -5.15] }),
        place(metricBox(0.05, 2.84, 0.05), { position: [3.3, 2.35, -5.15] }),
        place(metricBox(7.6, 0.03, 0.12), { position: [-0.6, 0.93, -5.08] }),
      ]),
      markers: merge(
        [0, 1, 2, 3].map((i) => place(new CylinderGeometry(0.012, 0.012, 0.13, 8), { position: [0.6 + i * 0.06, 0.962, -5.06], rotation: [0, 0, Math.PI / 2 + i * 0.05] })),
      ),
      laptopBase: place(metricBox(LAPTOP.w, 0.022, LAPTOP.d), { position: [0, 0.011, 0] }),
      keys: place(metricBox(LAPTOP.w * 0.86, 0.004, LAPTOP.d * 0.42), { position: [0, 0.024, -0.04] }),
      lid: place(metricBox(LAPTOP.w, LAPTOP.lidH, 0.012), { position: [0, LAPTOP.lidH / 2, 0] }),
      cups: merge([
        place(new CylinderGeometry(0.045, 0.038, 0.1, 14), { position: [0.2, 0.79, -1.5] }),
        place(new CylinderGeometry(0.045, 0.038, 0.1, 14), { position: [2.35, 0.79, -1.45] }),
      ]),
      cans: merge([
        place(new CylinderGeometry(0.033, 0.033, 0.122, 12), { position: [0.42, 0.801, -1.52] }),
        place(new CylinderGeometry(0.033, 0.033, 0.122, 12), { position: [0.5, 0.801, -1.42] }),
        place(new CylinderGeometry(0.033, 0.033, 0.122, 12), { position: [2.58, 0.801, -1.62] }),
      ]),
      papers: merge([
        place(metricBox(0.21, 0.004, 0.297), { position: [0.05, 0.742, -1.75], rotation: [0, 0.3, 0] }),
        place(metricBox(0.21, 0.004, 0.297), { position: [2.1, 0.742, -1.8], rotation: [0, -0.2, 0] }),
      ]),
    }),
    [],
  );

  useFrame(() => {
    const c = clock.current;
    if (!c.here) {
      releaseCues(members);
      releaseFocus(stop);
      return;
    }
    const u = c.meet;
    const pre = smoothstep(0.55, 1, c.walk);
    if (writer) {
      const k = cue(writer.member.id);
      k.turn = window01(u, 0.06, 0.5, 0.1);
      k.look = Math.max(pre * 0.55, k.turn);
      k.point = window01(u, 0.17, 0.42, 0.06);
      k.pointAt = pts.board;
    }
    watchers.forEach((m, i) => {
      const k = cue(m.member.id);
      if (i === 0) {
        // Glances back over a shoulder at you, then points at the lecture.
        k.look = window01(u, 0.55, 0.7, 0.06);
        k.point = window01(u, 0.66, 0.88, 0.05);
        k.pointAt = pts.screen;
      } else {
        k.look = window01(u, 0.2, 0.46, 0.08) * 0.9;
        k.wave = window01(u, 0.26, 0.4, 0.03);
      }
    });
    // Lean in over their shoulders: the lecture is readable.
    focusOn(stop, pts.screen, ease(window01(u, 0.4, 0.98, 0.17)), 27, pts.eye);
  });

  return (
    <BayGroup bay={bay}>
      <BayShell bay={bay}>
        <CanvasPanel width={7.7} height={2.75} pxPerMeter={210} position={[-0.6, 2.35, -5.16]} drawKey="cp-board" draw={drawWhiteboard} glowStrength={1.9} />
        <mesh geometry={geo.boardFrame} material={kit.steelLight} />
        <mesh geometry={geo.markers} material={kit.black} />
        <Desk position={[1.25, 0, -1.8]} width={2.8} depth={0.95} />
        <group position={[LAPTOP.x, 0.74, LAPTOP.z]}>
          <mesh geometry={geo.laptopBase} material={kit.steelLight} />
          <mesh geometry={geo.keys} material={kit.black} />
          <group position={[0, 0.022, -LAPTOP.d / 2 + 0.01]} rotation={[LAPTOP.tilt, 0, 0]}>
            <mesh geometry={geo.lid} material={kit.black} />
            <CanvasPanel
              width={LAPTOP.w - 0.03}
              height={LAPTOP.lidH - 0.035}
              pxPerMeter={1300}
              position={[0, LAPTOP.lidH / 2 + 0.004, 0.0075]}
              shading="glow"
              glowStrength={1}
              drawKey="cp-video"
              draw={(ctx, w, h) => drawVideo(ctx, w, h, 0)}
              animate={(ctx, w, h, t) => {
                if (!clock.current.near) return false;
                drawVideo(ctx, w, h, t);
                return true;
              }}
              animateEvery={0.1}
            />
          </group>
        </group>
        <Monitor
          position={[2.45, 0.74, -2.05]}
          rotation={[0, -0.35, 0]}
          width={0.62}
          height={0.36}
          drawKey="cp-standings"
          draw={(ctx, w, h) => drawStandings(ctx, w, h, 0)}
          animate={(ctx, w, h, t) => {
            if (!clock.current.near) return false;
            drawStandings(ctx, w, h, t);
            return true;
          }}
        />
        <mesh geometry={geo.cups} material={kit.paper} />
        <mesh geometry={geo.cans} material={kit.redLine} />
        <mesh geometry={geo.papers} material={kit.paper} />
        {watchers.map((m, i) => (
          <Chair key={m.member.id} position={[0.65 + i * 1.3, 0, -0.55]} rotation={[0, Math.PI, 0]} />
        ))}
        <CanvasPanel width={0.62} height={0.62} pxPerMeter={320} position={[3.95, 3.35, -5.16]} shading="glow" transparent drawKey="cp-clock" draw={drawClock} />
        <CanvasPanel width={1.3} height={0.9} pxPerMeter={260} position={[3.95, 1.9, -5.17]} drawKey="cp-upsolve" glowStrength={1.5} draw={drawUpsolve} />
      </BayShell>
    </BayGroup>
  );
}

function drawClock(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#f2efe8';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w * 0.48, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1b1b1d';
  ctx.lineWidth = w * 0.02;
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.fillStyle = '#1b1b1d';
    ctx.fillRect(w / 2 + Math.sin(a) * w * 0.4 - w * 0.01, h / 2 - Math.cos(a) * h * 0.4 - h * 0.01, w * 0.02, h * 0.02);
  }
  const hand = (a: number, len: number, width: number) => {
    ctx.strokeStyle = '#1b1b1d';
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w / 2, h / 2);
    ctx.lineTo(w / 2 + Math.sin(a) * len, h / 2 - Math.cos(a) * len);
    ctx.stroke();
  };
  // 2:47, and it's AM.
  hand(((2 + 47 / 60) / 12) * Math.PI * 2, w * 0.22, w * 0.035);
  hand((47 / 60) * Math.PI * 2, w * 0.34, w * 0.022);
  text(ctx, 'AM', w / 2, h * 0.72, { family: 'mono', size: h * 0.08, color: '#b5452f', align: 'center', tracking: 0.2 });
}

function drawUpsolve(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#f3ecd0';
  ctx.fillRect(0, 0, w, h);
  text(ctx, 'UPSOLVE LIST', w * 0.07, h * 0.18, { family: 'mono', weight: 500, size: h * 0.1, color: '#1b1b1d', tracking: 0.18 });
  ['two pointers ✓', 'prefix sums ✓', 'binary search on answer', 'segment tree (lazy)', 'DP on trees'].forEach((l, i) => {
    text(ctx, l, w * 0.07, h * (0.36 + i * 0.13), { family: 'serif', italic: true, size: h * 0.1, color: l.endsWith('✓') ? '#1f6f3f' : '#1f3f8f' });
  });
}

// ─── Web & App: the terminal wall ───────────────────────────────────────────

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void;
const WALL_SCREENS: Draw[] = [
  (c, w, h, t) => drawCode(c, w, h, t, true),
  (c, w, h, t) => drawTerminal(c, w, h, t, 'build'),
  drawGitGraph,
  drawLighthouse,
  drawDeploy,
  (c, w, h) => drawBrowser(c, w, h),
  drawPhoneApp,
  (c, w, h, t) => drawTerminal(c, w, h, t + 3, 'push'),
  (c, w, h, t) => drawCode(c, w, h, t + 5, false),
  drawStandings,
];

const WALL = {
  cols: [-2.46, -1.23, 0, 1.23, 2.46],
  rows: [3.0, 2.25, 1.5],
  sw: 1.18,
  sh: 0.72,
  /** Visible panel inside the bezel. */
  pw: 1.12,
  ph: 0.66,
  z: -4.6,
};
/** The whole wall as one picture, in metres (for the video-wall moment). */
const WALL_W = WALL.cols[4] - WALL.cols[0] + WALL.pw;
const WALL_H = WALL.rows[0] - WALL.rows[2] + WALL.ph;

const STAGES = ['Campus', 'The well', 'Events corridor', 'The door', 'The team', 'The core'];

/** One frame of the unified wall picture: the site, deployed, and a map of the build with you on it. */
function drawWallPicture(ctx: CanvasRenderingContext2D, W: number, H: number, t: number) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#0b1426');
  g.addColorStop(1, '#101a14');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Blueprint grid.
  ctx.strokeStyle = 'rgba(91,143,214,0.14)';
  ctx.lineWidth = Math.max(1, H * 0.002);
  const step = H / 12;
  for (let x = (t * step * 0.3) % step; x < W; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  // Left: the site, live.
  text(ctx, '● LIVE', W * 0.035, H * 0.16, { family: 'mono', weight: 500, size: H * 0.055, color: '#0cce6b', tracking: 0.2 });
  text(ctx, 'ACM-CEG', W * 0.03, H * 0.52, { family: 'serif', italic: true, size: H * 0.34, color: BONE });
  text(ctx, 'auceg.acm.org  ·  deployed just now  ·  build passing', W * 0.036, H * 0.66, { family: 'mono', size: H * 0.04, color: 'rgba(239,233,223,0.72)', tracking: 0.06 });
  text(ctx, `Student chapter · College of Engineering Guindy · since ${CHAPTER.established}`, W * 0.036, H * 0.76, { family: 'sans', size: H * 0.045, color: 'rgba(239,233,223,0.6)' });
  // Right: a map of the build, with a "you are here".
  const x0 = W * 0.56;
  const x1 = W * 0.95;
  const y = H * 0.46;
  ctx.strokeStyle = 'rgba(239,233,223,0.4)';
  ctx.lineWidth = H * 0.008;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
  text(ctx, 'THE BUILD YOU’RE WALKING THROUGH', x0, H * 0.18, { family: 'mono', size: H * 0.045, color: 'rgba(239,233,223,0.62)', tracking: 0.16 });
  STAGES.forEach((s, i) => {
    const x = x0 + ((x1 - x0) * i) / (STAGES.length - 1);
    const here = i === 4;
    ctx.fillStyle = here ? PALETTE.acm : i < 4 ? BONE : 'rgba(239,233,223,0.35)';
    ctx.beginPath();
    ctx.arc(x, y, H * (here ? 0.035 : 0.022), 0, Math.PI * 2);
    ctx.fill();
    if (here) {
      const f = (t * 0.9) % 1;
      ctx.strokeStyle = `rgba(91,143,214,${1 - f})`;
      ctx.lineWidth = H * 0.008;
      ctx.beginPath();
      ctx.arc(x, y, H * (0.05 + f * 0.09), 0, Math.PI * 2);
      ctx.stroke();
      text(ctx, 'YOU ARE HERE', x, y - H * 0.11, { family: 'mono', weight: 500, size: H * 0.045, color: '#8fb6ff', align: 'center', tracking: 0.14 });
    }
    text(ctx, s, x, y + H * (i % 2 ? 0.17 : 0.1), { family: 'sans', weight: 600, size: H * 0.045, color: here ? '#8fb6ff' : 'rgba(239,233,223,0.8)', align: 'center' });
  });
  // A scan line sweeping the wall.
  const sx = ((t * 0.35) % 1.3) * W - W * 0.15;
  const sg = ctx.createLinearGradient(sx - W * 0.08, 0, sx, 0);
  sg.addColorStop(0, 'rgba(143,182,255,0)');
  sg.addColorStop(1, 'rgba(143,182,255,0.16)');
  ctx.fillStyle = sg;
  ctx.fillRect(sx - W * 0.08, 0, W * 0.08, H);
}

/** When (0..1 through the meeting) each screen joins the wall — a ripple out from the centre. */
const joinAt = (c: number, r: number) => 0.5 + Math.abs(c - 2) * 0.03 + Math.abs(r - 1) * 0.015;

export function TerminalWallSet({ bay, stop, members }: SetProps) {
  const kit = useKit();
  const clock = useStopClock(stop);
  const frame = useBayFrame(bay);
  const chair = useRef<Group>(null);
  const [dev, ...others] = members;
  const pts = useMemo(
    () => ({
      wall: frame.world(0, WALL.z, 2.25),
      eye: frame.world(0.15, 2.3, EYE_HEIGHT + 0.05),
    }),
    [frame],
  );
  const screens = useMemo(
    () =>
      WALL.rows.flatMap((y, r) =>
        WALL.cols.map((x, c) => ({
          key: `${r}-${c}`,
          r,
          c,
          position: [x, y, WALL.z + Math.abs(x) * 0.12] as [number, number, number],
          rotation: [0, -x * 0.075, 0] as [number, number, number],
          draw: WALL_SCREENS[(r * 5 + c * 3) % WALL_SCREENS.length],
          phase: r * 1.7 + c * 0.9,
          // Where this tile sits in the whole-wall picture (metres from its top-left).
          left: x - WALL.pw / 2 - (WALL.cols[0] - WALL.pw / 2),
          top: WALL.rows[0] + WALL.ph / 2 - (y + WALL.ph / 2),
        })),
      ),
    [],
  );
  const frameGeo = useDisposable(
    () =>
      merge([
        // A dark mount behind the screens, and two floor legs at the ends.
        ...WALL.cols.map((x) => place(metricBox(WALL.sw + 0.08, 2.46, 0.04), { position: [x, 2.25, WALL.z - 0.07 + Math.abs(x) * 0.12], rotation: [0, -x * 0.075, 0] })),
        ...[-1, 1].map((sx) => place(metricBox(0.08, 3.6, 0.08), { position: [sx * (WALL.cols[4] + WALL.sw / 2 + 0.1), 1.8, WALL.z + 0.2] })),
      ]),
    [],
  );

  useFrame(() => {
    const c = clock.current;
    const u = c.meet;
    // Spin round to say hi, back to the keyboard to hit enter, round again to show you.
    const turn = c.here ? Math.max(window01(u, 0.14, 0.44, 0.1), window01(u, 0.54, 0.99, 0.08)) : 0;
    if (chair.current) chair.current.rotation.y = lerpAngle(Math.PI, 0.1, turn);
    if (!c.here) {
      releaseCues(members);
      releaseFocus(stop);
      return;
    }
    if (dev) {
      const k = cue(dev.member.id);
      k.turn = turn;
      k.look = turn;
      k.point = window01(u, 0.6, 0.84, 0.05);
      k.pointAt = pts.wall;
    }
    others.forEach((m, i) => {
      const k = cue(m.member.id);
      k.look = window01(u, 0.3 + i * 0.05, 0.8, 0.08) * 0.8;
    });
    // Step in to take the whole wall in.
    focusOn(stop, pts.wall, ease(window01(u, 0.46, 0.98, 0.16)), 4, pts.eye);
  });

  return (
    <BayGroup bay={bay}>
      <BayShell bay={bay}>
        <mesh geometry={frameGeo} material={kit.steel} />
        {screens.map((s) => (
          <group key={s.key} position={s.position} rotation={s.rotation}>
            <mesh material={kit.black}>
              <boxGeometry args={[WALL.sw, WALL.sh, 0.05]} />
            </mesh>
            <CanvasPanel
              width={WALL.pw}
              height={WALL.ph}
              pxPerMeter={430}
              position={[0, 0, 0.03]}
              shading="glow"
              glowStrength={0.95}
              drawKey={`web-${s.key}`}
              draw={(ctx, w, h) => s.draw(ctx, w, h, s.phase)}
              animate={(ctx, w, h, t) => {
                const k = clock.current;
                if (!k.near) return false;
                const at = joinAt(s.c, s.r);
                if (k.meet <= at) {
                  s.draw(ctx, w, h, t + s.phase);
                  return true;
                }
                const pxm = w / WALL.pw;
                ctx.save();
                ctx.translate(-s.left * pxm, -s.top * pxm);
                drawWallPicture(ctx, WALL_W * pxm, WALL_H * pxm, t);
                ctx.restore();
                // A bright seam for the first instant a tile flips.
                const since = k.meet - at;
                if (since < 0.025) {
                  ctx.fillStyle = `rgba(210,228,255,${0.7 * (1 - since / 0.025)})`;
                  ctx.fillRect(0, 0, w, h);
                }
                return true;
              }}
              animateEvery={0.12}
            />
          </group>
        ))}
        <Desk position={[0.9, 0, -3.15]} width={3.6} depth={0.8} />
        <Monitor position={[-0.55, 0.74, -3.3]} rotation={[0, 0.12, 0]} drawKey="web-m1" draw={(ctx, w, h) => drawCode(ctx, w, h, 2, true)} />
        <Monitor position={[0.2, 0.74, -3.35]} rotation={[0, -0.1, 0]} drawKey="web-m2" draw={(ctx, w, h) => drawPhoneApp(ctx, w, h, 1)} />
        <Monitor position={[2.2, 0.74, -3.3]} drawKey="web-m3" draw={(ctx, w, h) => drawTerminal(ctx, w, h, 9, 'build')} />
        <group ref={chair} position={[-0.4, 0, -2.3]} rotation={[0, Math.PI, 0]}>
          <Chair />
        </group>
        {others.map((m, i) => (
          <Chair key={m.member.id} position={[2.2 + i * 1.3, 0, -2.3]} rotation={[0, Math.PI, 0]} />
        ))}
      </BayShell>
    </BayGroup>
  );
}

// ─── VDM: the studio ─────────────────────────────────────────────────────────

/** A cyclorama: floor, cove and wall as one continuous sweep. */
function coveGeometry(width: number, r: number, floorD: number, wallH: number, seg = 14) {
  // Profile in (z, y): floor from +floorD to 0, a quarter arc to (−r, r), wall up to wallH.
  const prof: [number, number, number, number][] = [[floorD, 0, 1, 0]];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * (Math.PI / 2);
    prof.push([-r * Math.sin(a), r - r * Math.cos(a), Math.cos(a), Math.sin(a)]);
  }
  prof.push([-r, wallH, 0, 1]);
  const pos: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  for (const [z, y, ny, nz] of prof) {
    for (const x of [-width / 2, width / 2]) {
      pos.push(x, y, z);
      nrm.push(0, ny, nz);
    }
  }
  for (let i = 0; i < prof.length - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(nrm), 3));
  g.setIndex(idx);
  return g;
}

function drawDesignDisplay(ctx: CanvasRenderingContext2D, w: number, h: number, photo: boolean) {
  ctx.fillStyle = '#1b1c20';
  ctx.fillRect(0, 0, w, h);
  // App chrome: layers on the left, swatches on the right.
  ctx.fillStyle = '#26272c';
  ctx.fillRect(0, 0, w * 0.14, h);
  ctx.fillRect(w * 0.86, 0, w * 0.14, h);
  ctx.fillRect(0, 0, w, h * 0.05);
  ['Layers', photo ? '▸ visitor.jpg' : 'Frame 1', 'Poster', 'Type', 'Palette'].forEach((l, i) =>
    text(ctx, l, w * 0.015, h * (0.11 + i * 0.06), { family: 'sans', size: h * 0.028, color: i === 1 && photo ? '#8fb6ff' : 'rgba(239,233,223,0.7)' }),
  );
  [PALETTE.cegRed, PALETTE.acm, '#d4a24c', PALETTE.bone, '#141416'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(w * 0.875, h * (0.1 + i * 0.09), w * 0.04, h * 0.06);
  });
  if (!photo) {
    // Artboards: posters in progress.
    EVENTS.slice(0, 3).forEach((e, i) => {
      const x = w * (0.17 + i * 0.235);
      ctx.fillStyle = e.accent;
      ctx.fillRect(x, h * 0.12, w * 0.2, h * 0.56);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(x, h * 0.48, w * 0.2, h * 0.2);
      text(ctx, e.title, x + w * 0.012, h * 0.6, { family: 'serif', size: h * 0.06, color: BONE });
    });
    text(ctx, 'Aa', w * 0.17, h * 0.9, { family: 'serif', size: h * 0.18, color: BONE });
    text(ctx, 'Instrument Serif · Archivo · Plex Mono', w * 0.3, h * 0.86, { family: 'mono', size: h * 0.03, color: 'rgba(239,233,223,0.6)' });
    return;
  }
  // The shot, dropped into a poster: a silhouette against the sweep.
  const px = w * 0.3;
  const pw = w * 0.4;
  ctx.fillStyle = PALETTE.cegRed;
  ctx.fillRect(px, h * 0.08, pw, h * 0.86);
  const g = ctx.createRadialGradient(w * 0.5, h * 0.4, h * 0.02, w * 0.5, h * 0.4, h * 0.42);
  g.addColorStop(0, '#fbf7f0');
  g.addColorStop(1, '#d9d2c6');
  ctx.fillStyle = g;
  ctx.fillRect(px + w * 0.02, h * 0.12, pw - w * 0.04, h * 0.56);
  ctx.fillStyle = '#2a2b31';
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.36, w * 0.045, h * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.4, h * 0.68);
  ctx.quadraticCurveTo(w * 0.41, h * 0.48, w * 0.5, h * 0.47);
  ctx.quadraticCurveTo(w * 0.59, h * 0.48, w * 0.6, h * 0.68);
  ctx.fill();
  text(ctx, 'NEW FACE', w * 0.5, h * 0.77, { family: 'mono', weight: 500, size: h * 0.035, color: '#fbf6ee', align: 'center', tracking: 0.3 });
  text(ctx, 'Welcome to ACM-CEG', w * 0.5, h * 0.86, { family: 'serif', italic: true, size: h * 0.06, color: '#fbf6ee', align: 'center' });
  // Selection handles, as if it were just placed.
  ctx.strokeStyle = '#8fb6ff';
  ctx.lineWidth = h * 0.004;
  ctx.strokeRect(px + w * 0.02, h * 0.12, pw - w * 0.04, h * 0.56);
  for (const [x, y] of [
    [px + w * 0.02, h * 0.12],
    [px + pw - w * 0.02, h * 0.12],
    [px + w * 0.02, h * 0.68],
    [px + pw - w * 0.02, h * 0.68],
  ]) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - h * 0.01, y - h * 0.01, h * 0.02, h * 0.02);
  }
}

function drawSketchTablet(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#2b2b2f';
  ctx.lineWidth = h * 0.01;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    ctx.moveTo(w * 0.1, h * (0.2 + i * 0.14));
    ctx.bezierCurveTo(w * 0.3, h * (0.1 + i * 0.15), w * 0.6, h * (0.35 + i * 0.1), w * 0.9, h * (0.2 + i * 0.13));
  }
  ctx.stroke();
  ctx.fillStyle = PALETTE.cegRed;
  ctx.beginPath();
  ctx.arc(w * 0.72, h * 0.3, h * 0.12, 0, Math.PI * 2);
  ctx.fill();
}

export function StudioSet({ bay, stop, members }: SetProps) {
  const kit = useKit();
  const clock = useStopClock(stop);
  const frame = useBayFrame(bay);
  const [photographer] = role(members, 'photographer');
  const [designer] = role(members, 'designer');
  const tripod = useRef<Group>(null);
  const softboxes = useRef<(MeshBasicMaterial | null)[]>([]);
  const pts = useMemo(
    () => ({
      display: frame.world(-2.6, -5.1, 2.25),
      eye: frame.world(-2.5, 0.2, EYE_HEIGHT - 0.04),
    }),
    [frame],
  );
  const sweepMat = useDisposable(() => new MeshStandardMaterial({ color: '#efebe4', roughness: 0.95, side: DoubleSide }), []);
  const geo = useDisposable(
    () => ({
      sweep: place(coveGeometry(4.6, 1.1, 2.6, 3.6), { position: [2.4, 0.01, -4.05] }),
      legs: merge(
        [0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2;
          return place(metricBox(0.025, 1.4, 0.025), { position: [Math.sin(a) * 0.22, 0.68, Math.cos(a) * 0.22], rotation: [Math.cos(a) * 0.17, 0, -Math.sin(a) * 0.17] });
        }),
      ),
      body: merge([
        place(metricBox(0.15, 0.11, 0.09), { position: [0, 1.46, 0] }),
        place(metricBox(0.05, 0.04, 0.05), { position: [0.04, 1.535, -0.01] }),
        place(new CylinderGeometry(0.038, 0.042, 0.13, 18), { position: [0, 1.455, 0.1], rotation: [Math.PI / 2, 0, 0] }),
      ]),
      pole: place(new CylinderGeometry(0.018, 0.024, 2.05, 8), { position: [0, 1.02, 0] }),
      box: place(metricBox(0.8, 0.8, 0.32), { position: [0, 2.05, 0] }),
      face: place(metricBox(0.74, 0.74, 0.005), { position: [0, 2.05, 0.165] }),
      stool: merge([place(new CylinderGeometry(0.2, 0.2, 0.04, 20), { position: [0, 0.66, 0] }), place(new CylinderGeometry(0.02, 0.02, 0.64, 8), { position: [0, 0.32, 0] })]),
    }),
    [],
  );
  const displayAnimate = useMemo(() => {
    let last: boolean | null = null;
    return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const k = clock.current;
      const photo = k.meet > 0.42;
      if (photo === last) return false;
      last = photo;
      drawDesignDisplay(ctx, w, h, photo);
      return true;
    };
  }, [clock]);

  useFrame(() => {
    const c = clock.current;
    const u = c.meet;
    // The tripod swings from the stool on the sweep round to you.
    const swing = c.here ? smoothstep(0.1, 0.3, u) * (1 - smoothstep(0.88, 1, u)) : 0;
    if (tripod.current) tripod.current.rotation.y = lerpAngle(Math.PI, 0.35, swing);
    // Flash: a white burst at the shutter; the softboxes spike with it.
    const burst = c.here && u > 0.37 && u < 0.45 ? Math.pow(1 - (u - 0.37) / 0.08, 2) : 0;
    if (c.here || fx.flash > 0) fx.flash = burst * 0.92;
    softboxes.current.forEach((m) => m?.color.setScalar(1.25 + burst * 5));
    if (!c.here) {
      releaseCues(members);
      releaseFocus(stop);
      return;
    }
    if (photographer) {
      const k = cue(photographer.member.id);
      // Round behind the tripod as it swings to face you, and back again at the end.
      const go = smoothstep(0.08, 0.28, u) * (1 - smoothstep(0.86, 0.99, u));
      // A curve round the tripod's legs rather than through them.
      const bx = (1 - go) * (1 - go) * 2.2 + 2 * (1 - go) * go * 3.25 + go * go * 2.35;
      const bz = (1 - go) * (1 - go) * 0.05 + 2 * (1 - go) * go * -0.45 + go * go * -1.2;
      const [hx, hz] = frame.hall(bx, bz);
      k.pos = { x: TEAM_ORIGIN[0] + hx, z: TEAM_ORIGIN[2] + hz };
      k.turn = window01(u, 0.2, 0.9, 0.08);
      k.look = Math.max(smoothstep(0.5, 1, c.walk) * 0.5, window01(u, 0.3, 0.6, 0.05));
      k.wave = window01(u, 0.48, 0.6, 0.03);
    }
    if (designer) {
      const k = cue(designer.member.id);
      k.turn = window01(u, 0.56, 0.97, 0.08);
      k.look = k.turn;
      k.point = window01(u, 0.66, 0.9, 0.06);
      k.pointAt = pts.display;
    }
    // After the flash, step over to the display to see the shot.
    focusOn(stop, pts.display, ease(window01(u, 0.54, 0.98, 0.15)), 8, pts.eye);
  });

  return (
    <BayGroup bay={bay}>
      <BayShell bay={bay}>
        <mesh geometry={geo.sweep} material={sweepMat} />
        <mesh geometry={geo.stool} material={kit.steel} position={[2.4, 0, -3.3]} />
        <group ref={tripod} position={[2.2, 0, -0.55]} rotation={[0, Math.PI, 0]}>
          <mesh geometry={geo.legs} material={kit.black} />
          <mesh geometry={geo.body} material={kit.black} />
        </group>
        {[
          [0.35, -1.6, 0.75],
          [4.5, -1.9, -0.7],
        ].map(([x, z, r], i) => (
          <group key={i} position={[x, 0, z]} rotation={[0, r + Math.PI, 0]}>
            <mesh geometry={geo.pole} material={kit.steel} />
            <mesh geometry={geo.box} material={kit.black} />
            <mesh geometry={geo.face}>
              <meshBasicMaterial
                ref={(m: MeshBasicMaterial | null) => {
                  softboxes.current[i] = m;
                }}
                color={[1.25, 1.25, 1.25]}
                toneMapped={false}
              />
            </mesh>
          </group>
        ))}
        <mesh position={[-2.6, 2.25, -5.18]} material={kit.black}>
          <boxGeometry args={[3.56, 2.12, 0.06]} />
        </mesh>
        <CanvasPanel
          width={3.44}
          height={2.0}
          pxPerMeter={280}
          position={[-2.6, 2.25, -5.14]}
          shading="glow"
          glowStrength={0.95}
          drawKey="vdm-display"
          draw={(ctx, w, h) => drawDesignDisplay(ctx, w, h, false)}
          animate={displayAnimate}
          animateEvery={0.05}
        />
        <Desk position={[-2.6, 0, -3.7]} width={1.8} depth={0.7} />
        <CanvasPanel width={0.5} height={0.34} pxPerMeter={500} position={[-2.9, 0.745, -3.65]} rotation={[-Math.PI / 2, 0, 0.2]} drawKey="vdm-tablet" shading="glow" glowStrength={0.85} draw={drawSketchTablet} />
      </BayShell>
    </BayGroup>
  );
}

// ─── Content: the newsroom ─────────────────────────────────────────────────

function drawFrontPage(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const n = SET_COPY.newspaper;
  ctx.fillStyle = '#efe8d8';
  ctx.fillRect(0, 0, w, h);
  const u = w / 100;
  text(ctx, n.masthead, w / 2, u * 12.5, { family: 'serif', size: u * 12, color: '#151515', align: 'center' });
  ctx.fillStyle = '#151515';
  ctx.fillRect(u * 4, u * 15.5, w - u * 8, u * 0.45);
  text(ctx, n.kicker, w / 2, u * 19, { family: 'mono', size: u * 1.9, color: '#151515', align: 'center', tracking: 0.3 });
  ctx.fillRect(u * 4, u * 20.6, w - u * 8, u * 0.2);
  paragraph(ctx, n.headline.toUpperCase(), u * 4, u * 29, w - u * 8, u * 6.6, { family: 'serif', weight: 700, size: u * 6, color: '#101010' }, 2);
  // Photo: the red building, in halftone greys.
  const py = u * 43;
  ctx.fillStyle = '#4a4541';
  ctx.fillRect(u * 4, py, u * 52, h - py - u * 4);
  ctx.fillStyle = '#7e7771';
  ctx.fillRect(u * 8, h - u * 17, u * 44, u * 9);
  ctx.fillRect(u * 26, h - u * 30, u * 8, u * 13);
  ctx.beginPath();
  ctx.moveTo(u * 26, h - u * 30);
  ctx.quadraticCurveTo(u * 30, h - u * 38, u * 34, h - u * 30);
  ctx.fill();
  text(ctx, 'The red building, this morning.', u * 4, h - u * 1.4, { family: 'serif', italic: true, size: u * 1.8, color: '#444' });
  paragraph(ctx, n.deck, u * 59, u * 46, w - u * 63, u * 3.5, { family: 'serif', italic: true, size: u * 3, color: '#222' }, 5);
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = 'rgba(20,20,20,0.34)';
    ctx.fillRect(u * 59, u * 66 + i * u * 2.5, (w - u * 63) * (i % 4 === 3 ? 0.62 : 1), u * 0.8);
  }
}

function drawCorkBoard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#9c7a52';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(${60 + ((i * 37) % 40)},${40 + ((i * 17) % 30)},20,0.18)`;
    ctx.fillRect((i * 97.3) % w, (i * 53.7) % h, 2, 2);
  }
  const drafts = [`${NEWSLETTER.title} — draft 3`, 'Interview: alumni', 'Event recap', 'Tech explainer', 'Puzzle corner', 'Photo essay', 'Editor’s note', 'Next issue'];
  drafts.forEach((title, i) => {
    const x = w * (0.03 + (i % 4) * 0.245);
    const y = h * (0.06 + Math.floor(i / 4) * 0.48);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(((i % 3) - 1) * 0.03);
    ctx.fillStyle = '#f3efe4';
    ctx.fillRect(0, 0, w * 0.21, h * 0.4);
    text(ctx, title, w * 0.01, h * 0.06, { family: 'mono', size: h * 0.034, color: '#1b1b1d' });
    for (let l = 0; l < 7; l++) {
      ctx.fillStyle = 'rgba(20,20,20,0.3)';
      ctx.fillRect(w * 0.01, h * (0.1 + l * 0.04), w * (0.17 - (l % 3) * 0.03), h * 0.01);
    }
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = h * 0.006;
    ctx.beginPath();
    ctx.ellipse(w * 0.1, h * (0.18 + (i % 2) * 0.08), w * 0.06, h * 0.03, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(w * 0.105, h * 0.015, h * 0.012, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  // Red string between two drafts.
  ctx.strokeStyle = '#c0392b';
  ctx.lineWidth = h * 0.004;
  ctx.beginPath();
  ctx.moveTo(w * 0.135, h * 0.075);
  ctx.quadraticCurveTo(w * 0.3, h * 0.35, w * 0.63, h * 0.555);
  ctx.stroke();
}

export function NewsroomSet({ bay, stop, members }: SetProps) {
  const kit = useKit();
  const clock = useStopClock(stop);
  const paper = useRef<Group>(null);
  const visible = useRef(false);
  const geo = useDisposable(
    () => ({
      stack: merge([0, 1, 2, 3, 4, 5].map((i) => place(metricBox(0.42, 0.012, 0.3), { position: [-0.55, 0.748 + i * 0.012, -1.55], rotation: [0, i * 0.04, 0] }))),
      rack: merge([place(metricBox(2.8, 0.8, 0.5), { position: [-2.5, 0.4, -2.9] }), place(metricBox(2.8, 0.03, 0.62), { position: [-2.5, 0.815, -2.9] })]),
      lamp: merge([
        place(new CylinderGeometry(0.08, 0.1, 0.02, 16), { position: [0.85, 0.75, -1.75] }),
        place(new CylinderGeometry(0.01, 0.01, 0.42, 8), { position: [0.85, 0.96, -1.75], rotation: [0.3, 0, 0] }),
        place(new CylinderGeometry(0.03, 0.09, 0.12, 16, 1, true), { position: [0.85, 1.14, -1.63], rotation: [0.9, 0, 0] }),
      ]),
    }),
    [],
  );

  useFrame(() => {
    const c = clock.current;
    const u = c.meet;
    visible.current = c.here && u > 0.3 && u < 0.93;
    const g = paper.current;
    if (g && visible.current) {
      // Spinning in like a newsreel front page, then lowered away.
      const inn = smoothstep(0.3, 0.52, u);
      const out = smoothstep(0.8, 0.93, u);
      g.position.set(0.05 * (1 - inn), -0.02 - out * 0.9, -7 + (7 - 0.95) * inn);
      g.rotation.set(-out * 1.1, 0, (1 - inn) * Math.PI * 4);
      g.scale.setScalar(0.3 + 0.7 * inn);
    }
    if (!c.here) {
      releaseCues(members);
      return;
    }
    const [editor] = members;
    if (editor) {
      const k = cue(editor.member.id);
      k.look = Math.max(smoothstep(0.6, 1, c.walk) * 0.5, window01(u, 0.14, 0.95, 0.08));
      k.stand = window01(u, 0.18, 0.9, 0.02);
      k.turn = window01(u, 0.2, 0.9, 0.08);
      k.wave = window01(u, 0.22, 0.32, 0.03);
    }
  });

  return (
    <>
      <BayGroup bay={bay}>
        <BayShell bay={bay}>
          <Desk position={[0, 0, -1.55]} width={2.2} />
          <Chair position={[0, 0, -2.35]} />
          <Monitor position={[0.35, 0.74, -1.5]} rotation={[0, Math.PI, 0]} />
          <mesh geometry={geo.stack} material={kit.paper} />
          <mesh geometry={geo.lamp} material={kit.black} />
          <mesh geometry={geo.rack} material={kit.oak} />
          <CanvasPanel width={6} height={2.4} pxPerMeter={180} position={[0, 2.3, -5.16]} drawKey="news-cork" glowStrength={1.4} draw={drawCorkBoard} />
          <CanvasPanel
            width={3.4}
            height={0.8}
            pxPerMeter={200}
            position={[0, 4.0, -5.15]}
            shading="glow"
            transparent
            drawKey="news-mast"
            draw={(ctx, w, h) => text(ctx, NEWSLETTER.title, w / 2, h * 0.78, { family: 'serif', size: h * 0.85, color: BONE, align: 'center' })}
          />
          {NEWSLETTER.issues.map((iss, i) => (
            <CanvasPanel
              key={iss.href}
              width={0.42}
              height={0.56}
              pxPerMeter={320}
              position={[-3.55 + i * 0.52, 0.99, -2.85]}
              rotation={[-0.35, 0, 0]}
              drawKey={`issue-${i}`}
              glowStrength={1.4}
              draw={(ctx, w, h) => {
                ctx.fillStyle = i === 0 ? PALETTE.cegRed : '#ebe4d6';
                ctx.fillRect(0, 0, w, h);
                paragraph(ctx, iss.name, w * 0.08, h * 0.2, w * 0.84, h * 0.13, { family: 'serif', size: h * 0.11, color: i === 0 ? '#fbf6ee' : '#1b1b1d' }, 3);
              }}
            />
          ))}
        </BayShell>
      </BayGroup>
      <CameraSpace visible={visible}>
        <group ref={paper}>
          <CanvasPanel width={0.8} height={0.575} pxPerMeter={1400} shading="glow" glowStrength={1} drawKey="news-front" draw={drawFrontPage} renderOrder={10} />
        </group>
      </CameraSpace>
    </>
  );
}
