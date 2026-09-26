/**
 * A fragment's sheet, drawn once at load (no image files), packed into one
 * texture the parchment's shader reads:
 *
 *   R  paper tone     fibres, mottling, stains, foxing, a crease
 *   G  ink            the words, set in the site's own faces, with a little bleed
 *   B  burn time      0 → 1: when each point of the sheet is reached by the fire
 *                     (from its ignition point, irregularly, with holes that
 *                     burn through on their own)
 *   A  silhouette     a torn, chipped, irregular sheet
 *
 * Colour is applied in the shader (paper light/dark, sepia ink, char, ember),
 * so one texture per fragment carries everything.
 *
 * Also returned, for the ash: points on the sheet and the moment the fire
 * reaches each.
 */
import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, Vector4 } from 'three';
import { applyType, type TypeSpec } from '@/systems/textures/typeset';
import { hash } from '../world/noise';
import type { Fragment, LineStyle } from './fragments';

export interface ParchmentArt {
  texture: CanvasTexture;
  /** Each line's box in texture UV (x0, y0, x1, y1), for the ink's order of appearance. */
  lines: Vector4[];
  /** Ash: sheet UV and burn time per particle. */
  ash: { uv: Float32Array; burn: Float32Array; count: number };
}

// ─── small noise helpers (canvas-side) ────────────────────────────────────────

function smoothNoise(x: number, y: number, seed: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, seed);
  const b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed);
  const d = hash(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm(x: number, y: number, seed: number, oct = 4) {
  let s = 0;
  let a = 0.5;
  let f = 1;
  let n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * smoothNoise(x * f, y * f, seed + i * 17);
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / n;
}

// ─── the sheet's outline ──────────────────────────────────────────────────────

/** An irregular sheet: torn edges, a few chips and bites, one torn corner. */
function outline(w: number, h: number, seed: number): Path2D {
  const m = Math.min(w, h) * 0.045;
  const pts: [number, number][] = [];
  const edge = (x0: number, y0: number, x1: number, y1: number, n: number, e: number) => {
    const nx = -(y1 - y0);
    const ny = x1 - x0;
    const len = Math.hypot(nx, ny);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      // Torn fibre: a slow wander, and a finer roughness on top — continuous,
      // so it reads as a tear, not a cut.
      const j = (fbm(t * 5 + e * 3.1, e * 1.7, seed, 3) - 0.5) * m * 1.8 + (fbm(t * 38 + e * 7.3, e * 2.3 + 5, seed + 3, 3) - 0.5) * m * 0.55;
      // Occasional chips out of the edge.
      const slot = Math.floor(t * 9);
      const chip = hash(slot, e + 11, seed) > 0.78 ? Math.pow(Math.sin(((t * 9) % 1) * Math.PI), 3) * m * (0.6 + hash(slot, e + 12, seed)) : 0;
      pts.push([x0 + (x1 - x0) * t - (nx / len) * (j - chip), y0 + (y1 - y0) * t - (ny / len) * (j - chip)]);
    }
  };
  const p = m * 1.4;
  // One corner torn away diagonally.
  const torn = Math.floor(hash(seed, 3) * 4);
  const cut = Math.min(w, h) * (0.08 + hash(seed, 4) * 0.06);
  const corners: [number, number][] = [
    [p, p],
    [w - p, p],
    [w - p, h - p],
    [p, h - p],
  ];
  for (let k = 0; k < 4; k++) {
    const [ax, ay] = corners[k];
    const [bx, by] = corners[(k + 1) % 4];
    const sx = k === torn ? ax + Math.sign(bx - ax) * cut : ax;
    const sy = k === torn ? ay + Math.sign(by - ay) * cut : ay;
    const ex = (k + 1) % 4 === torn ? bx - Math.sign(bx - ax) * cut : bx;
    const ey = (k + 1) % 4 === torn ? by - Math.sign(by - ay) * cut : by;
    edge(sx, sy, ex, ey, 240, k);
  }
  const path = new Path2D();
  pts.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
  path.closePath();
  return path;
}

// ─── typesetting ──────────────────────────────────────────────────────────────

function spec(style: LineStyle, size: number): TypeSpec {
  if (style === 'caps') return { family: 'mono', weight: 500, size: size * 0.2, tracking: 0.26, color: '#fff', align: 'center' };
  if (style === 'italic') return { family: 'serif', italic: true, size: size * 0.86, tracking: -0.005, color: '#fff', align: 'center' };
  return { family: 'serif', size, tracking: -0.015, color: '#fff', align: 'center' };
}

// ─── the sheet ────────────────────────────────────────────────────────────────

export function drawParchment(f: Fragment, pxPerMetre: number, ashCount: number): ParchmentArt {
  const W = Math.round(f.size[0] * pxPerMetre);
  const H = Math.round(f.size[1] * pxPerMetre);
  const seed = f.seed;
  const shape = outline(W, H, seed);
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return { c, x: c.getContext('2d', { willReadFrequently: true })! };
  };

  // A — silhouette.
  const sil = mk();
  sil.x.fillStyle = '#fff';
  sil.x.fill(shape);

  // R — paper tone (drawn in greys; 0.5 = the paper's own colour).
  const tone = mk();
  const tx = tone.x;
  tx.fillStyle = 'rgb(150,150,150)';
  tx.fillRect(0, 0, W, H);
  // Mottling (large, soft).
  const cells = 26;
  for (let i = 0; i < cells * cells * 0.5; i++) {
    const x = hash(i, 1, seed) * W;
    const y = hash(i, 2, seed) * H;
    const r = (0.06 + hash(i, 3, seed) * 0.16) * W;
    const light = hash(i, 4, seed) > 0.5;
    const g = tx.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.05 + hash(i, 5, seed) * 0.08;
    g.addColorStop(0, light ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    tx.fillStyle = g;
    tx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Fibres.
  tx.lineWidth = Math.max(1, W / 1400);
  for (let i = 0; i < 2600; i++) {
    const x = hash(i, 7, seed) * W;
    const y = hash(i, 8, seed) * H;
    const a = hash(i, 9, seed) * Math.PI;
    const l = (0.004 + hash(i, 10, seed) * 0.018) * W;
    tx.strokeStyle = hash(i, 11, seed) > 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.09)';
    tx.beginPath();
    tx.moveTo(x, y);
    tx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (hash(i, 12, seed) - 0.5) * l * 0.4, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    tx.stroke();
  }
  // Stains: tide-marked blots.
  for (let i = 0; i < 3; i++) {
    const x = (0.15 + hash(i, 13, seed) * 0.7) * W;
    const y = (0.15 + hash(i, 14, seed) * 0.7) * H;
    const r = (0.05 + hash(i, 15, seed) * 0.1) * W;
    const g = tx.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,0.05)');
    g.addColorStop(0.82, 'rgba(0,0,0,0.12)');
    g.addColorStop(0.9, 'rgba(0,0,0,0.2)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    tx.fillStyle = g;
    tx.beginPath();
    tx.ellipse(x, y, r, r * (0.7 + hash(i, 16, seed) * 0.3), hash(i, 17, seed) * 3, 0, Math.PI * 2);
    tx.fill();
  }
  // Foxing: small brown spots.
  for (let i = 0; i < 70; i++) {
    const x = hash(i, 18, seed) * W;
    const y = hash(i, 19, seed) * H;
    const r = (0.001 + hash(i, 20, seed) ** 3 * 0.006) * W;
    tx.fillStyle = `rgba(0,0,0,${0.1 + hash(i, 21, seed) * 0.2})`;
    tx.beginPath();
    tx.arc(x, y, r, 0, Math.PI * 2);
    tx.fill();
  }
  // A fold crease across the sheet.
  const cy = H * (0.35 + hash(seed, 22) * 0.3);
  const cg = tx.createLinearGradient(0, cy - H * 0.02, 0, cy + H * 0.02);
  cg.addColorStop(0, 'rgba(0,0,0,0)');
  cg.addColorStop(0.45, 'rgba(0,0,0,0.1)');
  cg.addColorStop(0.5, 'rgba(255,255,255,0.14)');
  cg.addColorStop(0.6, 'rgba(0,0,0,0)');
  tx.fillStyle = cg;
  tx.fillRect(0, cy - H * 0.02, W, H * 0.04);

  // G — ink.
  const ink = mk();
  const ix = ink.x;
  ix.fillStyle = '#000';
  ix.fillRect(0, 0, W, H);
  const base = H * 0.19;
  const sizes = f.lines.map((l) => (l.style === 'caps' ? base * 0.2 * 1.6 : l.style === 'italic' ? base * 0.86 : base));
  // Fit the widest line to 84% of the sheet.
  let scale = 1;
  f.lines.forEach((l) => {
    applyType(ix, spec(l.style, base));
    const wLine = ix.measureText(l.text).width;
    scale = Math.min(scale, (W * 0.8) / Math.max(1, wLine));
  });
  const gaps = f.lines.map((l) => (l.style === 'caps' ? 1.9 : 1.08));
  const lineH = f.lines.map((l, i) => sizes[i] * scale * gaps[i]);
  const total = lineH.reduce((a, b) => a + b, 0);
  let y = H * 0.52 - total / 2;
  const lines: Vector4[] = [];
  f.lines.forEach((l, i) => {
    const sp = spec(l.style, base * scale);
    y += lineH[i];
    const baseline = y - lineH[i] * (l.style === 'caps' ? 0.28 : 0.2);
    applyType(ix, sp);
    const m = ix.measureText(l.text);
    // A little bleed under the letter, then the letter.
    ix.save();
    ix.shadowColor = 'rgba(255,255,255,0.55)';
    ix.shadowBlur = Math.max(1.5, sp.size * 0.03);
    ix.globalAlpha = 0.5;
    ix.fillText(l.text, W / 2, baseline);
    ix.restore();
    ix.fillText(l.text, W / 2, baseline);
    const x0 = W / 2 - m.width / 2;
    const x1 = W / 2 + m.width / 2;
    const top = baseline - (m.actualBoundingBoxAscent || sp.size * 0.7);
    const bot = baseline + (m.actualBoundingBoxDescent || sp.size * 0.2);
    // Texture UV: v runs up.
    lines.push(new Vector4(x0 / W, 1 - bot / H, x1 / W, 1 - top / H));
  });
  if (f.stamp) {
    const sx = W * 0.8;
    const sy = H * 0.84;
    ix.save();
    ix.translate(sx, sy);
    ix.rotate(-0.05);
    applyType(ix, { family: 'mono', weight: 500, size: H * 0.034, tracking: 0.28, color: '#fff', align: 'center' });
    ix.globalAlpha = 0.72;
    ix.fillText(f.stamp, 0, 0);
    ix.lineWidth = Math.max(1, H * 0.0035);
    ix.strokeStyle = '#fff';
    const sw = ix.measureText(f.stamp).width + H * 0.05;
    ix.strokeRect(-sw / 2, -H * 0.052, sw, H * 0.074);
    ix.restore();
    lines.push(new Vector4((sx - sw / 2) / W, 1 - (sy + H * 0.03) / H, (sx + sw / 2) / W, 1 - (sy - H * 0.06) / H));
  }

  // B — burn time: distance from the ignition point, made irregular, with a
  // couple of holes that burn through on their own.
  const lw = Math.max(64, Math.round(W / 4));
  const lh = Math.max(44, Math.round(H / 4));
  const burn = document.createElement('canvas');
  burn.width = lw;
  burn.height = lh;
  const bx = burn.getContext('2d', { willReadFrequently: true })!;
  const bimg = bx.createImageData(lw, lh);
  const [ix0, iy0] = f.ignite;
  const aspect = W / H;
  const field = new Float32Array(lw * lh);
  let maxT = 0;
  for (let j = 0; j < lh; j++)
    for (let i = 0; i < lw; i++) {
      const u = i / (lw - 1);
      const v = 1 - j / (lh - 1);
      let d = Math.hypot((u - ix0) * aspect, v - iy0);
      for (const [hx, hy] of f.holes) d = Math.min(d, 0.12 + Math.hypot((u - hx) * aspect, v - hy) * 1.6);
      const n = fbm(u * 5.5, v * 5.5 * (1 / aspect) + 3.7, seed + 5, 4);
      const t = d + (n - 0.5) * 0.42;
      field[j * lw + i] = t;
      maxT = Math.max(maxT, t);
    }
  for (let k = 0; k < field.length; k++) {
    const t = Math.max(0, field[k] / maxT);
    field[k] = t;
    const b = Math.round(t * 255);
    bimg.data[k * 4] = b;
    bimg.data[k * 4 + 1] = b;
    bimg.data[k * 4 + 2] = b;
    bimg.data[k * 4 + 3] = 255;
  }
  bx.putImageData(bimg, 0, 0);
  const burnFull = mk();
  burnFull.x.imageSmoothingEnabled = true;
  burnFull.x.imageSmoothingQuality = 'high';
  burnFull.x.drawImage(burn, 0, 0, W, H);

  // Pack.
  const out = mk();
  const pack = out.x.createImageData(W, H);
  const T = tone.x.getImageData(0, 0, W, H).data;
  const I = ink.x.getImageData(0, 0, W, H).data;
  const B = burnFull.x.getImageData(0, 0, W, H).data;
  const A = sil.x.getImageData(0, 0, W, H).data;
  const P = pack.data;
  for (let k = 0; k < P.length; k += 4) {
    P[k] = T[k];
    P[k + 1] = I[k];
    P[k + 2] = B[k];
    P[k + 3] = A[k + 3];
  }
  out.x.putImageData(pack, 0, 0);
  const texture = new CanvasTexture(out.c);
  texture.colorSpace = NoColorSpace;
  texture.premultiplyAlpha = false;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 8;
  texture.needsUpdate = true;

  // Ash: points inside the sheet, each with the moment the fire reaches it.
  const uv = new Float32Array(ashCount * 2);
  const bt = new Float32Array(ashCount);
  let n = 0;
  let guard = 0;
  while (n < ashCount && guard++ < ashCount * 30) {
    const u = hash(guard, 31, seed);
    const v = hash(guard, 32, seed);
    const px = Math.min(W - 1, Math.floor(u * W));
    const py = Math.min(H - 1, Math.floor((1 - v) * H));
    if (A[(py * W + px) * 4 + 3] < 128) continue;
    uv[n * 2] = u;
    uv[n * 2 + 1] = v;
    const li = Math.min(lw - 1, Math.floor(u * lw));
    const lj = Math.min(lh - 1, Math.floor((1 - v) * lh));
    bt[n] = field[lj * lw + li];
    n++;
  }
  return { texture, lines, ash: { uv, burn: bt, count: n } };
}
