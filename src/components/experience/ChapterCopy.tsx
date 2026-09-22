'use client';
/**
 * The two moments that are pure typography — the title over the red building
 * and "Beneath the red building" in the shaft. Everything else is a plate
 * (Plates.tsx) attached to what it describes.
 * The copy is real, server-rendered HTML — headings included — so it is
 * readable by assistive tech and search engines.
 */
import { useRef, type ReactNode } from 'react';
import { SEGMENTS, type SegmentId } from '@/config/timeline';
import { CHAPTER } from '@/content/chapter';
import { useExperience } from '@/store/experience';
import { jumpToProgress } from '@/systems/scroll/ScrollTimeline';
import { smooth, useProgressFrame } from './useProgressFrame';

interface Block {
  id: string;
  seg: SegmentId;
  /** Visible window inside the segment (0..1). */
  from: number;
  to: number;
  align: 'left' | 'right' | 'center' | 'bottom';
  children: ReactNode;
}

const w = (seg: SegmentId, t: number) => SEGMENTS[seg].start + (SEGMENTS[seg].end - SEGMENTS[seg].start) * t;

export function ChapterCopy() {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const phase = useExperience((s) => s.phase);

  const blocks: Block[] = [
    {
      id: 'arrival',
      seg: 'arrival',
      from: -1,
      to: 0.8,
      align: 'left',
      children: (
        <>
          <p className="kicker">
            {CHAPTER.institution} · {CHAPTER.university} · {CHAPTER.city}
          </p>
          <h1 className="hero-title">
            <span>ACM</span>
            <span>CEG</span>
          </h1>
          <p className="hero-sub">
            <em>Student Chapter</em> — since {CHAPTER.established}
          </p>
          <p className="scroll-cue" aria-hidden="true">
            <span /> Scroll to rise
          </p>
          <button className="text-link skip-intro" onClick={() => jumpToProgress(SEGMENTS.events.start + 0.002)}>
            Skip to the events →
          </button>
        </>
      ),
    },
    {
      id: 'descent',
      seg: 'descent',
      from: 0.55,
      to: 0.9,
      align: 'center',
      children: (
        <>
          <p className="kicker">Going under</p>
          <h2 className="display">Beneath the red building.</h2>
        </>
      ),
    },
  ];

  useProgressFrame((p) => {
    blocks.forEach((b, i) => {
      const el = refs.current[i];
      if (!el) return;
      const a = w(b.seg, b.from);
      const z = w(b.seg, b.to);
      const fade = (z - a) * 0.18;
      const o = b.from < 0 ? 1 - smooth(z - fade, z, p) : smooth(a, a + fade, p) * (1 - smooth(z - fade, z, p));
      el.style.opacity = String(o);
      el.style.transform = `translate3d(0, ${(1 - o) * (p > (a + z) / 2 ? -18 : 18)}px, 0)`;
      el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
    });
  });

  return (
    <div className="chapter-copy" data-phase={phase} aria-live="off">
      {blocks.map((b, i) => (
        <section
          key={b.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className={`copy-block copy-${b.align} copy-${b.id}`}
          style={{ opacity: b.from < 0 ? 1 : 0 }}
        >
          {b.children}
        </section>
      ))}
    </div>
  );
}
