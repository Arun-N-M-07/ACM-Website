'use client';
/**
 * The index: fallback navigation for the whole journey — jump to any chapter,
 * any event room, any of the six domains; open the text version; contact.
 */
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { CHAPTERS } from '@/config/timeline';
import { EVENT_ROOMS } from '@/config/world';
import { CHAPTER } from '@/content/chapter';
import { TEAM_DOMAINS } from '@/content/teams';
import { useExperience } from '@/store/experience';
import { goToChapter, goToDomain, goToRoom } from './navigation';
import { useModalFocus } from './useModalFocus';

export function IndexMenu() {
  const open = useExperience((s) => s.menuOpen);
  const set = useExperience((s) => s.set);
  const chapter = useExperience((s) => s.chapter);
  const reduced = useExperience((s) => s.reducedMotion);
  const root = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useModalFocus(open, root);

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
    <div ref={root} className="index" role="dialog" aria-modal="true" aria-label="Explore the chapter" data-lenis-prevent>
      <div className="index-head">
        <p className="kicker">ACM–CEG / Field guide</p>
        <button ref={closeRef} className="btn" onClick={() => set({ menuOpen: false })}>
          Close ✕
        </button>
      </div>
      <div className="index-intro"><h2>Follow your <em>curiosity.</em></h2><p>Travel the world at your own pace.<br />Every room has a story. Every domain has a place.</p></div>
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
            {EVENT_ROOMS.map((r) => (
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
        <nav aria-label="Meet the crew">
          <p className="kicker">Meet the crew</p>
          <ol className="index-rooms">
            {TEAM_DOMAINS.map((d, i) => (
              <li key={d.slug}>
                <button onClick={() => goToDomain(i)}>
                  <i style={{ background: d.tone }} aria-hidden="true" />
                  <span>{d.name}</span>
                  <em>{d.members.join(' · ')}</em>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div>
          <p className="kicker">Contact us</p>
          <ul className="index-more index-contact">
            <li>
              <a className="text-link" href={`mailto:${CHAPTER.contact.email}`}>
                {CHAPTER.contact.email}
              </a>
            </li>
            {CHAPTER.contact.phones.map((p) => (
              <li key={p.number}>
                <span className="who">{p.name}</span>
                <span className="role">{p.role}</span>
                <a className="text-link" href={`tel:${p.number.replace(/\s/g, '')}`}>
                  {p.number}
                </a>
              </li>
            ))}
          </ul>
          <p className="kicker">Follow us on</p>
          <ul className="index-more">
            <li>
              <a className="text-link" href={CHAPTER.siteUrl} target="_blank" rel="noopener noreferrer">
                {CHAPTER.siteUrl.replace(/^https?:\/\//, '')} ↗
              </a>
            </li>
            {CHAPTER.socials.map((s) => (
              <li key={s.href}>
                <a className="text-link" href={s.href} target="_blank" rel="noopener noreferrer">
                  {s.label} · {s.handle} ↗
                </a>
              </li>
            ))}
          </ul>
          <p className="kicker">Everything else</p>
          <ul className="index-more">
            <li>
              <button className="text-link" onClick={() => set({ textVersionOpen: true, menuOpen: false })}>
                Text version — the whole chapter as a page
              </button>
            </li>
            <li>
              <Link className="text-link" href="/archive" prefetch={false}>
                Open the printed edition ↗
              </Link>
            </li>
            <li className="credit">
              Campus map data ©{' '}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
                OpenStreetMap contributors
              </a>{' '}
              (ODbL)
            </li>
          </ul>
          <button className="btn index-motion" aria-pressed={reduced} onClick={() => set({ reducedMotion: !reduced })}>{reduced ? 'Reduced motion on' : 'Enable reduced motion'}</button>
          <p className="kicker">Keys</p>
          <ul className="index-keys">
            <li>
              <span className="kbd">Scroll</span> / <span className="kbd">Space</span> travel · hold the portal to enter the Crew
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
