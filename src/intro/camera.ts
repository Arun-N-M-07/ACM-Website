/**
 * The opening's camera: one continuous move, authored like a film operator's,
 * placed along the scroll (every key is a beat — see timeline.ts). Where it
 * is fast and where it is slow is the pacing: the keys are spaced so what the
 * eye sees changes at a steady rate (slow near things, faster where the
 * ground is far away).
 *
 *   arrival     a slow, curious walk out of the mist up the garden
 *   story       observation: the walk all but stops while each fragment is
 *               read; after the second, it turns aside to a stone in the mist
 *               and reads the chapter's name on it, then walks on
 *   reveal      the mist clears and the move carries on through the
 *               building's reveal — it never stops to pose — gathering pace
 *               evenly over the fountain pool (above its jets) towards the
 *               tower, and curving up into the rise without a halt
 *   ascent      straight up — the camera's column is the light-well's — past
 *               the face of the tower, looking down at the building as it
 *               shrinks into its campus, into the cloud and out above it;
 *               it levels out into flight over the sea of cloud, where
 *               ACM-CEG rises out of the cloud ahead; it slows into that
 *               composition and holds it, drifting in a little
 *   descent     tilts down and drops back into the cloud (inside it, the
 *               drift home to the column); out of its base straight down the
 *               column onto the glass light-well as it opens, down its shaft;
 *               tipping up, level in the lobby
 *   the door    straight across the lobby to the EVENTS door as it opens, and
 *               through, arriving exactly on the pose the Events chapter opens
 *               with (config/camera: facilityEnd)
 *
 * The path is one spline (./path.ts), so there is never a cut in position or
 * velocity. On top of it, a layer of life: a slow breath (small, smaller
 * still in flight, gone below ground, where the moves are pure direction); a
 * little turbulence in the cloud.
 */
import { CatmullRomCurve3, Vector3 } from 'three';
import { CAMERA_STATES } from '@/config/camera';
import { CAMPUS, EYE_Y, FLOOR_Y, type Vec3 } from '@/config/world';
import { aim, type CameraPose } from '@/systems/camera/pose';
import { CameraPath, makeSample, type PathKey } from './path';
import { introFrame } from './state';
import { ease, T, window4 } from './timeline';
import { STONE_FOCUS } from './world/stoneLayout';
import { CAM_Z, GROUND_Y, LETTERS, PX, ROLL_TO } from './prologue/layout';

const END = CAMERA_STATES.facilityEnd;
/** The handoff: the corridor mouth, looking north, level. */
const HANDOFF: Vec3 = [END.x, END.y, END.z];
const W = CAMPUS.well;
/** The drone's column: straight above the light-well. */
const up = (y: number): Vec3 => [W.x, y, W.z];
/**
 * Looking down the column from height `from` to height `y`, north at the top of the frame: the
 * target lies a little north of the column — 1.2% of the drop, under 0.7° off vertical — so which
 * way is up in the frame never hangs on a few centimetres (the position curve wanders more than
 * that between keys, and a target level with or south of the camera turns the picture round).
 */
const down = (y: number, from: number): Vec3 => [W.x, y, W.z - Math.max(0.2, 0.012 * (from - y))];
/** Towards the stone. */
const stone = (dy = 0, dz = 0): Vec3 => [STONE_FOCUS[0], STONE_FOCUS[1] + dy, STONE_FOCUS[2] + dz];

/** The prologue's ground-level frame (see prologue/layout.ts). */
const GY = GROUND_Y;


/**
 * One continuous move through `points` from beat t0 to t1, as n+1 keys on a
 * single spline: the camera travels it at a speed that runs smoothly from v0
 * to v1 (m/beat, a monotone cubic in distance travelled), so it arrives with
 * the speed the next move leaves with — no pose, no stop, no lurch. The look
 * target and the lens follow the same curve parameter as the position, so
 * each point's look is where the eye is when the camera passes that point.
 */
function cruise(points: { pos: Vec3; look: Vec3; fov: number }[], t0: number, t1: number, v0: number, v1: number, n: number): PathKey[] {
  const pos = new CatmullRomCurve3(points.map((k) => new Vector3(...k.pos)), false, 'centripetal');
  const look = new CatmullRomCurve3(points.map((k) => new Vector3(...k.look)), false, 'centripetal');
  pos.arcLengthDivisions = 600;
  const L = pos.getLength();
  const T = t1 - t0;
  const m = points.length - 1;
  const out: PathKey[] = [];
  for (let k = 0; k <= n; k++) {
    const x = k / n;
    // Distance travelled: Hermite from 0 (speed v0) to L (speed v1).
    const x2 = x * x;
    const x3 = x2 * x;
    const d = (x3 - 2 * x2 + x) * v0 * T + (-2 * x3 + 3 * x2) * L + (x3 - x2) * v1 * T;
    const u = Math.min(1, Math.max(0, d / L));
    const p = pos.getPointAt(u);
    const w = pos.getUtoTmapping(u, 0);
    const l = look.getPoint(w);
    const seg = Math.min(m - 1, Math.floor(w * m));
    const f = w * m - seg;
    out.push({ t: t0 + T * x, pos: [p.x, p.y, p.z], look: [l.x, l.y, l.z], fov: points[seg].fov + (points[seg + 1].fov - points[seg].fov) * f });
  }
  return out;
}

/** Where ACM-CEG stands: far out over the sea of cloud, ahead of the column (world). */
export const ACM_CEG = { x: W.x, y: 262, z: W.z - 336 } as const;
const acmCeg = (dy = 0): Vec3 => [ACM_CEG.x, ACM_CEG.y + dy, ACM_CEG.z];

export const INTRO_KEYS: PathKey[] = [
  // The prologue: 16 cm off the road, in the mist, looking down it into the fog. Something is rolling towards the lens…
  { t: T.prologue, pos: [PX, GY + 0.16, CAM_Z], look: [PX + 0.35, GY + 0.14, 146], fov: 44 },
  { t: T.roll + 3, pos: [PX - 0.02, GY + 0.16, CAM_Z - 0.03], look: [PX + 0.4, GY + 0.08, 148], fov: 44 },
  // …the eye settles on it as it slows, and it comes to rest a couple of metres off.
  { t: T.rest, pos: [PX - 0.05, GY + 0.16, CAM_Z - 0.06], look: [ROLL_TO.x + 0.05, GY - 0.12, ROLL_TO.z - 4.5], fov: 43.5 },
  { t: T.release - 0.3, pos: [PX - 0.06, GY + 0.17, CAM_Z - 0.08], look: [ROLL_TO.x + 0.05, GY - 0.1, ROLL_TO.z - 4.5], fov: 43.2 },
  // The release lifts the view and pushes it back a little — involuntary, not a jump — up into the smog…
  { t: T.release + 3, pos: [PX - 0.06, GY + 0.62, CAM_Z + 0.3], look: [LETTERS.x, GY + 0.8, LETTERS.z], fov: 44.5 },
  { t: T.release + 7, pos: [PX - 0.05, GY + 1.12, CAM_Z + 0.2], look: [LETTERS.x, LETTERS.y - 0.15, LETTERS.z], fov: 44.2 },
  // …and, immersed in it, travels slowly through it, towards the words as they form and are read…
  { t: T.form, pos: [PX - 0.05, GY + 1.2, CAM_Z - 0.4], look: [LETTERS.x, LETTERS.y - 0.08, LETTERS.z], fov: 44 },
  { t: T.legible, pos: [PX - 0.04, GY + 1.3, CAM_Z - 2.5], look: [LETTERS.x, LETTERS.y, LETTERS.z], fov: 43.5 },
  { t: T.dissolve, pos: [PX - 0.04, GY + 1.4, CAM_Z - 5.4], look: [LETTERS.x, LETTERS.y + 0.1, LETTERS.z - 2], fov: 43 },
  // …and on, through where they were, into the story's first shot.
  { t: T.mixed, pos: [PX - 0.1, GY + 1.55, CAM_Z - 8.0], look: [PX + 1.8, 3.6, 110], fov: 42.6 },
  { t: 0, pos: [-7.4, 1.72, 156], look: [-3.2, 5.2, 58], fov: 42 },
  { t: T.story1, pos: [-6.9, 1.74, 153], look: [-2.9, 5.5, 55], fov: 41.5 },
  // The story: the walk continues, slowly.
  { t: T.story2, pos: [-5.9, 1.78, 148.2], look: [-2.2, 6.2, 47], fov: 41 },
  { t: 30, pos: [-5, 1.82, 144.8], look: [-1.8, 6.8, 43], fov: 40.5 },
  // Aside to the stone in the mist, and the name on it…
  { t: T.acm, pos: [-3.1, 1.84, 140.4], look: stone(0.1), fov: 40 },
  { t: T.acmHold, pos: [-0.2, 1.86, 135.4], look: stone(), fov: 38.5 },
  // …and on past it, turning back to the way ahead.
  { t: T.acmOut, pos: [0.5, 1.86, 133.4], look: stone(0.4, -9), fov: 39 },
  { t: T.acmGone, pos: [0.2, 1.88, 131.2], look: [-0.6, 7.6, 34], fov: 39.5 },
  { t: T.story4, pos: [-0.8, 1.9, 125.8], look: [-0.5, 8.4, 26], fov: 39 },
  // The mist clears and the camera carries on through the reveal — the building comes out around a
  // move that never stops to pose — gathering pace evenly over the pool (above its jets) towards
  // the tower, and curving up into the rise without a halt (see cruise()).
  ...cruise(
    [
      { pos: [-0.9, 1.93, 118.5], look: [-0.2, 9.6, 14], fov: 37.5 },
      { pos: [-0.2, 1.95, 111.2], look: [0.15, 11, 2.4], fov: 36 },
      { pos: [0.15, 2.3, 104.5], look: [0.2, 12, 1.2], fov: 35.6 },
      { pos: [0.1, 3.4, 97], look: [0.2, 13.2, 1], fov: 36.8 },
      { pos: [0, 7.4, 84], look: [0.2, 15.5, 0.9], fov: 40 },
      { pos: [0, 9, 66], look: [0.2, 17.2, 0.8], fov: 45 },
      { pos: [0, 9.6, 52], look: [0.2, 18.4, 0.7], fov: 49 },
    ],
    T.clearing,
    T.hover,
    0.55,
    3,
    24,
  ).slice(0, -1),
  // The ascent: round the corner into the column and straight up it, past the tower, the building
  // sinking below, gathering speed into the cloud.
  ...cruise(
    [
      { pos: [0, 9.6, 52], look: [0.2, 18.4, 0.7], fov: 49 },
      { pos: [0, 11.5, 47.3], look: [0.2, 19, 0.6], fov: 50.5 },
      { pos: up(21), look: [0.2, 18.5, 0.6], fov: 52 },
      { pos: up(41), look: [0.1, 11, 3], fov: 53 },
      { pos: up(80), look: [0, 3, 10], fov: 54 },
      { pos: up(150), look: [0, 0, 32], fov: 55 },
    ],
    T.hover,
    T.cloudIn,
    3,
    20,
    14,
  ),
  // …out of the cloud's top…
  { t: T.cloudOut, pos: up(222), look: [0, 185, -40], fov: 55 },
  // …levelling into flight over the sea of cloud, where ACM-CEG rises out of the cloud ahead…
  { t: T.apex, pos: [W.x, 244, W.z - 2], look: [W.x, 248, W.z - 196], fov: 53 },
  { t: 141, pos: [W.x, 249.5, W.z - 24], look: acmCeg(-1), fov: 51.5 },
  // …slowing into its composition, and holding it: a slow drift in, a little to one side.
  { t: T.acmCeg, pos: [W.x, 251.5, W.z - 37], look: acmCeg(), fov: 50 },
  { t: 147.2, pos: [W.x - 1.4, 252.1, W.z - 40.6], look: acmCeg(), fov: 49.2 },
  { t: T.acmCegHold, pos: [W.x - 2.4, 252.5, W.z - 43.8], look: acmCeg(), fov: 48.5 },
  // Then on: tilting down to the cloud, and into the drop — back over the column inside the cloud.
  // (The look targets lie far along the tilt, so the view turns down evenly.)
  { t: 153, pos: [W.x - 1.6, 250.2, W.z - 41.5], look: [W.x, 205, W.z - 300], fov: 50 },
  { t: T.descend, pos: [W.x, 243, W.z - 32], look: [W.x, 60, W.z - 150], fov: 52 },
  // Looking almost straight down, which way is "up" in the frame is decided by which side of the
  // camera the look target lies (aim(): yaw from the horizontal offset). As the camera drifts home
  // to the column the target stays north of it all the way down — by a margin that shrinks to
  // down()'s — so north stays at the top of the frame. (A target south of the camera, or level
  // with it, turns the picture half round.)
  { t: T.cloudTop, pos: [W.x, 222, W.z - 16], look: [W.x, 40, W.z - 38], fov: 53 },
  { t: 160.8, pos: [W.x, 187, W.z - 5], look: [W.x, 125, W.z - 7.8], fov: 53 },
  { t: T.cloudBase, pos: up(152), look: [W.x, 90, W.z - 0.9], fov: 53 },
  { t: 166.5, pos: up(82), look: down(20, 82), fov: 53 },
  { t: 169.5, pos: up(34), look: down(-20, 34), fov: 52 },
  // …hovering low while its glass slides open, and through.
  { t: T.plaza, pos: up(10.5), look: down(-10, 10.5), fov: 52 },
  { t: 174, pos: up(6.4), look: down(-12, 6.4), fov: 53 },
  { t: T.shaft, pos: up(-1), look: down(-20, -1), fov: 54 },
  // (At the foot of the shaft the view already leans a little north, into the tip-up: with the target
  // straight below, the curve into the next key swings it south of the camera and the picture turns round.)
  { t: 179.5, pos: up(FLOOR_Y + 15), look: [W.x, FLOOR_Y - 3, W.z - 2.5], fov: 58 },
  // Tipping up out of the shaft into the lobby, and level, facing the door.
  { t: 181, pos: [W.x, FLOOR_Y + 6.4, W.z + 0.6], look: [W.x, FLOOR_Y + 2.3, W.z - 4.5], fov: 57 },
  { t: T.lobby, pos: [0, EYE_Y + 0.3, 44.8], look: [0, FLOOR_Y + 5.4, 27], fov: 55 },
  // Across the lobby, the lettering above the door, the door opening as the camera nears…
  { t: 186, pos: [0, EYE_Y + 0.22, 40.6], look: [0, FLOOR_Y + 5.2, 27], fov: 54 },
  { t: T.door, pos: [0, EYE_Y + 0.14, 37], look: [0, FLOOR_Y + 4.2, 27], fov: 53.5 },
  { t: 193.5, pos: [0, EYE_Y + 0.05, 32.4], look: [0, EYE_Y + 0.6, 18], fov: 53 },
  // …and through.
  { t: T.doorway, pos: [0, EYE_Y, 27.2], look: [0, EYE_Y, 10], fov: 53.5 },
  { t: T.end, pos: HANDOFF, look: [HANDOFF[0], HANDOFF[1], HANDOFF[2] - 20], fov: END.fov },
];

export const INTRO_PATH = new CameraPath(INTRO_KEYS);

const S = makeSample();
const _pos = new Vector3();
const _dir = new Vector3();

/** Where the camera is at beat `t` (no breath) — for things that travel with it. */
export function introCameraAt(t: number) {
  INTRO_PATH.sample(t, S);
  return S;
}

/** Shared portrait opening for the camera and the cloud wordmark's frame fit. */
export const portraitOpen = (aspect: number) => (aspect < 0.9 ? Math.min(1.9, 1 + (0.9 / aspect - 1) * 0.72) : 1);

/** Evaluate the opening's camera at the current beat into `out`. */
export function evaluateIntroShot(time: number, aspect: number, out: CameraPose, reduced: boolean) {
  const t = introFrame.t;
  INTRO_PATH.sample(t, S);
  _pos.copy(S.pos);
  const look = S.look;
  let fov = S.fov;

  // Portrait screens are tall and the building is wide. Through the reveal and
  // the hero the camera comes in closer and a little higher, on a tighter lens,
  // so the tower carries the height of the frame; elsewhere the lens opens to
  // keep the composition's coverage. Through the doorway it converges exactly
  // on the journey's own portrait lens (CameraRig: widen, and a step back), so
  // the handoff doesn't jump on a phone either.
  let lookY = look.y;
  if (aspect < 0.9) {
    const p = Math.min(1, (0.9 - aspect) / 0.45);
    const close = window4(t, T.clearing, T.reveal - 2, T.hover - 4, T.hover) * p;
    _dir.subVectors(look, _pos).normalize();
    _pos.addScaledVector(_dir, 16 * close);
    lookY += 2.6 * close;
    const open = portraitOpen(aspect);
    let wide = (2 * Math.atan(Math.tan((fov * Math.PI) / 360) * open) * 180) / Math.PI;
    wide += (44 - wide) * close;
    const rigWiden = Math.min(2.1, 1 + (1 / aspect - 1) * 0.9);
    const rigFov = (2 * Math.atan(Math.tan((fov * Math.PI) / 360) * rigWiden) * 180) / Math.PI;
    const h = ease(t, T.doorway - 1, T.end);
    fov = Math.min(110, wide + (rigFov - wide) * h);
    _pos.z += Math.min(2, (1 / aspect - 1) * 1.6) * h;
  }

  const { yaw, pitch } = aim([_pos.x, _pos.y, _pos.z], [look.x, lookY, look.z]);
  out.x = _pos.x;
  out.y = _pos.y;
  out.z = _pos.z;
  out.yaw = yaw;
  out.pitch = pitch;
  out.roll = S.roll;
  out.fov = fov;

  if (reduced) return out;

  // A layer of life. The breath never stops (even when the scroll does) but it
  // is small; smaller in flight, and gone below ground, where the moves are
  // pure direction.
  const calm = (1 - 0.7 * ease(t, T.approach, T.approach + 2)) * (1 - ease(t, T.plaza, T.plaza + 1.5));
  const hero = window4(t, T.reveal - 2, T.reveal + 1, T.heroEnd - 1, T.heroEnd + 1);
  const b = calm * (1 - 0.55 * hero);
  out.yaw += (Math.sin(time * 0.23) * 0.0045 + Math.sin(time * 0.61 + 1.7) * 0.0012) * b;
  out.pitch += (Math.sin(time * 0.19 + 0.6) * 0.0032 + Math.sin(time * 0.53 + 2.2) * 0.001) * b;
  out.x += Math.sin(time * 0.29 + 0.3) * 0.028 * b;
  out.y += Math.sin(time * 0.37 + 1.1) * 0.022 * b;
  // (No turbulence in the cloud: the camera never rolls — the cloud's own motion, and the motes streaming past, carry it.)
  return out;
}
