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
import { TEAM_DOMAINS } from '@/content/teams';
import { goToChapter, goToDomain, goToRoom } from './navigation';
import { jumpToProgress } from '@/systems/scroll/ScrollTimeline';
import { CHAPTER } from '@/content/chapter';
import { WorldMap } from './WorldMap';

function applyDeepLink() {
  const hash = window.location.hash.replace('#', '');
  if (!hash || hash === 'archive') return;
  if (hash === 'team' || hash === 'teams') return goToChapter('teams');
  const domain = TEAM_DOMAINS.findIndex((d) => d.slug === hash);
  if (domain >= 0) return goToDomain(domain);
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
      <div className="loader-masthead"><span>ACM <i /> CEG</span><span>{CHAPTER.city}, India <span className="loader-edition">/ Student Chapter</span></span></div>
      <div className="loader-atlas"><WorldMap /></div>
      <div className="loader-inner">
        <p className="kicker">Welcome to the world of ACM–CEG</p>
        <h2 className="loader-title"><span>A world of</span><span><em>curious</em> minds.</span></h2>
        <p className="loader-intro">Begin at the red building. Discover the programmes.<br className="desktop-break" /> Meet the people who bring it all to life.</p>
        <div className="loader-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(loadProgress * 100)}>
          <span style={{ transform: `scaleX(${loadProgress})` }} />
        </div>
        <p className="loader-label">
          <span>{ready ? 'Your journey is ready' : label}</span>
          <span>{String(Math.round(loadProgress * 100)).padStart(3, '0')}</span>
        </p>
        <div className="loader-enter" aria-hidden={!ready}>
          {hasTrack && <button ref={enterRef} className="btn btn-primary" disabled={!ready} onClick={() => enter(true)}>
            Enter with music
          </button>}
          <button ref={hasTrack ? undefined : enterRef} className={`btn ${hasTrack ? '' : 'btn-primary'}`} aria-label="Enter silently" disabled={!ready} onClick={() => enter(false)}>
            {hasTrack ? 'Enter silently' : 'Enter the world'} <span aria-hidden="true">↗</span>
          </button>
          {hasTrack && <p className="loader-track">♪ {MUSIC.title} <span>— {MUSIC.artist}</span></p>}
        </div>
        <p className="loader-foot">
          Scroll to explore ·{' '}
          <button className="text-link" onClick={() => set({ textVersionOpen: true })}>
            Read the chapter
          </button>
          {slow && !ready ? ' — this is taking longer than usual.' : ''}
        </p>
      </div>
      <div className="loader-colophon"><span>{CHAPTER.institution}<br />{CHAPTER.university}</span><span>Learn. Build. Connect.<br />Since {CHAPTER.established}</span></div>
    </div>
  );
}
