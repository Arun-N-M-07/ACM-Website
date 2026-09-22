/**
 * Procedural surface textures, generated on the client at load time instead of
 * downloading image files. All tile in metres: a texture's `repeat` is set to
 * 1 / tileSize and geometry UVs are authored in metres (see geometry/uv.ts).
 */
import type { Texture } from 'three';
import { rng } from '@/lib/random';
import { makeCanvas, toTexture } from './typeset';

function noise(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, seed: number) {
  const r = rng(seed);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

/** CEG red brick in English bond with lime mortar. One tile = 1.2m × 1.2m. */
export function brickTexture(scale = 1): { texture: Texture; tile: number } {
  const size = Math.round(512 * scale);
  const { canvas, ctx } = makeCanvas(size, size);
  const r = rng(1794);
  ctx.fillStyle = '#cdb89c';
  ctx.fillRect(0, 0, size, size);
  const rows = 16;
  const bh = size / rows;
  for (let row = 0; row < rows; row++) {
    const header = row % 2 === 1;
    const bw = header ? size / 16 : size / 8;
    const offset = header ? bw / 2 : 0;
    for (let x = -offset; x < size; x += bw) {
      const hue = 8 + r() * 8;
      const sat = 48 + r() * 14;
      const lig = 30 + r() * 9;
      ctx.fillStyle = `hsl(${hue} ${sat}% ${lig}%)`;
      ctx.fillRect(x + 1.2 * scale, row * bh + 1.2 * scale, bw - 2.4 * scale, bh - 2.4 * scale);
    }
  }
  noise(ctx, size, size, 16, 3);
  const texture = toTexture(canvas, { repeat: true });
  return { texture, tile: 1.2 };
}

/**
 * CEG red: painted lime plaster with soft mottling and faint rain streaks.
 * One tile = 4 m. Colour sampled from photographs of the building in daylight.
 */
export function plasterTexture(scale = 1, base = [176, 74, 58]): { texture: Texture; tile: number } {
  const size = Math.round(512 * scale);
  const { canvas, ctx } = makeCanvas(size, size);
  const r = rng(1920);
  ctx.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
  ctx.fillRect(0, 0, size, size);
  // Mottling: large soft blotches of slightly lighter / darker paint.
  for (let i = 0; i < 70; i++) {
    const x = r() * size;
    const y = r() * size;
    const rad = (0.04 + r() * 0.16) * size;
    const k = (r() - 0.5) * 26;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(${k > 0 ? '255,230,210' : '40,10,5'},${Math.abs(k) / 255})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // Rain streaks.
  for (let i = 0; i < 40; i++) {
    const x = r() * size;
    const len = (0.1 + r() * 0.4) * size;
    const g = ctx.createLinearGradient(0, 0, 0, len);
    g.addColorStop(0, 'rgba(40,12,8,0.10)');
    g.addColorStop(1, 'rgba(40,12,8,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, r() * size * 0.3, 1 + r() * 3 * scale, len);
  }
  noise(ctx, size, size, 10, 17);
  return { texture: toTexture(canvas, { repeat: true }), tile: 4 };
}

/** Mangalore clay tiles: courses with shadowed laps and per-tile hue drift. One tile = 1.6 m. */
export function roofTileTexture(scale = 1): { texture: Texture; tile: number } {
  const size = Math.round(256 * scale);
  const { canvas, ctx } = makeCanvas(size, size);
  const r = rng(7);
  const rows = 6;
  const cols = 6;
  const rh = size / rows;
  const cw = size / cols;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const hue = 12 + r() * 8;
      const light = 30 + r() * 10;
      const g = ctx.createLinearGradient(0, j * rh, 0, (j + 1) * rh);
      g.addColorStop(0, `hsl(${hue} 45% ${light - 8}%)`);
      g.addColorStop(0.25, `hsl(${hue} 48% ${light + 4}%)`);
      g.addColorStop(1, `hsl(${hue} 46% ${light}%)`);
      ctx.fillStyle = g;
      ctx.fillRect(i * cw, j * rh, cw, rh);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(i * cw, j * rh, Math.max(1, cw * 0.04), rh);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, j * rh, size, Math.max(1, rh * 0.08));
  }
  noise(ctx, size, size, 18, 23);
  return { texture: toTexture(canvas, { repeat: true }), tile: 1.6 };
}

/** Board-formed concrete: horizontal plank bands, tie holes, fine aggregate. One tile = 2.4m. */
export function concreteTexture(scale = 1, tone = 112): { texture: Texture; tile: number } {
  const size = Math.round(512 * scale);
  const { canvas, ctx } = makeCanvas(size, size);
  const r = rng(2004);
  const planks = 8;
  for (let i = 0; i < planks; i++) {
    const t = tone + (r() - 0.5) * 12;
    ctx.fillStyle = `rgb(${t},${t - 2},${t - 5})`;
    ctx.fillRect(0, (i * size) / planks, size, size / planks);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, (i * size) / planks, size, Math.max(1, scale));
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let y = 0.25; y < 1; y += 0.5)
    for (let x = 0.25; x < 1; x += 0.5) {
      ctx.beginPath();
      ctx.arc(x * size, y * size, 3.2 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  noise(ctx, size, size, 22, 7);
  return { texture: toTexture(canvas, { repeat: true }), tile: 2.4 };
}

/** Dark polished floor with a faint 1.2m joint grid. One tile = 2.4m. */
export function floorTexture(scale = 1, base = 30): { texture: Texture; tile: number } {
  const size = Math.round(512 * scale);
  const { canvas, ctx } = makeCanvas(size, size);
  ctx.fillStyle = `rgb(${base},${base},${base + 2})`;
  ctx.fillRect(0, 0, size, size);
  noise(ctx, size, size, 10, 11);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = Math.max(1, 1.5 * scale);
  for (let i = 0; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(0, (i * size) / 2);
    ctx.lineTo(size, (i * size) / 2);
    ctx.moveTo((i * size) / 2, 0);
    ctx.lineTo((i * size) / 2, size);
    ctx.stroke();
  }
  return { texture: toTexture(canvas, { repeat: true }), tile: 2.4 };
}

/** Mown lawn with mowing stripes. One tile = 8m. */
export function lawnTexture(scale = 1): { texture: Texture; tile: number } {
  const size = Math.round(256 * scale);
  const { canvas, ctx } = makeCanvas(size, size);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 ? '#3b5629' : '#42602d';
    ctx.fillRect(0, (i * size) / 4, size, size / 4);
  }
  noise(ctx, size, size, 26, 5);
  return { texture: toTexture(canvas, { repeat: true }), tile: 8 };
}
