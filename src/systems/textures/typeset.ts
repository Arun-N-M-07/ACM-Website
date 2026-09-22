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
  /** Archivo width axis ('condensed' | 'expanded' ...). */
  stretch?: 'condensed' | 'semi-condensed' | 'normal' | 'semi-expanded' | 'expanded';
}

const FALLBACK: Record<Family, string> = {
  serif: 'Georgia, "Times New Roman", serif',
  sans: '"Helvetica Neue", Arial, sans-serif',
  mono: '"SFMono-Regular", Menlo, Consolas, monospace',
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
  await Promise.all([
    document.fonts.load(`64px ${f.serif}`),
    document.fonts.load(`italic 64px ${f.serif}`),
    document.fonts.load(`500 64px ${f.sans}`),
    document.fonts.load(`700 64px ${f.sans}`),
    document.fonts.load(`400 64px ${f.mono}`),
  ]).catch(() => undefined);
  await document.fonts.ready;
}

export function applyType(ctx: CanvasRenderingContext2D, spec: TypeSpec) {
  const fam = fontFamilies()[spec.family];
  ctx.font = `${spec.italic ? 'italic ' : ''}${spec.weight ?? 400} ${spec.size}px ${fam}`;
  ctx.fillStyle = spec.color ?? '#efe9df';
  ctx.textAlign = spec.align ?? 'left';
  ctx.textBaseline = spec.baseline ?? 'alphabetic';
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string; fontStretch?: string };
  if ('letterSpacing' in c) c.letterSpacing = `${(spec.tracking ?? 0) * spec.size}px`;
  if ('fontStretch' in c) c.fontStretch = spec.stretch ?? 'normal';
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

/** Largest font size (≤ max) at which `value` fits in `maxWidth`. */
export function fitSize(ctx: CanvasRenderingContext2D, value: string, maxWidth: number, spec: TypeSpec, max: number, min = 12) {
  let size = max;
  while (size > min) {
    applyType(ctx, { ...spec, size });
    if (ctx.measureText(value).width <= maxWidth) break;
    size -= Math.max(1, size * 0.04);
  }
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
