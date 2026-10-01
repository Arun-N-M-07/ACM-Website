'use client';
/**
 * Client root of the immersive experience. Detects the device, WebGL and
 * motion preferences; waits for fonts (in-world signage uses them); lazily
 * loads the 3D canvas; and layers the HTML interface over it. If WebGL is
 * missing or the context dies, the printed edition takes over.
 */
import { fx } from '@/systems/camera/effects';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { EVENTS_TRACK, SEGMENTS } from '@/config/timeline';
import { SafeBoundary } from '@/scenes/shared/SafeBoundary';
import { useExperience } from '@/store/experience';
import { detectDevice, detectWebGL, prefersReducedMotion } from '@/systems/performance/quality';
import { music } from '@/systems/audio/music';
import { progress } from '@/systems/scroll/progress';
import { jumpToProgress, ScrollTimeline, scrollToProgress } from '@/systems/scroll/ScrollTimeline';
import { fontsReady } from '@/systems/textures/typeset';
import { MusicDirector } from './MusicDirector';
import { SoundDirector } from './SoundDirector';
import { JourneyLoop } from './JourneyLoop';
import { ChapterRail } from './ChapterRail';
import { Dossier } from './Dossier';
import { IndexMenu } from './IndexMenu';
import { KeyboardNav } from './KeyboardNav';
import { LoadingScreen } from './LoadingScreen';
import { ScreenFx } from './ScreenFx';
import { TeamsExperience } from '@/teams/TeamsExperience';
import { EventsUI } from '@/scenes/events/EventsUI';
import { eventsDebug } from '@/scenes/events/debug';
import { resetEvents, roomProgress } from '@/scenes/events/controller';
import { IntroExperience } from '@/intro/IntroExperience';
import { introDebug } from '@/intro/debug';
import { teamsDebug } from '@/teams/debug';
import { TopBar } from './TopBar';

const ExperienceCanvas = dynamic(() => import('@/experience/ExperienceCanvas'), { ssr: false });

function FallbackNotice({ reason }: { reason: 'unsupported' | 'failed' }) {
  return (
    <div className="fallback-notice" role="status">
      <p className="kicker">ACM · CEG</p>
      <p>
        {reason === 'unsupported'
          ? 'Your browser can’t run the 3D journey, so here is the chapter in print — every event, person and detail.'
          : 'The 3D journey stopped unexpectedly. Here is the chapter in print; reload to try the journey again.'}
      </p>
    </div>
  );
}

export function Experience() {
  const webgl = useExperience((s) => s.webgl);
  const textOpen = useExperience((s) => s.textVersionOpen);
  const [fontsOk, setFontsOk] = useState(false);

  useEffect(() => {
    const st = useExperience.getState();
    const device = detectDevice();
    const ok = detectWebGL();
    st.set({
      quality: device.tier,
      isTouch: device.isTouch,
      guided: device.guided,
      reducedMotion: prefersReducedMotion(),
      webgl: ok ? 'ok' : 'unsupported',
    });
    st.setLoad(0.12, 'Typesetting');
    // Fetch the world's code now, alongside the fonts, rather than after them (the canvas mounts
    // once the fonts are ready; by then its chunk is here).
    if (ok) void import('@/experience/ExperienceCanvas');
    let alive = true;
    fontsReady().then(() => {
      if (!alive) return;
      st.setLoad(0.4, 'Surveying the campus');
      setFontsOk(true);
    });
    // Test hook (dev builds, or ?debug in production): lets the visual test
    // harness jump through the journey deterministically.
    if (process.env.NODE_ENV !== 'production' || new URLSearchParams(window.location.search).has('debug')) {
      // (A jump anywhere but an event's room part lets go of a visit, as every jump the site makes does.)
      const jump = (p: number, lead?: number, opts?: { fade?: boolean }) => {
        if (!(p >= EVENTS_TRACK.branch.start && p <= EVENTS_TRACK.branch.end)) resetEvents();
        jumpToProgress(p, lead, opts);
      };
      (window as unknown as { __acm: unknown }).__acm = { jump, scroll: scrollToProgress, store: useExperience, progress, segments: SEGMENTS, music, roomProgress, events: eventsDebug, teams: teamsDebug, intro: introDebug, fx };
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => useExperience.getState().set({ reducedMotion: mq.matches });
    mq.addEventListener('change', onChange);
    return () => {
      alive = false;
      mq.removeEventListener('change', onChange);
    };
  }, []);

  // The printed edition lives in the server-rendered #archive layer; show it
  // when asked for, or when there is no WebGL.
  // A lost GPU context: drop the canvas, and bring a fresh one up a moment later.
  const [canvasKey, setCanvasKey] = useState(0);
  useEffect(() => {
    if (webgl !== 'lost') return;
    const id = window.setTimeout(() => {
      setCanvasKey((k) => k + 1);
      useExperience.getState().set({ webgl: 'ok' });
    }, 700);
    return () => window.clearTimeout(id);
  }, [webgl]);

  const archiveOpen = textOpen || webgl === 'unsupported' || webgl === 'failed';
  useEffect(() => {
    document.documentElement.dataset.archive = archiveOpen ? 'open' : 'closed';
    document.documentElement.dataset.fallback = webgl === 'unsupported' || webgl === 'failed' ? 'true' : 'false';
    const layer = document.getElementById('archive');
    if (layer) {
      if (archiveOpen) layer.removeAttribute('inert');
      else layer.setAttribute('inert', '');
    }
  }, [archiveOpen, webgl]);

  // The skip link / #archive hash opens the text version.
  useEffect(() => {
    const check = () => {
      if (window.location.hash === '#archive') useExperience.getState().set({ textVersionOpen: true });
    };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, []);

  if (webgl === 'unsupported' || webgl === 'failed') return <FallbackNotice reason={webgl} />;

  return (
    <>
      <div className="stage" tabIndex={-1}>
        {fontsOk && webgl === 'ok' && (
          <SafeBoundary name="canvas" fallback={null} onError={() => useExperience.getState().set({ webgl: 'failed' })}>
            <ExperienceCanvas key={canvasKey} />
          </SafeBoundary>
        )}
      </div>
      <ScreenFx />
      <ScrollTimeline />
      <IntroExperience />
      <EventsUI />
      <TeamsExperience />
      <ChapterRail />
      <TopBar />
      <IndexMenu />
      <Dossier />
      <LoadingScreen />
      <KeyboardNav />
      <MusicDirector />
      <SoundDirector />
      <JourneyLoop />
    </>
  );
}
