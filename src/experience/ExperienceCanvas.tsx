'use client';
/**
 * The WebGL root. Loaded client-side only (see Experience.tsx). Owns the
 * renderer settings, adaptive resolution, and mounts the camera system and
 * the chapter streamer.
 */
import { PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three';
import { FLIGHT } from '@/config/camera';
import { QUALITY } from '@/config/quality';
import { Atmosphere } from '@/scenes/shared/Atmosphere';
import { WorldLights } from '@/scenes/shared/WorldLights';
import { UndergroundKit } from '@/scenes/underground/kit';
import { ShaderWarmup } from './ShaderWarmup';
import { experience, useExperience } from '@/store/experience';
import { CameraRig } from '@/systems/camera/CameraRig';
import { AnchorProjector } from './AnchorProjector';
import { SceneDirector } from './SceneDirector';

/**
 * Boot sequence reported to the loader: first chapter rendered → every other
 * shader variant warmed → ready.
 */
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

export default function ExperienceCanvas() {
  const quality = useExperience((s) => s.quality);
  const q = QUALITY[quality];
  const [dpr, setDpr] = useState(q.dpr[1]);
  const declines = useRef(0);
  const lastDecline = useRef(0);
  const start = FLIGHT[0];

  useEffect(() => setDpr(q.dpr[1]), [q.dpr]);

  return (
    <Canvas
      className="experience-canvas"
      dpr={dpr}
      shadows={q.shadows ? 'soft' : false}
      gl={{ antialias: q.antialias, powerPreference: 'high-performance', alpha: false, stencil: false }}
      camera={{ fov: start.fov, near: 0.25, far: 3200, position: start.pos }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.outputColorSpace = SRGBColorSpace;
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          experience().set({ webgl: 'failed' });
        });
        experience().setLoad(0.62, 'Laying brick');
      }}
      aria-hidden="true"
    >
      {/*
        Resolution only ever steps down, and rarely: flipping DPR up and down
        mid-scroll reads as the image twitching between sharp and soft.
      */}
      <PerformanceMonitor
        ms={600}
        iterations={8}
        threshold={0.8}
        onDecline={() => {
          const now = performance.now();
          if (now - lastDecline.current < 6000) return;
          lastDecline.current = now;
          declines.current++;
          setDpr((d) => Math.max(q.dpr[0], Math.round((d - 0.25) * 100) / 100));
          // Persistent struggle: drop a whole quality tier.
          if (declines.current >= 4) {
            const tier = experience().quality;
            if (tier === 'high') experience().set({ quality: 'medium' });
            else if (tier === 'medium') experience().set({ quality: 'low' });
            declines.current = 0;
          }
        }}
      />
      <Atmosphere />
      <WorldLights />
      <CameraRig />
      <AnchorProjector />
      <SceneDirector />
      <Boot />
    </Canvas>
  );
}
