'use client';
/**
 * Runs the soundtrack: starts and stops it with the visitor's choice, and
 * shapes it to where they are — open air above ground, muffled in the cloud
 * and the shaft, roomy underground, a dip through the portal, and clear again
 * on the other side, in the Teams world.
 *
 * In the film it leaves room for the sound: low under the roll and the
 * stillness after it, lower still for the pressure, then swelling with the
 * words in the gas; and it eases back at the door, so the mechanism is heard
 * before the room opens.
 */
import { useEffect } from 'react';
import { useExperience } from '@/store/experience';
import { music } from '@/systems/audio/music';
import { look } from '@/intro/look';
import { introFrame } from '@/intro/state';
import { T } from '@/intro/timeline';
import { world } from '@/scenes/shared/blend';
import { useProgressFrame } from './useProgressFrame';

export function MusicDirector() {
  const musicOn = useExperience((s) => s.musicOn);
  const phase = useExperience((s) => s.phase);

  useEffect(() => {
    if (musicOn) void music.enable();
    else music.disable();
  }, [musicOn]);

  // Travelling through the portal ducks the track.
  useEffect(() => {
    if (phase === 'travel') music.duck();
  }, [phase]);

  useProgressFrame(() => {
    if (!musicOn) return;
    // Deep in the shaft it is most muffled; in the cloud, a little; it opens up again in the rooms.
    const u = world.underground * (1 - world.teams);
    music.setMuffle(Math.max(u * 0.75, look.cloud * 0.4 * world.intro));
    // Room for the film's sound.
    const t = introFrame.t;
    let level = 1;
    if (introFrame.active) {
      const k = (a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
      const e = (x: number) => x * x * (3 - 2 * x);
      level = 0.5 - 0.2 * e(k(T.pressure, T.release)) + 0.7 * e(k(T.release + 1, T.legible));
      level = Math.min(1, level);
      level *= 1 - 0.3 * e(k(T.door - 1, T.door + 1)) * (1 - e(k(T.door + 3, T.doorway)));
    }
    music.setLevel(level);
  });

  useEffect(() => () => music.destroy(), []);
  return null;
}

