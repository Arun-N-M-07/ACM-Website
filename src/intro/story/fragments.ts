/**
 * The story, as four fragments of an archive found in the mist.
 *
 * Deliberately little is said. Every fact here is the chapter's own
 * (content/chapter.ts): founded in 2004 — so "22 years ago" is computed, not
 * written — within CEG, a student chapter of the Association for Computing
 * Machinery. The rest is what the chapter says it is for, in as few words as
 * it takes.
 *
 * Each fragment is a physical sheet with its own life: it comes out of the
 * mist on its own path, settles off-centre (the middle of the frame belongs
 * to what the mist is hiding), its ink surfaces, it is read, and it burns —
 * each from a different place — to ash that the air takes away.
 *
 * Times are film seconds (see ../timeline.ts). The readable windows contain
 * the rest points, so a visitor who stops always stops on a legible page.
 */
import { CHAPTER, yearsActive } from '@/content/chapter';

export type LineStyle = 'display' | 'italic' | 'caps';

export interface FragmentLine {
  text: string;
  style: LineStyle;
}

export interface Fragment {
  id: string;
  lines: FragmentLine[];
  /** A small archival mark in a corner (mono caps), or nothing. */
  stamp?: string;
  /** Sheet size in metres (width, height). */
  size: [number, number];
  /** Film times: arrives (from → settled), ink surfaces, burns (ignites → gone). */
  arrive: [number, number];
  ink: [number, number];
  burn: [number, number];
  /** Where it settles, relative to the camera: x right, y up, z forward (m). */
  rest: [number, number, number];
  /** Where it comes from (same frame). */
  from: [number, number, number];
  /** Settled tilt (radians: x pitch, y yaw, z roll). */
  tilt: [number, number, number];
  /** Where the fire starts, in sheet UV. */
  ignite: [number, number];
  /** Secondary burn-through spots (UV), for holes. */
  holes: [number, number][];
  seed: number;
}

const years = yearsActive();

export const FRAGMENTS: Fragment[] = [
  {
    id: 'began',
    lines: [
      { text: `${years} years ago,`, style: 'display' },
      { text: 'a story began.', style: 'italic' },
    ],
    stamp: `EST. ${CHAPTER.established}`,
    size: [1.34, 0.9],
    arrive: [3, 5.4],
    ink: [4.5, 6.6],
    burn: [9.3, 12.2],
    rest: [-0.46, -0.1, 3.05],
    from: [-2.6, 0.55, 7.5],
    tilt: [-0.05, 0.2, 0.035],
    ignite: [0.92, 0.12],
    holes: [[0.3, 0.7]],
    seed: 11,
  },
  {
    id: 'born',
    lines: [
      { text: 'Within CEG,', style: 'display' },
      { text: 'a community was born.', style: 'italic' },
      { text: 'Association for Computing Machinery', style: 'caps' },
    ],
    size: [1.42, 0.98],
    arrive: [9, 11.4],
    ink: [10.4, 12.7],
    burn: [15, 17.8],
    rest: [0.5, 0.02, 3.2],
    from: [2.8, -0.35, 6.2],
    tilt: [0.04, -0.24, -0.05],
    ignite: [0.04, 0.55],
    holes: [[0.62, 0.3], [0.8, 0.78]],
    seed: 23,
  },
  {
    id: 'build',
    lines: [
      { text: 'Not just to learn.', style: 'italic' },
      { text: 'To build. To create.', style: 'display' },
      { text: 'To compete. To grow together.', style: 'display' },
    ],
    size: [1.46, 1.02],
    arrive: [15.4, 17.8],
    ink: [16.7, 19.4],
    burn: [21.6, 24.6],
    // Lower now: the building is beginning to come out of the mist above it.
    rest: [-0.62, -0.26, 3.35],
    from: [-1.4, -1.9, 5.8],
    tilt: [0.07, 0.26, -0.03],
    ignite: [0.5, 0.96],
    holes: [[0.22, 0.28], [0.74, 0.46]],
    seed: 37,
  },
  {
    id: 'continues',
    lines: [
      { text: 'Years passed. The community remained.', style: 'italic' },
      { text: 'Today,', style: 'display' },
      { text: 'the story continues.', style: 'display' },
    ],
    size: [1.26, 0.88],
    arrive: [21.4, 23.6],
    ink: [22.6, 24.8],
    burn: [25.8, 27.6],
    // Low and to the side: the building is the subject now.
    rest: [0.66, -0.36, 3.2],
    from: [2.4, 0.9, 7.4],
    tilt: [-0.06, -0.2, 0.045],
    ignite: [0.1, 0.05],
    holes: [[0.55, 0.62]],
    seed: 53,
  },
];

/** For assistive technology: each fragment's words, and when they can be read. */
export const STORY_LINES = FRAGMENTS.map((f) => ({
  text: f.lines.map((l) => l.text).join(' '),
  readable: [f.ink[1] - 0.4, f.burn[0] + 0.3] as [number, number],
}));
