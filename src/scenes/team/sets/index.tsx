'use client';
/**
 * Which set each domain gets, by its `station` kind (content/domains.ts). A
 * new domain can reuse any set; a domain with no set still gets its bay,
 * signage and people.
 */
import type { ComponentType } from 'react';
import type { StationKind } from '@/content/domains';
import { GrindSet, NewsroomSet, StudioSet, TerminalWallSet } from './Makers';
import { OutreachSet, PeopleDeskSet, PitchSet, PosterWallSet, StageSet, WarehouseSet } from './Ops';
import { BayGroup, BayShell, type SetProps } from './shared';

const SETS: Record<StationKind, ComponentType<SetProps> | null> = {
  commons: null,
  grind: GrindSet,
  'terminal-wall': TerminalWallSet,
  studio: StudioSet,
  newsroom: NewsroomSet,
  stage: StageSet,
  'people-desk': PeopleDeskSet,
  pitch: PitchSet,
  outreach: OutreachSet,
  'poster-wall': PosterWallSet,
  warehouse: WarehouseSet,
};

export function DomainSet(props: SetProps) {
  const Set = SETS[props.bay.domain.station];
  if (Set) return <Set {...props} />;
  return (
    <BayGroup bay={props.bay}>
      <BayShell bay={props.bay} />
    </BayGroup>
  );
}

export { WelcomeScene } from './Welcome';
