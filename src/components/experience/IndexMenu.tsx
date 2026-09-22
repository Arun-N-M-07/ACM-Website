'use client';
/**
 * The index: fallback navigation for the whole journey — jump to any chapter,
 * any event room, the team or the core; open the text version; contact.
 */
import { useEffect, useRef } from 'react';
import { CHAPTERS } from '@/config/timeline';
import { CORRIDOR } from '@/config/world';
import { CHAPTER } from '@/content/chapter';
import { DOMAINS } from '@/content/domains';
import { useExperience } from '@/store/experience';
import { goToChapter, goToDomain, goToRoom } from './navigation';

export function IndexMenu() {
  const open = useExperience((s) => s.menuOpen);
  const set = useExperience((s) => s.set);
  const chapter = useExperience((s) => s.chapter);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') set({ menuOpen: false });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, set]);

  if (!open) return null;
  return (
    <div className="index" role="dialog" aria-modal="true" aria-label="Index" data-lenis-prevent>
      <div className="index-head">
        <p className="kicker">Index</p>
        <button ref={closeRef} className="btn" onClick={() => set({ menuOpen: false })}>
          Close ✕
        </button>
      </div>
      <div className="index-grid">
        <nav aria-label="Chapters">
          <p className="kicker">The journey</p>
          <ol className="index-chapters">
            {CHAPTERS.map((c) => (
              <li key={c.id} className={c.id === chapter ? 'current' : ''}>
                <button onClick={() => goToChapter(c.id)}>
                  <span className="num">{c.number}</span>
                  <span className="label">{c.label}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <nav aria-label="Event rooms">
          <p className="kicker">Event rooms</p>
          <ol className="index-rooms">
            {CORRIDOR.rooms.map((r) => (
              <li key={r.event.slug}>
                <button onClick={() => goToRoom(r.index)}>
                  <i style={{ background: r.event.accent }} aria-hidden="true" />
                  <span>{r.event.title}</span>
                  <em>{r.event.kind}</em>
                </button>
                <button className="text-link small" onClick={() => set({ dossier: r.event.slug, menuOpen: false })}>
                  Dossier
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <nav aria-label="Meet the team">
          <p className="kicker">Meet the team</p>
          <ol className="index-rooms">
            {DOMAINS.map((d) => (
              <li key={d.id}>
                <button onClick={() => goToDomain(d.id)}>
                  <i style={{ background: d.accent }} aria-hidden="true" />
                  <span>{d.id === 'office' ? 'The welcome' : d.name}</span>
                  <em>{d.id === 'office' ? d.name : d.tagline.replace(/\.$/, '')}</em>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div>
          <p className="kicker">Everything else</p>
          <ul className="index-more">
            <li>
              <button className="text-link" onClick={() => set({ textVersionOpen: true, menuOpen: false })}>
                Text version — the whole chapter as a page
              </button>
            </li>
            <li>
              <a className="text-link" href="/archive">
                Printed edition (/archive)
              </a>
            </li>
            <li>
              <a className="text-link" href={`mailto:${CHAPTER.contact.email}`}>
                {CHAPTER.contact.email}
              </a>
            </li>
            {CHAPTER.socials.map((s) => (
              <li key={s.href}>
                <a className="text-link" href={s.href} target="_blank" rel="noopener noreferrer">
                  {s.label} ↗
                </a>
              </li>
            ))}
            <li className="credit">
              Campus map data ©{' '}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
                OpenStreetMap contributors
              </a>{' '}
              (ODbL)
            </li>
          </ul>
          <p className="kicker">Keys</p>
          <ul className="index-keys">
            <li>
              <span className="kbd">Scroll</span> / <span className="kbd">Space</span> travel — and walk the team
            </li>
            <li>
              <span className="kbd">N</span> / <span className="kbd">P</span> next / previous stop
            </li>
            <li>
              <span className="kbd">M</span> index · <span className="kbd">T</span> text version
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
