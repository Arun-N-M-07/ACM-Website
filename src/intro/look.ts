/**
 * The opening's light: its colour script, as a function of the beat (and so
 * of the scroll — scroll back and the day runs backwards).
 *
 *   mystery   before dawn — cool, pale mist; silhouettes; a few lit windows
 *             and lamps are the only warm things in the world
 *   story     the mist holds; the air slowly warms; the stone with the
 *             chapter's name stands in the same mist, lit by its own lamp
 *   clearing  once the last fragment has burnt: first light, the ground mist
 *             sinks and thins, the tower comes out first, then the red — lit,
 *             not painted
 *   hero      the richest state: low gold sun raking the facade, long
 *             shadows, a breath of mist left lying on the lawns
 *   ascent    broader morning light, clear air, haze with height; the cloud
 *   above     clean bright air over the cloud, the sun low and warm on it
 *   descent   back through the cloud into the morning haze over the campus,
 *             thinning as the camera comes down onto the plaza
 *   below     the facility's own light (the shaft, the lobby); the grade
 *             returns to neutral exactly at the Events
 *
 * Nothing here is a filter: every value drives a physical input — fog,
 * ground mist, the sun, the sky, the lamps, exposure — and the world
 * responds. Values are written once per frame into `look` (see
 * IntroAtmosphere) and read by the lights, the sky, the mist and the
 * materials.
 */
import { Color, Vector3 } from 'three';
import { ACM_CEG } from './camera';
import { T } from './timeline';
import { flashAt } from './world/lightning';

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

/** A number track that runs straight between its keys (for something travelling: it never pauses at a key). */
function linearTrack(keys: Key<number>[]) {
  return (t: number) => {
    if (t <= keys[0][0]) return keys[0][1];
    const n = keys.length;
    if (t >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0;
    while (t > keys[i + 1][0]) i++;
    const w = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
    return keys[i][1] + (keys[i + 1][1] - keys[i][1]) * w;
  };
}

// ─── the script ───────────────────────────────────────────────────────────────

const R = T.reveal;
const B = T.build;
const CL = T.clearing;

/** Distance haze (the scene's FogExp2 density). */
const fogDensity = numberTrack([
  [0, 0.034],
  [T.story2, 0.032],
  [T.acm, 0.028],
  // (Clearer air around the stone while the name is read.)
  [T.acm + 3, 0.019],
  [T.acmOut, 0.02],
  [T.acmGone + 3, 0.028],
  [T.story4, 0.028],
  [B, 0.026],
  [CL, 0.02],
  [CL + 3, 0.0135],
  [CL + 5.5, 0.009],
  [R - 1.5, 0.0062],
  [R, 0.0042],
  [R + 3, 0.0031],
  [T.heroEnd, 0.0028],
  [T.hover, 0.0026],
  [T.rise + 6, 0.0024],
  [T.cloudIn - 1.5, 0.003],
  [T.cloudIn, 0.0055],
  [T.cloudIn + 1.2, 0.0085],
  [T.cloudOut - 1, 0.009],
  [T.cloudOut, 0.006],
  [T.cloudOut + 1.2, 0.0024],
  [T.apex, 0.002],
  [T.descend, 0.002],
  [T.cloudTop - 0.5, 0.0035],
  [T.cloudTop + 1, 0.0085],
  [T.cloudBase - 1, 0.009],
  [T.cloudBase, 0.0075],
  [T.cloudBase + 2, 0.0048],
  [T.cloudBase + 5, 0.0034],
  [T.plaza, 0.0026],
]);

/** The colour distant things dissolve into. */
const fogColor = colorTrack([
  // The prologue's smog tints the whole air violet; it stays, thinner, through the first two
  // sheets, and clears slowly as the second burns and the stone comes — never a cut.
  [T.release, '#5b6570'],
  [T.release + 3, '#4f4764'],
  [T.legible, '#4a4061'],
  [T.mixed, '#4d4563'],
  [T.story1, '#4f4865'],
  [T.story2, '#534d68'],
  [T.acmTurn, '#59576c'],
  [T.acm + 7, '#626b75'],
  [T.story4, '#6a7178'],
  [B, '#767b80'],
  [CL, '#8d8c8b'],
  [CL + 3, '#a39b92'],
  [CL + 6, '#bba998'],
  [R, '#c7b3a0'],
  [T.heroEnd, '#c9b8a6'],
  [T.hover, '#c6bcb0'],
  [T.rise + 6, '#bdc3c8'],
  [T.cloudIn, '#d3d8dc'],
  [T.cloudIn + 1.2, '#e6e9ea'],
  [T.cloudOut - 1, '#eceef0'],
  [T.cloudOut + 1, '#cfdbe6'],
  [T.apex, '#c3d3e2'],
  // The gold travelling through the air (goldReach): far off first, then all round the flight.
  [T.acmCegIn, '#c5d2dd'],
  [142.5, '#d6d6d0'],
  [T.acmCegFormed, '#eedab9'],
  [T.acmCegHold, '#eedbbd'],
  [T.descend, '#dadcd6'],
  [T.cloudTop, '#dfe5ea'],
  [T.cloudTop + 1, '#e8ebed'],
  [T.cloudBase - 1, '#e2e5e7'],
  [T.cloudBase + 1, '#c8c9c6'],
  [T.cloudBase + 5, '#c4bdb2'],
  [T.plaza, '#c9bfb1'],
]);

/** Ground mist: density at the ground, how quickly it thins with height (m), how much of it there is. */
const mistDensity = numberTrack([
  [0, 0.085],
  [T.story2, 0.08],
  [T.acmTurn, 0.078],
  // (The mist thins around the stone while its name is read, and closes again after.)
  [T.acm + 2, 0.048],
  [T.acmOut, 0.05],
  [T.acmGone + 3, 0.075],
  [T.story4, 0.075],
  [B, 0.068],
  [CL, 0.058],
  [CL + 3, 0.044],
  [CL + 6, 0.034],
  [R, 0.026],
  [R + 4, 0.024],
  [T.heroEnd, 0.022],
  [T.hover, 0.018],
  [T.rise + 4, 0.012],
  [T.cloudIn, 0.004],
  [T.cloudIn + 1, 0],
  [T.cloudBase, 0],
  [T.cloudBase + 2, 0.012],
  [T.plaza, 0.006],
]);
/** How high the ground mist reaches: a deep bank at first, a veil lying on the lawns by the hero. */
const mistHeight = numberTrack([
  [0, 10],
  [B, 9],
  [CL, 7.5],
  [CL + 4, 4],
  [R - 2, 2],
  [R, 1.3],
  [T.heroEnd, 1.1],
  [T.hover, 1.4],
  [T.rise + 4, 3],
  [T.cloudIn, 6],
  [T.cloudBase, 6],
  [T.cloudBase + 2, 3],
  [T.plaza, 1.4],
]);

/** Sun elevation (degrees): below the horizon before dawn, rising through the reveal. */
const sunElevation = numberTrack([
  [0, -6],
  [B, -3],
  [CL, -1],
  [CL + 4, 1.5],
  [R, 7.5],
  [T.heroEnd, 10],
  [T.hover, 11.5],
  [T.apex, 14],
  [T.plaza, 15],
]);
/** Direct sunlight intensity (it has to get through the mist, and the cloud). */
const sunIntensity = numberTrack([
  [0, 0],
  [CL, 0],
  [CL + 3, 0.6],
  [CL + 6, 1.7],
  [R - 1, 2.4],
  [R + 0.5, 3.7],
  [R + 3, 3.4],
  [T.heroEnd, 3.45],
  [T.hover, 3.4],
  [T.cloudIn, 3.1],
  [T.cloudIn + 1.5, 1.2],
  [T.cloudOut - 0.5, 1.4],
  [T.cloudOut + 1, 3.8],
  [T.apex, 4],
  [T.descend, 3.9],
  [T.cloudTop + 0.5, 1.4],
  [T.cloudBase - 0.5, 1.2],
  [T.cloudBase + 1.5, 2.6],
  [T.cloudBase + 5, 3.2],
  [T.plaza, 3.3],
]);
const sunColor = colorTrack([
  [0, '#ff7a3d'],
  [CL + 3, '#ff8646'],
  [CL + 6, '#ffa25e'],
  [R, '#ffb56e'],
  [T.heroEnd, '#ffc485'],
  [T.hover, '#ffcb90'],
  [T.apex, '#ffe0b8'],
  [T.cloudBase, '#ffd2a0'],
  [T.plaza, '#ffcf98'],
]);

/** Skylight (hemisphere): how much, and its colours. */
const skyIntensity = numberTrack([
  [0, 0.3],
  [B, 0.34],
  [CL, 0.36],
  [CL + 3, 0.46],
  [R, 0.56],
  [T.heroEnd, 0.6],
  [T.hover, 0.62],
  [T.cloudIn, 0.8],
  [T.cloudIn + 1.2, 1.35],
  [T.cloudOut - 1, 1.4],
  [T.cloudOut + 1, 1.0],
  [T.apex, 0.95],
  [T.descend, 0.95],
  [T.cloudTop + 1, 1.35],
  [T.cloudBase - 1, 1.3],
  [T.cloudBase + 1, 0.9],
  [T.cloudBase + 5, 0.72],
  [T.plaza, 0.66],
]);
const skyTop = colorTrack([
  [0, '#7686a0'],
  [B, '#8491a6'],
  [R, '#a4b4cc'],
  [T.heroEnd, '#a9b8ce'],
  [T.cloudIn + 1, '#e6ebef'],
  [T.cloudOut + 1, '#b8cde6'],
  [T.descend, '#b8cde6'],
  [T.cloudTop + 1, '#e6ebef'],
  [T.cloudBase + 1, '#b9c3cf'],
  [T.plaza, '#aab8cc'],
]);
const skyBottom = colorTrack([
  [0, '#2a2825'],
  [R, '#4e3a2c'],
  [T.heroEnd, '#553e2e'],
  [T.cloudIn + 1, '#bcc2c6'],
  // Above the cloud, the light from below is the bright cloud itself.
  [T.cloudOut + 1, '#e8ecef'],
  [T.descend, '#e8ecef'],
  [T.cloudTop + 1, '#bcc2c6'],
  [T.cloudBase + 1, '#5e4b3c'],
  [T.plaza, '#56402f'],
]);

/** The sky dome: zenith, middle, horizon, and the glow around the sun. */
const skyZenith = colorTrack([
  [0, '#1b232d'],
  [B, '#1f2a38'],
  [CL + 3, '#233247'],
  [R, '#28507e'],
  [T.heroEnd, '#2d5886'],
  [T.hover, '#335f8c'],
  [T.cloudOut + 1, '#2f65a3'],
  [T.apex, '#2a62a3'],
  [T.plaza, '#3c6a98'],
]);
const skyMid = colorTrack([
  [0, '#3d4650'],
  [B, '#46505b'],
  [CL + 3, '#667182'],
  [R, '#7f9fbf'],
  [T.heroEnd, '#88a7c4'],
  [T.hover, '#90adc8'],
  [T.cloudOut + 1, '#86acd6'],
  [T.apex, '#82a9d6'],
  [T.acmCegFormed, '#b4bcc2'],
  [T.descend, '#88add6'],
  [T.plaza, '#a0b8cd'],
]);
const skyHorizon = colorTrack([
  [0, '#5f666d'],
  [B, '#6b6b6a'],
  [CL + 2, '#a07a64'],
  [R, '#e5b491'],
  [T.heroEnd, '#efc7a4'],
  [T.hover, '#ecd0b2'],
  [T.cloudOut + 1, '#f3e2cc'],
  [T.apex, '#f6e6d0'],
  [T.acmCegIn, '#f6e4cc'],
  [T.acmCegFormed, '#f6d9ae'],
  [T.acmCegHold, '#f5dbb2'],
  [T.descend, '#f3e2cc'],
  [T.plaza, '#e8d6c2'],
]);

/** Lamps and the building's lit rooms: on before dawn, off as the day arrives. */
const practicals = numberTrack([
  [0, 1],
  [CL, 1],
  [CL + 5, 0.55],
  [R + 2, 0.12],
  [T.heroEnd, 0.06],
  [T.hover, 0],
]);

/** Exposure: dim before dawn, fullest in the hero, bright above the cloud. */
const exposure = numberTrack([
  [0, 0.8],
  [T.story2, 0.82],
  [T.acm, 0.84],
  [T.acmLit, 0.94],
  [T.acmOut, 0.92],
  [T.acmGone + 3, 0.84],
  [B, 0.86],
  [CL + 4, 0.96],
  // The building complete: a breath of light as the last of the haze lifts.
  [R + 0.35, 1.12],
  [R + 3, 1.03],
  [T.heroEnd, 1.05],
  [T.cloudIn + 1, 1.0],
  [T.cloudOut - 1, 0.98],
  [T.cloudOut + 1, 1.05],
  [T.apex, 1.06],
  [T.acmCegIn, 1.02],
  [141.5, 0.97],
  [T.acmCegFormed, 0.97],
  [T.acmCegHold, 0.98],
  [T.descend, 1.05],
  [T.cloudTop + 1, 1.0],
  [T.cloudBase + 1, 1.0],
  [T.plaza, 1.05],
  [T.end, 1.05],
]);

/** The cloud: how much of it is around the camera (0..1). (Also the sound's: SoundDirector.) */
export const cloud = numberTrack([
  [T.cloudIn - 1, 0],
  [T.cloudIn + 0.8, 0.7],
  [T.cloudIn + 1.5, 1],
  [T.cloudOut - 1, 1],
  [T.cloudOut + 0.3, 0.3],
  [T.cloudOut + 1, 0],
  [T.cloudTop - 0.3, 0],
  [T.cloudTop + 0.8, 0.8],
  [T.cloudTop + 1.5, 1],
  [T.cloudBase - 1, 1],
  [T.cloudBase, 0.3],
  [T.cloudBase + 1, 0],
]);

/**
 * Below ground, during the opening only: how much of the facility's ambient
 * light the shaft and the lobby get — a little darker than the Events (the
 * door's light is the story there), back to 1 exactly at the handoff.
 */
const tunnelAmbient = numberTrack([
  [T.shaft, 1],
  [T.shaft + 3, 0.7],
  [T.lobby, 0.74],
  [T.door, 0.74],
  [T.doorway, 0.9],
  [T.end, 1],
]);

/**
 * The gold (the ascent's reveal). Over the cloud, a warm light wakes deep inside it, ahead of the
 * flight, behind where ACM–CEG rises (its place: world/AcmCeg.tsx sets it in the cloud behind the name).
 * It is a light, not a colour: the cloud around it is lit by it from within and at its thin edges
 * (Clouds), the sky glows low towards it (Sky), and it lights the name (AcmCeg). How bright it is, and
 * how far its warmth has travelled out through the air from it (m): the far air first, then all round
 * the flight — white, warm white, champagne, gold — built up as the name rises, warmest as it stands
 * whole. It runs straight (a travelling thing never pauses on the way). It fades as the camera tilts
 * down into the cloud, which is white inside.
 */
const goldAmount = numberTrack([
  [T.goldIn, 0],
  [T.acmCegIn, 0.22],
  [141.5, 0.62],
  [143, 0.95],
  [T.acmCegFormed, 1.1],
  [147, 1],
  [T.acmCegHold, 0.95],
  [153, 0.78],
  [T.descend, 0.45],
  [T.cloudTop, 0],
]);
const goldReach = linearTrack([
  [T.goldIn, 0],
  [T.acmCegIn, 12],
  [140.8, 45],
  [142, 90],
  [143.2, 150],
  [T.acmCegFormed, 270],
  [145.8, 420],
  [147.5, 560],
  [T.acmCegHold, 650],
]);
/**
 * How much of the white daylight is left on the cloud (it gives way to the gold: the sea of cloud goes
 * soft and misty as the light wakes in it, and the gold brings the brightness back as it spreads).
 */
const goldDay = numberTrack([
  [T.apex, 1],
  [T.acmCegIn, 0.9],
  [141.2, 0.7],
  [T.acmCegFormed, 0.66],
  [T.acmCegHold, 0.68],
  [T.descend, 0.9],
  [T.cloudTop, 1],
]);
/** Its colour: champagne gold, never orange (the air it lights is what turns warm). */
const GOLD = new Color('#ffcb8c');

/** Darkness (0..1) — none in the current script (kept for the look's shape). */
const dark = numberTrack([[0, 0]]);

// ─── the grade (display space, after tone mapping) ────────────────────────────
// Colour arrives with the light: the misted world is nearly without it, the
// red comes into its own as the sun clears the mist, and everything returns
// to neutral exactly at the handoff (the Events are not graded).

const saturation = numberTrack([
  // (The grade lets the violet through while it is in the air, and eases back as it clears.)
  [T.release, 0.32],
  [T.release + 1.5, 0.82],
  [T.legible, 0.92],
  [T.mixed, 0.8],
  [T.story1, 0.74],
  [T.story2, 0.66],
  [T.acmTurn, 0.6],
  [T.acm + 7, 0.52],
  [T.acmOut, 0.5],
  [B, 0.52],
  [CL, 0.56],
  [CL + 3, 0.7],
  [CL + 6, 0.9],
  [R, 1.04],
  [R + 4, 1.08],
  [T.heroEnd, 1.06],
  [T.hover, 1.04],
  [T.cloudIn, 0.95],
  [T.cloudIn + 1.2, 0.74],
  [T.cloudOut + 1, 0.92],
  [T.apex, 0.95],
  [T.descend, 0.95],
  [T.cloudTop + 1, 0.74],
  [T.cloudBase + 1, 0.86],
  [T.cloudBase + 5, 1.02],
  [T.plaza, 1.04],
  [T.lobby, 0.96],
  [T.end, 1],
]);
const contrast = numberTrack([
  [0, 0.93],
  [B, 0.95],
  [R, 1.05],
  [R + 4, 1.08],
  [T.heroEnd, 1.07],
  [T.cloudIn + 1.2, 0.92],
  [T.cloudOut + 1, 1.02],
  [T.descend, 1.02],
  [T.cloudTop + 1, 0.92],
  [T.cloudBase + 2, 1.02],
  [T.plaza, 1.04],
  [T.lobby, 1.05],
  [T.end, 1],
]);
const lift = colorTrack([
  [0, '#07090d'],
  [B, '#080a0d'],
  [R, '#0a0704'],
  [T.heroEnd, '#090603'],
  [T.cloudIn + 1, '#0a0a0b'],
  [T.cloudOut + 1, '#08090b'],
  [T.cloudTop + 1, '#0a0a0b'],
  [T.cloudBase + 3, '#080604'],
  [T.lobby, '#020304'],
  [T.end, '#000000'],
]);
const gain = colorTrack([
  [0, '#e9eef7'],
  [T.story1, '#f1efef'],
  [B, '#f4f0ea'],
  [R, '#fff7ec'],
  [T.heroEnd, '#fff5e8'],
  [T.hover, '#fcf6ef'],
  [T.cloudIn + 1, '#f6f8fa'],
  [T.apex, '#fff8f0'],
  [T.cloudTop + 1, '#f6f8fa'],
  [T.cloudBase + 3, '#fff8ee'],
  [T.lobby, '#f6f8fc'],
  [T.end, '#ffffff'],
]);
const vignette = numberTrack([
  [0, 0.32],
  [B, 0.3],
  [R, 0.22],
  [T.heroEnd, 0.2],
  [T.cloudIn + 1, 0.1],
  [T.apex, 0.16],
  [T.acmCegFormed, 0.07],
  [T.descend, 0.14],
  [T.cloudTop + 1, 0.1],
  [T.cloudBase + 3, 0.18],
  [T.shaft, 0.28],
  [T.lobby, 0.22],
  [T.doorway, 0.14],
  [T.end, 0],
]);
const bloom = numberTrack([
  [0, 0.42],
  [T.acm, 0.4],
  [T.acmHold, 0.36],
  [B, 0.38],
  [CL + 4, 0.3],
  [R + 0.35, 0.42],
  [R + 3, 0.22],
  [T.heroEnd, 0.2],
  [T.cloudIn + 1, 0.14],
  [T.apex, 0.2],
  [T.cloudTop + 1, 0.14],
  [T.cloudBase + 3, 0.16],
  [T.shaft, 0.34],
  [T.lobby, 0.3],
  [T.door + 2, 0.42],
  [T.doorway, 0.3],
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
  /** Lightning's light (0..~1.2) at this beat, and where in the sky it comes from (unit). */
  flash: 0,
  flashDir: new Vector3(0, 1, 0),
  dark: 0,
  tunnelAmbient: 1,
  /** The light inside the cloud (see goldAmount): where it is (world), its colour × brightness, how far it has reached (m). */
  gold: { pos: new Vector3(ACM_CEG.x, ACM_CEG.y - 8, ACM_CEG.z - 45), color: new Color(), amount: 0, reach: 0, day: 1 },
  /** Where ACM–CEG's letters stand at rest (world y of their feet): the cloud shelf in front of it lies just under (world/AcmCeg.tsx sets it). */
  nameFoot: ACM_CEG.y - 17,
  grade: { saturation: 1, contrast: 1, lift: new Color(0, 0, 0), gain: new Color(1, 1, 1), vignette: 0, bloom: 0 },
};

/** The sun's azimuth: low in the east, so it rakes across the south facade from the right. */
const SUN_AZIMUTH = new Vector3(0.93, 0, 0.37).normalize();

/** Evaluate the script at beat t into `look` (`reduced`: lightning without flicker). */
export function evaluateLook(t: number, reduced = false) {
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
  L.gold.amount = goldAmount(t);
  L.gold.reach = goldReach(t);
  L.gold.day = goldDay(t);
  L.gold.color.copy(GOLD).multiplyScalar(L.gold.amount);
  const g = L.grade;
  g.saturation = saturation(t);
  g.contrast = contrast(t);
  lift(t, g.lift);
  gain(t, g.gain);
  g.vignette = vignette(t);
  g.bloom = bloom(t);

  // Lightning: a light event, a pure function of the beat. The fog brightens (the air's volume
  // shows) — most where the flash is (fog.ts scatters it from L.flashDir) — the stone, the ground
  // and the trees catch a cold light from high behind the lens, the sky lifts, the exposure opens
  // a little.
  const f = flashAt(t, reduced, L.flashDir);
  L.flash = f;
  if (f > 0.001) {
    const k = Math.min(1, f);
    L.fogColor.lerp(FLASH_FOG, 0.14 * k);
    L.exposure += 0.18 * f;
    L.sun.dir.lerp(FLASH_DIR, Math.min(1, f * 3)).normalize();
    L.sun.color.lerp(FLASH_COLOR, Math.min(1, f * 3));
    L.sun.intensity += 9 * f;
    L.sky.intensity += 0.7 * f;
    L.sky.top.lerp(FLASH_FOG, 0.5 * k);
  }
  return L;
}

const FLASH_FOG = new Color('#c8d2e4');
const FLASH_COLOR = new Color('#e4ecff');
/** From high behind the reader of the stone: its face, the ground and the garden catch it. */
const FLASH_DIR = new Vector3(-0.34, 0.77, 0.54).normalize();
