'use client';
/**
 * Runs the soundtrack: starts and stops it with the visitor's choice, and
 * shapes it to where they are — open air above ground, muffled in the shaft,
 * roomy underground, and a dip as they are pushed through the door.
 */
import { useEffect } from 'react';
import { useExperience } from '@/store/experience';
import { music } from '@/systems/audio/music';
import { world } from '@/scenes/shared/blend';
import { useProgressFrame } from './useProgressFrame';

export function MusicDirector() {
  const musicOn = useExperience((s) => s.musicOn);
  const phase = useExperience((s) => s.phase);

  useEffect(() => {
    if (musicOn) void music.enable();
    else music.disable();
  }, [musicOn]);

  // The push through the door ducks the track.
  useEffect(() => {
    if (phase === 'impact') music.duck();
  }, [phase]);

  useProgressFrame(() => {
    if (!musicOn) return;
    // Deep in the shaft it is most muffled; it opens up again in the rooms.
    const u = world.underground;
    music.setMuffle(u * 0.75);
  });

  useEffect(() => () => music.destroy(), []);
  return null;
}

