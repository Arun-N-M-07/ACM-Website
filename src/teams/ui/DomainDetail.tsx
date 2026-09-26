'use client';
/**
 * The open domain.
 *
 * Not a modal. The camera has dived into the chosen card and settled with it
 * framed off-centre, the world around it sunk into a deep blue-green room;
 * the card's face — the domain's name — is the focal point. The details
 * arrive the way the reference's do: a small mono block in the lower-left
 * that types itself in line by line —
 *
 *   the domain's name
 *   DOMAIN 01 / 06 · 2 MEMBERS          (the meta line)
 *   the members                         (as given — nothing invented)
 *   [CONTENT PLACEHOLDER] × 2           (where the chapter's copy will go)
 *   <- PREV · NEXT ->
 *   <- CLOSE
 *
 * with SCROLL TO CLOSE at the top. Esc, a scroll, a tap off the card, or
 * <- CLOSE all reverse it.
 */
import { useEffect, useRef } from 'react';
import { DOMAIN_COUNT, TEAM_DOMAINS } from '@/content/teams';
import { closeDomain, stepDomain } from '../focus';
import { useTeams } from '../state';
import { TypeIn } from './TypeIn';

export function DomainDetail() {
  const state = useTeams((s) => s.state);
  const selected = useTeams((s) => s.selected);
  const heading = useRef<HTMLHeadingElement>(null);
  const open = state === 'domainDetail';

  useEffect(() => {
    if (open) heading.current?.focus({ preventScroll: true });
  }, [open, selected]);

  if (selected === null) return null;
  const d = TEAM_DOMAINS[selected];
  const n = d.members.length;
  const idx = `${String(selected + 1).padStart(2, '0')} / ${String(DOMAIN_COUNT).padStart(2, '0')}`;
  const base = 0.05;
  // The controls type in last, alongside the second placeholder.
  const controls = base + 0.75 + n * 0.22 + 0.25;
  return (
    <div className="domain-detail" data-open={open} data-ui>
      <p className="domain-scroll" aria-hidden="true">
        {open && <TypeIn text="Scroll to close" delay={0.5} />}
      </p>
      <article className="domain-panel" aria-labelledby="domain-detail-title" key={d.slug}>
        {open && (
          <>
            <h2 id="domain-detail-title" ref={heading} tabIndex={-1} className="domain-title">
              <TypeIn text={d.name} delay={base} />
            </h2>
            <p className="domain-meta">
              <TypeIn text={`Domain ${idx} · ${n} ${n === 1 ? 'member' : 'members'}`} delay={base + 0.3} />
            </p>
            <ul className="domain-members" aria-label="Members">
              {d.members.map((m, i) => (
                <li key={m}>
                  <TypeIn text={m} delay={base + 0.55 + i * 0.22} />
                </li>
              ))}
            </ul>
            <p className="domain-step">
              <button onClick={() => stepDomain(-1)} disabled={selected <= 0} aria-label="Previous domain">
                <TypeIn text="<- Prev" delay={controls} />
              </button>
              <span aria-hidden="true">
                <TypeIn text=" · " delay={controls + 0.1} />
              </span>
              <button onClick={() => stepDomain(1)} disabled={selected >= DOMAIN_COUNT - 1} aria-label="Next domain">
                <TypeIn text="Next ->" delay={controls + 0.14} />
              </button>
            </p>
            <button className="domain-close" onClick={closeDomain} aria-label="Close">
              <TypeIn text="<- Close" delay={controls + 0.3} />
            </button>
          </>
        )}
      </article>
    </div>
  );
}
