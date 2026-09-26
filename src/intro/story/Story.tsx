'use client';
/**
 * The story's artefacts. Every sheet is drawn and uploaded while the world
 * loads (behind the threshold), so none of them is made — or compiled —
 * during the film.
 */
import { QUALITY } from '@/config/quality';
import { useExperience } from '@/store/experience';
import { useDisposable } from '@/systems/performance/useDisposable';
import { noiseTexture } from '../world/noise';
import { FRAGMENTS } from './fragments';
import { Parchment } from './Parchment';
import { drawParchment } from './parchmentTexture';

export function Story() {
  const quality = useExperience((s) => s.quality);
  const scale = QUALITY[quality].textureScale;
  const art = useDisposable(() => {
    const px = 1080 * Math.max(0.6, scale);
    const ash = quality === 'high' ? 1700 : quality === 'medium' ? 1100 : 520;
    const noise = noiseTexture(quality === 'low' ? 128 : 256);
    return {
      noise,
      sheets: FRAGMENTS.map((f) => drawParchment(f, px, ash)),
    };
  }, [quality, scale]);

  return (
    <group name="intro-story">
      {FRAGMENTS.map((f, i) => (
        <Parchment key={f.id} fragment={f} art={art.sheets[i]} noise={art.noise} />
      ))}
    </group>
  );
}
