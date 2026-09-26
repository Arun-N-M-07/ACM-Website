/**
 * The Teams camera. Pure functions from state to a camera pose — the one
 * CameraRig (systems/camera/CameraRig.tsx) calls these and stays the only
 * thing that writes the camera.
 *
 *   portal hold  → the camera answers the hold: a pull, then a dolly that
 *                  accelerates into the ring
 *   travel in    → plunge through the membrane, streak tunnel, compression,
 *                  out into darkness
 *   arrival      → a long glide from the tunnel mouth to the establishing view
 *   orbit        → scroll: around and down the spine, card by card
 *   focus        → fly to a chosen card (any card, not just the centred one)
 *   travel out   → back up the tunnel and out of the portal, facing it
 *
 * Moves between shots interpolate in cylindrical coordinates around the spine
 * so the camera always arcs around the ring instead of cutting through it.
 */
import { Vector3 } from 'three';
import { CAMERA_STATES } from '@/config/camera';
import { PORTAL } from '@/config/world';
import { clamp01, easeInOutCubic, easeOutCubic, lerp, lerpAngle, lerpPose, smoothstep, type CameraPose } from '@/systems/camera/pose';
import { C_ENTRY, C_OUTRO, C_FINAL, cardAngle, cardCenter, cardY, LAST, O, STEP, type Composition } from './layout';

export interface Shot {
  pos: Vector3;
  target: Vector3;
  fov: number;
  roll: number;
}

export const makeShot = (): Shot => ({ pos: new Vector3(), target: new Vector3(), fov: 45, roll: 0 });

function copyShot(a: Shot, out: Shot) {
  out.pos.copy(a.pos);
  out.target.copy(a.target);
  out.fov = a.fov;
  out.roll = a.roll;
  return out;
}

/** Write a shot into a yaw/pitch pose (the rig's representation). */
export function shotToPose(s: Shot, out: CameraPose) {
  const dx = s.target.x - s.pos.x;
  const dy = s.target.y - s.pos.y;
  const dz = s.target.z - s.pos.z;
  out.x = s.pos.x;
  out.y = s.pos.y;
  out.z = s.pos.z;
  out.yaw = Math.atan2(-dx, -dz);
  out.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  out.roll = s.roll;
  out.fov = s.fov;
  return out;
}

const frac = (x: number) => x - Math.floor(x);
const _a = new Vector3();
const _b = new Vector3();

/**
 * The orbit: where the camera stands for orbit coordinate `c`.
 * c < 0 is the establishing approach, 0..5 the cards, > 5 the pull-back.
 */
export function orbitShot(c: number, comp: Composition, out: Shot) {
  const intro = smoothstep(0, C_ENTRY, c);
  const outro = c > C_OUTRO ? easeInOutCubic(clamp01((c - C_OUTRO) / (C_FINAL - C_OUTRO))) : 0;
  const onCards = c >= 0 && c <= LAST ? 1 : 0;
  // Between two cards the camera eases back a little, then in again: a breath.
  const breath = onCards * Math.sin(Math.PI * frac(c)) ** 2 * (comp.portrait ? 0.35 : 0.5);
  const phi = c * STEP;
  const yFocus = -c * comp.drop;
  const dist = comp.radius + comp.orbitDist + breath + intro * 2.2 + outro * (comp.portrait ? 15 : 12);
  const camY = O.y + yFocus + comp.lift + intro * 0.9 + outro * (comp.portrait ? 9 : 6.5);
  out.pos.set(O.x + Math.sin(phi) * dist, camY, O.z + Math.cos(phi) * dist);
  // Look through the focused card towards the spine, the gaze a little above
  // the card: the card sits low in frame (≈ 60% down, as on the reference)
  // with the spine rising behind and above it.
  const r = comp.radius * 0.7;
  const gaze = comp.portrait ? 0.12 : 0.16;
  out.target.set(O.x + Math.sin(phi) * r, O.y + yFocus + comp.lift + gaze, O.z + Math.cos(phi) * r);
  if (outro > 0) {
    // …and in the pull-back, at the middle of the whole helix.
    _a.set(O.x, O.y + cardY(LAST, comp) * 0.5, O.z);
    out.target.lerp(_a, outro);
  }
  out.fov = comp.fov + intro * 3 + outro * 8;
  out.roll = 0;
  return out;
}

/** In front of card `k`, square to it, the card filling the frame. */
export function focusShot(k: number, comp: Composition, out: Shot) {
  cardCenter(k, comp, out.target, FOCUS_PUSH);
  const a = cardAngle(k);
  out.pos.set(out.target.x + Math.sin(a) * comp.detailDist, out.target.y, out.target.z + Math.cos(a) * comp.detailDist);
  // Frame the card off-centre to leave room for the details: centre-right on
  // landscape screens (the text sits lower-left, as on the reference), higher
  // on portrait ones (the text sits beneath). Pan, don't turn: the card stays square.
  const tanH = Math.tan((comp.detailFov * Math.PI) / 360);
  if (comp.portrait) {
    const s = DETAIL_SHIFT.y * tanH * comp.detailDist;
    out.pos.y -= s;
    out.target.y -= s;
  } else {
    const s = DETAIL_SHIFT.x * tanH * comp.aspect * comp.detailDist;
    const rx = Math.cos(a);
    const rz = -Math.sin(a);
    out.pos.x -= rx * s;
    out.pos.z -= rz * s;
    out.target.x -= rx * s;
    out.target.z -= rz * s;
  }
  out.fov = comp.detailFov;
  out.roll = 0;
  return out;
}

/** Where an open card sits on screen: NDC offset of its centre (landscape: right; portrait: up). */
export const DETAIL_SHIFT = { x: 0.24, y: 0.32 };

/** How far a chosen card comes forward out of the ring. */
export const FOCUS_PUSH = 0.55;

/**
 * Blend two shots, arcing around the spine: angle, radius and height about
 * the axis are interpolated separately. `bump` pushes the arc outward in the
 * middle (used for card-to-card moves so the lens clears the ring).
 */
export function blendShots(a: Shot, b: Shot, t: number, out: Shot, bump = 0) {
  const ax = a.pos.x - O.x;
  const az = a.pos.z - O.z;
  const bx = b.pos.x - O.x;
  const bz = b.pos.z - O.z;
  const angle = lerpAngle(Math.atan2(ax, az), Math.atan2(bx, bz), t);
  const radius = lerp(Math.hypot(ax, az), Math.hypot(bx, bz), t) + Math.sin(Math.PI * t) * bump;
  out.pos.set(O.x + Math.sin(angle) * radius, lerp(a.pos.y, b.pos.y, t), O.z + Math.cos(angle) * radius);
  out.target.lerpVectors(a.target, b.target, t);
  out.fov = lerp(a.fov, b.fov, t);
  out.roll = lerp(a.roll, b.roll, t);
  return out;
}

// ─── Tunnel & arrival geometry ───────────────────────────────────────────────

export const TUNNEL_LENGTH = 110;

export interface TunnelFrame {
  /** Where the tunnel begins (the far end) and where it opens into the world. */
  start: Vector3;
  exit: Vector3;
  /** Direction of travel into the world (unit, horizontal). */
  dir: Vector3;
}

export const makeTunnel = (): TunnelFrame => ({ start: new Vector3(), exit: new Vector3(), dir: new Vector3() });

const _entry = makeShot();
/** The tunnel lies on the line from the establishing view outwards, opening a little above and behind it. */
export function tunnelFor(comp: Composition, out: TunnelFrame) {
  orbitShot(C_ENTRY, comp, _entry);
  out.dir.set(O.x - _entry.pos.x, 0, O.z - _entry.pos.z).normalize();
  out.exit.copy(_entry.pos).addScaledVector(out.dir, -16);
  out.exit.y += 2.4;
  out.start.copy(out.exit).addScaledVector(out.dir, -TUNNEL_LENGTH);
  return out;
}

/** The first frame after the tunnel: out of its mouth, looking at where the spine will be. */
export function arrivalStartShot(tunnel: TunnelFrame, comp: Composition, out: Shot) {
  out.pos.copy(tunnel.exit);
  out.target.copy(tunnel.exit).addScaledVector(tunnel.dir, 12);
  out.target.y = O.y + comp.lift - 0.4;
  out.fov = 44;
  out.roll = 0;
  return out;
}

// ─── The portal ──────────────────────────────────────────────────────────────

const MEMBRANE = { x: 0, y: PORTAL.y, z: PORTAL.z + 0.2 };

/**
 * The hold drives the camera: from 1.0 s the world pulls (a small lean in),
 * from 1.25 s it dollies, accelerating, and from 1.75 s it trembles with the
 * charge. `h` is hold progress 0..1 (2 s), so releasing reverses all of it.
 */
export function applyPortalHold(out: CameraPose, h: number, time: number, reduced: boolean) {
  if (h <= 0 || reduced) return out;
  const pull = smoothstep(0.5, 0.75, h) * 0.35;
  const g = smoothstep(0.625, 1, h);
  const dolly = pull + g * g * 3.1;
  const cp = Math.cos(out.pitch);
  out.x += -Math.sin(out.yaw) * cp * dolly;
  out.z += -Math.cos(out.yaw) * cp * dolly;
  out.y += Math.sin(out.pitch) * dolly;
  // Lens opens as the dolly gathers speed.
  out.fov += 3 * smoothstep(0.5, 0.8, h) + 15 * g * g;
  // Horizon settles level and centres on the ring as it takes you.
  out.pitch = lerp(out.pitch, 0.02, g);
  const shake = smoothstep(0.85, 1, h) * 0.006;
  out.yaw += Math.sin(time * 37) * shake;
  out.pitch += Math.sin(time * 43 + 1.3) * shake;
  return out;
}

// ─── Travel ──────────────────────────────────────────────────────────────────

/** Fraction of the entry travel spent before the crossing (plunge into the ring). */
export const ENTER_CROSS = 0.26;
/** Fraction of the exit travel spent in the tunnel before the crossing back. */
export const EXIT_CROSS = 0.6;

const plunge = (u: number) => 0.3 * u + 0.7 * u * u * u;

const _membrane: CameraPose = { x: MEMBRANE.x, y: MEMBRANE.y, z: MEMBRANE.z, yaw: 0, pitch: 0, roll: 0, fov: 104 };
const _t = makeShot();

/**
 * Entering. `from` is the pose at the instant the hold completed. Returns the
 * pose in the corridor (before the crossing) or in the tunnel (after).
 */
export function travelInPose(t: number, from: CameraPose, tunnel: TunnelFrame, comp: Composition, out: CameraPose) {
  if (t < ENTER_CROSS) {
    const u = plunge(t / ENTER_CROSS);
    lerpPose(from, _membrane, u, out);
    out.fov = lerp(from.fov, 104, u * u);
    out.roll = 0;
    return out;
  }
  // Through the tunnel: fastest at the crossing, braking into the mouth.
  const u = (t - ENTER_CROSS) / (1 - ENTER_CROSS);
  const s = 1 - Math.pow(1 - u, 1.7);
  _t.pos.lerpVectors(tunnel.start, tunnel.exit, s);
  _t.target.copy(_t.pos).addScaledVector(tunnel.dir, 10);
  // In the last stretch the eye drops to where the spine will be.
  arrivalStartShot(tunnel, comp, _entry);
  _t.target.lerp(_entry.target, smoothstep(0.7, 1, u));
  // Wide at speed, compressed towards the exit.
  _t.fov = u < 0.35 ? lerp(104, 86, u / 0.35) : lerp(86, 44, easeOutCubic((u - 0.35) / 0.65));
  _t.roll = Math.sin(u * Math.PI) * 0.05;
  return shotToPose(_t, out);
}

/** Leaving. `from` is the orbit shot at the instant the exit began. */
export function travelOutPose(t: number, from: Shot, tunnel: TunnelFrame, comp: Composition, out: CameraPose) {
  if (t < EXIT_CROSS) {
    const u = t / EXIT_CROSS;
    // First back out to the tunnel mouth, then accelerate up it, still facing the world.
    arrivalStartShot(tunnel, comp, _entry);
    const back = smoothstep(0, 0.35, u);
    blendShots(from, _entry, back, _t);
    const run = u < 0.35 ? 0 : Math.pow((u - 0.35) / 0.65, 2.2);
    _t.pos.addScaledVector(tunnel.dir, -run * TUNNEL_LENGTH * 0.9);
    _t.target.addScaledVector(tunnel.dir, -run * TUNNEL_LENGTH * 0.9);
    _t.fov = lerp(_t.fov, 104, run);
    _t.roll = -Math.sin(run * Math.PI) * 0.04;
    return shotToPose(_t, out);
  }
  // Out of the membrane backwards, braking to stand before the portal again.
  const u = easeOutCubic((t - EXIT_CROSS) / (1 - EXIT_CROSS));
  lerpPose(_membrane, CAMERA_STATES.portalStand, u, out);
  out.fov = lerp(104, CAMERA_STATES.portalStand.fov, u);
  return out;
}

export { copyShot };
