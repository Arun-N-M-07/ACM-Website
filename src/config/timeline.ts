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

export type SegmentId = IntroChapterId | 'events' | 'portal' | 'teams' | 'return';

/**
 * The Events (scenes/events). In order along the track:
 *
 *   arrival   from the lobby's door across the hall to stand before the matrix
 *   hub       the whole matrix: an event is chosen here (Visit), or the scroll
 *             goes on — to the Crew
 *   the room  one stretch of track for whichever event was chosen: into its
 *             bay and its room (enter), a short way on inside it (room — the
 *             scroll's slow step in; the room's installation plays on its own
 *             clock once the camera is there, never at the scroll's pace:
 *             scenes/events/controller), then its record: a page the
 *             scroll moves px for px, its edge rising over the room for a screen
 *             (unfold), read on up the screen after that (read — room enough for
 *             the longest record on a phone; a record's own end walls the scroll
 *             where its foot meets the screen's: scenes/events/controller), and
 *             the part's last hair (decide) — nothing goes on to another event
 *             unasked
 *   rejoin    the whole matrix again: where the scroll from the hub continues
 *             (scenes/events/controller joins the hub's end to this, the
 *             picture the same at both), on into the portal segment
 */
// The old 16/24vh slices were only thresholds for timed camera playback. Now that navigation is
// scrubbed, give the hall-to-bay path and established room real scroll distance: no tiny wheel
// gesture spanning the whole hall. Editorial remains measured px-for-px, not stretched with these.
// The hall walk needs real travel distance too: 44vh compressed the whole doorway-to-shelf
// approach into a few wheel notches. Match the scale of the subsequent room approach, not a zoom.
export const EVENTS_VH = { arrival: 180, hub: 60, enter: 150, room: 100, unfold: 100, read: 760, decide: 20, rejoin: 60 } as const;
const eventsVh = Object.values(EVENTS_VH).reduce((a, b) => a + b, 0);

/**
 * The portal: the matrix opening onto it — its outer columns into the wall, the middle one into the
 * floor (PORTAL_SPLIT) — the walk down the passage to stand before it, then a dwell where scrolling
 * is walled until the visitor touches and holds.
 */
const PORTAL_VH = 210;
/**
 * The Teams world: one continuous orbit of the spine — an establishing view,
 * the six domain cards, and the pull-back that closes the journey.
 */
const TEAMS_VH = 720;
/**
 * The return: a continuation past the last domain, in which the world comes apart into tiles and is
 * swallowed by the mist the opening begins in — and, inside it, the journey begins again
 * (components/experience/JourneyLoop). Long enough that the passage is the visitor's to scrub (on a
 * phone, more than a single fling). One finite track, read cyclically: nothing is appended, nothing
 * grows.
 */
const RETURN_VH = 300;

const SEGMENT_WEIGHTS: { id: SegmentId; vh: number }[] = [
  // The opening: each chapter's beats, at a fixed scroll length per beat.
  ...INTRO_CHAPTERS.map((c) => ({ id: c.id as SegmentId, vh: (c.to - c.from) * INTRO_VH_PER_BEAT })),
  { id: 'events', vh: eventsVh },
  { id: 'portal', vh: PORTAL_VH },
  { id: 'teams', vh: TEAMS_VH },
  { id: 'return', vh: RETURN_VH },
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

/** Where each part of the Events begins and ends (progress). */
export const EVENTS_TRACK = (() => {
  const s = SEGMENTS.events;
  const k = (s.end - s.start) / eventsVh;
  let acc = s.start;
  const next = (vh: number) => (acc += vh * k);
  const arrival = { start: acc, end: next(EVENTS_VH.arrival) };
  const hub = { start: acc, end: next(EVENTS_VH.hub) };
  const enter = { start: acc, end: next(EVENTS_VH.enter) };
  const room = { start: acc, end: next(EVENTS_VH.room) };
  const unfold = { start: acc, end: next(EVENTS_VH.unfold) };
  const read = { start: acc, end: next(EVENTS_VH.read) };
  const decide = { start: acc, end: next(EVENTS_VH.decide) };
  const rejoin = { start: acc, end: s.end };
  return { arrival, hub, enter, room, unfold, read, decide, rejoin, branch: { start: enter.start, end: decide.end } };
})();
export type EventsPart = Exclude<keyof typeof EVENTS_TRACK, 'branch'>;

/** Progress `t` of the way through a part of the Events. */
export const eventsAt = (part: EventsPart, t: number) => {
  const r = EVENTS_TRACK[part];
  return r.start + (r.end - r.start) * t;
};

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
/** Fraction of the portal segment by which the matrix has opened (its columns home in the wall and the floor). */
export const PORTAL_SPLIT = 0.32;
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

/** Progress at an opening beat (the film's first chapter starts before beat 0: the prologue). */
const introAt = (beat: number) => {
  const first = INTRO_CHAPTERS[0].from;
  return ((beat - first) / (INTRO_CHAPTERS[INTRO_CHAPTERS.length - 1].to - first)) * INTRO_PROGRESS_END;
};

export const CHAPTERS: ChapterDef[] = [
  ...INTRO_CHAPTERS.map((c) => ({ id: c.id, number: c.number, label: c.label, jumpTo: introAt(c.enterAt), segments: [c.id] as SegmentId[], intro: true })),
  { id: 'events', number: '06', label: 'Events', jumpTo: eventsAt('hub', 0.35), segments: ['events'] },
  { id: 'portal', number: '07', label: 'The Portal', jumpTo: SEGMENTS.portal.start + (SEGMENTS.portal.end - SEGMENTS.portal.start) * (PORTAL_DWELL + 0.08), segments: ['portal'] },
  // Entered through the portal (navigation plays the travel), never jumped into. (Its return — into
  // the mist, and round to the beginning — belongs to it.)
  { id: 'teams', number: '08', label: 'The Crew', jumpTo: null, segments: ['teams', 'return'] },
];

export function chapterForSegment(seg: SegmentId): ChapterId {
  return CHAPTERS.find((c) => c.segments.includes(seg))?.id ?? 'arrival';
}

/** Is this one of the opening's chapters? */
export const isIntroChapter = (id: ChapterId) => !!CHAPTERS.find((c) => c.id === id)?.intro;
