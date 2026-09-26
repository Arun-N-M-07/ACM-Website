/**
 * The typeset face of a domain card, drawn with Canvas 2D in the site's own
 * fonts and mapped onto a plane just in front of the glass.
 *
 * Composition — as on the reference's cards, the face carries almost nothing:
 * a small index line ("01 / 06") where a client mark would sit, and the
 * domain's name, centred, wide and luminous (a soft glow is baked into the
 * texture so bloom can pick it up).
 *
 * The name is set glyph by glyph so it can be in one of four states:
 *   settled    the name
 *   decoding   arriving in the centre: glyphs stutter in — doubled, then
 *              single — left to right, with a tail of stray glyphs that
 *              flickers off the end of each line
 *   glitched   off-centre cards: the name broken into doubled and substituted
 *              glyphs with a faint displaced ghost of the line (re-seeded a
 *              couple of times a second, so it lives)
 *   leaving    settled → glitched: the break-up running across the name
 */
import type { TeamDomain } from '@/content/teams';
import { DOMAIN_COUNT } from '@/content/teams';
import { applyType, wrap, type TypeSpec } from '@/systems/textures/typeset';

const GLYPHS = 'ABRONXKE38I|/\\_-#';
/** Cheap deterministic hash → 0..1. */
const hash = (a: number, b: number) => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export type FaceMode = 'settled' | 'decoding' | 'glitched' | 'leaving';

export interface FaceOptions {
  portrait: boolean;
  mode: FaceMode;
  /** Progress of decoding / leaving (0..1). */
  t: number;
  /** Changes the glitch pattern. */
  seed: number;
}

const NAME: Omit<TypeSpec, 'size'> = { family: 'sans', weight: 400, stretch: 'expanded', tracking: 0.04, color: '#f4f1ea' };

/** Wrap and size the name to the box. */
function fitName(ctx: CanvasRenderingContext2D, name: string, maxW: number, maxLines: number, maxSize: number) {
  let size = maxSize;
  let lines: string[] = [name];
  while (size > 10) {
    applyType(ctx, { ...NAME, size });
    lines = wrap(ctx, name, maxW);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (lines.length <= maxLines && widest <= maxW) break;
    size *= 0.95;
  }
  return { size, lines };
}

/** Per-glyph presentation for the current state. */
function glyphAt(ch: string, gi: number, n: number, o: FaceOptions): { char: string; double: number; alpha: number } {
  if (ch === ' ' || o.mode === 'settled') return { char: ch, double: 0, alpha: 1 };
  const r1 = hash(gi, o.seed);
  const r2 = hash(gi + 17.3, o.seed * 1.7);
  const pick = GLYPHS[Math.floor(hash(gi * 3.1, o.seed + 9) * GLYPHS.length)];
  if (o.mode === 'decoding') {
    // Each glyph settles at its own moment, roughly left to right.
    const at = (gi / n) * 0.62 + r1 * 0.22;
    if (o.t >= at + 0.14) return { char: ch, double: 0, alpha: 1 };
    if (o.t >= at) return { char: ch, double: 0.55, alpha: 1 };
    return r2 < 0.45 ? { char: '', double: 0, alpha: 0 } : { char: pick, double: 0, alpha: 0.7 };
  }
  // glitched / leaving: how broken the name is.
  const amount = o.mode === 'leaving' ? o.t : 1;
  if (r1 < amount * 0.34) return { char: pick, double: r2 < 0.3 ? 0.5 : 0, alpha: 0.8 };
  if (r1 < amount * 0.6) return { char: ch, double: 0.5, alpha: 0.95 };
  return { char: ch, double: 0, alpha: 1 };
}

export function drawCardFace(ctx: CanvasRenderingContext2D, w: number, h: number, d: TeamDomain, index: number, radiusPx: number, o: FaceOptions) {
  ctx.clearRect(0, 0, w, h);
  const u = Math.min(w, h);
  // (The glass itself carries the domain's tone; the face is lettering only.)
  void radiusPx;

  // The name, centred.
  const maxLines = o.portrait ? 4 : 3;
  const { size, lines } = fitName(ctx, d.name, w * (o.portrait ? 0.8 : 0.76), maxLines, u * (o.portrait ? 0.13 : 0.12));
  const lh = size * 1.04;
  const blockH = lh * lines.length;
  const cy = h * (o.portrait ? 0.53 : 0.55);
  const top = cy - blockH / 2;

  // Index line where a client's mark would sit.
  const idx = `${String(index + 1).padStart(2, '0')} / ${String(DOMAIN_COUNT).padStart(2, '0')}`;
  applyType(ctx, { family: 'mono', weight: 500, size: u * 0.045, color: 'rgba(244,241,234,0.72)', align: 'center', tracking: 0.18 });
  ctx.fillText(idx, w / 2, top - size * 0.55);

  applyType(ctx, { ...NAME, size, align: 'left' });
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 1;
  const tracking = (NAME.tracking ?? 0) * size;
  const n = d.name.length;
  let gi = 0;
  lines.forEach((line, li) => {
    const baseline = top + lh * (li + 0.82);
    // Measure the line as it will be drawn (glyph by glyph).
    const widths = [...line].map((ch) => ctx.measureText(ch).width + tracking);
    const lineW = widths.reduce((a, b) => a + b, 0) - tracking;
    let x = (w - lineW) / 2;
    // A ghost of the whole line, displaced, while broken.
    if (o.mode === 'glitched' || o.mode === 'leaving') {
      const k = o.mode === 'leaving' ? o.t : 1;
      ctx.globalAlpha = 0.22 * k;
      ctx.fillText(line, x + u * 0.05 * (hash(li, o.seed) - 0.3), baseline);
      ctx.globalAlpha = 1;
    }
    for (let c = 0; c < line.length; c++) {
      const g = glyphAt(line[c], gi, n, o);
      if (g.char) {
        ctx.globalAlpha = g.alpha;
        ctx.fillText(g.char, x, baseline);
        if (g.double > 0) {
          ctx.globalAlpha = g.alpha * g.double;
          ctx.fillText(g.char, x + widths[c] * 0.45, baseline);
        }
      }
      x += widths[c];
      gi++;
    }
    gi++; // the space the wrap consumed
    // Stray glyphs flickering off the end of the line while it decodes.
    if (o.mode === 'decoding' && o.t < 0.78) {
      const tail = 1 + Math.floor(hash(li, o.seed) * 3);
      ctx.globalAlpha = 0.55 * (1 - o.t / 0.78);
      for (let k = 0; k < tail; k++) {
        const ch = GLYPHS[Math.floor(hash(li * 7 + k, o.seed) * GLYPHS.length)];
        ctx.fillText(ch, x + tracking + k * size * 0.62, baseline);
      }
    }
    ctx.globalAlpha = 1;
  });
  ctx.shadowBlur = 0;
}
