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
import { Vector3 } from 'three';
import { CAMERA_STATES } from '@/config/camera';
import { CAMPUS, EYE_Y, FLOOR_Y, type Vec3 } from '@/config/world';
import { aim, type CameraPose } from '@/systems/camera/pose';
import { CameraPath, makeSample, type PathKey } from './path';
import { introFrame } from './state';
import { ease, T, window4 } from './timeline';
import { STONE_FOCUS } from './world/stoneLayout';

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

export const INTRO_KEYS: PathKey[] = [
  // Arrival: low, off the axis, among the garden's edges, in mist.
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
  { t: 95.5, pos: [0.05, 1.95, 109.6], look: [0.2, 11.4, 1.6], fov: 35.6 },
  { t: T.heroEnd, pos: [0.2, 2.05, 108], look: [0.2, 11.8, 1], fov: 35.2 },
  // The approach: a glide over the pool, clear of its jets, to hover before the tower.
  { t: 102.5, pos: [0.1, 3.4, 99], look: [0.2, 13.2, 1], fov: 36.8 },
  { t: 106.5, pos: [0, 7.6, 84], look: [0.2, 15.5, 0.9], fov: 40 },
  { t: 109.5, pos: [0, 9.1, 66], look: [0.2, 17.2, 0.8], fov: 45 },
  { t: T.hover, pos: [0, 9.4, 48.4], look: [0.2, 18.6, 0.6], fov: 50 },
  // The ascent: straight up the column, past the tower, the building sinking below…
  { t: T.rise, pos: up(9.8), look: [0.2, 19, 0.6], fov: 51 },
  { t: 119, pos: up(21), look: [0.2, 18.5, 0.6], fov: 52 },
  { t: 122, pos: up(41), look: [0.1, 11, 3], fov: 53 },
  { t: 125, pos: up(80), look: [0, 3, 10], fov: 54 },
  // …into the cloud, and out above it…
  { t: T.cloudIn, pos: up(150), look: [0, 0, 32], fov: 55 },
  { t: T.cloudOut, pos: up(222), look: [0, 130, 44], fov: 55 },
  // …tilting up to the horizon over the cloud.
  { t: T.apex, pos: up(256), look: [0, 243, -104], fov: 52 },
  { t: 136.5, pos: up(262), look: [0, 247.5, -120], fov: 51 },
  // The descent: tilting down, and straight down the same column…
  { t: T.descend, pos: up(260), look: down(200), fov: 52 },
  { t: T.cloudTop, pos: up(222), look: down(160), fov: 53 },
  { t: 143.8, pos: up(187), look: down(125), fov: 53 },
  // …out of the cloud's base, the light-well at the centre of the frame…
  { t: T.cloudBase, pos: up(152), look: down(90), fov: 53 },
  { t: 149.5, pos: up(82), look: down(20), fov: 53 },
  { t: 152.5, pos: up(34), look: down(-20), fov: 52 },
  // …hovering low while its glass slides open, and through.
  { t: T.plaza, pos: up(10.5), look: down(-10), fov: 52 },
  { t: 157, pos: up(6.4), look: down(-12), fov: 53 },
  { t: T.shaft, pos: up(-1), look: down(-20), fov: 54 },
  { t: 162.5, pos: up(FLOOR_Y + 15), look: down(FLOOR_Y - 3), fov: 58 },
  // Tipping up out of the shaft into the lobby, and level, facing the door.
  { t: 164, pos: [W.x, FLOOR_Y + 6.4, W.z + 0.6], look: [W.x, FLOOR_Y + 2.3, W.z - 4.5], fov: 57 },
  { t: T.lobby, pos: [0, EYE_Y + 0.3, 44.8], look: [0, FLOOR_Y + 5.4, 27], fov: 55 },
  // Across the lobby, the lettering above the door, the door opening as the camera nears…
  { t: 169, pos: [0, EYE_Y + 0.22, 40.6], look: [0, FLOOR_Y + 5.2, 27], fov: 54 },
  { t: T.door, pos: [0, EYE_Y + 0.14, 37], look: [0, FLOOR_Y + 4.2, 27], fov: 53.5 },
  { t: 176.5, pos: [0, EYE_Y + 0.05, 32.4], look: [0, EYE_Y + 0.6, 18], fov: 53 },
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
  // Turbulence in the cloud: small, quick, never a shake.
  const c = window4(t, T.cloudIn - 0.4, T.cloudIn + 0.8, T.cloudOut - 0.6, T.cloudOut + 0.2) + window4(t, T.cloudTop - 0.2, T.cloudTop + 0.9, T.cloudBase - 0.9, T.cloudBase + 0.3);
  if (c > 0) {
    out.roll += (Math.sin(time * 1.7) * 0.006 + Math.sin(time * 2.9 + 1) * 0.003) * c;
    out.pitch += Math.sin(time * 2.3 + 0.4) * 0.004 * c;
  }
  return out;
}
