/**
 * The story, as four fragments of an archive found in the mist.
 *
 * Deliberately little is said. Every fact here is the chapter's own
 * (content/chapter.ts): founded in 2004 — so "22 years ago" is computed, not
 * written — within CEG, a student chapter of the Association for Computing
 * Machinery. (The name itself is not written on paper: it stands in the
 * world, on a stone in the mist — world/AcmStone.tsx.) The rest is what the chapter says it is for,
 * in as few words as it takes.
 *
 * Each fragment is a physical sheet with its own life: the air brings it in
 * from one side or the other, rolled like a scroll, and it unfurls in front of
 * you (flight.ts); its ink surfaces, it is read, and it burns — each from a
 * different place — to ash that the air takes away.
 *
 * Every time here is a beat of the scroll (see ../timeline.ts): a sheet is
 * exactly as far through its arrival, its ink or its fire as the visitor has
 * scrolled, and each stays legible across about six beats.
 */
import { yearsActive } from '@/content/chapter';
import { T } from '../timeline';

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
  /** Beats: arrives (from → settled), ink surfaces, burns (ignites → gone). */
  arrive: [number, number];
  ink: [number, number];
  burn: [number, number];
  /** Where it settles, relative to the camera: x right, y up, z forward (m). */
  rest: [number, number, number];
  /** Which side the air brings it in from: −1 the left, +1 the right (they alternate). */
  side: -1 | 1;
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
    // (The years are said once, by the smog itself — prologue/ — never again on paper.)
    lines: [{ text: 'A STORY BEGAN.', style: 'display' }],
    size: [1.74, 1.17],
    arrive: [4, 9],
    ink: [7.5, 10.5],
    burn: [16.5, 20.5],
    rest: [-0.22, -0.06, 3.1],
    side: -1,
    tilt: [-0.05, 0.16, 0.03],
    ignite: [0.92, 0.12],
    holes: [[0.3, 0.7]],
    seed: 11,
  },
  {
    id: 'born',
    lines: [
      { text: 'Within CEG,', style: 'display' },
      { text: 'a community was born.', style: 'italic' },
    ],
    size: [1.8, 1.14],
    arrive: [19, 24],
    ink: [22.5, 25.5],
    burn: [31.5, 35.5],
    rest: [0.24, 0.02, 3.2],
    side: 1,
    tilt: [0.04, -0.2, -0.045],
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
    size: [1.9, 1.33],
    arrive: [55, 60],
    ink: [58.5, 61.5],
    burn: [67.5, 71.5],
    // Lower now: the building is beginning to come out of the mist above it.
    rest: [-0.26, -0.2, 3.35],
    side: -1,
    tilt: [0.07, 0.2, -0.03],
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
    size: [1.72, 1.2],
    arrive: [70, 75],
    ink: [73.5, 76.5],
    // (It burns as the mist begins to clear, so what opens in it is the building coming out.)
    burn: [84.5, 89],
    // Over the tower: it burns from the middle outwards, and the opening it leaves frames the
    // building as the mist clears behind it — the words become the place.
    rest: [0.02, 0.14, 3.3],
    side: 1,
    tilt: [-0.03, -0.05, 0.015],
    ignite: [0.52, 0.56],
    holes: [[0.4, 0.62], [0.6, 0.5]],
    seed: 53,
  },
];

/**
 * For assistive technology: the words the prologue's gas forms, each
 * fragment's words — and the chapter's name, which is not on paper — and
 * when they can be read.
 */
export const STORY_LINES = [
  // The prologue: the words the gas forms.
  { text: `${years} years ago`, readable: [T.legible - 1.5, T.dissolve + 1] as [number, number] },
  ...FRAGMENTS.slice(0, 2).map((f) => ({
    text: f.lines.map((l) => l.text).join(' '),
    readable: [f.ink[1] - 0.4, f.burn[0] + 0.3] as [number, number],
  })),
  { text: 'Association for Computing Machinery', readable: [T.acm + 2, T.acmOut] as [number, number] },
  ...FRAGMENTS.slice(2).map((f) => ({
    text: f.lines.map((l) => l.text).join(' '),
    readable: [f.ink[1] - 0.4, f.burn[0] + 0.3] as [number, number],
  })),
];
