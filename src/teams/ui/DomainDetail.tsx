'use client';
/** Accessible counterpart and controls for the content inside the 3D plate. */
import { useEffect, useRef } from 'react';
import { DOMAIN_COUNT, TEAM_DOMAINS } from '@/content/teams';
import { useProgressFrame } from '@/components/experience/useProgressFrame';
import { closeDomain, stepDomain } from '../focus';
import { teamsFrame, useTeams } from '../state';

export function DomainDetail() {
  const state = useTeams(s => s.state), selected = useTeams(s => s.selected);
  const heading = useRef<HTMLHeadingElement>(null), root = useRef<HTMLDivElement>(null);
  const open = state === 'domainDetail';
  useEffect(() => { if (open) heading.current?.focus({ preventScroll: true }); }, [open, selected]);
  useProgressFrame(() => {
    if (root.current) root.current.style.opacity = String(teamsFrame.domainReveal);
  });
  if (selected === null) return null;
  const d = TEAM_DOMAINS[selected];
  return <div ref={root} className="domain-detail" data-open={open} data-domain={d.slug} data-ui style={{ opacity: 0 }}>
    <article className="sr-only" aria-labelledby="domain-detail-title" aria-hidden={!open}>
      <h2 id="domain-detail-title" ref={heading} tabIndex={-1}>{d.name}</h2>
      <ul>{d.officers ? d.officers.map(o => <li key={o.rollNumber}>{o.role}: {o.name}, {o.rollNumber}</li>) : d.members.map(name => <li key={name}>{name}</li>)}</ul>
    </article>
    <p className="domain-scroll" aria-hidden="true">Scroll to return</p>
    <nav className="domain-controls" aria-label="Domain controls" inert={!open}>
      <button onClick={() => stepDomain(-1)} disabled={!open || selected === 0} aria-label="Previous domain">← Previous</button>
      <button onClick={closeDomain} disabled={!open} aria-label="Close">Return to Teams</button>
      <button onClick={() => stepDomain(1)} disabled={!open || selected === DOMAIN_COUNT - 1} aria-label="Next domain">Next →</button>
    </nav>
  </div>;
}
