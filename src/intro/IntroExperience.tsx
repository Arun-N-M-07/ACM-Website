'use client';
/**
 * The intro's layer of the page: its input, and the very little interface it
 * allows itself.
 *
 *   – the input (wheel / touch / keys → intent; see input.ts)
 *   – "Skip" — quiet, bottom right, always reachable by keyboard; and
 *     opposite it, the sound (the top bar, with its own toggle, waits for the
 *     Events)
 *   – a cue that appears only if the film has been waiting at rest for a
 *     while ("Scroll" / "Swipe"), and never while it moves
 *   – the story's words for assistive technology, announced as each
 *     fragment becomes legible
 *   – at the corridor mouth, the pull back into the film
 *
 * No navigation, no titles, no panels: the world is the interface.
 */
import { useEffect, useRef } from 'react';
import { MUSIC } from '@/config/music';
import { isAvailable } from '@/content/media';
import { useExperience } from '@/store/experience';
import { progress } from '@/systems/scroll/progress';
import { skipIntro, stepIntro } from './controller';
import { atFilmEnd, feedIntent, feedPull, filmListening, PULL_BACK, relaxPull, wheelPixels } from './input';
import { introFrame, useIntro } from './state';
import { STORY_LINES } from './story/fragments';

function useIntroInput() {
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // pinch-zoom
      const px = wheelPixels(e);
      if (filmListening()) {
        feedIntent(px);
        if (e.cancelable) e.preventDefault();
      } else if (atFilmEnd()) feedPull(px);
    };

    let lastY: number | null = null;
    const onTouchStart = (e: TouchEvent) => {
      lastY = e.touches.length === 1 ? e.touches[0].clientY : null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (lastY === null || e.touches.length !== 1) return;
      const y = e.touches[0].clientY;
      // A swipe up (content moves up) continues, like scrolling down.
      const px = (lastY - y) * 2.2;
      lastY = y;
      if (filmListening()) {
        feedIntent(px);
        if (e.cancelable) e.preventDefault();
      } else if (atFilmEnd()) feedPull(px);
    };
    const onTouchEnd = () => {
      lastY = null;
    };

    const onKey = (e: KeyboardEvent) => {
      if (!filmListening() || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      // Keys pressed on a control belong to the control.
      if (t && (t.tagName === 'BUTTON' || t.tagName === 'A' || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const k = e.key;
      if (k === 'ArrowDown' || k === 'PageDown' || k === ' ' || k === 'Enter' || k === 'n' || k === 'N') {
        e.preventDefault();
        if (!e.repeat) stepIntro(1);
      } else if (k === 'ArrowUp' || k === 'PageUp' || k === 'p' || k === 'P') {
        e.preventDefault();
        if (!e.repeat) stepIntro(-1);
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // The pull relaxes if the visitor stops short of it.
  useEffect(() => progress.subscribe((_, dt) => relaxPull(dt)), []);
}

export function IntroExperience() {
  useIntroInput();
  const phase = useExperience((s) => s.phase);
  const isTouch = useExperience((s) => s.isTouch);
  const state = useIntro((s) => s.state);
  const hint = useIntro((s) => s.hint);
  const line = useIntro((s) => s.line);
  const musicOn = useExperience((s) => s.musicOn);
  const set = useExperience((s) => s.set);
  const hasTrack = isAvailable(MUSIC.src);
  const pull = useRef<HTMLDivElement>(null);
  const running = phase === 'intro' && (state === 'playing' || state === 'resting');

  // The pull back into the film, drawn as a thin rule that fills.
  useEffect(
    () =>
      progress.subscribe(() => {
        const el = pull.current;
        if (!el) return;
        const k = Math.min(1, introFrame.pull / PULL_BACK);
        el.style.opacity = String(k > 0.04 ? Math.min(1, k * 2.2) : 0);
        el.style.setProperty('--k', k.toFixed(3));
      }),
    [],
  );

  return (
    <div className="intro-layer" data-running={running}>
      {running && hasTrack && (
        <button
          className="intro-sound"
          aria-pressed={musicOn}
          onClick={(e) => {
            // Off: the music director fades it out. On: the film picks the score up as it moves.
            set({ musicOn: !musicOn });
            e.currentTarget.blur();
          }}
        >
          {musicOn ? 'Sound on' : 'Sound off'}
        </button>
      )}
      {running && (
        <button className="intro-skip" onClick={skipIntro}>
          Skip intro
        </button>
      )}
      <div className="intro-cue" data-on={running && hint} aria-hidden="true">
        <span className="intro-cue-line" />
        <span className="intro-cue-word">{isTouch ? 'Swipe' : 'Scroll'}</span>
      </div>
      <p className="sr-only" aria-live="polite">
        {running && line >= 0 ? STORY_LINES[line].text : ''}
      </p>
      <div ref={pull} className="intro-pull" aria-hidden="true" style={{ opacity: 0 }}>
        <span className="intro-pull-bar" />
        <span className="intro-pull-word">Back to the beginning</span>
      </div>
      {running && state === 'resting' && (
        <button className="sr-only" onClick={() => stepIntro(1)}>
          Continue
        </button>
      )}
    </div>
  );
}
