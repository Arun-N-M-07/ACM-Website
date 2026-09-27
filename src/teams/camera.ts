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
import { C_ENTRY, C_OUTRO, C_FINAL, DWELL_SLOPE, ENTRY_Z, cardAngle, cardCenter, cardRadius, cardY, spineAxis, LAST, O, type Composition } from './layout';
import { LETTER_DEPTH, letterLayout } from './world/letters';

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
  if (c < 0) return entryShotAt(c, comp, out);
  const intro = 0;
  const outro = c > C_OUTRO ? easeInOutCubic(clamp01((c - C_OUTRO) / (C_FINAL - C_OUTRO))) : 0;
  const onCards = c >= 0 && c <= LAST ? 1 : 0;
  // Between two cards the camera eases back a little, then in again: a breath.
  const breath = onCards * Math.sin(Math.PI * frac(c)) ** 2 * (comp.portrait ? 0.35 : 0.5);
  const phi = cardAngle(c);
  const yFocus = cardY(c, comp);
  spineAxis(yFocus, _b);
  const dist = cardRadius(c, comp) + comp.orbitDist + breath + outro * (comp.portrait ? 15 : 12);
  const camY = O.y + yFocus + comp.lift + intro * 0.9 + outro * (comp.portrait ? 9 : 6.5);
  out.pos.set(O.x + _b.x + Math.sin(phi) * dist, camY, O.z + _b.z + Math.cos(phi) * dist);
  // Look through the focused card towards the spine, the gaze a little above
  // the card: the card sits low in frame (≈ 60% down, as on the reference)
  // with the spine rising behind and above it.
  const r = comp.radius * 0.7;
  const gaze = comp.portrait ? 0.12 : 0.16;
  out.target.set(O.x + _b.x + Math.sin(phi) * r, O.y + yFocus + comp.lift + gaze, O.z + _b.z + Math.cos(phi) * r);
  if (outro > 0) {
    // …and in the pull-back, at the middle of the whole helix.
    _a.set(O.x, O.y + cardY(LAST, comp) * 0.5, O.z);
    out.target.lerp(_a, outro);
  }
  out.fov = comp.fov + intro * 3 + outro * 8;
  out.roll = 0;
  return out;
}

// ─── THE TEAM: the entrance path (c from C_ENTRY to 0) ──────────────────────
//
// Out of the tunnel's mouth the camera stands far enough back to see the whole
// title, approaches until the letters are enormous, skims the letter faces,
// flies through the passage between the words (or, in portrait, the slot
// between the lines), and comes out into the open world to arrive at card 01
// — landing with exactly the velocity the orbit continues with, so the scroll
// never feels the hand-over. Keys are interpolated with a C¹ Hermite spline in
// the scroll coordinate: a pure function of c, so it reverses exactly.

/** Channels per key: position xyz, target xyz, fov, roll. */
const CH = 8;
interface EntryPath {
  u: number[];
  v: number[][];
  m: number[][];
}
const entryCache = new WeakMap<Composition, EntryPath>();
const _o0 = makeShot();
const _o1 = makeShot();
const channels = (s: Shot) => [s.pos.x, s.pos.y, s.pos.z, s.target.x, s.target.y, s.target.z, s.fov, s.roll];

function entryPath(comp: Composition): EntryPath {
  const hit = entryCache.get(comp);
  if (hit) return hit;
  const L = letterLayout(comp.portrait);
  const plane = O.z + ENTRY_Z;
  const face = plane + LETTER_DEPTH / 2;
  const back = plane - LETTER_DEPTH / 2;
  const cx = O.x + (L.left + L.right) / 2;
  const cy = O.y + (L.bottom + L.top) / 2;
  const px = O.x + L.passX;
  const py = O.y + L.passY;
  const tanV = Math.tan((comp.fov * Math.PI) / 360);
  // Far enough back that the whole title spans ~84% of the frame's width (or 62% of its height).
  const fit = Math.max((L.right - L.left) / 0.84 / (2 * tanV * comp.aspect), (L.top - L.bottom) / 0.62 / (2 * tanV));
  const side = comp.portrait ? 0 : 1;
  orbitShot(0, comp, _o0);
  orbitShot(0.02, comp, _o1);
  const keys: [number, number[]][] = [
    // Out of the tunnel: the whole title, a little above its centre line.
    [0, [lerp(cx, px, 0.25), cy + 1.5, face + fit + 6, lerp(cx, px, 0.2), cy + 0.25, plane, comp.fov + 2, 0]],
    // Approaching: the letters fill the frame, the aim drifts towards the passage.
    [0.3, [lerp(cx, px, 0.62), lerp(cy, py, 0.55) + 0.55, face + fit * 0.42, lerp(cx, px, 0.72), lerp(cy, py, 0.6), plane - 2, comp.fov, 0]],
    // At the letter faces: the lens opens, the walls stretch past the edges of frame.
    [0.55, [px + 0.12 * side, py + 0.14, face + 2.4, px, py + 0.04, back - 12, comp.fov + 9, -0.014 * side]],
    // Through: the letters are behind us.
    [0.72, [px, py, back - 2, px, py + 0.06, back - 16, comp.fov + 5, 0.004 * side]],
    // Card 01, in orbit.
    [1, channels(_o0)],
  ];
  const u = keys.map((k) => k[0]);
  const v = keys.map((k) => k[1]);
  const n = keys.length;
  const m = v.map((vi, i) =>
    vi.map((_, j) => {
      if (i === 0) return (v[1][j] - v[0][j]) / (u[1] - u[0]);
      if (i === n - 1) return 0;
      return 0.5 * ((v[i + 1][j] - v[i][j]) / (u[i + 1] - u[i]) + (v[i][j] - v[i - 1][j]) / (u[i] - u[i - 1]));
    }),
  );
  // Land with the orbit's own velocity: d/du = d/dc · (dc/dr at a dwell) · (dr/du).
  const o1 = channels(_o1);
  const o0 = v[n - 1];
  for (let j = 0; j < CH; j++) m[n - 1][j] = ((o1[j] - o0[j]) / 0.02) * DWELL_SLOPE * -C_ENTRY;
  const path = { u, v, m };
  entryCache.set(comp, path);
  return path;
}

const _e = new Array<number>(CH).fill(0);
function entryShotAt(c: number, comp: Composition, out: Shot) {
  const { u: U, v, m } = entryPath(comp);
  const u = clamp01((c - C_ENTRY) / -C_ENTRY);
  let i = 0;
  while (i < U.length - 2 && u > U[i + 1]) i++;
  const h = U[i + 1] - U[i];
  const t = (u - U[i]) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  for (let j = 0; j < CH; j++) _e[j] = h00 * v[i][j] + h10 * h * m[i][j] + h01 * v[i + 1][j] + h11 * h * m[i + 1][j];
  out.pos.set(_e[0], _e[1], _e[2]);
  out.target.set(_e[3], _e[4], _e[5]);
  out.fov = _e[6];
  out.roll = _e[7];
  return out;
}

/**
 * How far the camera has come into and through the letters: 0 still a little
 * way in front of their faces → 1 well clear of their backs. The world starts
 * to show through the passage as the lens reaches the letter faces, so the
 * spine is the destination seen between the words, not a void behind them.
 */
export function letterClearance(camZ: number) {
  return smoothstep(ENTRY_Z + LETTER_DEPTH / 2 + 2.2, ENTRY_Z - LETTER_DEPTH / 2 - 5, camZ - O.z);
}

// ─── Entering a domain ───────────────────────────────────────────────────────
//
// A chosen card is a threshold. Behind every card there is a room (the
// domain's space, world/DomainInterior.tsx); the camera flies through the
// card's surface into it:
//
//   commit      the card comes forward and squares up at once, on its own
//               quicker clock; the eye sets off straight away (no pull-back)
//   travel      it accelerates, arcing round the spine if it has to, until it
//               stands square in front of the card
//   threshold   it closes on the surface; the card's type fills the view and
//               an aperture opens from the card's centre (DomainCards, uOpen)
//               with the room behind it, and the lens widens a little as it
//               crosses
//   settle      it decelerates to rest just inside the room
//
// One continuous path, keyed on the focus scalar (0..1): closing the domain
// runs the same scalar back, so the return retraces it exactly.

/** How far a chosen card comes forward out of the ring. */
export const FOCUS_PUSH = 0.55;
/** Where the eye settles inside the room: this far past the card's centre plane. */
export const ROOM_EYE = 0.9;
/**
 * The room behind a card — far larger than the card: the card is the
 * compressed form, the room the world it opens onto. Width, height, depth,
 * and how far the floor lies below the eye (metres).
 */
export const roomSize = (comp: Composition) => (comp.portrait ? { w: 4.8, h: 6.6, depth: 8.6, floor: 1.9 } : { w: 7.6, h: 4.3, depth: 8.6, floor: 1.45 });
/** The lens inside the room (wide enough to take in the room's architecture). */
export const roomFov = (comp: Composition) => (comp.portrait ? 64 : 52);

/** Settled inside the domain room, looking down it. */
export function focusShot(k: number, comp: Composition, out: Shot) {
  const a = cardAngle(k);
  cardCenter(k, comp, out.pos, FOCUS_PUSH - ROOM_EYE);
  out.target.set(out.pos.x - Math.sin(a) * 4, out.pos.y, out.pos.z - Math.cos(a) * 4);
  out.fov = roomFov(comp);
  out.roll = 0;
  return out;
}

/** Where each key falls on the focus scalar (key 2 moves with the distances: see entryShot). */
const ENTRY_U = [0, 0.14, 0.5, 0.8, 1];
/** Per key: angle, radius and height about the spine axis; target xyz; fov; roll. */
const _k = ENTRY_U.map(() => new Array<number>(8).fill(0));
const _m = ENTRY_U.map(() => new Array<number>(8).fill(0));
const _v = new Array<number>(8).fill(0);
const _n = new Vector3();
const _cc = new Vector3();
const _dir = new Vector3();
const _tgt = new Vector3();
const _al = new Vector3();

function setKey(i: number, px: number, py: number, pz: number, tx: number, ty: number, tz: number, fov: number, roll: number) {
  const k = _k[i];
  let th = Math.atan2(px - O.x, pz - O.z);
  // Unwrap against the previous key so the camera takes the short way round the spine.
  if (i > 0) th = _k[i - 1][0] + Math.atan2(Math.sin(th - _k[i - 1][0]), Math.cos(th - _k[i - 1][0]));
  k[0] = th;
  k[1] = Math.hypot(px - O.x, pz - O.z);
  k[2] = py;
  k[3] = tx;
  k[4] = ty;
  k[5] = tz;
  k[6] = fov;
  k[7] = roll;
}

/** The entry path: from the orbit shot `from` into card k's room, at focus 0..1. */
export function entryShot(from: Shot, k: number, comp: Composition, focus: number, out: Shot) {
  const a = cardAngle(k);
  _n.set(Math.sin(a), 0, Math.cos(a));
  cardCenter(k, comp, _cc, FOCUS_PUSH);
  // 0 · where the eye was
  setKey(0, from.pos.x, from.pos.y, from.pos.z, from.target.x, from.target.y, from.target.z, from.fov, from.roll);
  // Where the eye will stand square in front of the card.
  const d = comp.orbitDist * 0.84;
  _al.set(_cc.x + _n.x * d, _cc.y, _cc.z + _n.z * d);
  // 1 · already moving: the eye commits the moment the card does (no pull-back)
  _dir.subVectors(_al, from.pos);
  _tgt.lerpVectors(from.target, _cc, 0.12);
  setKey(1, from.pos.x + _dir.x * 0.1, from.pos.y + _dir.y * 0.1, from.pos.z + _dir.z * 0.1, _tgt.x, _tgt.y, _tgt.z, from.fov, from.roll * 0.5);
  // 2 · square in front of the card
  setKey(2, _al.x, _al.y, _al.z, _cc.x, _cc.y, _cc.z, comp.fov, 0);
  // The squaring-up takes its share of the path by distance: a card already
  // in front of the eye is squared almost at once and the travel starts
  // straight away; one round the ring takes longer to reach.
  const toSquare = _al.distanceTo(from.pos);
  const through = _al.distanceTo(_cc) + ROOM_EYE;
  ENTRY_U[2] = Math.min(0.5, Math.max(0.2, 0.12 + (0.5 * toSquare) / (toSquare + through)));
  ENTRY_U[1] = ENTRY_U[2] * 0.3;
  // 3 · through its surface, the lens opened a little by the speed
  setKey(3, _cc.x - _n.x * 0.12, _cc.y, _cc.z - _n.z * 0.12, _cc.x - _n.x * 4, _cc.y, _cc.z - _n.z * 4, roomFov(comp) + 4, 0);
  // 4 · at rest inside the room
  const e = ROOM_EYE;
  setKey(4, _cc.x - _n.x * e, _cc.y, _cc.z - _n.z * e, _cc.x - _n.x * (e + 4), _cc.y, _cc.z - _n.z * (e + 4), roomFov(comp), 0);
  // C¹ through the keys, at rest at both ends, and monotone between them
  // (Fritsch–Carlson): the eye never drifts back before it goes forward, and
  // never overshoots the room.
  const U = ENTRY_U;
  const n = U.length;
  for (let j = 0; j < 8; j++) {
    _m[0][j] = 0;
    _m[n - 1][j] = 0;
    for (let i = 1; i < n - 1; i++) {
      const a = (_k[i][j] - _k[i - 1][j]) / (U[i] - U[i - 1]);
      const b = (_k[i + 1][j] - _k[i][j]) / (U[i + 1] - U[i]);
      _m[i][j] = a * b <= 0 ? 0 : 0.5 * (a + b);
    }
    for (let i = 0; i < n - 1; i++) {
      const dk = (_k[i + 1][j] - _k[i][j]) / (U[i + 1] - U[i]);
      if (Math.abs(dk) < 1e-9) {
        _m[i][j] = _m[i + 1][j] = 0;
        continue;
      }
      const al = _m[i][j] / dk;
      const be = _m[i + 1][j] / dk;
      const hh = al * al + be * be;
      if (hh > 9) {
        const tau = 3 / Math.sqrt(hh);
        _m[i][j] = tau * al * dk;
        _m[i + 1][j] = tau * be * dk;
      }
    }
  }
  const u = clamp01(focus);
  let i = 0;
  while (i < n - 2 && u > U[i + 1]) i++;
  const h = U[i + 1] - U[i];
  const t = (u - U[i]) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  for (let j = 0; j < 8; j++) _v[j] = h00 * _k[i][j] + h10 * h * _m[i][j] + h01 * _k[i + 1][j] + h11 * h * _m[i + 1][j];
  out.pos.set(O.x + Math.sin(_v[0]) * _v[1], _v[2], O.z + Math.cos(_v[0]) * _v[1]);
  out.target.set(_v[3], _v[4], _v[5]);
  out.fov = _v[6];
  out.roll = _v[7];
  return out;
}

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
/**
 * The tunnel opens exactly where the entrance path begins (the floor of the
 * world's scroll), on the line of the camera's first look at THE TEAM — so the
 * travel hands straight over to scroll, with no timed glide in between.
 */
export function tunnelFor(comp: Composition, out: TunnelFrame) {
  orbitShot(C_ENTRY, comp, _entry);
  out.dir.set(_entry.target.x - _entry.pos.x, 0, _entry.target.z - _entry.pos.z).normalize();
  out.exit.copy(_entry.pos);
  out.start.copy(out.exit).addScaledVector(out.dir, -TUNNEL_LENGTH);
  return out;
}

/** The first frame out of the tunnel: the entrance path's first pose. */
export function arrivalStartShot(_tunnel: TunnelFrame, comp: Composition, out: Shot) {
  return orbitShot(C_ENTRY, comp, out);
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
  // In the last stretch the eye settles on THE TEAM, the entrance path's first look.
  arrivalStartShot(tunnel, comp, _entry);
  _t.target.lerp(_entry.target, smoothstep(0.7, 1, u));
  // Wide at speed, compressed towards the exit.
  _t.fov = u < 0.35 ? lerp(104, 86, u / 0.35) : lerp(86, _entry.fov, easeOutCubic((u - 0.35) / 0.65));
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
