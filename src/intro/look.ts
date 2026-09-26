/**
 * The film's light: its colour script, as a function of film time.
 *
 *   mystery   before dawn — cool, pale mist; silhouettes; a few lit windows
 *             and lamps are the only warm things in the world
 *   story     the mist holds; the air slowly warms
 *   reveal    first light: the sun clears the horizon behind the mist, the
 *             ground mist sinks and thins, the tower comes out first, then
 *             the red — lit, not painted
 *   hero      the richest state: low gold sun raking the facade, long
 *             shadows, a breath of mist left lying on the lawns
 *   ascension broader morning light; distance haze instead of mist
 *   cloud     white, soft, low contrast, no shadows
 *   descent   the white greys, then darkens, to black
 *   tunnel    darkness, with the tunnel's own controlled light
 *
 * Nothing here is a filter: every value drives a physical input — fog,
 * ground mist, the sun, the sky, the lamps, exposure — and the world
 * responds. Values are written once per frame into `look` (see
 * IntroAtmosphere) and read by the lights, the sky, the mist and the
 * materials.
 */
import { Color, Vector3 } from 'three';
import { T } from './timeline';

// ─── keyframed tracks ─────────────────────────────────────────────────────────

type Key<V> = [number, V];

const sstep = (x: number) => x * x * (3 - 2 * x);

function locate(keys: Key<unknown>[], t: number): [number, number, number] {
  if (t <= keys[0][0]) return [0, 0, 0];
  const n = keys.length;
  if (t >= keys[n - 1][0]) return [n - 1, n - 1, 0];
  let i = 0;
  while (i < n - 2 && t > keys[i + 1][0]) i++;
  const a = keys[i][0];
  const b = keys[i + 1][0];
  return [i, i + 1, sstep((t - a) / (b - a))];
}

export function numberTrack(keys: Key<number>[]) {
  return (t: number) => {
    const [i, j, w] = locate(keys, t);
    return keys[i][1] + (keys[j][1] - keys[i][1]) * w;
  };
}

/** Colour track: interpolates in linear RGB. */
export function colorTrack(keys: Key<string>[]) {
  const cols = keys.map(([t, c]) => [t, new Color(c)] as Key<Color>);
  return (t: number, out: Color) => {
    const [i, j, w] = locate(cols, t);
    return out.copy(cols[i][1]).lerp(cols[j][1], w);
  };
}

// ─── the script ───────────────────────────────────────────────────────────────

const R = T.reveal;

/** Distance haze (the scene's FogExp2 density). */
const fogDensity = numberTrack([
  [0, 0.034],
  [9, 0.03],
  [T.build, 0.024],
  [19, 0.0138],
  [22.5, 0.0102],
  [25, 0.0082],
  [26.2, 0.0068],
  [R, 0.0042],
  [R + 2.5, 0.0031],
  [T.heroEnd, 0.0028],
  [42, 0.0021],
  [T.cloudIn - 0.2, 0.0022],
  [T.cloudIn + 0.6, 0.0045],
  [T.cloudIn + 1.3, 0.009],
  [T.cloudDeep, 0.0125],
  [T.descent, 0.0135],
  [49.4, 0.018],
  [50.4, 0.03],
  [T.tunnel, 0.036],
  [52.6, 0.024],
  [T.events, 0.02],
  [T.end, 0.028],
]);

/** The colour distant things dissolve into. */
const fogColor = colorTrack([
  [0, '#5b6570'],
  [9, '#626b75'],
  [T.build, '#767b80'],
  [21, '#a39b92'],
  [24.5, '#bba998'],
  [R, '#c7b3a0'],
  [T.heroEnd, '#c9b8a6'],
  [42.5, '#b9c0c6'],
  [T.cloudIn, '#c9d0d5'],
  [T.cloudIn + 1, '#dde2e5'],
  [T.cloudDeep, '#e6e9ea'],
  [T.descent, '#d9dde0'],
  [49.4, '#8d959c'],
  [50.4, '#2a3037'],
  [T.tunnel, '#0c0e12'],
  [T.end, '#0a0c10'],
]);

/** Ground mist: density at the ground, how quickly it thins with height (m), how much of it there is. */
const mistDensity = numberTrack([
  [0, 0.085],
  [9, 0.08],
  [T.build, 0.066],
  [20, 0.046],
  [23.5, 0.036],
  [26, 0.032],
  [R + 0.6, 0.026],
  [R + 4, 0.024],
  [T.heroEnd, 0.022],
  [42, 0.014],
  [44, 0.006],
  [T.cloudDeep, 0],
]);
/** How high the ground mist reaches: a deep bank at first, a veil lying on the lawns by the hero. */
const mistHeight = numberTrack([
  [0, 10],
  [T.build, 8.5],
  [20, 5.2],
  [24, 2.6],
  [R, 1.3],
  [T.heroEnd, 1.1],
  [42, 2],
  [44, 6],
]);

/** Sun elevation (degrees): below the horizon before dawn, rising through the reveal. */
const sunElevation = numberTrack([
  [0, -6],
  [T.build, -1.5],
  [21, 1.5],
  [R, 7.5],
  [T.heroEnd, 10.5],
  [44, 12.5],
]);
/** Direct sunlight intensity (it has to get through the mist). */
const sunIntensity = numberTrack([
  [0, 0],
  [17, 0],
  [21, 0.6],
  [24.5, 1.7],
  [26.3, 2.4],
  [R + 0.5, 3.7],
  [R + 3, 3.4],
  [T.heroEnd, 3.45],
  [43, 3.2],
  [T.cloudIn + 0.8, 1.2],
  [T.cloudDeep, 0.45],
  [T.descent, 0.3],
  [50, 0],
]);
const sunColor = colorTrack([
  [0, '#ff7a3d'],
  [21, '#ff8646'],
  [24.5, '#ffa25e'],
  [R, '#ffb56e'],
  [T.heroEnd, '#ffc485'],
  [44, '#ffd6a6'],
]);

/** Skylight (hemisphere): how much, and its colours. */
const skyIntensity = numberTrack([
  [0, 0.3],
  [T.build, 0.36],
  [21, 0.46],
  [R, 0.56],
  [T.heroEnd, 0.6],
  [43, 0.8],
  [T.cloudIn + 1, 1.35],
  [T.cloudDeep, 1.45],
  [T.descent, 1.2],
  [49.4, 0.55],
  [50.4, 0.1],
  [T.tunnel, 0],
]);
const skyTop = colorTrack([
  [0, '#7686a0'],
  [T.build, '#8491a6'],
  [R, '#a4b4cc'],
  [T.heroEnd, '#a9b8ce'],
  [T.cloudIn + 1, '#e6ebef'],
  [T.descent, '#d7dde2'],
  [50, '#5a6470'],
]);
const skyBottom = colorTrack([
  [0, '#2a2825'],
  [R, '#4e3a2c'],
  [T.heroEnd, '#553e2e'],
  [T.cloudIn + 1, '#bcc2c6'],
  [T.descent, '#9da4aa'],
  [50, '#1b1e22'],
]);

/** The sky dome: zenith, middle, horizon, and the glow around the sun. */
const skyZenith = colorTrack([
  [0, '#1b232d'],
  [T.build, '#233247'],
  [R, '#28507e'],
  [T.heroEnd, '#2d5886'],
  [43, '#3a6795'],
]);
const skyMid = colorTrack([
  [0, '#3d4650'],
  [T.build, '#4c5663'],
  [21, '#667182'],
  [R, '#7f9fbf'],
  [T.heroEnd, '#88a7c4'],
  [43, '#9cb6cc'],
]);
const skyHorizon = colorTrack([
  [0, '#5f666d'],
  [T.build, '#6f6c69'],
  [20, '#a07a64'],
  [R, '#e5b491'],
  [T.heroEnd, '#efc7a4'],
  [43, '#e9d4bf'],
]);

/** Lamps and the building's lit rooms: on before dawn, off as the day arrives. */
const practicals = numberTrack([
  [0, 1],
  [19, 1],
  [24, 0.55],
  [R + 2, 0.12],
  [T.heroEnd, 0.06],
]);

/** Exposure: dim before dawn, fullest in the hero, bright in the cloud, deep in the dark. */
const exposure = numberTrack([
  [0, 0.8],
  [T.build, 0.86],
  [26.2, 0.96],
  // The orchestra arrives: a breath of light as the last of the haze lifts.
  [R + 0.35, 1.12],
  [R + 2.8, 1.03],
  [T.heroEnd, 1.05],
  [T.cloudIn + 1, 1.0],
  [T.cloudDeep, 0.94],
  [T.descent, 0.95],
  [50.4, 1.0],
  [T.tunnel, 1.05],
  [T.end, 1.05],
]);

/** The cloud: how much of it is around the camera (0..1). */
const cloud = numberTrack([
  [T.cloudIn - 1.2, 0],
  [T.cloudIn + 0.4, 0.55],
  [T.cloudIn + 1.6, 1],
  [T.descent + 0.6, 1],
  [49.6, 0.7],
  [50.6, 0.25],
  [51.4, 0],
]);

/**
 * Underground, during the film only: how much of the facility's ambient light
 * the tunnel gets (its own light is the story there). Back to 1 exactly at the
 * handoff, where the Events open under their usual light.
 */
const tunnelAmbient = numberTrack([
  [T.descent, 1],
  [50.5, 0.3],
  [T.tunnel, 0.28],
  [T.events, 0.36],
  [56.2, 0.62],
  [T.end, 1],
]);

/** Darkness below the cloud (0..1): mist becoming night. */
const dark = numberTrack([
  [49, 0],
  [50.4, 0.85],
  [T.tunnel, 1],
]);

// ─── the grade (display space, after tone mapping) ────────────────────────────
// Colour arrives with the light: the misted world is nearly without it, the
// red comes into its own as the sun clears the mist, and everything returns
// to neutral exactly at the handoff (the Events are not graded).

const saturation = numberTrack([
  [0, 0.32],
  [T.story1, 0.4],
  [9, 0.48],
  [T.build, 0.5],
  [19, 0.56],
  [22.5, 0.7],
  [25, 0.9],
  [R, 1.04],
  [R + 4, 1.08],
  [T.heroEnd, 1.06],
  [43, 1.0],
  [T.cloudIn + 1, 0.72],
  [T.descent, 0.66],
  [50.4, 0.6],
  [T.tunnel, 0.86],
  [T.events, 0.94],
  [T.end, 1],
]);
const contrast = numberTrack([
  [0, 0.93],
  [T.build, 0.95],
  [R, 1.05],
  [R + 4, 1.08],
  [T.heroEnd, 1.07],
  [T.cloudIn + 1, 0.9],
  [T.descent, 0.92],
  [T.tunnel, 1.05],
  [T.end, 1],
]);
const lift = colorTrack([
  [0, '#07090d'],
  [T.build, '#080a0d'],
  [R, '#0a0704'],
  [T.heroEnd, '#090603'],
  [T.cloudIn + 1, '#0a0a0b'],
  [T.descent, '#050607'],
  [T.tunnel, '#010203'],
  [T.end, '#000000'],
]);
const gain = colorTrack([
  [0, '#e9eef7'],
  [T.story1, '#f1efef'],
  [T.build, '#f4f0ea'],
  [R, '#fff7ec'],
  [T.heroEnd, '#fff5e8'],
  [43, '#fbf8f3'],
  [T.cloudIn + 1, '#f6f8fa'],
  [T.tunnel, '#f4f7fc'],
  [T.end, '#ffffff'],
]);
const vignette = numberTrack([
  [0, 0.32],
  [R, 0.22],
  [T.heroEnd, 0.2],
  [T.cloudIn + 1, 0.1],
  [T.descent, 0.24],
  [T.tunnel, 0.3],
  [T.events, 0.22],
  [T.end, 0],
]);
const bloom = numberTrack([
  [0, 0.42],
  [T.build, 0.38],
  [26.2, 0.3],
  [R + 0.35, 0.42],
  [R + 2.8, 0.22],
  [T.heroEnd, 0.2],
  [T.cloudIn + 1, 0.14],
  [T.descent, 0.12],
  [T.tunnel, 0.34],
  [T.events, 0.42],
  [T.end - 0.8, 0.3],
  [T.end, 0],
]);

// ─── the frame's values ───────────────────────────────────────────────────────

export const look = {
  fogColor: new Color(),
  fogDensity: 0.03,
  mist: { density: 0.08, height: 10 },
  sun: { dir: new Vector3(), color: new Color(), intensity: 0, elevation: 0 },
  sky: { intensity: 0.4, top: new Color(), bottom: new Color() },
  dome: { zenith: new Color(), mid: new Color(), horizon: new Color() },
  practicals: 1,
  exposure: 1,
  cloud: 0,
  dark: 0,
  tunnelAmbient: 1,
  grade: { saturation: 1, contrast: 1, lift: new Color(0, 0, 0), gain: new Color(1, 1, 1), vignette: 0, bloom: 0 },
};

/** The sun's azimuth: low in the east, so it rakes across the south facade from the right. */
const SUN_AZIMUTH = new Vector3(0.93, 0, 0.37).normalize();

/** Evaluate the script at film time t into `look`. */
export function evaluateLook(t: number) {
  const L = look;
  fogColor(t, L.fogColor);
  L.fogDensity = fogDensity(t);
  L.mist.density = mistDensity(t);
  L.mist.height = mistHeight(t);
  const el = (sunElevation(t) * Math.PI) / 180;
  L.sun.elevation = el;
  L.sun.dir.set(SUN_AZIMUTH.x * Math.cos(el), Math.sin(el), SUN_AZIMUTH.z * Math.cos(el)).normalize();
  sunColor(t, L.sun.color);
  L.sun.intensity = sunIntensity(t);
  L.sky.intensity = skyIntensity(t);
  skyTop(t, L.sky.top);
  skyBottom(t, L.sky.bottom);
  skyZenith(t, L.dome.zenith);
  skyMid(t, L.dome.mid);
  skyHorizon(t, L.dome.horizon);
  L.practicals = practicals(t);
  L.exposure = exposure(t);
  L.cloud = cloud(t);
  L.dark = dark(t);
  L.tunnelAmbient = tunnelAmbient(t);
  const g = L.grade;
  g.saturation = saturation(t);
  g.contrast = contrast(t);
  lift(t, g.lift);
  gain(t, g.gain);
  g.vignette = vignette(t);
  g.bloom = bloom(t);
  return L;
}
