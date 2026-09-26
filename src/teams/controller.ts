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
import { fx } from '@/systems/camera/effects';
import { progress } from '@/systems/scroll/progress';
import {
  arrivalStartShot,
  blendShots,
  copyShot,
  focusShot,
  makeShot,
  makeTunnel,
  orbitShot,
  shotToPose,
  travelInPose,
  travelOutPose,
  tunnelFor,
  type Shot,
} from './camera';
import { carouselAt, composition, nearestCard, type Composition } from './layout';
import { teams, teamsFrame } from './state';
import { capture, enterTeams, exitTeams, travelChannels } from './travel';

/** Seconds of holding to go through. */
export const HOLD_SECONDS = 2;
/** How quickly the orbit catches up with the scroll (per second; lower = heavier glide). */
export const ORBIT_GLIDE = 2.3;
/** Sustained upward scroll (CSS px of wheel / swipe) at the start of the world that takes you back out. */
export const PULL_EXIT = 760;

// ─── Composition cache ───────────────────────────────────────────────────────

let comp: Composition = composition(16 / 9);
export function compositionFor(aspect: number) {
  if (Math.abs(comp.aspect - aspect) > 1e-3) comp = composition(aspect);
  return comp;
}
export const currentComposition = () => comp;

// ─── Card picking ────────────────────────────────────────────────────────────

/** Each card publishes its world matrix and half-size here every frame. */
export const cardPick = Array.from({ length: DOMAIN_COUNT }, () => ({ matrix: new Matrix4(), inverse: new Matrix4(), hw: 1, hh: 1, live: false }));

const _o = new Vector3();
const _d = new Vector3();
const _lo = new Vector3();
const _ld = new Vector3();

/** Where the last successful pick hit its card, in the card's own plane (metres from its centre). */
export const lastHit = { x: 0, y: 0 };

/** Card index under NDC point (x, y), or −1. */
export function pickCard(camera: PerspectiveCamera, x: number, y: number) {
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
    if (Math.abs(_ld.z) < 1e-5) continue;
    const t = -_lo.z / _ld.z;
    if (t <= 0 || t >= bestT) continue;
    const hx = _lo.x + _ld.x * t;
    const hy = _lo.y + _ld.y * t;
    if (Math.abs(hx) <= c.hw && Math.abs(hy) <= c.hh) {
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
  return { x: (_sc.x * 0.5 + 0.5) * window.innerWidth, y: (-_sc.y * 0.5 + 0.5) * window.innerHeight };
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

  const cNear = nearestCard(f.c);
  if (f.inside && cNear !== st.current) st.set({ current: cNear });

  // Pointer velocity (NDC / s), smoothed and decaying — the dust's wake reads it.
  const kv = 1 - Math.exp(-dt * 9);
  f.pointer.vx += (f.pointer.dx / Math.max(dt, 1e-3) - f.pointer.vx) * kv;
  f.pointer.vy += (f.pointer.dy / Math.max(dt, 1e-3) - f.pointer.vy) * kv;
  f.pointer.dx = f.pointer.dy = 0;

  // Pointer, smoothed — everything that follows the pointer reads sx / sy.
  const k = 1 - Math.exp(-dt * 2.6);
  f.pointer.sx += ((f.pointer.active ? f.pointer.x : 0) - f.pointer.sx) * k;
  f.pointer.sy += ((f.pointer.active ? f.pointer.y : 0) - f.pointer.sy) * k;

  // Hover: mouse / pen only (TeamsInput never marks a touch as the pointer; touch selects on tap).
  const canHover = f.inside && st.state === 'teamsActive' && f.pointer.active;
  f.hover = canHover ? pickCard(camera, f.pointer.x, f.pointer.y) : -1;
  if (f.hover >= 0) {
    // Ease the hit point so the glint glides with the pointer instead of snapping.
    const kp = 1 - Math.exp(-dt * 14);
    const jump = f.hover !== lastHover;
    f.hoverAt.x = jump ? lastHit.x : f.hoverAt.x + (lastHit.x - f.hoverAt.x) * kp;
    f.hoverAt.y = jump ? lastHit.y : f.hoverAt.y + (lastHit.y - f.hoverAt.y) * kp;
  }
  lastHover = f.hover;
  const kh = 1 - Math.exp(-dt * 7);
  for (let i = 0; i < f.hoverAmt.length; i++) f.hoverAmt[i] += ((i === f.hover ? 1 : 0) - f.hoverAmt[i]) * kh;

  travelChannels();
}

// ─── The shot ────────────────────────────────────────────────────────────────

const tunnel = makeTunnel();
export const currentTunnel = () => tunnel;
const travelFrom = emptyPose();
const exitFrom = makeShot();
const lastShot = makeShot();
const A = makeShot();
const B = makeShot();
const F = makeShot();
const F0 = makeShot();
const F1 = makeShot();
const OUT = makeShot();
const _right = new Vector3();
const _up = new Vector3(0, 1, 0);
const _fwd = new Vector3();
const _rad = new Vector3();

function focusShotAt(k: number, cp: Composition, out: Shot) {
  const k0 = Math.floor(k);
  const t = k - k0;
  focusShot(k0, cp, F0);
  if (t < 1e-4) return copyShot(F0, out);
  focusShot(Math.min(DOMAIN_COUNT - 1, k0 + 1), cp, F1);
  // Card to card: arc out around the ring and back in.
  return blendShots(F0, F1, t, out, cp.portrait ? 2.2 : 2.8);
}

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
  if (st !== 'teamsEntering') {
    const target = carouselAt(progress.value);
    // A jump (menu, deep link) is a cut behind a fade, not a velocity.
    const cut = reduced || fx.fade > 0.5 || Math.abs(target - f.c) > 1.5;
    // The orbit glides after the scroll with a long, weighted tail — a wheel
    // notch keeps the world drifting for seconds, as on the reference.
    const c = cut ? target : f.c + (target - f.c) * (1 - Math.exp(-dt * ORBIT_GLIDE));
    const v = cut ? 0 : (c - f.c) / Math.max(dt, 1e-3);
    f.cVel += (v - f.cVel) * (1 - Math.exp(-dt * 6));
    f.c = c;
  } else f.cVel = 0;
  orbitShot(f.c, cp, A);

  // Idle: the camera breathes, slowly, in and up.
  if (!reduced) {
    _rad.set(A.pos.x - A.target.x, 0, A.pos.z - A.target.z).normalize();
    A.pos.addScaledVector(_rad, Math.sin(time * 0.31) * 0.05);
    A.pos.y += Math.sin(time * 0.45 + 0.8) * 0.035;
  }

  copyShot(A, OUT);

  // ── the arrival glide ──
  if (st === 'teamsEntering') {
    arrivalStartShot(tunnel, cp, B);
    const a = smoothstep(0, 0.96, f.arrival);
    blendShots(B, A, 1 - Math.pow(1 - a, 2.6), OUT);
  }

  // ── focus ──
  if (f.focus > 1e-4) {
    focusShotAt(f.focusK, cp, F);
    blendShots(OUT, F, f.focus, OUT);
  }
  // Opening, the camera dives past the framing — the name rushes up at you —
  // and settles back (not on closing, not card-to-card).
  const opening = st === 'cardFocused' && teams().focusDir === 'in' && !reduced;
  const diveTarget = opening ? Math.pow(Math.sin(Math.PI * Math.min(1, f.focus / 0.92)), 2) * smoothstep(0.08, 0.4, f.focus) : 0;
  f.dive += (diveTarget - f.dive) * (1 - Math.exp(-dt * 20));
  if (f.dive > 1e-3) {
    _fwd.subVectors(OUT.target, OUT.pos);
    const d = _fwd.length();
    OUT.pos.addScaledVector(_fwd.normalize(), d * 0.6 * f.dive);
    OUT.fov += 14 * f.dive;
  }

  // ── layered response: pointer parallax, scroll bank, the exit pull ──
  _fwd.subVectors(OUT.target, OUT.pos).normalize();
  _right.crossVectors(_fwd, _up).normalize();
  const live = st === 'teamsEntering' ? smoothstep(0.85, 1, f.arrival) : 1;
  const par = (reduced ? 0.4 : 1) * live * (1 - 0.65 * f.focus);
  OUT.pos.addScaledVector(_right, f.pointer.sx * 0.14 * par).addScaledVector(_up, f.pointer.sy * 0.09 * par);
  OUT.target.addScaledVector(_right, f.pointer.sx * 0.05 * par).addScaledVector(_up, f.pointer.sy * 0.03 * par);
  if (!reduced) OUT.roll += Math.max(-0.05, Math.min(0.05, -f.cVel * 0.02)) * (1 - f.focus);
  const pull = clamp01(f.pull / PULL_EXIT);
  if (pull > 0) {
    OUT.pos.addScaledVector(_fwd, -1.8 * pull * pull);
    OUT.fov += 4 * pull;
  }

  copyShot(OUT, lastShot);
  return shotToPose(OUT, out);
}
