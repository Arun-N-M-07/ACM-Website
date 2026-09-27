/**
 * The chapter's name, drawn as blades: an original display face for
 * ASSOCIATION FOR COMPUTING MACHINERY, built from exact outlines so each
 * letter can be extruded into a physical, bevelled object.
 *
 * Its character — tall, sharp, a little irregular — comes from the drawing,
 * not from a font: stems waisted between flared ends, barbed terminals,
 * bowls faceted and stressed on the diagonal, a spur where a stroke ends, and
 * the name's first letter with a spike that breaks the cap line.
 *
 * Authored at cap height 1, baseline y = 0, x from the letter's left edge.
 * Every letter is one outline (plus counters), never overlapping strokes, so
 * it extrudes cleanly. No dependencies: the outlines are plain numbers.
 */

export type Pt = [number, number];

export interface BladeGlyph {
  outer: Pt[];
  holes: Pt[][];
  width: number;
}

const DEG = Math.PI / 180;

/** Points on an ellipse (optionally rotated) from angle a0 to a1 (degrees, either direction). */
function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n: number, rot = 0): Pt[] {
  const out: Pt[] = [];
  const cr = Math.cos(rot * DEG);
  const sr = Math.sin(rot * DEG);
  for (let i = 0; i <= n; i++) {
    const a = (a0 + ((a1 - a0) * i) / n) * DEG;
    // A slightly squarer ellipse (superellipse, exponent 2.4): the bowls read as cut, not turned.
    const c = Math.cos(a);
    const s = Math.sin(a);
    const e = 2 / 2.4;
    const x = Math.sign(c) * Math.pow(Math.abs(c), e) * rx;
    const y = Math.sign(s) * Math.pow(Math.abs(s), e) * ry;
    out.push([cx + x * cr - y * sr, cy + x * sr + y * cr]);
  }
  return out;
}

// The bowl shared by O, C, G: outer, and a counter stressed on the diagonal.
const OW = 0.84;
const outerAt = (a0: number, a1: number, n = 36) => arc(OW / 2, 0.5, OW / 2 + 0.005, 0.525, a0, a1, n);
/** A small beak past a stroke's end on the bowl, along the bowl's tangent (dir −1: clockwise). */
const beak = ([x, y]: Pt, dir: 1 | -1): Pt => {
  const a = Math.atan2((y - 0.5) / 0.525, (x - OW / 2) / (OW / 2));
  return [x - dir * Math.sin(a) * 0.05 + (x - OW / 2) * 0.04, y + dir * Math.cos(a) * 0.05 + (y - 0.5) * 0.04];
};
const innerAt = (a0: number, a1: number, n = 36) => arc(OW / 2, 0.5, 0.235, 0.37, a0, a1, n, -14);

const GLYPHS: Record<string, () => BladeGlyph> = {
  A: () => ({
    width: 0.83,
    outer: [
      [-0.03, 0],
      [0.15, 0],
      [0.24, 0.28],
      [0.52, 0.28],
      [0.6, 0],
      [0.84, 0],
      [0.47, 1.0],
      [0.405, 1.09],
      [0.34, 1.0],
    ],
    holes: [
      [
        [0.285, 0.4],
        [0.48, 0.4],
        [0.385, 0.71],
      ],
    ],
  }),
  // The name's first letter: the apex breaks the cap line as a spike, leaning back.
  'A*': () => ({
    width: 0.86,
    outer: [
      [-0.05, -0.02],
      [0.15, 0],
      [0.24, 0.28],
      [0.52, 0.28],
      [0.6, 0],
      [0.86, -0.02],
      [0.48, 1.0],
      [0.3, 1.46],
      [0.35, 1.0],
    ],
    holes: [
      [
        [0.285, 0.4],
        [0.48, 0.4],
        [0.39, 0.7],
      ],
    ],
  }),
  S: () => {
    // A spine through two bowls, heaviest where it crosses, drawn to points at its ends.
    const spine: Pt[] = [
      ...arc(0.37, 0.745, 0.3, 0.235, 14, 270, 22).slice(0, -1),
      ...arc(0.37, 0.265, 0.315, 0.245, 90, -172, 24),
    ];
    const n = spine.length;
    const left: Pt[] = [];
    const right: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const a = spine[Math.max(0, i - 1)];
      const b = spine[Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0];
      let ty = b[1] - a[1];
      const l = Math.hypot(tx, ty) || 1;
      tx /= l;
      ty /= l;
      const w = 0.2 * Math.pow(Math.sin((Math.PI * i) / (n - 1)), 0.45);
      left.push([spine[i][0] - ty * w * 0.5, spine[i][1] + tx * w * 0.5]);
      right.push([spine[i][0] + ty * w * 0.5, spine[i][1] - tx * w * 0.5]);
    }
    return { width: 0.72, outer: [...left, ...right.slice(1, n - 1).reverse()], holes: [] };
  },
  O: () => ({ width: OW, outer: outerAt(0, 360, 72).slice(0, -1), holes: [innerAt(0, 360, 60).slice(0, -1)] }),
  C: () => {
    const outer = outerAt(40, 322, 48);
    const inner = innerAt(318, 48, 40);
    // Beaked terminals, each a short continuation of the stroke's outer edge.
    return { width: 0.78, outer: [beak(outer[0], -1), ...outer, beak(outer[outer.length - 1], 1), ...inner], holes: [] };
  },
  G: () => {
    const outer = outerAt(40, 342, 50);
    const lo = outer[outer.length - 1];
    const inner = innerAt(326, 50, 38);
    const ib = inner[0];
    return {
      width: 0.84,
      outer: [beak(outer[0], -1), ...outer, [lo[0] + 0.012, 0.52], [0.5, 0.52], [0.455, 0.47], [0.5, 0.42], [ib[0], 0.42], ...inner],
      holes: [],
    };
  },
  I: () => ({
    width: 0.32,
    outer: [
      [-0.02, 0],
      [0.32, 0],
      [0.255, 0.5],
      [0.31, 1.0],
      [0.0, 1.03],
      [0.045, 0.5],
    ],
    holes: [],
  }),
  T: () => ({
    width: 0.8,
    outer: [
      [0.28, 0],
      [0.5, 0],
      [0.465, 0.5],
      [0.49, 0.87],
      [0.72, 0.87],
      [0.8, 1.0],
      [-0.02, 1.0],
      [0.06, 0.87],
      [0.29, 0.87],
      [0.315, 0.5],
    ],
    holes: [],
  }),
  N: () => ({
    width: 0.82,
    outer: [
      [-0.02, 0],
      [0.15, 0],
      [0.155, 0.62],
      [0.6, 0],
      [0.82, 0],
      [0.81, 1.08],
      [0.66, 1.0],
      [0.655, 0.38],
      [0.24, 1.0],
      [-0.02, 1.0],
      [0.03, 0.5],
    ],
    holes: [],
  }),
  F: () => ({
    width: 0.68,
    outer: [
      [-0.02, 0],
      [0.22, 0],
      [0.195, 0.45],
      [0.48, 0.45],
      [0.54, 0.505],
      [0.48, 0.56],
      [0.19, 0.56],
      [0.2, 0.87],
      [0.57, 0.87],
      [0.69, 0.82],
      [0.66, 1.0],
      [-0.02, 1.0],
      [0.035, 0.5],
    ],
    holes: [],
  }),
  E: () => ({
    width: 0.69,
    outer: [
      [-0.02, 0],
      [0.66, 0],
      [0.69, 0.18],
      [0.57, 0.13],
      [0.2, 0.13],
      [0.19, 0.45],
      [0.5, 0.45],
      [0.56, 0.505],
      [0.5, 0.56],
      [0.19, 0.56],
      [0.2, 0.87],
      [0.57, 0.87],
      [0.69, 0.82],
      [0.66, 1.0],
      [-0.02, 1.0],
      [0.035, 0.5],
    ],
    holes: [],
  }),
  H: () => ({
    width: 0.8,
    outer: [
      [-0.02, 0],
      [0.22, 0],
      [0.195, 0.46],
      [0.585, 0.46],
      [0.56, 0],
      [0.8, 0],
      [0.765, 0.5],
      [0.8, 1.0],
      [0.56, 1.0],
      [0.585, 0.57],
      [0.195, 0.57],
      [0.22, 1.0],
      [-0.02, 1.0],
      [0.035, 0.5],
    ],
    holes: [],
  }),
  M: () => ({
    width: 1.02,
    outer: [
      [-0.02, 0],
      [0.14, 0],
      [0.15, 0.7],
      [0.47, 0],
      [0.58, 0],
      [0.84, 0.7],
      [0.84, 0],
      [1.02, 0],
      [0.985, 0.5],
      [1.03, 1.06],
      [0.83, 1.0],
      [0.515, 0.34],
      [0.2, 1.0],
      [-0.02, 1.0],
      [0.03, 0.5],
    ],
    holes: [],
  }),
  P: () => ({
    width: 0.74,
    outer: [[-0.02, 0], [0.22, 0], [0.195, 0.44], [0.44, 0.44], ...arc(0.44, 0.72, 0.3, 0.28, -90, 90, 24), [-0.02, 1.0], [0.035, 0.5]],
    holes: [[[0.2, 0.56], [0.44, 0.56], ...arc(0.44, 0.72, 0.14, 0.16, -90, 90, 16), [0.2, 0.88]]],
  }),
  R: () => ({
    width: 0.86,
    outer: [
      [-0.02, 0],
      [0.22, 0],
      [0.195, 0.42],
      [0.36, 0.42],
      [0.62, 0],
      [0.88, -0.02],
      ...arc(0.44, 0.72, 0.3, 0.28, -60, 90, 22),
      [-0.02, 1.0],
      [0.035, 0.5],
    ],
    holes: [[[0.2, 0.56], [0.44, 0.56], ...arc(0.44, 0.72, 0.14, 0.16, -90, 90, 16), [0.2, 0.88]]],
  }),
  U: () => ({
    width: 0.82,
    outer: [
      [-0.02, 1.0],
      [0.035, 0.5],
      ...arc(0.4, 0.34, 0.38, 0.36, 180, 360, 26),
      [0.765, 0.5],
      [0.83, 1.06],
      [0.63, 1.0],
      [0.62, 0.34],
      ...arc(0.4, 0.34, 0.22, 0.22, 360, 180, 20),
      [0.2, 1.0],
    ],
    holes: [],
  }),
  Y: () => ({
    width: 0.84,
    outer: [
      [0.3, 0],
      [0.52, 0],
      [0.49, 0.44],
      [0.85, 1.0],
      [0.66, 1.0],
      [0.42, 0.6],
      [0.2, 1.0],
      [-0.04, 1.04],
      [0.31, 0.44],
    ],
    holes: [],
  }),
};

export function bladeGlyph(ch: string): BladeGlyph {
  const make = GLYPHS[ch];
  if (!make) throw new Error(`No blade glyph for ${ch}`);
  return make();
}

export interface BladeLetter {
  ch: string;
  glyph: BladeGlyph;
  /** Left edge (cap units, relative to the line's centre) and baseline. */
  x: number;
  y: number;
  /** Cap height of the line (m). */
  cap: number;
  line: number;
}

/**
 * The name, set in three lines — ASSOCIATION / FOR COMPUTING / MACHINERY —
 * the middle one smaller and more widely spaced; each line centred; the whole
 * centred on its middle. Positions in metres for a given cap height.
 */
export function setName(cap: number) {
  const lines: { text: string; scale: number; tracking: number }[] = [
    { text: 'ASSOCIATION', scale: 1, tracking: 0.06 },
    { text: 'FOR COMPUTING', scale: 0.6, tracking: 0.15 },
    { text: 'MACHINERY', scale: 1, tracking: 0.06 },
  ];
  const gap = 0.36;
  const heights = lines.map((l) => l.scale);
  const total = heights.reduce((a, b) => a + b, 0) + gap * (lines.length - 1);
  const letters: BladeLetter[] = [];
  let top = total / 2;
  lines.forEach((l, li) => {
    const c = cap * l.scale;
    const baseline = (top - l.scale) * cap;
    const glyphs = [...l.text].map((ch, i) => (ch === ' ' ? null : bladeGlyph(li === 0 && i === 0 ? 'A*' : ch)));
    const widths = glyphs.map((g) => (g ? g.width : 0.34));
    const w = widths.reduce((a, b) => a + b, 0) + l.tracking * (widths.length - 1);
    let x = -w / 2;
    glyphs.forEach((g, i) => {
      if (g) letters.push({ ch: l.text[i], glyph: g, x: x * c, y: baseline, cap: c, line: li });
      x += widths[i] + l.tracking;
    });
    top -= l.scale + gap;
  });
  return { letters, height: total * cap, width: Math.max(...lines.map((l) => l.text.length)) };
}
