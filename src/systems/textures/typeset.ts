/**
 * Canvas typesetting for in-world signage. All environmental text is drawn
 * with the same web fonts as the HTML layer (resolved from the CSS variables
 * next/font sets on <html>), so walls, posters and screens share one typographic
 * voice without shipping extra font files to the GPU.
 */
import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from 'three';

export type Family = 'serif' | 'sans' | 'mono';

export interface TypeSpec {
  family: Family;
  size: number;
  weight?: number;
  italic?: boolean;
  color?: string;
  /** Tracking in em. */
  tracking?: number;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  /** (Width axis — no longer used: Montserrat has none.) */
  stretch?: 'condensed' | 'semi-condensed' | 'normal' | 'semi-expanded' | 'expanded';
}

const FALLBACK: Record<Family, string> = {
  serif: 'Montserrat, "Helvetica Neue", Arial, sans-serif',
  sans: 'Montserrat, "Helvetica Neue", Arial, sans-serif',
  mono: 'Montserrat, "Helvetica Neue", Arial, sans-serif',
};

let familyCache: Record<Family, string> | null = null;

export function fontFamilies(): Record<Family, string> {
  if (familyCache) return familyCache;
  if (typeof document === 'undefined') return FALLBACK;
  const cs = getComputedStyle(document.documentElement);
  const read = (v: string, f: Family) => {
    const val = cs.getPropertyValue(v).trim();
    return val ? `${val}, ${FALLBACK[f]}` : FALLBACK[f];
  };
  familyCache = { serif: read('--font-serif', 'serif'), sans: read('--font-sans', 'sans'), mono: read('--font-mono', 'mono') };
  return familyCache;
}

/** Resolve once web fonts are usable in canvas. */
export async function fontsReady(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const f = fontFamilies();
  // (One variable family: these make sure each style and the weights the roles use are ready.)
  await Promise.all([
    document.fonts.load(`400 64px ${f.sans}`),
    document.fonts.load(`italic 400 64px ${f.serif}`),
    document.fonts.load(`500 64px ${f.sans}`),
    document.fonts.load(`600 64px ${f.serif}`),
    document.fonts.load(`700 64px ${f.sans}`),
    document.fonts.load(`800 64px ${f.sans}`),
  ]).catch(() => undefined);
  await document.fonts.ready;
}

/**
 * The in-world type's hierarchy, as the page's (globals.css --w-* / --t-*): one family, Montserrat,
 * so the roles are weights and tracking. A display line ('serif') set at a text weight is a title
 * — semibold, a touch tighter; a label ('mono') is semibold, and its tracking is held to what
 * Montserrat (already wide) needs; text ('sans') is as specified.
 */
function roleWeight(spec: TypeSpec) {
  const w = spec.weight ?? 400;
  if (spec.family === 'serif' && !spec.italic) return Math.max(w, 600);
  if (spec.family === 'mono') return Math.max(w, 600);
  return w;
}
function roleTracking(spec: TypeSpec) {
  const t = spec.tracking ?? 0;
  if (spec.family === 'serif') return t - 0.01;
  if (spec.family === 'mono') return Math.min(t, 0.16);
  return t;
}

export function applyType(ctx: CanvasRenderingContext2D, spec: TypeSpec) {
  const fam = fontFamilies()[spec.family];
  ctx.font = `${spec.italic ? 'italic ' : ''}${roleWeight(spec)} ${spec.size}px ${fam}`;
  ctx.fillStyle = spec.color ?? '#efe9df';
  ctx.textAlign = spec.align ?? 'left';
  ctx.textBaseline = spec.baseline ?? 'alphabetic';
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string; fontStretch?: string };
  if ('letterSpacing' in c) c.letterSpacing = `${roleTracking(spec) * spec.size}px`;
  if ('fontStretch' in c) c.fontStretch = 'normal';
}

export function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, spec: TypeSpec) {
  applyType(ctx, spec);
  ctx.fillText(value, x, y);
}

/** Greedy word wrap. */
export function wrap(ctx: CanvasRenderingContext2D, value: string, maxWidth: number): string[] {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** Draw a wrapped paragraph; returns the y after the last line. */
export function paragraph(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  spec: TypeSpec,
  maxLines = Infinity,
): number {
  applyType(ctx, spec);
  let lines = wrap(ctx, value, maxWidth);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = lines[maxLines - 1].replace(/[\s,.;:]*\S*$/, '') + ' …';
  }
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

/**
 * Fitted sizes already found. The search sets and measures the type at every step (dozens of font
 * parses for a long line) and the walls redraw many times a second while they play, so each answer is
 * kept: it depends only on the text, its type, the width — and the fonts (the key carries whether
 * they have loaded, so the web font's metrics replace the fallback's). Bounded: cleared when full.
 */
const fitted = new Map<string, { size: number; set: number }>();

/** Largest font size (≤ max) at which `value` fits in `maxWidth`. */
export function fitSize(ctx: CanvasRenderingContext2D, value: string, maxWidth: number, spec: TypeSpec, max: number, min = 12) {
  const key = `${typeof document !== 'undefined' ? document.fonts?.status : ''}|${spec.family}|${spec.italic ? 1 : 0}|${spec.weight ?? ''}|${spec.tracking ?? ''}|${max}|${min}|${maxWidth}|${value}`;
  const hit = fitted.get(key);
  if (hit) {
    // (Leaves the context's type as the search would have — untouched if it never set one.)
    if (hit.set === hit.set) applyType(ctx, { ...spec, size: hit.set });
    return hit.size;
  }
  // The search steps down from max by 4% (at least 1) and takes the first size that fits — or the first
  // at or under min. Measuring every step costs a font parse and a measure each (dozens for a long
  // line), but type's width grows in proportion to its size (its tracking with it), so one measure at
  // max says where the search will end; only that step and the one before it are measured to confirm,
  // and if either disagrees the search walks on from there exactly as before. Same answer, same type
  // left set on the context.
  const step = (s: number) => s - Math.max(1, s * 0.04);
  const fits = (s: number) => {
    applyType(ctx, { ...spec, size: s });
    last = s;
    return ctx.measureText(value).width <= maxWidth;
  };
  let last = NaN;
  let size = max;
  if (size > min && !fits(size)) {
    const est = (max * maxWidth) / ctx.measureText(value).width;
    // Skip (without measuring) to the step the estimate points at…
    let prev = size;
    size = step(size);
    while (size > min && size > est) {
      prev = size;
      size = step(size);
    }
    // …walk back while the step before still fits (the estimate ran long)…
    while (prev < max && prev > min && fits(prev)) {
      size = prev;
      let p = max;
      while (step(p) > prev) p = step(p);
      prev = p;
    }
    // …and on while this one doesn't (it ran short), exactly as the full search would.
    while (size > min && !fits(size)) size = step(size);
  }
  // (The search leaves the last size it tried set: this one, or — when it ran out at min — the one before.)
  let set = NaN;
  if (max > min) {
    if (size > min) set = size;
    else {
      let p = max;
      while (step(p) > size) p = step(p);
      set = p;
    }
  }
  if (set === set && last !== set) applyType(ctx, { ...spec, size: set });
  if (fitted.size > 600) fitted.clear();
  fitted.set(key, { size, set });
  return size;
}

export function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.round(width));
  canvas.height = Math.max(2, Math.round(height));
  const ctx = canvas.getContext('2d')!;
  return { canvas, ctx };
}

export function toTexture(canvas: HTMLCanvasElement, opts: { repeat?: boolean; anisotropy?: number } = {}) {
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = opts.anisotropy ?? 8;
  tex.minFilter = LinearMipmapLinearFilter;
  if (opts.repeat) {
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
  }
  tex.needsUpdate = true;
  return tex;
}

/** Load an image, resolving null on failure (callers fall back to typography). */
export function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Draw an image cropped to cover a rect. */
export function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / s;
  const sh = h / s;
  const sx = (img.naturalWidth - sw) / 2;
  const sy = (img.naturalHeight - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}
