'use client';
/**
 * The journey is a loop.
 *
 * There is one finite, canonical track (config/timeline). Its two ends are the
 * same air — the mist the opening begins in — and the loop is made there:
 *
 *   the end      the camera rests on the last card (teams/camera); scrolling
 *                a little further, the mist rises and takes the world (the
 *                orbit coordinate, run on through the short return segment,
 *                measures how far: teams/layout C_MIST → C_MIST_FULL); after
 *                that, a margin of the track wholly in the mist
 *   the start    before the film's first frame, a few beats of that mist
 *                (intro/timeline T.mist → T.prologue), the first of them
 *                wholly mist: entering, the film starts clear at T.prologue;
 *                scrolling back from it, the mist thickens
 *
 * The two ends are joined at a seam inside each margin — two points of the
 * track that look exactly the same, wholly in the mist (END_SEAM, START_SEAM).
 * Crossing one, the journey continues past the other: the world is exchanged
 * while nothing can be seen and the scroll moves on by exactly the seam's
 * length (navigation.wrapToStart / wrapToEnd → ScrollTimeline.shiftProgress):
 * no cut, nothing reset — whatever the visitor's scroll was doing (its speed,
 * Lenis's smoothing) carries on across it, forwards or backwards. The seams
 * lie inside the margins, short of the track's hard ends, so the scroll never
 * has to run into a wall to come round.
 *
 * The mist (fx.mist, drawn by ScreenFx over every world alike) is a pure
 * function of the one progress value, so it plays the same forwards and
 * backwards, stops when the scroll stops, and nothing about it runs on time.
 * Nothing is appended and nothing accumulates: the scroll position is always a
 * place on the one track, and both worlds stay resident (SceneDirector), so
 * crossing the seam builds nothing. It reads no input of its own — scrolling is
 * the scroll system's.
 */
import { introTimeAt, progressAtIntroTime } from '@/intro/controller';
import { T } from '@/intro/timeline';
import { useExperience } from '@/store/experience';
import { fx } from '@/systems/camera/effects';
import { SEGMENTS } from '@/config/timeline';
import { progress } from '@/systems/scroll/progress';
import { C_MIST, C_MIST_FULL, carouselAt } from '@/teams/layout';
import { teams, teamsFrame } from '@/teams/state';
import { wrapToEnd, wrapToStart } from './navigation';
import { useProgressFrame } from './useProgressFrame';

const smoother = (x: number) => {
  const k = x < 0 ? 0 : x > 1 ? 1 : x;
  return k * k * k * (k * (k * 6 - 15) + 10);
};

/** Where the start's mist begins to thin: before it, the track is wholly mist (around the seam). */
const START_CLEAR_FROM = T.mist + 6;
/** At the end: how much of the world the mist has taken, from how far past the last card the scroll is. */
const mistAtEnd = (p: number) => smoother((carouselAt(p) - C_MIST) / (C_MIST_FULL - C_MIST));
/** At the start: how thick the mist before the film still is (whole at first, gone at its first frame). */
const mistAtStart = (p: number) => 1 - smoother((introTimeAt(p) - START_CLEAR_FROM) / (T.prologue - START_CLEAR_FROM));

/**
 * The seam: two places, one at each end, wholly in the mist and looking the same — each the
 * other's continuation. Each lies well inside its end's whole mist, with room on both sides: the
 * camera's progress lags the scroll a little (the scroll is smoothed, and the camera damped), and
 * both must be in the mist when the journey comes round; and past each seam there is room still
 * before the track's hard end, so the scroll (and its smoothing) never runs into a wall there.
 */
const END_SEAM = SEGMENTS.return.start + 0.55 * (SEGMENTS.return.end - SEGMENTS.return.start);
const START_SEAM = progressAtIntroTime(T.mist + 3);

export function JourneyLoop() {
  useProgressFrame((p) => {
    const st = useExperience.getState();
    const inside = teamsFrame.inside;
    // The mist: at the end, inside the Crew's world, past the last card; at the start, before the film.
    fx.mist = inside ? mistAtEnd(p) : introTimeAt(p) < T.prologue ? mistAtStart(p) : 0;

    const open = st.phase === 'cinematic' && !st.menuOpen && !st.dossier && !st.textVersionOpen;
    if (!open || st.reducedMotion) return;
    // Where the scroll itself is — and the camera, which follows it a moment behind (in the film, at
    // a cinematic pace at most: a hard fling back through the opening can leave it far behind). The
    // world is exchanged only once both are in the whole mist, where nothing can be seen.
    const s = progress.target;
    // Past the end's seam: on from the start's, by as much as it went past.
    if (inside && teams().state === 'teamsActive' && s > END_SEAM && mistAtEnd(p) >= 1) {
      wrapToStart(START_SEAM - END_SEAM);
      return;
    }
    // Back past the start's seam: on (backwards) from the end's.
    if (!inside && s < START_SEAM && introTimeAt(p) <= START_CLEAR_FROM) wrapToEnd(END_SEAM - START_SEAM);
  });

  return null;
}
