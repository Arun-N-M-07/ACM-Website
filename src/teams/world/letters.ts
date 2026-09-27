/**
 * THE TEAM — the letterforms and where they stand.
 *
 * Shared by the geometry (TeamEntrance.tsx) and the camera (camera.ts, the
 * entrance path), so the lens always flies through the real passage.
 *
 * The outlines are the site's own display face — Archivo, expanded width,
 * bold — traced from the web font at 1000 px and simplified to exact
 * polygons (cap height = 1, baseline y = 0, x from the glyph's left ink edge).
 *
 * Landscape: one line, THE · TEAM, with the passage between the words.
 * Portrait: THE above TEAM, with the passage as a horizontal slot between
 * the lines (one long line would be a sliver on a phone).
 */
export type Point = [number, number];
export interface Glyph {
  outline: Point[];
  holes?: Point[][];
  /** Advance and left side bearing (cap-height units). */
  advance: number;
  lsb: number;
}

// Archivo · wdth expanded · 700.
export const GLYPHS: Record<string, Glyph> = {
  T: { advance: 1.2054, lsb: 0.0361, outline: [[0, 1], [1.132, 1], [1.132, 0.789], [0.692, 0.789], [0.692, 0], [0.44, 0], [0.44, 0.789], [0, 0.789]] },
  H: {
    advance: 1.4193,
    lsb: 0.1333,
    outline: [[0, 0], [0.252, 0], [0.252, 0.404], [0.899, 0.404], [0.899, 0], [1.151, 0], [1.151, 1], [0.899, 1], [0.899, 0.617], [0.252, 0.617], [0.252, 1], [0, 1]],
  },
  E: {
    advance: 1.2593,
    lsb: 0.1333,
    outline: [[0, 0], [1.036, 0], [1.036, 0.2], [0.252, 0.2], [0.252, 0.411], [0.935, 0.411], [0.935, 0.607], [0.252, 0.607], [0.252, 0.802], [1.024, 0.802], [1.024, 1], [0, 1]],
  },
  A: {
    advance: 1.3369,
    lsb: 0.0297,
    outline: [[0, 0], [0.257, 0], [0.346, 0.181], [0.914, 0.181], [1.003, 0], [1.275, 0], [0.779, 1], [0.497, 1]],
    holes: [[[0.437, 0.376], [0.822, 0.376], [0.6295, 0.792]]],
  },
  M: {
    advance: 1.6403,
    lsb: 0.1333,
    outline: [[0, 0], [0.24, 0], [0.24, 0.757], [0.562, 0], [0.799, 0], [1.121, 0.757], [1.121, 0], [1.371, 0], [1.371, 1], [0.99, 1], [0.69, 0.288], [0.392, 1], [0, 1]],
  },
};

/** Cap height of the built letters (metres). */
export const LETTER_CAP = 3.4;
/** Depth of the slabs (the front faces look towards the approaching camera, +z). */
export const LETTER_DEPTH = 1.3;
/** Landscape: clear width between THE and TEAM (the passage, centred on x = 0). */
const GAP_X = 1.7;
/** Portrait: clear height between the lines (the slot the camera flies through). */
const GAP_Y = 1.9;
/** The camera passes through at this height relative to the world origin (layout lift). */
const PASS_Y = 0.3;

const inkRight = (g: Glyph) => Math.max(...g.outline.map(([x]) => x));

/** Ink extent of a word set with the font's own advances (cap units, from the first glyph's ink). */
function measure(word: string) {
  let pen = -GLYPHS[word[0]].lsb;
  let right = 0;
  for (const ch of word) {
    const g = GLYPHS[ch];
    right = pen + g.lsb + inkRight(g);
    pen += g.advance;
  }
  return right;
}

export interface PlacedGlyph {
  glyph: Glyph;
  /** Left ink edge and baseline, metres relative to the letters' origin (x = passage, y = world origin). */
  x: number;
  y: number;
}

export interface LetterLayout {
  glyphs: PlacedGlyph[];
  /** Ink bounds of the whole title (metres, same frame). */
  left: number;
  right: number;
  bottom: number;
  top: number;
  /** Where the camera crosses the letters' plane. */
  passX: number;
  passY: number;
}

function place(word: string, x0: number, baseline: number, out: PlacedGlyph[]) {
  let pen = x0 / LETTER_CAP - GLYPHS[word[0]].lsb;
  for (const ch of word) {
    const g = GLYPHS[ch];
    out.push({ glyph: g, x: (pen + g.lsb) * LETTER_CAP, y: baseline });
    pen += g.advance;
  }
}

const cache: Partial<Record<'landscape' | 'portrait', LetterLayout>> = {};

export function letterLayout(portrait: boolean): LetterLayout {
  const key = portrait ? 'portrait' : 'landscape';
  const hit = cache[key];
  if (hit) return hit;
  const glyphs: PlacedGlyph[] = [];
  const the = measure('THE') * LETTER_CAP;
  const team = measure('TEAM') * LETTER_CAP;
  let layout: LetterLayout;
  if (portrait) {
    const upper = PASS_Y + GAP_Y / 2;
    const lower = PASS_Y - GAP_Y / 2 - LETTER_CAP;
    place('THE', -the / 2, upper, glyphs);
    place('TEAM', -team / 2, lower, glyphs);
    layout = { glyphs, left: -team / 2, right: team / 2, bottom: lower, top: upper + LETTER_CAP, passX: 0, passY: PASS_Y };
  } else {
    // The camera passes at ~45% of cap height, between E's arms and T's stem.
    const baseline = PASS_Y - 0.45 * LETTER_CAP;
    place('THE', -GAP_X / 2 - the, baseline, glyphs);
    place('TEAM', GAP_X / 2, baseline, glyphs);
    layout = { glyphs, left: -GAP_X / 2 - the, right: GAP_X / 2 + team, bottom: baseline, top: baseline + LETTER_CAP, passX: 0, passY: PASS_Y };
  }
  cache[key] = layout;
  return layout;
}
