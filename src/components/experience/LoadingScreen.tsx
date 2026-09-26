'use client';
/**
 * The threshold. While the world is built behind it, a mark and a count — no
 * headline, no map, nothing that explains what is on the other side. When
 * everything the opening film needs is ready (the world, its compiled
 * shaders, the score buffered), one word: Enter. Entering is the user
 * gesture browsers need for sound, and the start of the film.
 *
 * A deep link (#events, an event, a domain, #teams) skips the film and opens
 * the journey where it points.
 */
import { useEffect, useRef, useState } from 'react';
import { SEGMENTS } from '@/config/timeline';
import { eventBySlug, EVENTS } from '@/content/events';
import { useExperience } from '@/store/experience';
import { MUSIC } from '@/config/music';
import { isAvailable } from '@/content/media';
import { music } from '@/systems/audio/music';
import { TEAM_DOMAINS } from '@/content/teams';
import { goToChapter, goToDomain, goToRoom } from './navigation';
import { jumpToProgress } from '@/systems/scroll/ScrollTimeline';
import { CHAPTER } from '@/content/chapter';
import { startIntro } from '@/intro/controller';
import { INTRO_END, SCORE_IN } from '@/intro/timeline';

/** Where a deep link points, as an action — or null (no link: the film plays). */
function deepLink(): (() => void) | null {
  const hash = window.location.hash.replace('#', '');
  if (!hash || hash === 'archive') return null;
  if (hash === 'team' || hash === 'teams') return () => goToChapter('teams');
  const domain = TEAM_DOMAINS.findIndex((d) => d.slug === hash);
  if (domain >= 0) return () => goToDomain(domain);
  if (hash in SEGMENTS) return () => jumpToProgress(SEGMENTS[hash as keyof typeof SEGMENTS].start + 0.002);
  const ev = eventBySlug(hash);
  if (ev) return () => goToRoom(EVENTS.indexOf(ev));
  return null;
}

/** How long Enter may wait for the score to buffer before the film starts without waiting. */
const SCORE_WAIT_MS = 9000;

export function LoadingScreen() {
  const phase = useExperience((s) => s.phase);
  const loadProgress = useExperience((s) => s.loadProgress);
  const label = useExperience((s) => s.loadLabel);
  const set = useExperience((s) => s.set);
  const [gone, setGone] = useState(false);
  const [slow, setSlow] = useState(false);
  const hasTrack = isAvailable(MUSIC.src);
  const [scoreReady, setScoreReady] = useState(!hasTrack);
  const enterRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), 15000);
    return () => window.clearTimeout(t);
  }, []);

  // Buffer the score while the world builds, so the film never starts on a stall.
  useEffect(() => {
    if (!hasTrack) return;
    music.preload();
    const t0 = performance.now();
    const id = window.setInterval(() => {
      if (music.ready || music.failed || performance.now() - t0 > SCORE_WAIT_MS) {
        setScoreReady(true);
        window.clearInterval(id);
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [hasTrack]);

  const ready = phase === 'ready' && scoreReady;

  useEffect(() => {
    if (ready) enterRef.current?.focus({ preventScroll: true });
    if (phase !== 'loading' && phase !== 'ready') {
      const t = window.setTimeout(() => setGone(true), 2200);
      return () => window.clearTimeout(t);
    }
  }, [phase, ready]);

  if (gone) return null;

  const enter = (withMusic: boolean) => {
    if (withMusic) set({ musicOn: true });
    const link = deepLink();
    if (link) {
      // The journey (without the film) begins at the Events; the link then takes it on.
      set({ phase: 'cinematic', segment: 'events', chapter: 'events' });
      if (withMusic) void music.playFrom(SCORE_IN + INTRO_END, MUSIC.fade);
    } else startIntro(withMusic);
    // Keyboard focus must not be left on a button, or Space would press it
    // instead of moving the film / the journey.
    requestAnimationFrame(() => {
      (document.activeElement as HTMLElement | null)?.blur();
      document.querySelector<HTMLElement>('.stage')?.focus({ preventScroll: true });
      link?.();
    });
  };

  const leaving = phase !== 'loading' && phase !== 'ready';
  const pct = Math.round(loadProgress * 100);
  return (
    <div className="loader threshold" data-state={leaving ? 'leaving' : ready ? 'ready' : 'loading'} role="dialog" aria-modal="true" aria-label="ACM-CEG">
      <p className="threshold-mark" aria-hidden="true">
        <span>ACM</span>
        <i />
        <span>CEG</span>
      </p>
      <div className="threshold-center">
        <div className="threshold-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={ready ? 'Ready' : label}>
          <span className="threshold-count">{String(pct).padStart(3, '0')}</span>
          <span className="threshold-line">
            <span style={{ transform: `scaleX(${loadProgress})` }} />
          </span>
        </div>
        <div className="loader-enter" aria-hidden={!ready}>
          <button ref={enterRef} className="threshold-enter" disabled={!ready} onClick={() => enter(hasTrack)} aria-label={hasTrack ? 'Enter with sound' : 'Enter silently'}>
            Enter
          </button>
          {hasTrack && (
            <button className="threshold-quiet" disabled={!ready} onClick={() => enter(false)} aria-label="Enter silently">
              without sound
            </button>
          )}
        </div>
      </div>
      <p className="threshold-foot">
        {hasTrack && (
          <span className="threshold-credit">
            Sound: {MUSIC.title} — {MUSIC.artist}
          </span>
        )}
        <button className="text-link" onClick={() => set({ textVersionOpen: true })}>
          Read the chapter as a page
        </button>
        {slow && !ready ? <span> — this is taking longer than usual.</span> : null}
      </p>
      <p className="sr-only">
        {CHAPTER.name}, {CHAPTER.institution}.
      </p>
    </div>
  );
}
