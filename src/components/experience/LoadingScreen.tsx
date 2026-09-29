'use client';
/**
 * The threshold. While the world is built behind it, a mark and a count — no
 * headline, no map, nothing that explains what is on the other side. When
 * everything the opening needs is ready (the world, its compiled shaders, the
 * score buffered), one word: Enter. Entering is the user gesture browsers
 * need for sound — the score is started right there, inside the click — and
 * it hands the page's scroll to the visitor: the journey (the opening first)
 * moves only as they scroll.
 *
 * A deep link (#events, an event, a domain, #crew) opens the journey where
 * it points instead — once: the hash is consumed as it is followed, so the
 * address bar no longer carries it and a refresh is a normal entry again.
 * Without one, Enter always starts the opening from its first frame, whatever
 * the browser remembered (a restored scroll offset, a stale dossier…).
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
import { SCORE_IN, T } from '@/intro/timeline';
import { progressAtIntroTime } from '@/intro/controller';

/** Where a deep link points, as an action — or null (no link: the film plays). */
function deepLink(): (() => void) | null {
  const hash = window.location.hash.replace('#', '');
  if (!hash || hash === 'archive') return null;
  // Followed once: take it out of the address bar (a later refresh is a normal entry).
  history.replaceState(history.state, '', window.location.pathname + window.location.search);
  if (hash === 'crew' || hash === 'team' || hash === 'teams') return () => goToChapter('teams');
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

  // Buffer the score while the world builds, so the film never starts on a stall. (Where the browser
  // won't fetch it before a gesture — iOS — there is nothing to wait for once the world is ready.)
  useEffect(() => {
    if (!hasTrack) return;
    music.preload();
    const t0 = performance.now();
    const id = window.setInterval(() => {
      const held = music.held && useExperience.getState().phase === 'ready';
      if (music.ready || music.failed || held || performance.now() - t0 > SCORE_WAIT_MS) {
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
    if (withMusic) {
      // Inside the click: the gesture every browser needs before it plays sound.
      void music.playFrom(SCORE_IN, MUSIC.fade);
      set({ musicOn: true });
    }
    const link = deepLink();
    // A normal entry starts the journey at its beginning, deterministically: the scroll, the
    // camera's progress, and anything left open, whatever the browser restored.
    set({ phase: 'cinematic', dossier: null, menuOpen: false, activeRoom: -1 });
    // (The film's first frame — the track begins a little before it, in the mist the loop comes round through.)
    if (!link) jumpToProgress(progressAtIntroTime(T.prologue));
    // Keyboard focus must not be left on a button, or Space would press it
    // instead of scrolling the journey.
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
