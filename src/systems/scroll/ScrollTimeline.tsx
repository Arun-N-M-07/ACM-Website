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
import { progress } from './progress';

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

/** Jump to progress `p`: the camera cuts (behind a brief fade) instead of flying. */
export function jumpToProgress(p: number) {
  progress.target = Math.min(1, Math.max(0, p));
  progress.snap = true;
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

export function ScrollTimeline() {
  const track = useRef<HTMLDivElement>(null);
  const reducedMotion = useExperience((s) => s.reducedMotion);
  const phase = useExperience((s) => s.phase);
  const overlay = useExperience((s) => s.menuOpen || !!s.dossier || s.textVersionOpen);

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  }, []);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const instance = reducedMotion ? null : new Lenis({ lerp: 0.085, wheelMultiplier: 0.85, touchMultiplier: 1.4, autoRaf: false });
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
      onUpdate: (self) => progress.setTarget(self.progress),
    });
    progress.setTarget(st.progress);
    const phaseNow = useExperience.getState().phase;
    if (instance && phaseNow !== 'cinematic') instance.stop();
    return () => {
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
    const locked = phase !== 'cinematic' || overlay;
    document.documentElement.classList.toggle('scroll-locked', locked);
    if (locked) lenis?.stop();
    else lenis?.start();
  }, [phase, overlay, reducedMotion]);

  return <div ref={track} className="scroll-track" style={{ height: `${SCROLL_LENGTH_VH}vh` }} aria-hidden="true" />;
}
