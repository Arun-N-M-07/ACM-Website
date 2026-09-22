'use client';
/**
 * The loader: the chapter's name, a progress bar tied to real work (fonts,
 * renderer, first chapter built and compiled), then a choice to enter with or
 * without sound — which doubles as the user gesture browsers need for audio.
 */
import { useEffect, useRef, useState } from 'react';
import { SEGMENTS } from '@/config/timeline';
import { eventBySlug, EVENTS } from '@/content/events';
import { useExperience } from '@/store/experience';
import { MUSIC } from '@/config/music';
import { isAvailable } from '@/content/media';
import { music } from '@/systems/audio/music';
import { DOMAINS } from '@/content/domains';
import { goToChapter, goToDomain, goToRoom, skipToCore } from './navigation';
import { jumpToProgress } from '@/systems/scroll/ScrollTimeline';

function applyDeepLink() {
  const hash = window.location.hash.replace('#', '');
  if (!hash || hash === 'archive') return;
  if (hash === 'team') return goToChapter('team');
  if (hash === 'core') return skipToCore();
  const domain = DOMAINS.find((d) => d.id === hash);
  if (domain) return goToDomain(domain.id);
  if (hash in SEGMENTS) return jumpToProgress(SEGMENTS[hash as keyof typeof SEGMENTS].start + 0.002);
  const ev = eventBySlug(hash);
  if (ev) goToRoom(EVENTS.indexOf(ev));
}

export function LoadingScreen() {
  const phase = useExperience((s) => s.phase);
  const loadProgress = useExperience((s) => s.loadProgress);
  const label = useExperience((s) => s.loadLabel);
  const set = useExperience((s) => s.set);
  const [gone, setGone] = useState(false);
  const [slow, setSlow] = useState(false);
  const enterRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), 15000);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (phase === 'ready') enterRef.current?.focus({ preventScroll: true });
    if (phase !== 'loading' && phase !== 'ready') {
      const t = window.setTimeout(() => setGone(true), 1400);
      return () => window.clearTimeout(t);
    }
  }, [phase]);

  if (gone) return null;

  const enter = (withMusic: boolean) => {
    if (withMusic) {
      set({ musicOn: true });
      void music.enable();
    }
    set({ phase: 'cinematic' });
    // Keyboard focus must not be left on a button, or Space would press it
    // instead of scrolling the journey.
    requestAnimationFrame(() => {
      (document.activeElement as HTMLElement | null)?.blur();
      document.querySelector<HTMLElement>('.stage')?.focus({ preventScroll: true });
      applyDeepLink();
    });
  };

  const hasTrack = isAvailable(MUSIC.src);
  const ready = phase === 'ready';
  const leaving = phase !== 'loading' && phase !== 'ready';
  return (
    <div className="loader" data-state={leaving ? 'leaving' : ready ? 'ready' : 'loading'} role="dialog" aria-modal="true" aria-label="Loading the ACM-CEG experience">
      <div className="loader-inner">
        <p className="kicker">College of Engineering Guindy · Anna University</p>
        <p className="loader-title" aria-hidden="true">
          <span>ACM</span>
          <span>CEG</span>
        </p>
        <div className="loader-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(loadProgress * 100)}>
          <span style={{ transform: `scaleX(${loadProgress})` }} />
        </div>
        <p className="loader-label">
          <span>{ready ? 'Ready' : label}</span>
          <span>{String(Math.round(loadProgress * 100)).padStart(3, '0')}</span>
        </p>
        <div className="loader-enter" aria-hidden={!ready}>
          <button ref={hasTrack ? enterRef : undefined} className="btn btn-primary" disabled={!ready || !hasTrack} onClick={() => enter(true)}>
            Enter with music
          </button>
          <button ref={hasTrack ? undefined : enterRef} className={`btn ${hasTrack ? '' : 'btn-primary'}`} disabled={!ready} onClick={() => enter(false)}>
            Enter silently
          </button>
          <p className="loader-track">
            {hasTrack ? (
              <>
                ♪ {MUSIC.title} <span>— {MUSIC.artist}</span>
              </>
            ) : (
              <>
                No soundtrack installed — add <code>public{MUSIC.src}</code>
              </>
            )}
          </p>
        </div>
        <p className="loader-foot">
          Scroll to travel · best with headphones ·{' '}
          <button className="text-link" onClick={() => set({ textVersionOpen: true })}>
            read the text version
          </button>
          {slow && !ready ? ' — this is taking longer than usual.' : ''}
        </p>
      </div>
    </div>
  );
}
