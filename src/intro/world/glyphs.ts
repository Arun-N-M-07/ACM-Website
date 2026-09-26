/**
 * EVENTS, drawn as architecture: a wide, geometric, even-stroked sans (the
 * voice of the site's Archivo Expanded headings), built from exact outlines
 * so the word can be extruded into physical letters — no font file needed.
 *
 * Letters are authored on a baseline at y = 0, cap height H, stroke S, in
 * metres; each returns its outline and its advance width.
 */
import { Shape, Vector2 } from 'three';

export interface Glyph {
  shape: Shape;
  width: number;
}

const poly = (pts: [number, number][]) => new Shape(pts.map(([x, y]) => new Vector2(x, y)));

function E(H: number, S: number): Glyph {
  const w = H * 0.66;
  const mid = H / 2;
  return {
    width: w,
    shape: poly([
      [0, 0],
      [w, 0],
      [w, S],
      [S, S],
      [S, mid - S / 2],
      [w * 0.86, mid - S / 2],
      [w * 0.86, mid + S / 2],
      [S, mid + S / 2],
      [S, H - S],
      [w, H - S],
      [w, H],
      [0, H],
    ]),
  };
}

function V(H: number, S: number): Glyph {
  const w = H * 0.86;
  const top = S * 1.18;
  const foot = S * 0.62;
  return {
    width: w,
    shape: poly([
      [0, H],
      [top, H],
      [w / 2, S * 1.55],
      [w - top, H],
      [w, H],
      [w / 2 + foot, 0],
      [w / 2 - foot, 0],
    ]),
  };
}

function N(H: number, S: number): Glyph {
  const w = H * 0.8;
  const k = S * 1.5;
  return {
    width: w,
    shape: poly([
      [0, 0],
      [S, 0],
      [S, H - k],
      [w - S, 0],
      [w, 0],
      [w, H],
      [w - S, H],
      [w - S, k],
      [S, H],
      [0, H],
    ]),
  };
}

function Tg(H: number, S: number): Glyph {
  const w = H * 0.76;
  return {
    width: w,
    shape: poly([
      [0, H],
      [w, H],
      [w, H - S],
      [w / 2 + S / 2, H - S],
      [w / 2 + S / 2, 0],
      [w / 2 - S / 2, 0],
      [w / 2 - S / 2, H - S],
      [0, H - S],
    ]),
  };
}

/**
 * S: a spine of two elliptical bowls meeting in the middle (C1 at the join),
 * thickened by S; terminals cut square to the stroke.
 */
function Sg(H: number, S: number): Glyph {
  const w = H * 0.74;
  const cx = w / 2;
  const ax = w / 2 - S / 2;
  const ay = (H - S) / 4;
  const upper = H / 2 + ay;
  const lower = H / 2 - ay;
  const spine: [number, number][] = [];
  const steps = 40;
  // Upper bowl: from the upper-right terminal, over the top, down to the middle.
  for (let i = 0; i <= steps; i++) {
    const th = ((24 + (270 - 24) * (i / steps)) * Math.PI) / 180;
    spine.push([cx + ax * Math.cos(th), upper + ay * Math.sin(th)]);
  }
  // Lower bowl: from the middle, round the right, along the bottom, to the lower-left terminal.
  for (let i = 1; i <= steps; i++) {
    const th = ((90 - (90 + 156) * (i / steps)) * Math.PI) / 180;
    spine.push([cx + ax * Math.cos(th), lower + ay * Math.sin(th)]);
  }
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i < spine.length; i++) {
    const a = spine[Math.max(0, i - 1)];
    const b = spine[Math.min(spine.length - 1, i + 1)];
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    const nx = -ty;
    const ny = tx;
    left.push([spine[i][0] + nx * (S / 2), spine[i][1] + ny * (S / 2)]);
    right.push([spine[i][0] - nx * (S / 2), spine[i][1] - ny * (S / 2)]);
  }
  return { width: w, shape: poly([...left, ...right.reverse()]) };
}

const BUILD: Record<string, (H: number, S: number) => Glyph> = { E, V, N, T: Tg, S: Sg };

/** Outlines for a word, laid out on a baseline; x offsets are the left edge of each letter. */
export function layoutWord(word: string, H: number, S: number, tracking: number) {
  let x = 0;
  const letters = [...word].map((ch) => {
    const g = BUILD[ch](H, S);
    const item = { ch, glyph: g, x };
    x += g.width + tracking;
    return item;
  });
  return { letters, width: x - tracking };
}
