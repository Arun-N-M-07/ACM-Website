'use client';
/**
 * The WebGL root. Loaded client-side only (see Experience.tsx). Owns the
 * renderer settings, adaptive resolution, and mounts the camera system and
 * the chapter streamer.
 */
import { PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three';
import { QUALITY, type QualitySettings } from '@/config/quality';
import { Atmosphere } from '@/scenes/shared/Atmosphere';
import { WorldLights } from '@/scenes/shared/WorldLights';
import { UndergroundKit } from '@/scenes/underground/kit';
import { ShaderWarmup } from './ShaderWarmup';
import { experience, useExperience } from '@/store/experience';
import { CameraRig } from '@/systems/camera/CameraRig';
import { fx } from '@/systems/camera/effects';
import { AnchorProjector } from './AnchorProjector';
import { INTRO_KEYS } from '@/intro/camera';
import { PostProcessing } from '@/teams/post/PostProcessing';
import { SceneDirector } from './SceneDirector';

/**
 * Boot sequence reported to the loader: first chapter rendered → every other
 * shader variant warmed → ready.
 */
let lastContextLoss = -Infinity;

function Boot() {
  const [stage, setStage] = useState<'frames' | 'warm' | 'done'>('frames');
  const frames = useRef(0);
  const gl = useThree((s) => s.gl);
  const waited = useRef(0);
  useFrame((_, dt) => {
    if (stage !== 'frames') return;
    const st = experience();
    // Hold until the campus (OpenStreetMap data) is built, but never forever.
    waited.current += dt;
    if (!st.campusReady && waited.current < 15) {
      st.setLoad(0.66, 'Surveying the campus');
      return;
    }
    frames.current++;
    if (frames.current === 1) st.setLoad(0.78, 'Compiling the red building');
    if (frames.current === 3) {
      if (process.env.NODE_ENV !== 'production') console.info('[experience] draw calls, first chapter:', gl.info.render.calls);
      st.setLoad(0.9, 'Pouring the facility');
      setStage('warm');
    }
  });
  const done = useCallback(() => {
    setStage('done');
    const st = experience();
    st.setLoad(1, 'Ready');
    if (st.phase === 'loading') st.set({ phase: 'ready' });
  }, []);
  if (stage !== 'warm') return null;
  return (
    <UndergroundKit>
      <ShaderWarmup onDone={done} />
    </UndergroundKit>
  );
}

/**
 * The most pixels a frame is drawn with: a 16-inch retina laptop's own frame (1728×1117 at 2×).
 * Up to it, a tier draws at its full pixel ratio, as it always has (on a 1× screen that is
 * supersampling, which the post-processed chapters rely on for their edges); past it — large and
 * ultra-wide monitors, where 2× meant 15–20 million pixels a frame — the ratio comes down to fit.
 */
const PIXEL_BUDGET = 1728 * 1117 * 4;
const STEP = 0.25;

/** The tier's pixel ratio on this screen, before any step down (in 0.05s, never below the tier's floor). */
function ceilingDpr(q: QualitySettings) {
  const css = Math.max(1, window.innerWidth * window.innerHeight);
  const fit = Math.floor(Math.sqrt(PIXEL_BUDGET / css) * 20) / 20;
  return Math.max(q.dpr[0], Math.min(q.dpr[1], fit));
}

/**
 * Adaptive resolution. Resolution only ever steps down, and rarely: flipping it up and down
 * mid-scroll reads as the image twitching between sharp and soft. Once it is at a pixel per CSS
 * pixel and the device still can't keep up, the runtime `degrade` level turns the cheap knobs (smog
 * march, bloom, glass); after those, a tier whose floor is lower (phones) goes below it. The tier
 * itself, which everything in the world is built at, never changes
 * mid-journey (that rebuilt and recompiled the whole resident world on the frame it happened).
 * (Steps go through R3F's setDpr from here, so the scene tree doesn't re-render for them.)
 */
function Resolution({ q }: { q: QualitySettings }) {
  const setDpr = useThree((s) => s.setDpr);
  const steps = useRef(0);
  const lastDecline = useRef(0);
  const frameStart = useRef(0);
  /** A decline being checked before it is acted on: the rate it was seen at, and frames timed since. */
  const check = useRef<{ fps: number; costs: number[] } | null>(null);
  const pixel = useMemo(() => new Uint8Array(4), []);
  const target = useCallback(() => Math.max(q.dpr[0], Math.round((ceilingDpr(q) - STEP * steps.current) * 100) / 100), [q]);
  useEffect(() => {
    const apply = () => setDpr(target());
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, [setDpr, target]);

  const stepDown = useCallback(() => {
    // Down to a pixel per CSS pixel first; then the cheap knobs; only then — where the tier's floor
    // is below 1 (phones) — fewer pixels than that.
    const step = () => {
      steps.current++;
      setDpr(target());
    };
    if (target() > Math.max(q.dpr[0], 1) + 1e-3) return step();
    const st = experience();
    if (st.degrade < 2) return st.set({ degrade: (st.degrade + 1) as 1 | 2 });
    if (target() > q.dpr[0] + 1e-3) step();
  }, [q, setDpr, target]);

  useFrame(() => {
    frameStart.current = performance.now();
  }, -1000);
  // (After the frame is drawn.) A slow rate is not always a slow frame: a browser can hold the page to
  // 30 frames a second however little it draws (iOS in Low Power Mode, a battery saver), and stepping
  // down there only loses sharpness. So a decline is checked first: three frames timed whole — the
  // read waits for the GPU — and only if they take up the interval the display gives them is it the
  // drawing that holds the rate down.
  useFrame(({ gl }) => {
    const c = check.current;
    if (!c) return;
    const ctx = gl.getContext();
    ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, pixel);
    c.costs.push(performance.now() - frameStart.current);
    if (c.costs.length < 3) return;
    check.current = null;
    if (Math.min(...c.costs) < 0.5 * (1000 / c.fps)) return;
    stepDown();
  }, 1000);

  return (
    <PerformanceMonitor
      ms={600}
      iterations={8}
      threshold={0.8}
      onDecline={(api) => {
        const now = performance.now();
        if (now - lastDecline.current < 6000 || check.current) return;
        lastDecline.current = now;
        const fps = api.averages.reduce((a, b) => a + b, 0) / Math.max(1, api.averages.length);
        check.current = { fps: Math.max(1, fps), costs: [] };
      }}
    />
  );
}

export default function ExperienceCanvas() {
  const quality = useExperience((s) => s.quality);
  const q = QUALITY[quality];
  // (Constant: R3F re-applies the prop on every render of the Canvas; steps go through setDpr.)
  const [dpr] = useState(() => ceilingDpr(q));
  const start = INTRO_KEYS[0];

  return (
    <Canvas
      className="experience-canvas"
      dpr={dpr}
      shadows={q.shadows ? 'soft' : false}
      gl={{ antialias: q.antialias, powerPreference: 'high-performance', alpha: false, stencil: false }}
      camera={{ fov: start.fov, near: 0.25, far: 3200, position: start.pos }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.outputColorSpace = SRGBColorSpace;
        const debug = (window as unknown as { __acm?: Record<string, unknown> }).__acm;
        if (debug) { debug.scene = scene; debug.renderInfo = () => gl.info.render; debug.memory = () => ({ ...gl.info.memory, programs: gl.info.programs?.length }); }
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          // GPU pressure or a driver reset: recreate the canvas once (the
          // journey's state lives outside it, so it picks up where it was);
          // a second loss soon after hands over to the printed edition.
          const now = performance.now();
          const again = now - lastContextLoss < 30000;
          lastContextLoss = now;
          // (It is lost already: taking this canvas down needn't ask for the loss again — a lost
          // context has no extensions left to ask with, and three would only warn about it.)
          gl.forceContextLoss = () => undefined;
          fx.fade = 1;
          experience().set({ webgl: again ? 'failed' : 'lost' });
        });
        experience().setLoad(0.62, 'Laying brick');
      }}
      aria-hidden="true"
    >
      <Resolution q={q} />
      <Atmosphere />
      <WorldLights />
      <CameraRig />
      <AnchorProjector />
      <SceneDirector />
      <PostProcessing />
      <Boot />
    </Canvas>
  );
}
