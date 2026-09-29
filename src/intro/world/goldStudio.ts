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
 */
import { CanvasTexture, EquirectangularReflectionMapping, PMREMGenerator, SRGBColorSpace, type WebGLRenderer, type WebGLRenderTarget } from 'three';

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
const GROUND: [number, string][] = [
  // The shelf of shadow under the horizon, then the shadowed cloud below it.
  [0.535, '#3a2b1c'],
  [0.57, '#2f2419'],
  [0.62, '#6c6255'],
  [0.68, '#7d7366'],
  [0.8, '#554c42'],
  [1, '#3d3731'],
];

function paintStudio(gl: WebGLRenderer) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;
  // The front (what the faces see): champagne, deepening toward the horizon.
  rows(x, [...SKY, [0.445, '#e8dcc3'], [0.47, '#d6c3a0'], [0.5, '#b89f77'], [0.515, '#7d6547'], ...GROUND]);
  // Behind and to the sides (what the letters' sides see): the same sky and ground, the band deep amber.
  const back = document.createElement('canvas');
  back.width = W;
  back.height = H;
  const b = back.getContext('2d')!;
  rows(b, [...SKY, [0.445, '#b69568'], [0.47, '#7a5a37'], [0.5, '#523b24'], [0.515, '#3d2c1b'], ...GROUND]);
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
    [0.655, 40, 'rgba(255,250,240,0.75)'],
    [0.715, 34, 'rgba(255,252,246,0.9)'],
    [0.79, 46, 'rgba(255,248,236,0.8)'],
    [0.865, 38, 'rgba(255,246,232,0.7)'],
  ] as [number, number, string][]) {
    x.fillStyle = col;
    x.fillRect(u * W - w / 2, 0.435 * H, w, 0.07 * H);
  }
  x.fillStyle = 'rgba(104,82,54,0.5)';
  for (const u of [0.685, 0.752, 0.83]) x.fillRect(u * W - 16, 0.44 * H, 32, 0.065 * H);
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
    slant(u, 18, 'rgba(255,250,238,0.8)');
    slant(u + 0.022, 14, 'rgba(96,74,46,0.35)');
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
  const tex = new CanvasTexture(c);
  tex.mapping = EquirectangularReflectionMapping;
  tex.colorSpace = SRGBColorSpace;
  const pm = new PMREMGenerator(gl);
  const target = pm.fromEquirectangular(tex);
  pm.dispose();
  tex.dispose();
  return target;
}
