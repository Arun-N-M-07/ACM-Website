'use client';
/**
 * The scroll system: one tall track, Lenis for smooth wheel/touch input
 * (disabled for reduced motion), and a single ScrollTrigger that maps the
 * track to progress 0..1. Nothing else in the app listens to scroll.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { useEffect, useRef } from 'react';
import { SCROLL_LENGTH_VH } from '@/config/timeline';
import { useExperience } from '@/store/experience';
import { useTeams, type TeamsState } from '@/teams/state';
import { progress } from './progress';
import { wheelGain } from './wheelShape';

let lenis: Lenis | null = null;

function maxScroll() {
  return Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
}

/** Smoothly scroll the journey to progress `p`. */
export function scrollToProgress(p: number, duration = 2.4) {
  const y = p * maxScroll();
  if (lenis) lenis.scrollTo(y, { duration, force: true, easing: (t: number) => 1 - Math.pow(1 - t, 3) });
  else window.scrollTo({ top: y, behavior: 'auto' });
}

/**
 * Move the whole journey by `delta` (progress) without a cut: the scroll position, its target and
 * the camera's damped progress all move by the same amount, and whatever the visitor's scroll was
 * still doing — Lenis's smoothing towards where the input asked to go — carries on from the new
 * place. (The loop, where the track's two ends meet inside the mist: JourneyLoop.)
 */
export function shiftProgress(delta: number) {
  const dy = delta * maxScroll();
  progress.target += delta;
  progress.value += delta;
  if (lenis) {
    const pending = lenis.targetScroll - lenis.animatedScroll;
    const y = lenis.animatedScroll + dy;
    lenis.scrollTo(y, { immediate: true, force: true });
    // The rest of the input's motion, as the input's own (not a programmatic scroll: Lenis keeps a
    // programmatic target pinned to where it is, so the next wheel event would drop the rest).
    if (Math.abs(pending) > 0.5) lenis.scrollTo(y + pending, { programmatic: false, lerp: lenis.options.lerp, force: true });
  } else window.scrollTo({ top: window.scrollY + dy, behavior: 'auto' });
}

/**
 * Jump to progress `p`: the camera cuts (behind a brief fade) instead of flying — landing `lead`
 * short of it (progress units, within the walls) and carried the rest of the way by its own
 * damped follow, if asked. (`fade: false`: no dip to black — for a cut hidden some other way.)
 */
export function jumpToProgress(p: number, lead = 0, opts: { fade?: boolean } = {}) {
  p = progress.clampToLock(p);
  progress.target = p;
  progress.snap = true;
  progress.snapFade = opts.fade ?? true;
  progress.snapLead = Math.max(0, Math.min(lead, p - progress.lock.min));
  const y = p * maxScroll();
  if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
  else window.scrollTo({ top: y, behavior: 'auto' });
}

/**
 * Move the scroll position to `p` without a cut — the camera is already there
 * (the end of the push through the door hands over to the team tour).
 */
export function placeScroll(p: number) {
  const v = Math.min(1, Math.max(0, p));
  progress.target = progress.value = v;
  progress.hold = v;
  progress.holdUntil = performance.now() + 1500;
  // Scrolling is locked during the impact and unlocks a frame or two later;
  // keep nudging the page until its scroll position agrees.
  let tries = 0;
  const place = () => {
    const y = v * maxScroll();
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo({ top: y, behavior: 'auto' });
    if (progress.hold !== null && ++tries < 40) requestAnimationFrame(place);
  };
  requestAnimationFrame(place);
}

/**
 * Input pushed past a wall (the portal): put the page's scroll position back
 * on the wall so Lenis doesn't keep a runaway target. Once per frame at most.
 */
let pullQueued = false;
function pullBack() {
  if (pullQueued) return;
  pullQueued = true;
  requestAnimationFrame(() => {
    pullQueued = false;
    const y = progress.target * maxScroll();
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo({ top: y, behavior: 'auto' });
  });
}

/** Teams states in which the page must not scroll (travel, arrival, a card opening or open). */
const LOCKING: TeamsState[] = ['portalEntering', 'teamsEntering', 'cardFocused', 'domainDetail', 'portalExiting'];

export function ScrollTimeline() {
  const track = useRef<HTMLDivElement>(null);
  const reducedMotion = useExperience((s) => s.reducedMotion);
  const phase = useExperience((s) => s.phase);
  const overlay = useExperience((s) => s.menuOpen || !!s.dossier || s.textVersionOpen);
  const teamsLock = useTeams((s) => LOCKING.includes(s.state));

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  }, []);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const instance = reducedMotion
      ? null
      : new Lenis({
          lerp: 0.085,
          wheelMultiplier: 0.85,
          touchMultiplier: 1.4,
          autoRaf: false,
          // Wheel and trackpad: a fling is compressed, deliberate scrolling isn't (wheelShape.ts).
          virtualScroll: (data) => {
            if (data.event.type === 'wheel') {
              const g = wheelGain(data.deltaX, data.deltaY);
              data.deltaX *= g;
              data.deltaY *= g;
            }
            return true;
          },
        });
    lenis = instance;
    const tick = (time: number) => instance?.raf(time * 1000);
    if (instance) {
      instance.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    }
    const st = ScrollTrigger.create({
      trigger: track.current,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        if (progress.setTarget(self.progress)) pullBack();
      },
    });
    progress.setTarget(st.progress);
    // The track is sized in viewport heights, so a resize (rotation, window
    // drag) would change what the current pixel offset means. Keep the
    // journey where it was instead.
    let kept = progress.target;
    const beforeRefresh = () => {
      kept = progress.target;
    };
    const afterRefresh = () => {
      const y = kept * maxScroll();
      if (instance) instance.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo({ top: y, behavior: 'auto' });
      progress.target = kept;
    };
    ScrollTrigger.addEventListener('refreshInit', beforeRefresh);
    ScrollTrigger.addEventListener('refresh', afterRefresh);
    const phaseNow = useExperience.getState().phase;
    if (instance && phaseNow !== 'cinematic') instance.stop();
    return () => {
      ScrollTrigger.removeEventListener('refreshInit', beforeRefresh);
      ScrollTrigger.removeEventListener('refresh', afterRefresh);
      st.kill();
      if (instance) {
        gsap.ticker.remove(tick);
        instance.destroy();
      }
      lenis = null;
    };
  }, [reducedMotion]);

  // Scrolling only drives the journey in cinematic mode.
  useEffect(() => {
    const locked = phase !== 'cinematic' || overlay || teamsLock;
    document.documentElement.classList.toggle('scroll-locked', locked);
    if (locked) lenis?.stop();
    else lenis?.start();
  }, [phase, overlay, teamsLock, reducedMotion]);

  return <div ref={track} className="scroll-track" style={{ height: `${SCROLL_LENGTH_VH}vh` }} aria-hidden="true" />;
}
