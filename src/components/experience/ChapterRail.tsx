'use client';
/**
 * The chapter rail: one vertical track with a tick per chapter, the progress
 * filling along it, the active chapter, and the percentage — all from the one
 * damped journey progress the camera itself follows (so the rail can never
 * disagree with the scene).
 *
 * The ticks are evenly spaced but the chapters are not (the opening is long,
 * the portal short), so the fill is mapped piecewise: within chapter i it runs
 * from tick i to tick i+1 in proportion to how far through that chapter the
 * journey is — the fill always meets the active chapter's tick.
 *
 * During the opening film it stays quiet (dimmed until hovered or focused).
 */
import { useMemo, useRef } from 'react';
import { CHAPTERS, isIntroChapter, SEGMENTS } from '@/config/timeline';
import { progressAtIntroTime } from '@/intro/controller';
import { T } from '@/intro/timeline';
import { useExperience } from '@/store/experience';
import { goToChapter } from './navigation';
import { useProgressFrame } from './useProgressFrame';

/** Where the journey's first frame is on the track (the film's; see intro/timeline T.mist). */
const FILM_START = progressAtIntroTime(T.prologue);

/** Each chapter's span of the journey's progress. */
function chapterSpans() {
  return CHAPTERS.map((c) => {
    const segs = c.segments.map((id) => SEGMENTS[id]);
    return { start: Math.min(...segs.map((s) => s.start)), end: Math.max(...segs.map((s) => s.end)) };
  });
}

/** Where along the track (0 = first tick, 1 = last) progress p falls. */
export function railPosition(p: number, spans: { start: number; end: number }[]) {
  const n = spans.length;
  if (p <= spans[0].start) return 0;
  for (let i = 0; i < n; i++) {
    const s = spans[i];
    if (p < s.end || i === n - 1) {
      if (i === n - 1) return 1;
      const local = Math.min(1, Math.max(0, (p - s.start) / Math.max(1e-6, s.end - s.start)));
      return (i + local) / (n - 1);
    }
  }
  return 1;
}

export function ChapterRail() {
  const chapter = useExperience((s) => s.chapter);
  const phase = useExperience((s) => s.phase);
  const fill = useRef<HTMLSpanElement>(null);
  const counter = useRef<HTMLSpanElement>(null);
  const spans = useMemo(chapterSpans, []);
  // (Written only when they change: an unchanged style or text still costs a style pass, and new text a node, every frame.)
  const shown = useRef({ fill: '', count: '' });

  useProgressFrame((p) => {
    const was = shown.current;
    const scale = `scaleY(${railPosition(p, spans)})`;
    if (fill.current && scale !== was.fill) {
      fill.current.style.transform = scale;
      was.fill = scale;
    }
    // (Counted from the film's first frame: the few beats of mist before it are where the loop comes round.)
    const done = Math.max(0, (p - FILM_START) / (1 - FILM_START));
    const count = `${String(Math.round(done * 100)).padStart(2, '0')}%`;
    if (counter.current && count !== was.count) {
      counter.current.textContent = count;
      was.count = count;
    }
  });

  if (phase === 'loading' || phase === 'ready') return null;
  return (
    <nav className="rail" aria-label="Chapters" data-film={isIntroChapter(chapter) ? 'true' : 'false'}>
      <ol>
        {CHAPTERS.map((c, i) => (
          <li key={c.id} className={c.id === chapter ? 'active' : ''}>
            <button
              onClick={(e) => {
                goToChapter(c.id);
                // Hand focus back to the page so Space scrolls instead of re-pressing this.
                if (e.detail > 0) {
                  e.currentTarget.blur();
                  document.querySelector<HTMLElement>('.stage')?.focus({ preventScroll: true });
                }
              }}
              aria-current={c.id === chapter ? 'step' : undefined}
              aria-label={`${c.number} ${c.label}`}
            >
              <span className="label" aria-hidden="true">
                {c.label}
              </span>
              <span className="num" aria-hidden="true">
                {c.number}
              </span>
              <span className="tick" aria-hidden="true" />
            </button>
            {i === 0 && (
              <span className="rail-track" aria-hidden="true">
                <span ref={fill} className="rail-fill" />
              </span>
            )}
          </li>
        ))}
      </ol>
      <span ref={counter} className="rail-percent" aria-hidden="true">
        00%
      </span>
    </nav>
  );
}
