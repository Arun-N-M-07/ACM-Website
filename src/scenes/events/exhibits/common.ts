/**
 * Shared machinery for the event exhibits: the room clock (how far through
 * its visit a room is, straight from scroll — so every installation scrubs),
 * and small canvas helpers the wall projections share.
 */
import { useFrame } from '@react-three/fiber';
import { type ComponentType, type MutableRefObject, useRef } from 'react';
import { type PerspectiveCamera, Vector3 } from 'three';
import type { EventRecord } from '@/content/events';
import { PALETTE } from '@/config/palette';
import { CORRIDOR } from '@/config/world';
import { toNdc } from '@/systems/anchors/anchors';
import { fitSize, text } from '@/systems/textures/typeset';
import { readRoomClock, type RoomClock } from './roomClock';

// (The clock and the Prodigy wall's timing live in roomClock.ts — no renderer in them — so the page's
// own code can read them without loading the 3D world.)
export { PUZZLE_PIECES, puzzleOrder, puzzlePiece, puzzleSpan, readRoomClock, type RoomClock } from './roomClock';

export function useRoomClock(index: number) {
  const clock = useRef<RoomClock>({ u: -0.3, here: false, near: false, presence: 0 });
  useFrame(() => {
    readRoomClock(index, clock.current);
  });
  return clock;
}

// ─── Pointer proximity ─────────────────────────────────────────────────────

const pointer = { x: 0, y: 0, live: false };
let listening = false;
const _ndc = new Vector3();

/**
 * How close the (mouse) pointer is to a world point on screen: 1 over it,
 * easing to 0 at `radius` (in screen heights). Touch doesn't hover, so it
 * stays 0 there; nothing depends on it — it only lets an artifact answer.
 */
export function pointerNear(point: Vector3, camera: PerspectiveCamera, radius = 0.16) {
  if (!listening && typeof window !== 'undefined') {
    listening = true;
    window.addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerType === 'touch') return;
        const p = toNdc(e.clientX, e.clientY);
        pointer.x = p.x;
        pointer.y = p.y;
        pointer.live = true;
      },
      { passive: true },
    );
  }
  if (!pointer.live) return 0;
  _ndc.copy(point).project(camera);
  if (_ndc.z > 1) return 0;
  const d = Math.hypot((_ndc.x - pointer.x) * camera.aspect, _ndc.y - pointer.y) / 2;
  return 1 - sstep(d, radius * 0.35, radius);
}

/** Up across [a, b] and back down across [c, d]. */
export const swell = (s: number, a: number, b: number, c: number, d: number) => sstep(s, a, b) * (1 - sstep(s, c, d));

export type Wall = 'back' | 'left' | 'right';

export interface WallInfo {
  ev: EventRecord;
  index: number;
  total: number;
}

/** Draws one wall of a room's projection for visit progress `u` at time `t`. */
export type WallDraw = (ctx: CanvasRenderingContext2D, w: number, h: number, wall: Wall, u: number, t: number, info: WallInfo) => void;

export interface PieceProps {
  event: EventRecord;
  /** The room's place in the corridor. */
  index: number;
  /** Multiplier on the room's light (1 = as the room sets it): an installation can let the room respond. */
  response: MutableRefObject<number>;
  width: number;
  depth: number;
  height: number;
  clock: MutableRefObject<RoomClock>;
}

export interface Exhibit {
  /** One line on what the installation does (for docs / dev tools). */
  idea: string;
  walls: WallDraw;
  Piece: ComponentType<PieceProps>;
  /** Room light level before the visit starts (a room can stay dark until its installation lights it). */
  darkUntil?: number;
  /** Walls whose projection also plays on time (`t`), not only the visit: they keep redrawing while the room is near. */
  timeWalls?: Wall[];
}

// ─── Canvas helpers ────────────────────────────────────────────────────────

export const BONE = PALETTE.bone;
export const DIM = 'rgba(239,233,223,0.6)';
export const pad2 = (n: number) => String(n).padStart(2, '0');
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const ramp = (u: number, a: number, b: number) => clamp01((u - a) / (b - a));
export const sstep = (u: number, a: number, b: number) => {
  const x = ramp(u, a, b);
  return x * x * (3 - 2 * x);
};

/** Deterministic pseudo-random in [0, 1) from an integer. */
export const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * The part of a back wall the room's reading card leaves open (and in view),
 * as fractions of its width. The card docks to the side of the screen away
 * from the wall's anchor — which side depends on the room's side of the
 * corridor — and covers more of a narrower screen; on phones it is a sheet
 * along the bottom and the view sees the middle of the wall.
 */
export function openSpan(index: number): [number, number] {
  const w = typeof window === 'undefined' ? 1440 : window.innerWidth;
  const right = CORRIDOR.rooms[index]?.side === -1;
  if (w <= 760) return [0.3, 0.74];
  if (w <= 1080) return right ? [0.2, 0.42] : [0.58, 0.8];
  return right ? [0.05, 0.58] : [0.42, 0.95];
}

/** The exhibit's title, painted across the top of its back wall. Returns the y where the installation can start. */
export function titleBand(ctx: CanvasRenderingContext2D, w: number, h: number, info: WallInfo, ink: string = BONE, dim: string = DIM) {
  const u = h / 100;
  const x = w * 0.045;
  ctx.fillStyle = info.ev.accent;
  ctx.fillRect(x, u * 6, u * 5, u * 0.8);
  text(ctx, `ROOM ${pad2(info.index + 1)} / ${pad2(info.total)}   ·   ${info.ev.kind.toUpperCase()}   ·   ${info.ev.cadence.toUpperCase()}${info.ev.flagship ? '   ·   FLAGSHIP' : ''}`, x + u * 7, u * 7.2, {
    family: 'mono',
    size: u * 2.6,
    color: dim,
    tracking: 0.24,
  });
  const size = fitSize(ctx, info.ev.title, w * 0.7, { family: 'serif', size: u * 13 }, u * 13, u * 7);
  text(ctx, info.ev.title, x - u * 0.4, u * 20, { family: 'serif', size, color: ink });
  return u * 26;
}

/** First `n` characters of `s` revealed across [a, b] of `u`. */
export function typed(s: string, u: number, a: number, b: number) {
  return s.slice(0, Math.floor(s.length * ramp(u, a, b)));
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Syntax-coloured code on a dark screen (decorative), for laptops and monitors. */
export function codeScreen(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  ctx.fillStyle = '#0c0f14';
  ctx.fillRect(0, 0, w, h);
  const colors = ['#7fb0ff', '#e8c07a', '#9fd3a8', '#d6d3cc', '#c49bdd'];
  const lh = h / 11;
  for (let i = 0; i < 10; i++) {
    let x = w * 0.06 + ((i * 7 + seed) % 3) * w * 0.05;
    const n = 1 + ((i * 3 + seed) % 4);
    for (let k = 0; k < n; k++) {
      const len = w * (0.06 + (((i + k + seed) * 13) % 7) * 0.025);
      ctx.fillStyle = colors[(i + k + seed) % colors.length];
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x, lh * (i + 0.7), len, lh * 0.4);
      x += len + w * 0.025;
    }
  }
  ctx.globalAlpha = 1;
}
