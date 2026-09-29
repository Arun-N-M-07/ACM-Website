'use client';
/**
 * The portal's prompt and hit target.
 *
 * The target is a real <button> laid exactly over the ring's projected disc
 * (so the whole portal is the thing you press), with the prompt beneath it:
 * TOUCH & HOLD. It accepts mouse, touch and pen through pointer events (with
 * pointer capture, so a pointer that drifts off the ring doesn't cancel; a
 * finger that sets off on a swipe scrolls instead, and lets go), and the
 * keyboard: hold Space or Enter.
 *
 * Nothing here animates through React: the prompt's stages are written to
 * the DOM from the per-frame channel.
 */
import { useEffect, useRef } from 'react';
import { anchorAt, onProjected } from '@/systems/anchors/anchors';
import { teamsFrame, useTeams } from '../state';

export function PortalHold() {
  const state = useTeams((s) => s.state);
  const visible = state === 'portalIdle' || state === 'portalHolding';
  const btn = useRef<HTMLButtonElement>(null);
  const label = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLSpanElement>(null);

  // Follow the ring on screen; stage the prompt from the hold.
  useEffect(() => {
    if (!visible) return;
    return onProjected(() => {
      const c = anchorAt('portal');
      const top = anchorAt('portalTop');
      const base = anchorAt('portalBase');
      const b = btn.current;
      const l = label.current;
      if (!c || !top || !b || !l) return;
      const r = Math.max(60, Math.hypot(top.x - c.x, top.y - c.y));
      b.style.transform = `translate3d(${(c.x - r).toFixed(1)}px, ${(c.y - r).toFixed(1)}px, 0)`;
      b.style.width = b.style.height = `${(2 * r).toFixed(1)}px`;
      const ly = Math.min(window.innerHeight - 96, base?.visible ? base.y : c.y + r + 24);
      l.style.transform = `translate3d(-50%, ${ly.toFixed(1)}px, 0)`;
      l.style.left = `${c.x.toFixed(1)}px`;
      const h = teamsFrame.hold;
      l.dataset.stage = h <= 0.001 ? (teamsFrame.pressure > 0.2 ? 'nudge' : 'idle') : h < 0.85 ? 'holding' : 'going';
      l.style.opacity = String(Math.max(0, 1 - Math.max(0, h - 0.7) / 0.25));
      l.style.letterSpacing = `${(0.32 + h * 0.5).toFixed(3)}em`;
      if (bar.current) bar.current.style.transform = `scaleX(${h.toFixed(3)})`;
    });
  }, [visible]);

  // Never leave a hold stuck on.
  useEffect(() => {
    if (!visible) teamsFrame.holding = false;
    const release = () => {
      teamsFrame.holding = false;
    };
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', release);
    return () => {
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', release);
    };
  }, [visible]);

  if (!visible) return null;
  return (
    <div className="portal-hold" data-ui>
      <button
        ref={btn}
        className="portal-target"
        aria-label="Touch and hold to enter the Crew"
        aria-describedby="portal-hold-hint"
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          teamsFrame.holding = true;
        }}
        onPointerUp={() => {
          teamsFrame.holding = false;
        }}
        onPointerCancel={() => {
          teamsFrame.holding = false;
        }}
        onLostPointerCapture={() => {
          teamsFrame.holding = false;
        }}
        onKeyDown={(e) => {
          if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
            e.preventDefault();
            teamsFrame.holding = true;
          }
        }}
        onKeyUp={(e) => {
          if (e.key === ' ' || e.key === 'Enter') teamsFrame.holding = false;
        }}
        onBlur={() => {
          teamsFrame.holding = false;
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="sr-only" id="portal-hold-hint">
          Press and hold Space or Enter, or touch and hold, for two seconds.
        </span>
      </button>
      <div ref={label} className="portal-label" aria-hidden="true" data-stage="idle">
        <span className="portal-label-main">TOUCH &amp; HOLD</span>
        <span className="portal-label-bar">
          <span ref={bar} />
        </span>
        <span className="portal-label-sub">to enter the Crew</span>
      </div>
    </div>
  );
}
