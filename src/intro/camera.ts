/**
 * The intro's camera: one continuous move, authored like a film operator's.
 *
 *   arrival     a slow, curious walk out of the mist up the garden's axis,
 *               joining the axis as the place starts to make sense
 *   story       observation: the walk slows while the fragments are read
 *   reveal      the move settles into the building's composition
 *   hero        almost still — a breath of a push-in for a whole phrase
 *   ascension   a gentle lift that becomes a rise, pulling back so the
 *               building shrinks into its campus
 *   cloud       inside the cloud the camera levels (you can't see it turn)
 *   descent     it tips over and falls through mist into the dark…
 *   tunnel      …pulls up into the tunnel and commits, straight on,
 *               towards EVENTS — arriving exactly on the pose the Events
 *               chapter opens with (config/camera: facilityEnd)
 *
 * The path is one spline (./path.ts), so there is never a cut in position or
 * velocity. On top of it, a layer of life: a slow breath that never stops,
 * even at rest; a little turbulence inside the cloud; nothing in the tunnel.
 */
import { Vector3 } from 'three';
import { CAMERA_STATES } from '@/config/camera';
import { EYE_Y, type Vec3 } from '@/config/world';
import { aim, type CameraPose } from '@/systems/camera/pose';
import { CameraPath, makeSample, type PathKey } from './path';
import { introFrame } from './state';
import { ease, T, window4 } from './timeline';

const END = CAMERA_STATES.facilityEnd;
/** The handoff: the corridor mouth, looking north, level. */
const HANDOFF: Vec3 = [END.x, END.y, END.z];

export const INTRO_KEYS: PathKey[] = [
  // Arrival: low, off the axis, among the garden's edges, in mist.
  { t: 0, pos: [-7.4, 1.72, 156], look: [-3.2, 5.2, 58], fov: 42 },
  { t: T.story1, pos: [-6.9, 1.74, 152.2], look: [-2.8, 5.6, 54], fov: 41.5 },
  // The story: the walk continues, drifting onto the axis.
  { t: 9, pos: [-5.4, 1.8, 145.4], look: [-1.8, 6.6, 44], fov: 40.5 },
  { t: T.build, pos: [-3.5, 1.88, 137.6], look: [-0.9, 8.2, 30], fov: 39.5 },
  { t: 21, pos: [-1.5, 1.95, 124.2], look: [-0.2, 9.6, 14], fov: 38 },
  // The reveal: settle into the building's composition.
  { t: T.reveal, pos: [-0.2, 1.9, 111.2], look: [0.15, 11, 2.4], fov: 36 },
  // Hero: almost still.
  { t: 33, pos: [0.08, 1.95, 108.9], look: [0.2, 11.5, 1.2], fov: 35.4 },
  { t: T.heroEnd, pos: [0.25, 2.1, 106.6], look: [0.2, 12, 0.6], fov: 35 },
  // Ascension: a lift, then the rise, pulling back over the garden.
  { t: 41.2, pos: [0.45, 8.5, 109], look: [0.2, 11.5, 2], fov: 36.5 },
  { t: 43.2, pos: [0.6, 44, 128], look: [0.1, 4, 8], fov: 41 },
  { t: T.cloudIn, pos: [0.5, 92, 140], look: [0, 0, 22], fov: 44 },
  // Inside the cloud: level out (unseen), and crest.
  { t: T.cloudDeep, pos: [0.2, 170, 156], look: [0, 150, 70], fov: 50 },
  { t: T.descent, pos: [0, 186, 160], look: [0, 138, 96], fov: 54 },
  // The fall: through the mist, into the dark…
  { t: 49.4, pos: [0, 112, 157], look: [0, -40, 112], fov: 58 },
  { t: 50.5, pos: [0, 22, 150], look: [0, -70, 100], fov: 58 },
  // …towards the one lit thing down there: an arched mouth. Pull up, level, in.
  { t: 51.4, pos: [0, -34, 136], look: [0, -60, 80], fov: 57 },
  { t: 52.3, pos: [0, -55.6, 112], look: [0, -58.2, 60], fov: 55.5 },
  // Straight on.
  { t: T.events, pos: [0, EYE_Y + 0.1, 76], look: [0, EYE_Y + 0.05, 20], fov: 54.5 },
  { t: 56, pos: [0, EYE_Y + 0.02, 38], look: [0, EYE_Y, 0], fov: 54 },
  { t: T.end, pos: HANDOFF, look: [HANDOFF[0], HANDOFF[1], HANDOFF[2] - 20], fov: END.fov },
];

export const INTRO_PATH = new CameraPath(INTRO_KEYS);

const S = makeSample();
const _pos = new Vector3();
const _dir = new Vector3();

/** Where the camera is at film time `t` (no breath) — for things that travel with it. */
export function introCameraAt(t: number) {
  INTRO_PATH.sample(t, S);
  return S;
}

/** Evaluate the intro camera for the current playhead into `out`. */
export function evaluateIntroShot(time: number, aspect: number, out: CameraPose, reduced: boolean) {
  const t = introFrame.t;
  INTRO_PATH.sample(t, S);
  _pos.copy(S.pos);
  const look = S.look;
  let fov = S.fov;

  // Portrait screens are tall and the building is wide. Through the reveal and
  // the hero the camera comes in closer and a little higher, on a tighter lens,
  // so the tower carries the height of the frame; elsewhere the lens opens to
  // keep the composition's coverage. Through the tunnel it converges exactly on
  // the journey's own portrait lens (CameraRig: widen, and a step back), so
  // the handoff doesn't jump on a phone either.
  let lookY = look.y;
  if (aspect < 0.9) {
    const p = Math.min(1, (0.9 - aspect) / 0.45);
    const close = window4(t, 12, 24, T.heroEnd, T.heroEnd + 3.5) * p;
    _dir.subVectors(look, _pos).normalize();
    _pos.addScaledVector(_dir, 16 * close);
    lookY += 2.6 * close;
    const open = Math.min(1.9, 1 + (0.9 / aspect - 1) * 0.72);
    let wide = (2 * Math.atan(Math.tan((fov * Math.PI) / 360) * open) * 180) / Math.PI;
    wide += (44 - wide) * close;
    const rigWiden = Math.min(2.1, 1 + (1 / aspect - 1) * 0.9);
    const rigFov = (2 * Math.atan(Math.tan((fov * Math.PI) / 360) * rigWiden) * 180) / Math.PI;
    const h = ease(t, 54.5, T.end);
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

  // A layer of life. The breath never stops (even at rest) but it is small;
  // it fades out in the tunnel, where the move is pure direction.
  const calm = 1 - ease(t, T.tunnel - 0.5, T.tunnel + 1.5);
  const hero = window4(t, T.reveal - 2, T.reveal + 1, T.heroEnd - 1, T.heroEnd + 1);
  const b = calm * (1 - 0.55 * hero);
  out.yaw += (Math.sin(time * 0.23) * 0.0045 + Math.sin(time * 0.61 + 1.7) * 0.0012) * b;
  out.pitch += (Math.sin(time * 0.19 + 0.6) * 0.0032 + Math.sin(time * 0.53 + 2.2) * 0.001) * b;
  out.x += Math.sin(time * 0.29 + 0.3) * 0.028 * b;
  out.y += Math.sin(time * 0.37 + 1.1) * 0.022 * b;
  // Turbulence in the cloud: small, quick, never a shake.
  const c = window4(t, T.cloudIn - 0.6, T.cloudIn + 0.8, T.descent + 1.4, T.descent + 2.4);
  if (c > 0) {
    out.roll += (Math.sin(time * 1.7) * 0.006 + Math.sin(time * 2.9 + 1) * 0.003) * c;
    out.pitch += Math.sin(time * 2.3 + 0.4) * 0.004 * c;
  }
  return out;
}
