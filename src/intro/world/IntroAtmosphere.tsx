'use client';
/**
 * Once per frame: evaluate the opening's colour script at the scroll's beat
 * (look.ts) and hand it to the world — the ground mist every patched
 * material shares, the exposure — and hold `world.intro` at 1 while the
 * opening (or the threshold before it) is what's on screen. The shared atmosphere,
 * lights and sky blend towards the script by that weight, above ground.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Color } from 'three';
import { world } from '@/scenes/shared/blend';
import { experience } from '@/store/experience';
import { mistUniforms } from '../fog';
import { evaluateLook, look } from '../look';
import { introFrame } from '../state';
import { flash, flashLevel, LIGHTNING } from './lightning';

const DEFAULT_EXPOSURE = 1.05;
const _glow = new Color();
const _flashFog = new Color('#eef2ff');

export function IntroAtmosphere() {
  const gl = useThree((s) => s.gl);
  const last = useRef<number | null>(null);

  useFrame(({ clock }) => {
    const ph = experience().phase;
    const film = introFrame.active || ph === 'loading' || ph === 'ready';
    world.intro = film ? 1 : 0;
    evaluateLook(introFrame.t);

    // Lightning: struck when the film crosses its beat going forward (not scrubbing back, not on a jump).
    const t = introFrame.t;
    const prev = last.current;
    last.current = introFrame.active ? t : null;
    if (prev !== null && t - prev > 0 && t - prev < 4 && !experience().reducedMotion) {
      for (const l of LIGHTNING) {
        if (prev < l.at && t >= l.at) {
          flash.start = clock.elapsedTime;
          flash.strength = l.strength;
          flash.seed = l.seed;
        }
      }
    }
    flash.level = introFrame.active ? flashLevel(clock.elapsedTime) : 0;
    look.flash = flash.level;
    // Inside the cloud, the cloud is the fog: it lights up with the flash.
    if (flash.level > 0) look.fogColor.lerp(_flashFog, Math.min(1, flash.level * 0.5 * (0.35 + 0.65 * look.cloud)));

    // The ground mist, and the light it scatters towards the sun: faint and
    // cool before dawn, warm as the sun clears the horizon.
    mistUniforms.uMist.value.set(look.mist.density, look.mist.height, 0, world.intro);
    mistUniforms.uMistSun.value.copy(look.sun.dir);
    const up = Math.min(1, Math.max(0, (look.sun.elevation * 180) / Math.PI / 10 + 0.55));
    _glow.copy(look.sun.color).multiplyScalar(0.55 + 0.6 * up);
    mistUniforms.uMistGlow.value.copy(look.fogColor).lerp(_glow, 0.25 + 0.55 * up);

    gl.toneMappingExposure = DEFAULT_EXPOSURE + (look.exposure + 0.22 * flash.level - DEFAULT_EXPOSURE) * world.intro;
  });

  useEffect(
    () => () => {
      world.intro = 0;
      mistUniforms.uMist.value.w = 0;
      gl.toneMappingExposure = DEFAULT_EXPOSURE;
    },
    [gl],
  );
  return null;
}
