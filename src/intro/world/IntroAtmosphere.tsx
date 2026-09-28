'use client';
/**
 * Once per frame: evaluate the opening's colour script at the scroll's beat
 * (look.ts) and hand it to the world — the ground mist every patched
 * material shares, the exposure — and hold `world.intro` at 1 while the
 * opening (or the threshold before it) is what's on screen. The shared atmosphere,
 * lights and sky blend towards the script by that weight, above ground.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { Color } from 'three';
import { world } from '@/scenes/shared/blend';
import { experience } from '@/store/experience';
import { mistUniforms } from '../fog';
import { evaluateLook, look } from '../look';
import { introFrame } from '../state';

const DEFAULT_EXPOSURE = 1.05;
const _glow = new Color();

export function IntroAtmosphere() {
  const gl = useThree((s) => s.gl);

  useFrame(() => {
    const ph = experience().phase;
    const film = introFrame.active || ph === 'loading' || ph === 'ready';
    world.intro = film ? 1 : 0;
    evaluateLook(introFrame.t, experience().reducedMotion);


    // The ground mist, and the light it scatters towards the sun: faint and
    // cool before dawn, warm as the sun clears the horizon.
    mistUniforms.uMist.value.set(look.mist.density, look.mist.height, 0, world.intro);
    mistUniforms.uMistSun.value.copy(look.sun.dir);
    const up = Math.min(1, Math.max(0, (look.sun.elevation * 180) / Math.PI / 10 + 0.55));
    _glow.copy(look.sun.color).multiplyScalar(0.55 + 0.6 * up);
    mistUniforms.uMistGlow.value.copy(look.fogColor).lerp(_glow, 0.25 + 0.55 * up);
    // Lightning, held in the air (fog.ts).
    const fl = mistUniforms.uMistFlash.value;
    fl.set(look.flashDir.x, look.flashDir.y, look.flashDir.z, Math.min(1.2, look.flash) * 0.55 * world.intro);

    gl.toneMappingExposure = DEFAULT_EXPOSURE + (look.exposure - DEFAULT_EXPOSURE) * world.intro;
  });

  useEffect(
    () => () => {
      world.intro = 0;
      mistUniforms.uMist.value.w = 0;
      mistUniforms.uMistFlash.value.w = 0;
      gl.toneMappingExposure = DEFAULT_EXPOSURE;
    },
    [gl],
  );
  return null;
}
