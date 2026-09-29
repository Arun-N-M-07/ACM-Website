'use client';
/** The open domain: its people as a hand of cards (MemberHand), and the controls. */
import { useRef } from 'react';
import { DOMAIN_COUNT, TEAM_DOMAINS } from '@/content/teams';
import { smooth, useProgressFrame } from '@/components/experience/useProgressFrame';
import { closeDomain, stepDomain } from '../focus';
import { teamsFrame, useTeams } from '../state';
import { MemberHand } from './MemberHand';

export function DomainDetail() {
  const state = useTeams(s => s.state), selected = useTeams(s => s.selected);
  const root = useRef<HTMLDivElement>(null);
  const open = state === 'domainDetail';
  useProgressFrame(() => {
    // The controls arrive with the end of the deal.
    if (root.current) root.current.style.setProperty('--controls', smooth(0.9, 1, teamsFrame.focus).toFixed(3));
  });
  if (selected === null) return null;
  const d = TEAM_DOMAINS[selected];
  return <div ref={root} className="domain-detail" data-open={open} data-domain={d.slug} data-ui aria-hidden={!open}>
    <MemberHand key={d.slug} domain={d} index={selected} open={open} />
    <p className="domain-scroll" aria-hidden="true">Scroll to return</p>
    <nav className="domain-controls" aria-label="Domain controls" inert={!open}>
      <button onClick={() => stepDomain(-1)} disabled={!open || selected === 0} aria-label="Previous domain">← Previous</button>
      <button onClick={closeDomain} disabled={!open} aria-label="Close">Return to the Crew</button>
      <button onClick={() => stepDomain(1)} disabled={!open || selected === DOMAIN_COUNT - 1} aria-label="Next domain">Next →</button>
    </nav>
  </div>;
}
