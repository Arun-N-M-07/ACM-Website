'use client';
/**
 * Runs the soundtrack: starts and stops it with the visitor's choice, and
 * shapes it to where they are — open air above ground, muffled in the shaft,
 * roomy underground, a dip through the portal, and clear again on the other
 * side, in the Teams world. It is never lowered to make room for an effect.
 */
import { useEffect } from 'react';
import { useExperience } from '@/store/experience';
import { music } from '@/systems/audio/music';
import { world } from '@/scenes/shared/blend';
import { useProgressFrame } from './useProgressFrame';

export function MusicDirector() {
  const musicOn = useExperience((s) => s.musicOn);
  const phase = useExperience((s) => s.phase);
  const guided = useExperience((s) => s.guided);

  useEffect(() => {
    if (musicOn) void music.enable();
    else music.disable();
  }, [musicOn]);

  // Leaving the page and coming back (on a phone, the sound pauses while it's hidden).
  useEffect(() => music.watchPage(guided), [guided]);

  // Travelling through the portal ducks the track.
  useEffect(() => {
    if (phase === 'travel') music.duck();
  }, [phase]);

  useProgressFrame(() => {
    if (!musicOn) return;
    // Deep in the shaft it is muffled; it opens up again in the rooms. (Nowhere else is it touched:
    // the score is the film's backbone, and the sound effects sit under it.)
    const u = world.underground * (1 - world.teams);
    music.setMuffle(u * 0.75);
  });

  useEffect(() => () => music.destroy(), []);
  return null;
}

