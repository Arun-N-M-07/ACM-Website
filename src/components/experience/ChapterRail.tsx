'use client';
/** Vertical chapter rail with a live progress line; each tick jumps to its chapter. */
import { useRef } from 'react';
import { CHAPTERS } from '@/config/timeline';
import { useExperience } from '@/store/experience';
import { goToChapter } from './navigation';
import { useProgressFrame } from './useProgressFrame';

export function ChapterRail() {
  const chapter = useExperience((s) => s.chapter);
  const phase = useExperience((s) => s.phase);
  const fill = useRef<HTMLSpanElement>(null);
  const active = phase === 'impact' ? 'team' : chapter;

  useProgressFrame((p) => {
    if (fill.current) fill.current.style.transform = `scaleY(${p})`;
  });

  if (phase === 'loading') return null;
  return (
    <nav className="rail" aria-label="Chapters">
      <span className="rail-line" aria-hidden="true">
        <span ref={fill} className="rail-fill" />
      </span>
      <ol>
        {CHAPTERS.map((c) => (
          <li key={c.id} className={c.id === active ? 'active' : ''}>
            <button
              onClick={(e) => {
                goToChapter(c.id);
                // Hand focus back to the page so Space scrolls instead of re-pressing this.
                if (e.detail > 0) {
                  e.currentTarget.blur();
                  document.querySelector<HTMLElement>('.stage')?.focus({ preventScroll: true });
                }
              }}
              aria-current={c.id === active ? 'step' : undefined}
            >
              <span className="num">{c.number}</span>
              <span className="label">{c.label}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
