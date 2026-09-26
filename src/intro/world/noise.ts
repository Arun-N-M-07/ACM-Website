/**
 * Procedural textures for the film's air (no image files are downloaded):
 * a tileable value-noise FBM, and a soft round glow.
 */
import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping } from 'three';

/** Deterministic hash → 0..1. */
export const hash = (x: number, y: number, s = 0) => {
  const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return v - Math.floor(v);
};

/** Tileable value noise on an integer lattice of `period` cells. */
function valueNoise(x: number, y: number, period: number, seed: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const w = (a: number) => ((a % period) + period) % period;
  const a = hash(w(x0), w(y0), seed);
  const b = hash(w(x0 + 1), w(y0), seed);
  const c = hash(w(x0), w(y0 + 1), seed);
  const d = hash(w(x0 + 1), w(y0 + 1), seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/**
 * Tileable FBM, packed as RGBA: each channel an independent field at a
 * different base frequency (R coarse … A fine), so a shader can build soft,
 * non-repeating billows from one texture.
 */
export function noiseTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const bases = [4, 8, 16, 32];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const o = (y * size + x) * 4;
      for (let ch = 0; ch < 4; ch++) {
        let amp = 0.5;
        let sum = 0;
        let norm = 0;
        let per = bases[ch];
        for (let oct = 0; oct < 4; oct++) {
          sum += amp * valueNoise((x / size) * per, (y / size) * per, per, ch * 13 + oct * 7);
          norm += amp;
          amp *= 0.5;
          per *= 2;
        }
        img.data[o + ch] = Math.round((sum / norm) * 255);
      }
    }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.colorSpace = NoColorSpace;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** A soft round glow (for lights seen through mist). */
export function glowTexture(size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.08, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.22)');
  g.addColorStop(0.62, 'rgba(255,255,255,0.05)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}
