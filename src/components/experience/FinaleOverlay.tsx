'use client';
/** The ending, inside the core: appears once you've walked in and turned to the model. */
import { useState } from 'react';
import { CHAPTER, yearsActive } from '@/content/chapter';
import { NEWSLETTER } from '@/content/newsletter';
import { useExperience } from '@/store/experience';
import { TOUR_STOPS, tourProgress } from '@/systems/camera/tour';
import { backToJourney } from './navigation';
import { useProgressFrame } from './useProgressFrame';

const SHOW_AT = tourProgress(TOUR_STOPS.length - 1, 0.28);

export function FinaleOverlay() {
  const phase = useExperience((s) => s.phase);
  const set = useExperience((s) => s.set);
  const [shown, setShown] = useState(false);
  useProgressFrame((p) => {
    const want = p >= SHOW_AT;
    if (want !== shown) setShown(want);
  });
  if (!shown || phase !== 'cinematic') return null;
  return (
    <section className="finale" aria-labelledby="finale-title">
      <p className="kicker">09 · The core · {yearsActive()} years under the red building</p>
      <h2 id="finale-title" className="finale-title">
        <span>ACM</span>
        <span>CEG</span>
      </h2>
      <p className="finale-words">
        <span>Learn.</span> <span>Build.</span> <span>Connect.</span>
      </p>
      <p className="body">
        Since {CHAPTER.established}. {CHAPTER.whatWeDo}
      </p>
      <p className="body muted">{CHAPTER.membership.openTo} {CHAPTER.membership.fee}</p>
      <ul className="finale-links">
        <li>
          <a href={`mailto:${CHAPTER.contact.email}`}>{CHAPTER.contact.email}</a>
        </li>
        {CHAPTER.socials.map((s) => (
          <li key={s.href}>
            <a href={s.href} target="_blank" rel="noopener noreferrer">
              {s.label} ↗
            </a>
          </li>
        ))}
        <li>
          <a href={NEWSLETTER.archiveUrl} target="_blank" rel="noopener noreferrer">
            {NEWSLETTER.title} newsletter ↗
          </a>
        </li>
        <li>
          <button className="text-link" onClick={() => set({ textVersionOpen: true })}>
            Read everything
          </button>
        </li>
        <li>
          <button className="text-link" onClick={() => backToJourney(0)}>
            Start again from the red building
          </button>
        </li>
      </ul>
    </section>
  );
}
