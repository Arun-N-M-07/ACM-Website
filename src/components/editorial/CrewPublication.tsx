'use client';
import Image from 'next/image';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { CREW_PEOPLE } from '@/content/crewPeople';
import { TEAM_DOMAINS } from '@/content/teams';

/** The index and wall are two views of one identity, not independent hover systems. */
export function CrewPeople({ prefix }: { prefix: string }) {
  const [active, setActive] = useState<string | null>(null);
  const region = useRef<HTMLElement>(null);
  useEffect(() => {
    const outside = (e: globalThis.PointerEvent) => {
      if (e.target instanceof Node && !region.current?.contains(e.target)) setActive(null);
    };
    document.addEventListener('pointerdown', outside, { passive: true });
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  const focused = () => {
    const el = document.activeElement;
    return el instanceof HTMLElement && region.current?.contains(el) ? el.dataset.person ?? null : null;
  };
  const activate = (id: string) => ({
    'data-person': id,
    'data-active': active === id,
    'aria-pressed': active === id,
    onPointerEnter: (e: PointerEvent) => { if (e.pointerType === 'mouse') setActive(id); },
    onFocus: () => setActive(id),
    onClick: () => setActive(id),
  });
  return (
    <section ref={region} className="crew-people" data-has-active={active !== null} aria-labelledby={`${prefix}-people`}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') setActive(focused()); }}
      onPointerDown={(e) => { if (!(e.target instanceof Element && e.target.closest('[data-person]'))) { (document.activeElement as HTMLElement)?.blur(); setActive(null); } }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setActive(null); }}
      onKeyDown={(e) => { if (e.key === 'Escape') { (document.activeElement as HTMLElement)?.blur(); setActive(null); } }}>
      <header className="crew-people-heading">
        <span className="publication-label">The people behind the chapter</span>
        <h2 id={`${prefix}-people`}>The Crew</h2>
        <span className="crew-count" aria-label={`${CREW_PEOPLE.length} people`}>{CREW_PEOPLE.length}</span>
      </header>
      <div className="crew-index" aria-label="People by domain">
        {TEAM_DOMAINS.map((domain) => (
          <section key={domain.slug} id={domain.slug} aria-labelledby={`${prefix}-${domain.slug}`}>
            <h3 id={`${prefix}-${domain.slug}`}><span>{String(domain.number).padStart(2, '0')}</span>{domain.name}</h3>
            <ul>{domain.members.map((name) => {
              const person = CREW_PEOPLE.find((p) => p.name === name)!;
              const role = domain.officers?.find((o) => o.name === name)?.role;
              return <li key={person.id}><button type="button" {...activate(person.id)} aria-controls={`${prefix}-photo-${person.id}`}>
                <span>{person.name}</span>{role && <span className="crew-role">{role}</span>}
              </button></li>;
            })}</ul>
          </section>
        ))}
      </div>
      <ul className="crew-photo-wall" aria-label="Crew photographs">
        {CREW_PEOPLE.map((person) => (
          <li key={person.id}><button type="button" id={`${prefix}-photo-${person.id}`} {...activate(person.id)} aria-label={person.name}>
            {/* Request enough pixels for the 1.8× face-aware framing, not just the grid cell. */}
            <Image src={person.src} alt={person.name} width={1086} height={1448}
              style={{ transformOrigin: `${person.face.cx * 100}% ${person.face.cy * 100}%` }}
              sizes="(max-width: 360px) 170vw, (max-width: 640px) 85vw, (max-width: 1000px) and (max-height: 500px) and (pointer: coarse) 85vw, (max-width: 1000px) 60vw, 30vw" quality={90} loading="lazy" />
            <span className="crew-photo-name" aria-hidden="true">{person.name}</span>
          </button></li>
        ))}
      </ul>
    </section>
  );
}
