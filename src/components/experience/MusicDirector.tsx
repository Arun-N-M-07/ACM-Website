'use client';
/**
 * Runs the soundtrack: starts and stops it with the visitor's choice, and
 * shapes it to where they are — open air above ground, muffled in the shaft,
 * roomy underground, a dip through the portal, and clear again on the other
 * side, in the Teams world.
 */
import { useEffect } from 'react';
import { useExperience } from '@/store/experience';
import { music } from '@/systems/audio/music';
import { world } from '@/scenes/shared/blend';
import { useProgressFrame } from './useProgressFrame';
import { introFrame } from '@/intro/state';

export function MusicDirector() {
  const musicOn = useExperience((s) => s.musicOn);
  const phase = useExperience((s) => s.phase);

  useEffect(() => {
    // While the opening film runs it plays the score itself, in step with the picture.
    if (musicOn) {
      if (!introFrame.active) void music.enable();
    } else music.disable();
  }, [musicOn]);

  // Travelling through the portal ducks the track.
  useEffect(() => {
    if (phase === 'travel') music.duck();
  }, [phase]);

  useProgressFrame(() => {
    if (!musicOn) return;
    // Deep in the shaft it is most muffled; it opens up again in the rooms.
    const u = world.underground * (1 - world.teams);
    music.setMuffle(u * 0.75);
  });

  useEffect(() => () => music.destroy(), []);
  return null;
}

