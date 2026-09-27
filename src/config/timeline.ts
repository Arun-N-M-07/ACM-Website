/**
 * The scroll timeline. Scroll is treated as one normalised progress value
 * (0 → 1) across a tall scroll track; each segment below owns a slice of it.
 *
 * The journey opens with the cinematic (src/intro): its five chapters are the
 * first segments of this same track, so the film is scrubbed by the
 * visitor's scroll like everything after it — its beat sheet
 * (intro/timeline.ts) maps linearly onto them.
 *
 * Tune pacing by editing the `vh` weights (how many viewport-heights of
 * scrolling a segment takes). Everything else — chapter ranges, the camera,
 * scene streaming, overlay copy — derives from these numbers.
 */
import { INTRO_CHAPTERS, INTRO_VH_PER_BEAT, type IntroChapterId } from '@/intro/timeline';
import { CORRIDOR } from './world';

export type SegmentId = IntroChapterId | 'events' | 'portal' | 'teams';

const EVENT_VH = { regular: 85, flagship: 125 };
const eventsVh = CORRIDOR.rooms.reduce((sum, r) => sum + (r.event.flagship ? EVENT_VH.flagship : EVENT_VH.regular), 0);

/**
 * The portal: the walk from the last event room to stand before it, then a
 * dwell where scrolling is walled until the visitor touches and holds.
 */
const PORTAL_VH = 150;
/**
 * The Teams world: one continuous orbit of the spine — an establishing view,
 * the six domain cards, and the pull-back that closes the journey.
 */
const TEAMS_VH = 720;

const SEGMENT_WEIGHTS: { id: SegmentId; vh: number }[] = [
  // The opening: each chapter's beats, at a fixed scroll length per beat.
  ...INTRO_CHAPTERS.map((c) => ({ id: c.id as SegmentId, vh: (c.to - c.from) * INTRO_VH_PER_BEAT })),
  { id: 'events', vh: eventsVh + 40 },
  { id: 'portal', vh: PORTAL_VH },
  { id: 'teams', vh: TEAMS_VH },
];

export const SCROLL_LENGTH_VH = SEGMENT_WEIGHTS.reduce((s, x) => s + x.vh, 0);

export interface Segment {
  id: SegmentId;
  start: number;
  end: number;
}

export const SEGMENTS: Record<SegmentId, Segment> = (() => {
  let acc = 0;
  const out = {} as Record<SegmentId, Segment>;
  for (const s of SEGMENT_WEIGHTS) {
    const start = acc / SCROLL_LENGTH_VH;
    acc += s.vh;
    out[s.id] = { id: s.id, start, end: acc / SCROLL_LENGTH_VH };
  }
  return out;
})();

/** Where the opening ends and the Events begin (progress). */
export const INTRO_PROGRESS_END = SEGMENTS.events.start;

/** Per-room progress weights inside the events segment (flagship rooms linger longer). */
export const EVENT_STATION_WEIGHTS = [
  40 / (eventsVh + 40),
  ...CORRIDOR.rooms.map((r) => (r.event.flagship ? EVENT_VH.flagship : EVENT_VH.regular) / (eventsVh + 40)),
];

/** Local 0..1 progress within a segment (clamped). */
export function segmentProgress(p: number, id: SegmentId) {
  const s = SEGMENTS[id];
  return Math.min(1, Math.max(0, (p - s.start) / (s.end - s.start)));
}

export function segmentAt(p: number): SegmentId {
  for (const s of SEGMENT_WEIGHTS) if (p <= SEGMENTS[s.id].end) return s.id;
  return 'teams';
}

/** Fraction of the portal segment at which the visitor is standing before it (the hold zone begins). */
export const PORTAL_DWELL = 0.7;
/**
 * The wall: until the portal has been entered, scroll progress can't pass
 * this point. It is also where the Teams world's own progress begins.
 */
export const PORTAL_GATE = SEGMENTS.portal.end;

// ─── User-facing chapters (the chapter rail + index menu) ──────────────────────

export type ChapterId = IntroChapterId | 'events' | 'portal' | 'teams';

export interface ChapterDef {
  id: ChapterId;
  number: string;
  label: string;
  /** Scroll progress to jump to (null: not a place on the scroll track). */
  jumpTo: number | null;
  segments: SegmentId[];
  /** One of the opening's chapters. */
  intro?: boolean;
}

/** Progress at an opening beat. */
const introAt = (beat: number) => (beat / INTRO_CHAPTERS[INTRO_CHAPTERS.length - 1].to) * INTRO_PROGRESS_END;

export const CHAPTERS: ChapterDef[] = [
  ...INTRO_CHAPTERS.map((c) => ({ id: c.id, number: c.number, label: c.label, jumpTo: introAt(c.enterAt), segments: [c.id] as SegmentId[], intro: true })),
  { id: 'events', number: '06', label: 'Events', jumpTo: SEGMENTS.events.start + 0.002, segments: ['events'] },
  { id: 'portal', number: '07', label: 'The Portal', jumpTo: SEGMENTS.portal.start + (SEGMENTS.portal.end - SEGMENTS.portal.start) * (PORTAL_DWELL + 0.08), segments: ['portal'] },
  // Entered through the portal (navigation plays the travel), never jumped into.
  { id: 'teams', number: '08', label: 'The Teams', jumpTo: null, segments: ['teams'] },
];

export function chapterForSegment(seg: SegmentId): ChapterId {
  return CHAPTERS.find((c) => c.segments.includes(seg))?.id ?? 'arrival';
}

/** Is this one of the opening's chapters? */
export const isIntroChapter = (id: ChapterId) => !!CHAPTERS.find((c) => c.id === id)?.intro;

/** Progress of the dwell point for a given room (used by "jump to event"). */
export function progressForRoom(index: number) {
  const w = EVENT_STATION_WEIGHTS;
  let acc = 0;
  for (let i = 0; i <= index; i++) acc += w[i];
  acc += w[index + 1] * 0.72;
  const s = SEGMENTS.events;
  return s.start + (s.end - s.start) * acc;
}
