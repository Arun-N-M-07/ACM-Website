'use client';
/**
 * Everything the opening puts into the world that isn't the campus: its
 * light (the colour script) and lens (the grade), the air (mist, motes), the
 * story's artefacts, the stone with the chapter's name, the cloud — and below ground, the
 * light-well's shaft, the lobby, EVENTS and the door. Mounted while the world
 * loads (so it is built and compiled behind the loader) and for as long as
 * the opening can be seen or scrolled back into.
 */
import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import type { Group } from 'three';
import { DescentShaft } from '@/scenes/underground/DescentShaft';
import { experience } from '@/store/experience';
import { IntroPost } from '../post/IntroPost';
import { introFrame } from '../state';
import { T } from '../timeline';
import { AcmStone } from './AcmStone';
import { Clouds } from './Clouds';
import { EventsTitle } from './EventsTitle';
import { Gate } from './Gate';
import { Halos } from './Halos';
import { IntroAtmosphere } from './IntroAtmosphere';
import { Lobby } from './Lobby';
import { MistLayers } from './MistLayers';
import { Motes } from './Motes';
import { Story } from '../story/Story';
import { Prologue } from '../prologue/Prologue';

/** The opening is what's on screen (the threshold counts: the world is behind it). */
const onScreen = () => {
  const ph = experience().phase;
  return introFrame.active || ph === 'loading' || ph === 'ready';
};

export function IntroWorld() {
  const [lens, setLens] = useState(onScreen);
  const below = useRef<Group>(null);
  useFrame(() => {
    const want = onScreen();
    if (want !== lens) setLens(want);
    // Below ground only once the camera is coming down onto the well (and after the opening).
    if (below.current) below.current.visible = !introFrame.active || introFrame.t > T.cloudBase + 3;
  });
  return (
    <group name="intro-world">
      <IntroAtmosphere />
      <Prologue />
      <MistLayers />
      <Halos />
      <Story />
      <AcmStone />
      <Clouds />
      <Motes />
      <group ref={below}>
        <DescentShaft />
        <Lobby />
        <EventsTitle />
        <Gate />
      </group>
      {lens && <IntroPost />}
    </group>
  );
}
