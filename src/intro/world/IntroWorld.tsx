'use client';
/**
 * Everything the opening film puts into the world that isn't the campus:
 * its light (the colour script) and lens (the grade), the air (mist, motes),
 * the story's artefacts, the cloud, the tunnel and EVENTS. Mounted while the
 * world loads (so it is built and compiled behind the loader) and for as long
 * as the film can be seen or rewound into.
 */
import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import type { Group } from 'three';
import { experience } from '@/store/experience';
import { IntroPost } from '../post/IntroPost';
import { introFrame } from '../state';
import { T } from '../timeline';
import { Clouds } from './Clouds';
import { EventsTitle } from './EventsTitle';
import { Tunnel } from './Tunnel';
import { Halos } from './Halos';
import { IntroAtmosphere } from './IntroAtmosphere';
import { MistLayers } from './MistLayers';
import { Motes } from './Motes';
import { Story } from '../story/Story';

/** The film is what's on screen (the threshold counts: the world is behind it). */
const onScreen = () => {
  const ph = experience().phase;
  return introFrame.active || ph === 'loading' || ph === 'ready' || ph === 'intro';
};

export function IntroWorld() {
  const [lens, setLens] = useState(onScreen);
  const below = useRef<Group>(null);
  useFrame(() => {
    const want = onScreen();
    if (want !== lens) setLens(want);
    // Below ground only once the camera is on its way down (and after the film).
    if (below.current) below.current.visible = !introFrame.active || introFrame.t > T.descent - 0.5;
  });
  return (
    <group name="intro-world">
      <IntroAtmosphere />
      <MistLayers />
      <Halos />
      <Story />
      <Clouds />
      <Motes />
      <group ref={below}>
        <Tunnel />
        <EventsTitle />
      </group>
      {lens && <IntroPost />}
    </group>
  );
}
