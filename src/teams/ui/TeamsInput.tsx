'use client';
/**
 * InteractionController (DOM side). Window-level listeners that feed the
 * per-frame channel and trigger the discrete actions:
 *
 *   pointer move      → teamsFrame.pointer (NDC) for parallax, tilt, the
 *                       pointer light, dust, hover picking
 *   tap / click       → open the card under it (touch: tap is the hover);
 *                       with a card open, a tap off the card closes it
 *   wheel / swipe     → at the portal gate: pressure (the ring flares: "hold
 *                       me"); at the start of the world, upward: the pull
 *                       that takes you back out; with a card open: "scroll to
 *                       close"
 *   keys              → Esc closes, ←/→ step between open domains, ↑/PgUp at
 *                       the start of the world pulls
 *
 * Events that start on real UI (buttons, links, the index…) are ignored.
 */
import { useEffect } from 'react';
import { useExperience } from '@/store/experience';
import { progress } from '@/systems/scroll/progress';
import { PULL_EXIT, lastHit, pickAt } from '../controller';
import { closeDomain, selectDomain, stepDomain } from '../focus';
import { teams, teamsFrame } from '../state';

const onUI = (t: EventTarget | null) => t instanceof Element && !!t.closest('button, a, input, textarea, select, [role="dialog"], [data-ui]');

const ndc = (x: number, y: number) => ({ x: (x / window.innerWidth) * 2 - 1, y: -(y / window.innerHeight) * 2 + 1 });

/** Standing on the gate (scroll at the portal wall, outside) / on the floor (at the start of the world, inside). */
const atGate = () => !teamsFrame.inside && progress.target >= progress.lock.max - 0.0004;
const atFloor = () => teamsFrame.inside && progress.target <= progress.lock.min + 0.0006;
/**
 * …and the camera has been at rest there, facing THE TEAM, for a moment. Only
 * then does upward scroll count as the pull that goes back out through the
 * portal — so the momentum of one long fling back to the entrance can't carry
 * you out.
 */
const restingAtFloor = () => atFloor() && teamsFrame.floorRest > 0.4;

export function TeamsInput() {
  useEffect(() => {
    const f = teamsFrame;
    let down: { x: number; y: number; t: number; id: number; touch: boolean } | null = null;
    let closeAcc = 0;
    let lastTouchY: number | null = null;

    const release = () => {
      f.press.card = -1;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) {
          // A drag, not a touch: the card lets go.
          f.touchCard = -1;
          release();
        }
        return;
      }
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) release();
      const p = ndc(e.clientX, e.clientY);
      if (f.pointer.active) {
        // Motion since the last frame (the controller turns it into a velocity).
        f.pointer.dx += p.x - f.pointer.x;
        f.pointer.dy += p.y - f.pointer.y;
      }
      f.pointer.x = p.x;
      f.pointer.y = p.y;
      f.pointer.active = true;
    };
    const leave = () => {
      f.pointer.active = false;
      f.touchCard = -1;
      release();
    };
    const pdown = (e: PointerEvent) => {
      if (onUI(e.target) || (e.pointerType === 'mouse' && e.button !== 0)) return;
      down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, touch: e.pointerType !== 'mouse' };
      const p = ndc(e.clientX, e.clientY);
      const card = teams().state === 'teamsActive' ? pickAt(p.x, p.y) : -1;
      if (e.pointerType !== 'mouse') {
        // Touch: the finger is the pointer for the parallax while it's down.
        f.pointer.x = p.x;
        f.pointer.y = p.y;
        f.touchCard = card;
      }
      // The touch lands before the click: the card under it takes the press at once.
      if (card >= 0) {
        f.press.card = card;
        f.press.x = lastHit.x;
        f.press.y = lastHit.y;
      }
    };
    const pup = (e: PointerEvent) => {
      const d = down;
      down = null;
      f.touchCard = -1;
      release();
      if (!d || d.id !== e.pointerId || onUI(e.target)) return;
      const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
      if (moved > 12 || performance.now() - d.t > 650) return;
      const s = teams().state;
      const p = ndc(e.clientX, e.clientY);
      if (s === 'teamsActive') {
        const i = pickAt(p.x, p.y);
        if (i >= 0) selectDomain(i);
      } else if (s === 'domainDetail') {
        // The selected surface is now behind the camera; its projected
        // rectangle cannot be used as an outside-click boundary.
        closeDomain();
      }
    };

    const push = (dy: number) => {
      const s = teams().state;
      if (s === 'domainDetail') {
        closeAcc += Math.abs(dy);
        if (closeAcc > 140) {
          closeAcc = 0;
          closeDomain();
        }
        return;
      }
      closeAcc = 0;
      if (dy > 0 && atGate() && (s === 'portalIdle' || s === 'portalHolding' || s === 'outside')) f.pressure = Math.min(1.5, f.pressure + dy / 700);
      if (dy < 0 && restingAtFloor() && s === 'teamsActive') f.pull = Math.min(PULL_EXIT * 1.2, f.pull - dy);
    };

    const wheel = (e: WheelEvent) => {
      if (onUI(e.target) && !(e.target instanceof Element && e.target.closest('.domain-detail, .portal-hold'))) return;
      const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? window.innerHeight : 1;
      push(e.deltaY * unit);
    };
    const tstart = (e: TouchEvent) => {
      const t = e.target instanceof Element ? e.target : null;
      // A finger on the portal is a hold, not a swipe.
      lastTouchY = e.touches.length === 1 && !t?.closest('.portal-target') ? e.touches[0].clientY : null;
    };
    const tmove = (e: TouchEvent) => {
      if (lastTouchY === null || e.touches.length !== 1) return;
      const y = e.touches[0].clientY;
      // Finger down the screen = scrolling up.
      push((lastTouchY - y) * 1.6);
      lastTouchY = y;
    };
    const tend = () => {
      lastTouchY = null;
    };

    const key = (e: KeyboardEvent) => {
      const ex = useExperience.getState();
      if (ex.menuOpen || ex.dossier || ex.textVersionOpen) return;
      const s = teams().state;
      if (e.key === 'Escape' && (s === 'domainDetail' || s === 'cardFocused')) {
        e.preventDefault();
        closeDomain();
      } else if (s === 'domainDetail' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        stepDomain(e.key === 'ArrowRight' ? 1 : -1);
      } else if (s === 'teamsActive' && restingAtFloor() && (e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey))) {
        f.pull = Math.min(PULL_EXIT * 1.2, f.pull + PULL_EXIT * 0.4);
      }
    };

    window.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', leave);
    window.addEventListener('blur', leave);
    window.addEventListener('pointerdown', pdown, { passive: true });
    window.addEventListener('pointerup', pup, { passive: true });
    window.addEventListener('pointercancel', leave, { passive: true });
    window.addEventListener('wheel', wheel, { passive: true });
    window.addEventListener('touchstart', tstart, { passive: true });
    window.addEventListener('touchmove', tmove, { passive: true });
    window.addEventListener('touchend', tend, { passive: true });
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', leave);
      window.removeEventListener('blur', leave);
      window.removeEventListener('pointerdown', pdown);
      window.removeEventListener('pointerup', pup);
      window.removeEventListener('pointercancel', leave);
      window.removeEventListener('wheel', wheel);
      window.removeEventListener('touchstart', tstart);
      window.removeEventListener('touchmove', tmove);
      window.removeEventListener('touchend', tend);
      window.removeEventListener('keydown', key);
    };
  }, []);
  return null;
}
