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
 *   reveal      the mist clears; the move settles into the building's
 *               composition, and holds
 *   approach    a glide over the fountain pool (above its jets), rising a
 *               little, to hover over the plaza before the tower
 *   ascent      straight up — the camera's column is the light-well's — past
 *               the face of the tower, looking down at the building as it
 *               shrinks into its campus, into the cloud and out above it;
 *               it tilts up to the horizon over the cloud
 *   descent     tilts down and drops straight down the same column: through
 *               the cloud, onto the glass light-well as it opens (the
 *               original descent), down its shaft; tipping up, level in the
 *               lobby
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
/** Looking straight down the column (north at the top of the frame). */
const down = (y: number): Vec3 => [W.x, y, W.z - 0.03];
/** Towards the stone. */
const stone = (dy = 0, dz = 0): Vec3 => [STONE_FOCUS[0], STONE_FOCUS[1] + dy, STONE_FOCUS[2] + dz];

/** The prologue's ground-level frame (see prologue/layout.ts). */
const GY = GROUND_Y;

/**
 * One continuous move through the given keys (only the first and last beats
 * count): the camera travels the curve through them with a smootherstep
 * profile — gathering speed evenly out of the first, easing evenly into the
 * last — as `n` keys along that same curve (the path then passes through them
 * with continuous speed). Position, look target and lens are all spaced by
 * their own arc length.
 */
function glide(keys: PathKey[], n: number): PathKey[] {
  const t0 = keys[0].t;
  const t1 = keys[keys.length - 1].t;
  const pos = new CatmullRomCurve3(keys.map((k) => new Vector3(...k.pos)), false, 'centripetal');
  const look = new CatmullRomCurve3(keys.map((k) => new Vector3(...k.look)), false, 'centripetal');
  pos.arcLengthDivisions = look.arcLengthDivisions = 400;
  // The lens, by the position's arc length at each authored key.
  const lens = pos.getLengths(400);
  const fovAt = (u: number) => {
    const L = u * lens[lens.length - 1];
    const seg = keys.length - 1;
    for (let i = 0; i < seg; i++) {
      const a = lens[Math.round((i / seg) * 400)];
      const b = lens[Math.round(((i + 1) / seg) * 400)];
      if (L <= b || i === seg - 1) return keys[i].fov + (keys[i + 1].fov - keys[i].fov) * Math.min(1, Math.max(0, (L - a) / Math.max(1e-6, b - a)));
    }
    return keys[seg].fov;
  };
  const S = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);
  const out: PathKey[] = [];
  for (let k = 0; k <= n; k++) {
    const x = k / n;
    const u = S(x);
    const p = pos.getPointAt(u);
    const l = look.getPointAt(u);
    out.push({ t: t0 + (t1 - t0) * x, pos: [p.x, p.y, p.z], look: [l.x, l.y, l.z], fov: fovAt(u) });
  }
  return out;
}

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
  { t: T.clearing, pos: [-0.9, 1.93, 118.5], look: [-0.2, 9.6, 14], fov: 37.5 },
  // The reveal: settle into the building's composition, and hold.
  { t: T.reveal, pos: [-0.2, 1.9, 111.2], look: [0.15, 11, 2.4], fov: 36 },
  // (Keys timed so the drift through the hold is even, and the glide eases out of it and into the hover.)
  { t: 97.5, pos: [0.05, 1.95, 109.6], look: [0.2, 11.4, 1.6], fov: 35.6 },
  // The approach: a glide over the pool, clear of its jets, to hover before the tower — one
  // even ease out of the hold and into the hover (see glide()).
  ...glide(
    [
      { t: T.heroEnd, pos: [0.2, 2.05, 108], look: [0.2, 11.8, 1], fov: 35.2 },
      { t: 0, pos: [0.1, 3.4, 99], look: [0.2, 13.2, 1], fov: 36.8 },
      { t: 0, pos: [0, 7.6, 84], look: [0.2, 15.5, 0.9], fov: 40 },
      { t: 0, pos: [0, 9.1, 66], look: [0.2, 17.2, 0.8], fov: 45 },
      { t: T.hover, pos: [0, 9.4, 48.4], look: [0.2, 18.6, 0.6], fov: 50 },
    ],
    8,
  ),
  // The ascent: straight up the column, past the tower, the building sinking below…
  { t: T.rise, pos: up(9.8), look: [0.2, 19, 0.6], fov: 51 },
  { t: 123, pos: up(21), look: [0.2, 18.5, 0.6], fov: 52 },
  { t: 126, pos: up(41), look: [0.1, 11, 3], fov: 53 },
  { t: 129, pos: up(80), look: [0, 3, 10], fov: 54 },
  // …into the cloud, and out above it…
  { t: T.cloudIn, pos: up(150), look: [0, 0, 32], fov: 55 },
  { t: T.cloudOut, pos: up(222), look: [0, 185, -40], fov: 55 },
  // …tilting up to the horizon over the cloud.
  // (The apex: the rise spends itself and settles, looking out over the sea of cloud — not up at the sky.)
  { t: T.apex, pos: up(254), look: [0, 216, -104], fov: 53 },
  { t: 140.5, pos: up(258), look: [0, 218, -112], fov: 52.5 },
  // The descent: tilting down, and straight down the same column…
  { t: T.descend, pos: up(260), look: down(200), fov: 52 },
  { t: T.cloudTop, pos: up(222), look: down(160), fov: 53 },
  { t: 147.8, pos: up(187), look: down(125), fov: 53 },
  // …out of the cloud's base, the light-well at the centre of the frame…
  { t: T.cloudBase, pos: up(152), look: down(90), fov: 53 },
  { t: 153.5, pos: up(82), look: down(20), fov: 53 },
  { t: 156.5, pos: up(34), look: down(-20), fov: 52 },
  // …hovering low while its glass slides open, and through.
  { t: T.plaza, pos: up(10.5), look: down(-10), fov: 52 },
  { t: 161, pos: up(6.4), look: down(-12), fov: 53 },
  { t: T.shaft, pos: up(-1), look: down(-20), fov: 54 },
  { t: 166.5, pos: up(FLOOR_Y + 15), look: down(FLOOR_Y - 3), fov: 58 },
  // Tipping up out of the shaft into the lobby, and level, facing the door.
  { t: 168, pos: [W.x, FLOOR_Y + 6.4, W.z + 0.6], look: [W.x, FLOOR_Y + 2.3, W.z - 4.5], fov: 57 },
  { t: T.lobby, pos: [0, EYE_Y + 0.3, 44.8], look: [0, FLOOR_Y + 5.4, 27], fov: 55 },
  // Across the lobby, the lettering above the door, the door opening as the camera nears…
  { t: 173, pos: [0, EYE_Y + 0.22, 40.6], look: [0, FLOOR_Y + 5.2, 27], fov: 54 },
  { t: T.door, pos: [0, EYE_Y + 0.14, 37], look: [0, FLOOR_Y + 4.2, 27], fov: 53.5 },
  { t: 180.5, pos: [0, EYE_Y + 0.05, 32.4], look: [0, EYE_Y + 0.6, 18], fov: 53 },
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
    const open = Math.min(1.9, 1 + (0.9 / aspect - 1) * 0.72);
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
