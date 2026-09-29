/**
 * The Teams interaction controller: everything that has to happen once per
 * frame, called by the CameraRig (so it runs after scroll damping and before
 * the shot is evaluated — one ordered loop, no competing useFrames).
 *
 *   - arms the portal when the visitor is standing before it
 *   - integrates the hold (2 s to fill, eases back on release)
 *   - turns scroll pressure against the walls into the gate hint / the pull
 *     that takes you back out
 *   - picks the card under the pointer (exact ray / rounded-rect test against
 *     the cards' own matrices — no raycaster traversal, no DOM event plumbing)
 *   - evaluates the camera shot for travel, arrival, orbit and focus, with
 *     pointer parallax, scroll-velocity bank and idle breathing layered on
 */
import { Matrix4, type PerspectiveCamera, Vector3 } from 'three';
import { PORTAL_DWELL, segmentProgress } from '@/config/timeline';
import { DOMAIN_COUNT } from '@/content/teams';
import { experience } from '@/store/experience';
import { clamp01, copyPose, emptyPose, smoothstep, type CameraPose } from '@/systems/camera/pose';
import { stage } from '@/systems/anchors/anchors';
import { fx } from '@/systems/camera/effects';
import { progress } from '@/systems/scroll/progress';
import {
  blendShots,
  copyShot,
  entryShot,
  letterClearance,
  makeShot,
  makeTunnel,
  orbitShot,
  shotToPose,
  travelInPose,
  travelOutPose,
  tunnelFor,
  type Shot,
} from './camera';
import { C_ENTRY, O, cardAngle, cardCenter, carouselAt, composition, nearestCard, type Composition } from './layout';
import { FOCUS_PUSH } from './camera';
import { updatePointerField } from './pointer';
import { teams, teamsFrame } from './state';
import { capture, enterTeams, exitTeams, travelChannels } from './travel';

/** Seconds of holding to go through. */
export const HOLD_SECONDS = 2;
/**
 * The orbit follows the scroll with a critically damped spring (rad/s): an
 * immediate first response, ~0.1 s of lag, and a tail that settles without
 * overshoot. It reads the Lenis-smoothed scroll target directly — Lenis is
 * the one smoothing stage in front of it — instead of stacking a third
 * exponential tail on top (the old glide kept a single wheel notch drifting
 * for ~1.5 s and reversed ~0.5 s late).
 */
export const ORBIT_FOLLOW = 20;
/**
 * Everything else feels the orbit's velocity at its own rate (1/s), so the
 * world doesn't move as one rigid block: the camera banks first, the cards
 * near it trail a touch later, the heavier spine later still.
 */
const RATE = { camera: 6, cards: 7, spine: 3.2 };
/** Sustained upward scroll (CSS px of wheel / swipe) at the start of the world that takes you back out. */
export const PULL_EXIT = 760;
/** QA only (debug.ts): hold the camera still — no pointer parallax, no idle breathing. */
export const qa = { still: false };

// ─── Composition cache ───────────────────────────────────────────────────────

let comp: Composition = composition(16 / 9);
export function compositionFor(aspect: number) {
  if (Math.abs(comp.aspect - aspect) > 1e-3) comp = composition(aspect);
  return comp;
}
export const currentComposition = () => comp;

// ─── Card picking ────────────────────────────────────────────────────────────

/** Each card publishes its world matrix and half-size here every frame. */
export const cardPick = Array.from({ length: DOMAIN_COUNT }, () => ({ matrix: new Matrix4(), inverse: new Matrix4(), hw: 1, hh: 1, radius: 0.1, live: false }));

const _o = new Vector3();
const _d = new Vector3();
const _lo = new Vector3();
const _ld = new Vector3();

/** Where the last successful pick hit its card, in the card's own plane (metres from its centre). */
export const lastHit = { x: 0, y: 0 };

/** Card index under NDC point (x, y), or −1. */
export function pickCard(camera: PerspectiveCamera, x: number, y: number, proximity = false) {
  _o.setFromMatrixPosition(camera.matrixWorld);
  _d.set(x, y, 0.5).unproject(camera).sub(_o).normalize();
  let best = -1;
  let bestT = Infinity;
  for (let i = 0; i < cardPick.length; i++) {
    const c = cardPick[i];
    if (!c.live) continue;
    c.inverse.copy(c.matrix).invert();
    _lo.copy(_o).applyMatrix4(c.inverse);
    _ld.copy(_d).transformDirection(c.inverse);
    if (_ld.z >= -1e-5 || _lo.z <= 0) continue;
    const t = -_lo.z / _ld.z;
    if (t <= 0) continue;
    const hx = _lo.x + _ld.x * t;
    const hy = _lo.y + _ld.y * t;
    const qx = Math.abs(hx) - c.hw + c.radius;
    const qy = Math.abs(hy) - c.hh + c.radius;
    const distance = Math.hypot(Math.max(0, qx), Math.max(0, qy)) + Math.min(0, Math.max(qx, qy)) - c.radius;
    if (proximity) teamsFrame.proximity[i] = 1 - smoothstep(0, 0.42, distance);
    if (distance <= 0 && t < bestT) {
      best = i;
      bestT = t;
      lastHit.x = hx;
      lastHit.y = hy;
    }
  }
  return best;
}

// ─── Per-frame update ────────────────────────────────────────────────────────

const HOLDABLE = new Set(['outside', 'portalIdle', 'portalHolding']);
let lastHover = -1;

let lastCamera: PerspectiveCamera | null = null;
/** Card under a screen point (NDC), using the camera as last placed. */
export const pickAt = (x: number, y: number) => (lastCamera ? pickCard(lastCamera, x, y) : -1);

const _sc = new Vector3();
/** Where card i's centre is on screen (CSS px) — for the QA harness. */
export function cardScreenPoint(i: number) {
  const c = cardPick[i];
  if (!lastCamera || !c) return null;
  _sc.setFromMatrixPosition(c.matrix).project(lastCamera);
  if (_sc.z > 1) return null;
  return { x: (_sc.x * 0.5 + 0.5) * (stage.w || window.innerWidth), y: (-_sc.y * 0.5 + 0.5) * (stage.h || window.innerHeight) };
}

/** The camera as last placed (QA traces). */
export function cameraSnapshot() {
  const c = lastCamera;
  if (!c) return null;
  const r = (v: number) => Math.round(v * 1000) / 1000;
  return { x: r(c.position.x), y: r(c.position.y), z: r(c.position.z), yaw: r(c.rotation.y), pitch: r(c.rotation.x), roll: r(c.rotation.z), fov: r(c.fov) };
}

export function updateTeams(dt: number, camera: PerspectiveCamera) {
  lastCamera = camera;
  const ex = experience();
  const st = teams();
  const f = teamsFrame;
  const reduced = ex.reducedMotion;

  // ── the portal ──
  if (!f.inside && ex.phase === 'cinematic' && HOLDABLE.has(st.state)) {
    const p = progress.value;
    const u = segmentProgress(p, 'portal');
    const standing = ex.segment === 'portal' && u >= PORTAL_DWELL - 0.04 && Math.abs(progress.target - p) < 0.01;
    f.armed = standing && !ex.menuOpen && !ex.dossier && !ex.textVersionOpen;
    if (f.holding && f.armed) {
      f.heldFor += dt;
      f.hold = Math.min(1, f.hold + dt / HOLD_SECONDS);
      if (f.hold >= 1) {
        enterTeams({ reduced });
        return;
      }
    } else {
      f.heldFor = 0;
      // Let go early: the whole reaction runs back down, quickly at first.
      f.hold = Math.max(0, f.hold - dt * (0.4 + f.hold * 1.7));
    }
    const next = f.hold > 0.001 ? 'portalHolding' : f.armed ? 'portalIdle' : 'outside';
    if (next !== st.state) st.set({ state: next });
  } else if (!f.inside) {
    f.armed = false;
  }
  f.pressure *= Math.exp(-dt * 1.6);
  f.pull *= Math.exp(-dt * (f.pull > PULL_EXIT * 0.5 ? 0.6 : 1.2));

  // ── inside ──
  if (f.inside && st.state === 'teamsActive' && f.pull > PULL_EXIT) {
    f.pull = 0;
    exitTeams({ reduced });
  }

  // At rest at the entrance (facing THE TEAM, the scroll on its floor)?
  const resting = f.inside && st.state === 'teamsActive' && progress.target <= progress.lock.min + 0.0006 && f.c <= C_ENTRY + 0.03 && Math.abs(f.cV) < 0.08;
  f.floorRest = resting ? f.floorRest + dt : 0;

  const cNear = nearestCard(f.c);
  if (f.inside && cNear !== st.current) st.set({ current: cNear });

  // Pointer velocity (NDC / s), smoothed and decaying — the dust's wake reads it.
  const kv = 1 - Math.exp(-dt * 9);
  f.pointer.vx += (f.pointer.dx / Math.max(dt, 1e-3) - f.pointer.vx) * kv;
  f.pointer.vy += (f.pointer.dy / Math.max(dt, 1e-3) - f.pointer.vy) * kv;
  f.pointer.dx = f.pointer.dy = 0;

  // Pointer, smoothed: the slow channel (sx / sy, the portal's lean) and the
  // camera's parallax channel (cx / cy) — short enough that the view never chases.
  const k = 1 - Math.exp(-dt * 2.6);
  f.pointer.sx += ((f.pointer.active ? f.pointer.x : 0) - f.pointer.sx) * k;
  f.pointer.sy += ((f.pointer.active ? f.pointer.y : 0) - f.pointer.sy) * k;
  const kc = 1 - Math.exp(-dt * 4.5);
  f.pointer.cx += ((f.pointer.active ? f.pointer.x : 0) - f.pointer.cx) * kc;
  f.pointer.cy += ((f.pointer.active ? f.pointer.y : 0) - f.pointer.cy) * kc;

  // Damped force field: input attracts a small mass; velocity survives direction
  // changes and decays after stopping. Substeps make it stable on slow devices.
  updatePointerField(f.pointer, dt, reduced);

  // Hover: mouse / pen only (TeamsInput never marks a touch as the pointer; touch selects on tap).
  const canHover = f.inside && f.reveal > 0.9 && st.state === 'teamsActive' && f.pointer.active;
  f.proximity.fill(0);
  f.hover = canHover ? pickCard(camera, f.pointer.x, f.pointer.y, true) : -1;
  if (f.touchCard >= 0) f.proximity[f.touchCard] = 0.6;
  if (f.hover >= 0) {
    // Ease the hit point so the glint glides with the pointer instead of snapping.
    const kp = 1 - Math.exp(-dt * 14);
    const jump = f.hover !== lastHover;
    f.hoverAt.x = jump ? lastHit.x : f.hoverAt.x + (lastHit.x - f.hoverAt.x) * kp;
    f.hoverAt.y = jump ? lastHit.y : f.hoverAt.y + (lastHit.y - f.hoverAt.y) * kp;
  }
  lastHover = f.hover;
  // Proximity answers quickly and lets go a little slower (no pop either way).
  const kIn = 1 - Math.exp(-dt * 12);
  const kOut = 1 - Math.exp(-dt * 6);
  for (let i = 0; i < f.hoverAmt.length; i++) {
    const t = reduced ? 0 : f.proximity[i];
    f.hoverAmt[i] += (t - f.hoverAmt[i]) * (t > f.hoverAmt[i] ? kIn : kOut);
  }

  travelChannels();
}

// ─── The shot ────────────────────────────────────────────────────────────────

const tunnel = makeTunnel();
export const currentTunnel = () => tunnel;
const travelFrom = emptyPose();
const exitFrom = makeShot();
const lastShot = makeShot();
const A = makeShot();
const F = makeShot();
const OUT = makeShot();
const _right = new Vector3();
const _up = new Vector3(0, 1, 0);
const _fwd = new Vector3();
const _rad = new Vector3();

/**
 * Is the Teams camera in charge this frame? (Travel in either direction, or
 * anywhere inside the world.)
 */
export function teamsCameraActive() {
  const s = teams().state;
  return teamsFrame.inside || s === 'portalEntering' || s === 'portalExiting';
}

/**
 * The camera shot for the Teams world. `prev` is the rig's last shot (the
 * origin of a travel that starts this frame).
 */
export function evaluateTeamsShot(dt: number, time: number, aspect: number, prev: CameraPose, out: CameraPose, reduced: boolean) {
  const cp = compositionFor(aspect);
  const st = teams().state;
  const f = teamsFrame;
  tunnelFor(cp, tunnel);

  if (st === 'portalEntering' && !f.inside) {
    if (capture.pending) {
      copyPose(prev, travelFrom);
      capture.pending = false;
    }
    return travelInPose(f.travel.t, travelFrom, tunnel, cp, out);
  }
  if (st === 'portalEntering') return travelInPose(f.travel.t, travelFrom, tunnel, cp, out);
  if (st === 'portalExiting') {
    if (capture.pending) {
      copyShot(lastShot, exitFrom);
      capture.pending = false;
    }
    return travelOutPose(f.travel.t, exitFrom, tunnel, cp, out);
  }

  // ── the orbit ──
  let v = 0;
  // The orbit keeps gliding while a card is chosen or open: a selection made
  // mid-scroll lets the orbit's momentum settle (focus.ts has already moved the
  // scroll to where it comes to rest) instead of stopping it dead.
  if (st === 'teamsActive' || st === 'cardFocused' || st === 'domainDetail') {
    // A jump (menu, deep link — or the loop coming round, inside the mist) is a
    // cut, not a velocity; reduced motion cuts between framed stills
    // (progress.value holds the still).
    const cut = reduced || fx.fade > 0.5 || progress.cut;
    const target = carouselAt(cut ? progress.value : progress.target);
    if (cut) {
      f.c = target;
      f.cV = 0;
    } else {
      // Critically damped follower, substepped so it is stable at any frame rate.
      const n = Math.max(1, Math.ceil(dt * 240));
      const h = dt / n;
      const w = ORBIT_FOLLOW;
      for (let i = 0; i < n; i++) {
        f.cV += ((target - f.c) * w * w - 2 * w * f.cV) * h;
        f.c += f.cV * h;
      }
      if (Math.abs(target - f.c) < 2e-5 && Math.abs(f.cV) < 2e-3) {
        f.c = target;
        f.cV = 0;
      }
    }
    v = f.cV;
  } else f.cV = 0;
  // Each layer feels the motion at its own rate, and lets it go at its own rate
  // (nothing snaps to rest when a card is chosen mid-scroll).
  const e = (r: number) => 1 - Math.exp(-dt * r);
  f.cVel += (v - f.cVel) * e(RATE.camera);
  f.cardVel += (v - f.cardVel) * e(RATE.cards);
  f.spineVel += (v - f.spineVel) * e(RATE.spine);
  orbitShot(f.c, cp, A);
  // The world is revealed as the camera comes out through the back of the letters.
  f.reveal = f.arrival * (f.c >= 0 ? 1 : letterClearance(A.pos.z));

  // Idle: the camera breathes, slowly, in and up.
  if (!reduced && !qa.still) {
    _rad.set(A.pos.x - A.target.x, 0, A.pos.z - A.target.z).normalize();
    A.pos.addScaledVector(_rad, Math.sin(time * 0.31) * 0.05);
    A.pos.y += Math.sin(time * 0.45 + 0.8) * 0.035;
  }

  copyShot(A, OUT);

  // ── focus ──
  if (f.focus > 1e-4) {
    entryShot(OUT, f.focusK, cp, f.focus, OUT);
  }
  cardCenter(f.focusK, cp, _rad, FOCUS_PUSH);
  const normalAngle = cardAngle(f.focusK);
  const surfaceDistance = (OUT.pos.x - _rad.x) * Math.sin(normalAngle) + (OUT.pos.z - _rad.z) * Math.cos(normalAngle);
  // The domain's hand is fully dealt as the eye comes through the surface.
  f.domainReveal = f.focus > 0.3 ? 1 - smoothstep(-0.45, -0.04, surfaceDistance) : 0;
  f.dive = 0;

  // ── layered response: pointer parallax, scroll bank, the exit pull ──
  _fwd.subVectors(OUT.target, OUT.pos).normalize();
  _right.crossVectors(_fwd, _up).normalize();
  const live = st === 'teamsEntering' ? smoothstep(0.85, 1, f.arrival) : 1;
  // Pointer parallax: out in the orbit, and (smaller) once through a card, where
  // it keeps the dust behind the member hand reading as depth.
  const par = qa.still ? 0 : (reduced ? 0 : 0.45) * live * (1 - f.focus) + (reduced ? 0 : 0.22) * f.domainReveal;
  OUT.pos.addScaledVector(_right, f.pointer.cx * 0.14 * par).addScaledVector(_up, f.pointer.cy * 0.09 * par);
  OUT.target.addScaledVector(_right, f.pointer.cx * 0.05 * par).addScaledVector(_up, f.pointer.cy * 0.03 * par);
  if (!reduced) {
    // Speed banks the view a hair and opens the lens a little (felt more than seen).
    OUT.roll += Math.max(-0.008, Math.min(0.008, -f.cVel * 0.004)) * (1 - f.focus);
    OUT.fov += Math.min(1.4, Math.abs(f.cVel) * 1.1) * (1 - f.focus);
  }
  const pull = clamp01(f.pull / PULL_EXIT);
  if (pull > 0) {
    OUT.pos.addScaledVector(_fwd, -1.8 * pull * pull);
    OUT.fov += 4 * pull;
  }

  copyShot(OUT, lastShot);
  return shotToPose(OUT, out);
}
