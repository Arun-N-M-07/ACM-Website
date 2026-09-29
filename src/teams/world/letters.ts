/**
 * THE CREW — the letterforms and where they stand.
 *
 * Shared by the geometry (TeamEntrance.tsx) and the camera (camera.ts, the
 * entrance path), so the lens always flies through the real passage.
 *
 * The outlines are the site's display face for the entrance — Archivo,
 * expanded width, bold — as polygons (cap height = 1, baseline y = 0, x from
 * the glyph's left ink edge): T, H and E traced from the web font at 1000 px;
 * C, R and W from the font's own outlines at the same instance (wght 700,
 * wdth 125), their curves flattened to within 0.002 of the cap height.
 *
 * Landscape: one line, THE · CREW, with the passage between the words.
 * Portrait: THE above CREW, with the passage as a horizontal slot between
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
  C: {
    advance: 1.3741,
    lsb: 0.0902,
    outline: [[0.6201, -0.0175], [0.5009, -0.012], [0.3852, 0.0066], [0.2921, 0.0351], [0.2487, 0.0543], [0.2055, 0.0783], [0.1665, 0.1057], [0.1382, 0.1301], [0.1065, 0.1636], [0.079, 0.2005], [0.0564, 0.2391], [0.0381, 0.2794], [0.0233, 0.3226], [0.0122, 0.3685], [0.0035, 0.4272], [0.0003, 0.4792], [0.0012, 0.5429], [0.0061, 0.5932], [0.0169, 0.6501], [0.03, 0.6946], [0.0469, 0.7364], [0.0721, 0.783], [0.0972, 0.819], [0.1323, 0.8586], [0.1713, 0.8932], [0.2119, 0.9218], [0.2565, 0.9466], [0.305, 0.9677], [0.3575, 0.9851], [0.4139, 0.9988], [0.4847, 1.01], [0.5497, 1.0156], [0.6186, 1.0175], [0.6935, 1.0149], [0.7543, 1.0088], [0.8214, 0.9969], [0.8756, 0.9827], [0.9284, 0.9641], [0.9841, 0.9383], [1.026, 0.9133], [1.0636, 0.8852], [1.1033, 0.8474], [1.132, 0.8119], [1.1559, 0.7727], [1.1739, 0.7307], [1.1861, 0.6859], [1.1936, 0.6084], [0.9476, 0.6084], [0.9415, 0.657], [0.9277, 0.6917], [0.9004, 0.7289], [0.8601, 0.7619], [0.8091, 0.7878], [0.7551, 0.8045], [0.6885, 0.8158], [0.6253, 0.8194], [0.5712, 0.818], [0.5209, 0.8121], [0.4834, 0.8041], [0.4399, 0.79], [0.4053, 0.7741], [0.3718, 0.7536], [0.3425, 0.7297], [0.3174, 0.7024], [0.2846, 0.6487], [0.2721, 0.6151], [0.2638, 0.5788], [0.2596, 0.54], [0.2592, 0.473], [0.2624, 0.4335], [0.2697, 0.3965], [0.2811, 0.362], [0.2968, 0.33], [0.3174, 0.2995], [0.3358, 0.2785], [0.388, 0.2372], [0.4483, 0.2082], [0.5209, 0.1893], [0.5924, 0.1823], [0.6884, 0.1851], [0.7716, 0.1985], [0.8158, 0.2119], [0.8513, 0.2276], [0.8819, 0.2466], [0.9077, 0.269], [0.9303, 0.2977], [0.9428, 0.3224], [0.9527, 0.3588], [0.9549, 0.3886], [1.1951, 0.3886], [1.1931, 0.3483], [1.185, 0.3004], [1.1708, 0.2552], [1.1549, 0.2211], [1.1351, 0.1887], [1.1065, 0.1526], [1.0744, 0.1208], [1.038, 0.0921], [0.9974, 0.0665], [0.9525, 0.044], [0.9073, 0.026], [0.8563, 0.0104], [0.8021, -0.0018], [0.7446, -0.0105]],
  },
  R: {
    advance: 1.3464,
    lsb: 0.1339,
    outline: [[0, 0], [0, 1], [0.8515, 0.9981], [0.9106, 0.9879], [0.9619, 0.969], [1.0081, 0.9401], [1.0483, 0.9023], [1.0705, 0.8734], [1.0888, 0.8413], [1.1033, 0.8069], [1.1139, 0.7707], [1.1207, 0.7327], [1.1237, 0.6827], [1.1217, 0.6452], [1.1156, 0.6089], [1.1054, 0.5736], [1.0912, 0.5395], [1.0732, 0.5069], [1.052, 0.4777], [1.027, 0.4511], [0.9983, 0.4272], [0.9389, 0.3916], [1.147, 0], [0.8646, 0], [0.6885, 0.3464], [0.2518, 0.3464], [0.2518, 0]],
    holes: [[[0.2518, 0.5444], [0.7336, 0.5444], [0.7801, 0.5508], [0.8038, 0.5609], [0.8243, 0.5756], [0.8516, 0.6113], [0.8614, 0.6373], [0.8658, 0.6664], [0.8651, 0.6964], [0.8598, 0.7227], [0.8452, 0.7529], [0.8275, 0.7726], [0.7975, 0.7909], [0.7634, 0.8], [0.2518, 0.802]]],
  },
  W: {
    advance: 1.7467,
    lsb: 0.0146,
    outline: [[0.3304, 0], [0, 1], [0.2678, 1], [0.4597, 0.3747], [0.4891, 0.2518], [0.4993, 0.2518], [0.5328, 0.4003], [0.7031, 1], [1.0364, 1], [1.2082, 0.4003], [1.2416, 0.2518], [1.2518, 0.2518], [1.2911, 0.4003], [1.4745, 1], [1.7176, 1], [1.3872, 0], [1.0844, 0], [0.8981, 0.6346], [0.8763, 0.7173], [0.8646, 0.7787], [0.8574, 0.7787], [0.8224, 0.6346], [0.6405, 0]],
  },
};

/** Cap height of the built letters (metres). */
export const LETTER_CAP = 3.4;
/** Depth of the slabs (the front faces look towards the approaching camera, +z). */
export const LETTER_DEPTH = 1.3;
/**
 * Landscape: clear width between THE and CREW (the passage, centred on x = 0). A little wider than
 * the old TEAM's: C's bowl comes closest at the very height the camera passes (T's stem stood back
 * from the gap), and at 1.7 it crowded the lens; still a word space in the establishing view.
 */
const GAP_X = 2.1;
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
  const crew = measure('CREW') * LETTER_CAP;
  let layout: LetterLayout;
  if (portrait) {
    const upper = PASS_Y + GAP_Y / 2;
    const lower = PASS_Y - GAP_Y / 2 - LETTER_CAP;
    place('THE', -the / 2, upper, glyphs);
    place('CREW', -crew / 2, lower, glyphs);
    layout = { glyphs, left: -crew / 2, right: crew / 2, bottom: lower, top: upper + LETTER_CAP, passX: 0, passY: PASS_Y };
  } else {
    // The camera passes at ~45% of cap height, between E's arms and C's bowl.
    const baseline = PASS_Y - 0.45 * LETTER_CAP;
    place('THE', -GAP_X / 2 - the, baseline, glyphs);
    place('CREW', GAP_X / 2, baseline, glyphs);
    layout = { glyphs, left: -GAP_X / 2 - the, right: GAP_X / 2 + crew, bottom: baseline, top: baseline + LETTER_CAP, passX: 0, passY: PASS_Y };
  }
  cache[key] = layout;
  return layout;
}
