/**
 * The fields the prologue's gas is made of, built once on the CPU:
 *
 *   noise3D      a tileable fractal noise volume (the gas's billows)
 *   letterField  the chapter's years as a DENSITY FIELD, not as type: the
 *                phrase is set once on a canvas and softened into three
 *                channels — R the letters' body (softly blurred, so its
 *                edges are gradients the shader can erode and warp), G a
 *                wide halo (gas that clings around the forms), B the order
 *                in which each part condenses (word by word, left to right).
 *                The shader never draws these as an image; it reads them as
 *                how much gas there is at each point of a slab of air.
 */
import { fontFamilies } from '@/systems/textures/typeset';
import { ClampToEdgeWrapping, Data3DTexture, DataTexture, LinearFilter, LinearMipmapLinearFilter, RedFormat, RepeatWrapping, RGBAFormat, UnsignedByteType } from 'three';

// ─── noise ─────────────────────────────────────────────────────────────────

/** Periodic value noise, four octaves, baked into a size³ volume (0..255). */
export function noise3D(size = 64) {
  const data = new Uint8Array(size * size * size);
  let seed = 1337;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const octaves = [4, 8, 16, 32].filter((p) => p <= size);
  const lattices = octaves.map((p) => Float32Array.from({ length: p * p * p }, rnd));
  const fade = (x: number) => x * x * (3 - 2 * x);
  let k = 0;
  let min = 1e9;
  let max = -1e9;
  const tmp = new Float32Array(size * size * size);
  for (let z = 0; z < size; z++)
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        let v = 0;
        let amp = 0.55;
        octaves.forEach((p, o) => {
          const L = lattices[o];
          const fx = (x / size) * p;
          const fy = (y / size) * p;
          const fz = (z / size) * p;
          const x0 = Math.floor(fx);
          const y0 = Math.floor(fy);
          const z0 = Math.floor(fz);
          const tx = fade(fx - x0);
          const ty = fade(fy - y0);
          const tz = fade(fz - z0);
          const at = (i: number, j: number, l: number) => L[((l % p) * p + (j % p)) * p + (i % p)];
          const c00 = at(x0, y0, z0) * (1 - tx) + at(x0 + 1, y0, z0) * tx;
          const c10 = at(x0, y0 + 1, z0) * (1 - tx) + at(x0 + 1, y0 + 1, z0) * tx;
          const c01 = at(x0, y0, z0 + 1) * (1 - tx) + at(x0 + 1, y0, z0 + 1) * tx;
          const c11 = at(x0, y0 + 1, z0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1, z0 + 1) * tx;
          v += amp * ((c00 * (1 - ty) + c10 * ty) * (1 - tz) + (c01 * (1 - ty) + c11 * ty) * tz);
          amp *= 0.5;
        });
        tmp[k++] = v;
        if (v < min) min = v;
        if (v > max) max = v;
      }
  for (let i = 0; i < tmp.length; i++) data[i] = Math.round(((tmp[i] - min) / (max - min)) * 255);
  const tex = new Data3DTexture(data, size, size, size);
  tex.format = RedFormat;
  tex.type = UnsignedByteType;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.wrapS = tex.wrapT = tex.wrapR = RepeatWrapping;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  return tex;
}

// ─── the words, as a field ─────────────────────────────────────────────────

export interface LetterField {
  texture: DataTexture;
  /** Physical size of the slab the phrase occupies (m). */
  width: number;
  height: number;
}

/** Blur a canvas by drawing it down and back up (bilinear), `passes` times at `scale`. */
function soften(src: HTMLCanvasElement, scale: number, passes: number) {
  const w = src.width;
  const h = src.height;
  const small = document.createElement('canvas');
  small.width = Math.max(2, Math.round(w * scale));
  small.height = Math.max(2, Math.round(h * scale));
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const sg = small.getContext('2d')!;
  const og = out.getContext('2d')!;
  sg.imageSmoothingEnabled = og.imageSmoothingEnabled = true;
  sg.imageSmoothingQuality = og.imageSmoothingQuality = 'high';
  og.drawImage(src, 0, 0);
  for (let i = 0; i < passes; i++) {
    sg.clearRect(0, 0, small.width, small.height);
    sg.drawImage(out, 0, 0, small.width, small.height);
    og.clearRect(0, 0, w, h);
    og.drawImage(small, 0, 0, w, h);
  }
  return og.getImageData(0, 0, w, h).data;
}

/**
 * The phrase as a density field. Landscape: one line. Portrait: the number
 * above the words, so it can be large on a narrow screen.
 */
export function letterField(words: string, portrait: boolean): LetterField {
  const [num, ...rest] = words.split(' ');
  const tail = rest.join(' ');
  const W = portrait ? 1152 : 1536;
  const H = portrait ? 960 : 384;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  // The site's Montserrat at its heaviest: the gas's letterform is a density field, blurred and
  // eroded, and only thick, even strokes survive that. (The fonts are ready before the world mounts.)
  const fam = `${fontFamilies().sans}, "Helvetica Neue", Helvetica, Arial, sans-serif`;
  g.fillStyle = '#fff';
  g.textBaseline = 'alphabetic';
  // Where each word lies, for the order channel: [x0, x1, y0, y1, order].
  const spans: [number, number, number, number, number][] = [];
  const setWord = (text: string, x: number, y: number, size: number, order: number) => {
    g.font = `800 ${size}px ${fam}`;
    if ('letterSpacing' in g) (g as unknown as { letterSpacing: string }).letterSpacing = `${Math.round(size * 0.02)}px`;
    g.fillText(text, x, y);
    const m = g.measureText(text);
    spans.push([x, x + m.width, y - size * 0.8, y + size * 0.1, order]);
    return m.width;
  };
  if (!portrait) {
    const parts = [num, ...tail.split(' ')];
    // Fit the line inside the field with a margin (the gas needs room around the forms).
    let size = 230;
    g.font = `800 ${size}px ${fam}`;
    const natural = parts.reduce((a, p) => a + g.measureText(p).width, 0) + size * 0.34 * (parts.length - 1);
    size = Math.min(size, (size * W * 0.86) / natural);
    g.font = `800 ${size}px ${fam}`;
    const gap = size * 0.34;
    const widths = parts.map((p) => g.measureText(p).width);
    let x = (W - (widths.reduce((a, b) => a + b, 0) + gap * (parts.length - 1))) / 2;
    parts.forEach((p, i) => {
      setWord(p, x, H * 0.5 + size * 0.36, size, i / (parts.length - 1));
      x += widths[i] + gap;
    });
  } else {
    let big = 300;
    g.font = `800 ${big}px ${fam}`;
    // (Narrower than the field: a phone's frame is, once the camera nears the words.)
    big = Math.min(big, (big * W * 0.72) / g.measureText(num).width);
    g.font = `800 ${big}px ${fam}`;
    setWord(num, (W - g.measureText(num).width) / 2, H * 0.47, big, 0);
    let small = 150;
    g.font = `800 ${small}px ${fam}`;
    const tw = tail.split(' ');
    small = Math.min(small, (small * W * 0.7) / (tw.reduce((a, p) => a + g.measureText(p).width, 0) + small * 0.34 * (tw.length - 1)));
    g.font = `800 ${small}px ${fam}`;
    const gap = small * 0.34;
    const widths = tw.map((p) => g.measureText(p).width);
    let x = (W - (widths.reduce((a, b) => a + b, 0) + gap * (tw.length - 1))) / 2;
    tw.forEach((p, i) => {
      // (Close under the number — lower in the field it would sink into the mist over the road.)
      setWord(p, x, H * 0.72, small, 0.5 + (0.5 * i) / Math.max(1, tw.length - 1));
      x += widths[i] + gap;
    });
  }
  // (Portrait sets the words smaller within the field: soften less, or the thinner strokes blur away.)
  const body = soften(c, portrait ? 0.34 : 0.25, 1);
  const halo = soften(c, 1 / 14, 3);
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      // (Canvas rows run top-down; the texture's run bottom-up.)
      const o = ((H - 1 - y) * W + x) * 4;
      data[o] = body[i + 3];
      data[o + 1] = halo[i + 3];
      // Order: which word, and a little later further along it.
      let ord = 1;
      let best = 1e9;
      for (const [x0, x1, y0, y1, k] of spans) {
        const dx = x < x0 ? x0 - x : x > x1 ? x - x1 : 0;
        const dy = y < y0 ? y0 - y : y > y1 ? y - y1 : 0;
        const d = dx + dy;
        if (d < best) {
          best = d;
          ord = Math.min(1, k * 0.82 + 0.16 * Math.min(1, Math.max(0, (x - x0) / Math.max(1, x1 - x0))));
        }
      }
      data[o + 2] = Math.round(ord * 255);
      data[o + 3] = 255;
    }
  const texture = new DataTexture(data, W, H, RGBAFormat, UnsignedByteType);
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
  texture.wrapS = texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;
  // Physical size: wide and low in landscape, stacked in portrait.
  return portrait ? { texture, width: 4.2, height: 3.5 } : { texture, width: 6.4, height: 1.6 };
}
