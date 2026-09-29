/**
 * Discrete experience state (changes a few times per minute, not per frame).
 * Per-frame values — scroll progress, camera pose, the portal hold — live in
 * refs / the progress channel instead. The Teams world's own states live in
 * src/teams/state.ts.
 */
import { create } from 'zustand';
import type { QualityTier } from '@/config/quality';
import type { ChapterId, SegmentId } from '@/config/timeline';

export type Phase =
  /** Building the world; the loader is on screen. */
  | 'loading'
  /** World ready, waiting for the visitor to enter. */
  | 'ready'
  /** Scroll-driven journey — including the orbit of the Teams world. */
  | 'cinematic'
  /** Timed travel through the portal (either direction); scroll is locked. */
  | 'travel';

/** `lost`: the GPU context dropped; the canvas is being recreated once before giving up. */
export type WebGLStatus = 'unknown' | 'ok' | 'unsupported' | 'lost' | 'failed';

interface ExperienceState {
  phase: Phase;
  webgl: WebGLStatus;
  /** The device tier, chosen once at start-up: everything built for the world is built at it. */
  quality: QualityTier;
  /**
   * Runtime relief for a device that can't keep up even at its lowest pixel ratio (0 none … 2
   * most). It only turns knobs that cost nothing to turn — how finely the smog is marched, bloom,
   * the glass's transmission resolution — never anything that rebuilds or recompiles
   * (see ExperienceCanvas).
   */
  degrade: 0 | 1 | 2;
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

  set: (partial: Partial<ExperienceState>) => void;
  setLoad: (progress: number, label: string) => void;
  toggleMotion: () => void;
}

export const useExperience = create<ExperienceState>((set, get) => ({
  phase: 'loading',
  webgl: 'unknown',
  quality: 'medium',
  degrade: 0,
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

  set: (partial) => set(partial),
  setLoad: (progress, label) => set({ loadProgress: Math.max(get().loadProgress, progress), loadLabel: label }),
  toggleMotion: () => set({ reducedMotion: !get().reducedMotion }),
}));

/** Non-hook access for systems running inside useFrame. */
export const experience = () => useExperience.getState();
