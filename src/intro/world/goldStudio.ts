/**
 * The light ACM-CEG's gold reflects above the cloud (world/AcmCeg.tsx). A studio is painted once on a
 * canvas and prefiltered for image-based reflections, like the stone's chrome (chromeStudio.ts), but
 * lit for gold as a jeweller would light a piece: every surface of the letters sees its own part of it.
 *
 * Held facing the camera over the cloud, the letters' faces look back toward the camera, a few degrees
 * above the horizon (u ≈ 0.75, x ≈ 768 here). There they find champagne light, deepening toward the
 * horizon, in soft windows that give each letter its own tone. Their top edges roll up through a broad
 * warm key light above, and take the brightest highlights. Their sides look away past them, behind
 * the name, into deep amber: that is the depth between a face and its sides. Their undersides look
 * down into a shelf of shadow under the horizon, which gives them weight. While a letter still leans
 * forward, rising out of the cloud, its face looks down into the shadowed cloud below and reads as a
 * dark, muted silhouette; as it straightens into place, its reflection climbs through the shelf into
 * the champagne band, and the light catches it. The colour of the gold is the metal's own; this light
 * only shapes it.
 *
 * Its lights are brighter than white, as a studio's are (it is painted, then lifted into high dynamic
 * range): the key above, a fine line along its top, the soft box the letters' upper faces see, and two
 * narrow strip lights at the sides. On polished gold that is the difference between the colour of gold
 * and gold catching the light: the rolled edges and the curves of the C and G carry lines of light
 * brighter than the metal's colour, the faces run from a luminous champagne at their tops to deep
 * amber at their feet, and the sides stay dark.
 */
import { DataTexture, DataUtils, EquirectangularReflectionMapping, HalfFloatType, LinearFilter, LinearSRGBColorSpace, PMREMGenerator, RGBAFormat, type WebGLRenderer, type WebGLRenderTarget } from 'three';

/**
 * One studio per renderer, made once and kept. It is never rebuilt as the opening streams out and
 * back in (a render target made in a component's factory on every mount would build up over a
 * looping journey).
 */
const studios = new WeakMap<WebGLRenderer, WebGLRenderTarget>();
export function goldStudio(gl: WebGLRenderer) {
  let s = studios.get(gl);
  if (!s) {
    s = paintStudio(gl);
    studios.set(gl, s);
  }
  return s;
}

const W = 1024;
const H = 512;

/** Rows run from the zenith (top, 0) to the nadir (bottom, 1), the horizon across the middle. */
function rows(x: CanvasRenderingContext2D, stops: [number, string][]) {
  const g = x.createLinearGradient(0, 0, 0, H);
  for (const [at, col] of stops) g.addColorStop(at, col);
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
}

/** The sky and the ground, shared by the front and the back. */
const SKY: [number, string][] = [
  [0, '#8a9aae'],
  [0.2, '#c3ccd6'],
  [0.33, '#e9e8e3'],
  // The key: a broad warm light above, for the top edges.
  [0.37, '#fff8ea'],
  [0.425, '#fff3e0'],
];
/** Behind the name the sky is dim and warm: the key hangs in front (what a letter's sides see there). */
const BACK_SKY: [number, string][] = [
  [0, '#6f7784'],
  [0.2, '#8a8b8c'],
  [0.33, '#9c9384'],
  [0.37, '#ac9676'],
  [0.425, '#9a7b52'],
];
const GROUND: [number, string][] = [
  // The shelf of shadow under the horizon, then the shadowed cloud below it.
  [0.535, '#2c1f12'],
  [0.57, '#241a10'],
  [0.62, '#5f564a'],
  [0.68, '#6e6558'],
  [0.8, '#4d453c'],
  [1, '#37312b'],
];

function paintStudio(gl: WebGLRenderer) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;
  // The front (what the faces see, their tops at ≈ 0.47 and their feet at ≈ 0.51): a soft box of warm
  // light over champagne, deepening through gold to amber, then shadow.
  rows(x, [...SKY, [0.445, '#fbeed3'], [0.465, '#f2dcae'], [0.48, '#d6b57a'], [0.495, '#9c7440'], [0.51, '#5c3e1e'], [0.525, '#3a2812'], ...GROUND]);
  // Behind and to the sides (what the letters' sides see): a dimmer sky, the same ground, the band deep amber.
  const back = document.createElement('canvas');
  back.width = W;
  back.height = H;
  const b = back.getContext('2d')!;
  rows(b, [...BACK_SKY, [0.445, '#8e6b3c'], [0.47, '#5e4222'], [0.5, '#3c2a16'], [0.515, '#2c1f10'], ...GROUND]);
  // …laid over the front everywhere but the front: full behind the name (u ≈ 0.25), gone toward the
  // camera (u ≈ 0.75), blending between (so the letters at the ends of the word are a shade deeper).
  const mask = b.createLinearGradient(0, 0, W, 0);
  for (let i = 0; i <= 64; i++) {
    const u = i / 64;
    const d = Math.min(Math.abs(u - 0.25), 1 - Math.abs(u - 0.25));
    const k = Math.min(1, Math.max(0, (d - 0.28) / 0.16));
    mask.addColorStop(u, `rgba(0,0,0,${(1 - k * k * (3 - 2 * k)).toFixed(3)})`);
  }
  b.globalCompositeOperation = 'destination-in';
  b.fillStyle = mask;
  b.fillRect(0, 0, W, H);
  x.drawImage(back, 0, 0);
  // Soft windows in the champagne band, and deeper places between them: no two letters hold quite
  // the same tone.
  x.filter = 'blur(16px)';
  for (const [u, w, col] of [
    [0.655, 40, 'rgba(255,250,240,0.45)'],
    [0.715, 34, 'rgba(255,252,246,0.55)'],
    [0.79, 46, 'rgba(255,248,236,0.5)'],
    [0.865, 38, 'rgba(255,246,232,0.4)'],
  ] as [number, number, string][]) {
    x.fillStyle = col;
    x.fillRect(u * W - w / 2, 0.435 * H, w, 0.045 * H);
  }
  x.fillStyle = 'rgba(92,66,34,0.4)';
  for (const u of [0.685, 0.752, 0.83]) x.fillRect(u * W - 16, 0.44 * H, 32, 0.05 * H);
  // Soft diagonal bands of light across the band: over a letter's face they fall as a slanting glare,
  // at a different place on each letter.
  // (Each a band of light with a softer, deeper one beside it, as a window's reflection has its frame.)
  x.filter = 'blur(4px)';
  const slant = (u: number, w: number, fill: string) => {
    x.fillStyle = fill;
    x.beginPath();
    x.moveTo(u * W, 0.43 * H);
    x.lineTo(u * W + w, 0.43 * H);
    x.lineTo(u * W + w + 26, 0.53 * H);
    x.lineTo(u * W + 26, 0.53 * H);
    x.closePath();
    x.fill();
  };
  for (const u of [0.64, 0.705, 0.77, 0.84, 0.9]) {
    slant(u, 18, 'rgba(255,250,238,0.6)');
    slant(u + 0.022, 14, 'rgba(80,56,28,0.4)');
  }
  // A few dark, liquid streaks through the sky and the ground: the contrast polished metal needs.
  x.filter = 'blur(10px)';
  x.strokeStyle = 'rgba(52,40,28,0.8)';
  x.lineCap = 'round';
  for (let k = 0; k < 7; k++) {
    const u = ((k * 0.61803 + 0.13) % 1) * W;
    const v = (0.1 + ((k * 0.37) % 0.18)) * H;
    x.lineWidth = 12 + ((k * 7) % 18);
    x.beginPath();
    x.moveTo(u, v);
    x.bezierCurveTo(u + 70, v + 30, u + 130, v - 40, u + 210, v + 20 + ((k * 13) % 30));
    x.stroke();
  }
  // A fine bright line along the top of the key: the sharpest glint on the letters' upper edges.
  x.filter = 'blur(1.5px)';
  x.fillStyle = '#fffdf6';
  x.fillRect(0, 0.39 * H, W, 0.008 * H);
  const tex = lift(x.getImageData(0, 0, W, H).data);
  const pm = new PMREMGenerator(gl);
  const target = pm.fromEquirectangular(tex);
  pm.dispose();
  tex.dispose();
  return target;
}

const smooth = (a: number, b: number, v: number) => {
  const k = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/**
 * The painted studio, lifted into high dynamic range: how many times brighter than its paint each
 * place is (row r from the zenith, 0–1; u around, 0–1).
 */
function gain(r: number, u: number) {
  // The key above (brightest along its fine top line) and the soft box below it that the faces see.
  // The key hangs in front of the name: full toward the camera (u ≈ 0.75), a third of it behind, where
  // only the sides of the letters look (so a side turned up toward the sky stays a side).
  const du0 = Math.min(Math.abs(u - 0.75), 1 - Math.abs(u - 0.75));
  const front = 0.3 + 0.7 * (1 - smooth(0.12, 0.3, du0));
  const key = front * (1.4 * smooth(0.31, 0.37, r) * (1 - smooth(0.415, 0.44, r)) + 3.5 * Math.exp(-(((r - 0.392) / 0.006) ** 2)));
  const box = 0.3 * smooth(0.425, 0.445, r) * (1 - smooth(0.46, 0.485, r));
  // Two narrow strip lights at the sides (u 0.5 and 0/1), tall: the rolled edges of the stems and the
  // C's and G's curves find them, as vertical lines of light.
  const du = Math.min(Math.abs(u - 0.5), Math.abs(u), Math.abs(1 - u));
  const strip = 3 * Math.exp(-((du / 0.011) ** 2)) * smooth(0.28, 0.33, r) * (1 - smooth(0.54, 0.6, r));
  return 1 + key + box + strip;
}

/** The painted studio (sRGB, zenith first) as a linear, high-dynamic-range equirectangular map. */
function lift(px: Uint8ClampedArray) {
  const data = new Uint16Array(W * H * 4);
  const lin = new Float32Array(256);
  for (let i = 0; i < 256; i++) lin[i] = toLinear(i / 255);
  const one = DataUtils.toHalfFloat(1);
  for (let j = 0; j < H; j++) {
    const r = (j + 0.5) / H;
    // (A data texture's first row is the bottom of the map: the nadir.)
    const row = (H - 1 - j) * W * 4;
    for (let i = 0; i < W; i++) {
      const g = gain(r, (i + 0.5) / W);
      const k = (j * W + i) * 4;
      const o = row + i * 4;
      data[o] = DataUtils.toHalfFloat(lin[px[k]] * g);
      data[o + 1] = DataUtils.toHalfFloat(lin[px[k + 1]] * g);
      data[o + 2] = DataUtils.toHalfFloat(lin[px[k + 2]] * g);
      data[o + 3] = one;
    }
  }
  const tex = new DataTexture(data, W, H, RGBAFormat, HalfFloatType);
  tex.mapping = EquirectangularReflectionMapping;
  tex.colorSpace = LinearSRGBColorSpace;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
