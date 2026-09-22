/**
 * Discrete experience state (changes a few times per minute, not per frame).
 * Per-frame values — scroll progress, camera pose, NPC internals — live in
 * refs / the progress channel instead.
 */
import { create } from 'zustand';
import type { QualityTier } from '@/config/quality';
import type { ChapterId, SegmentId } from '@/config/timeline';
import type { DomainId } from '@/content/domains';

export type Phase =
  /** Building the world; the loader is on screen. */
  | 'loading'
  /** World ready, waiting for the visitor to enter. */
  | 'ready'
  /** Scroll-driven journey — including the first-person walk through the team. */
  | 'cinematic'
  /** The timed push through the door. */
  | 'impact';

export type WebGLStatus = 'unknown' | 'ok' | 'unsupported' | 'failed';

export interface Speech {
  memberId: string;
  name: string;
  role: string;
  text: string;
  /** performance.now() timestamp after which the line is hidden. */
  until: number;
}

interface ExperienceState {
  phase: Phase;
  webgl: WebGLStatus;
  quality: QualityTier;
  isTouch: boolean;
  guided: boolean;
  reducedMotion: boolean;
  /** The soundtrack is playing (the only sound the site makes). */
  musicOn: boolean;

  loadProgress: number;
  loadLabel: string;
  /** The campus model (OSM data) has been built. */
  campusReady: boolean;

  segment: SegmentId;
  chapter: ChapterId;
  activeRoom: number;
  dossier: string | null;
  menuOpen: boolean;
  textVersionOpen: boolean;

  /** Team tour stop the visitor is at (−1 outside the team): 0 welcome, then a domain each, then the core. */
  tourStop: number;
  /** The domain being met right now. */
  tourDomain: DomainId | 'core' | null;
  speech: Speech | null;

  set: (partial: Partial<ExperienceState>) => void;
  setLoad: (progress: number, label: string) => void;
  say: (s: Omit<Speech, 'until'>, ms?: number) => void;
  toggleMotion: () => void;
}

export const useExperience = create<ExperienceState>((set, get) => ({
  phase: 'loading',
  webgl: 'unknown',
  quality: 'medium',
  isTouch: false,
  guided: false,
  reducedMotion: false,
  musicOn: false,

  loadProgress: 0,
  loadLabel: 'Initialising',
  campusReady: false,

  segment: 'arrival',
  chapter: 'arrival',
  activeRoom: -1,
  dossier: null,
  menuOpen: false,
  textVersionOpen: false,

  tourStop: -1,
  tourDomain: null,
  speech: null,

  set: (partial) => set(partial),
  setLoad: (progress, label) => set({ loadProgress: Math.max(get().loadProgress, progress), loadLabel: label }),
  say: (s, ms = 3200) => set({ speech: { ...s, until: performance.now() + ms } }),
  toggleMotion: () => set({ reducedMotion: !get().reducedMotion }),
}));

/** Non-hook access for systems running inside useFrame. */
export const experience = () => useExperience.getState();
