'use client';
/**
 * Client root of the immersive experience. Detects the device, WebGL and
 * motion preferences; waits for fonts (in-world signage uses them); lazily
 * loads the 3D canvas; and layers the HTML interface over it. If WebGL is
 * missing or the context dies, the printed edition takes over.
 */
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { SEGMENTS } from '@/config/timeline';
import { SafeBoundary } from '@/scenes/shared/SafeBoundary';
import { useExperience } from '@/store/experience';
import { detectDevice, detectWebGL, prefersReducedMotion } from '@/systems/performance/quality';
import { music } from '@/systems/audio/music';
import { roomDwellRange } from '@/systems/camera/shots';
import { tourProgress } from '@/systems/camera/tour';
import { progress } from '@/systems/scroll/progress';
import { jumpToProgress, ScrollTimeline, scrollToProgress } from '@/systems/scroll/ScrollTimeline';
import { fontsReady } from '@/systems/textures/typeset';
import { MusicDirector } from './MusicDirector';
import { ChapterCopy } from './ChapterCopy';
import { ChapterRail } from './ChapterRail';
import { DescentMeter } from './DescentMeter';
import { Dossier } from './Dossier';
import { FinaleOverlay } from './FinaleOverlay';
import { IndexMenu } from './IndexMenu';
import { KeyboardNav } from './KeyboardNav';
import { LoadingScreen } from './LoadingScreen';
import { Plates } from './Plates';
import { ScreenFx } from './ScreenFx';
import { TeamHud } from './TeamHud';
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
    let alive = true;
    fontsReady().then(() => {
      if (!alive) return;
      st.setLoad(0.4, 'Surveying the campus');
      setFontsOk(true);
    });
    // Test hook (dev builds, or ?debug in production): lets the visual test
    // harness jump through the journey deterministically.
    if (process.env.NODE_ENV !== 'production' || new URLSearchParams(window.location.search).has('debug')) {
      (window as unknown as { __acm: unknown }).__acm = { jump: jumpToProgress, scroll: scrollToProgress, store: useExperience, progress, tourProgress, segments: SEGMENTS, music, roomProgress: (i: number, d: number) => { const [a, b] = roomDwellRange(i); return a + (b - a) * d; } };
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
            <ExperienceCanvas />
          </SafeBoundary>
        )}
      </div>
      <ScreenFx />
      <ScrollTimeline />
      <ChapterCopy />
      <DescentMeter />
      <Plates />
      <TeamHud />
      <FinaleOverlay />
      <ChapterRail />
      <TopBar />
      <IndexMenu />
      <Dossier />
      <LoadingScreen />
      <KeyboardNav />
      <MusicDirector />
    </>
  );
}
