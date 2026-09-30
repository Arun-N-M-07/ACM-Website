'use client';
/** The open domain: its people as a hand of cards (MemberHand), and the controls. */
import { useEffect, useRef } from 'react';
import { DOMAIN_COUNT, TEAM_DOMAINS } from '@/content/teams';
import { smooth, useProgressFrame } from '@/components/experience/useProgressFrame';
import { closeDomain, stepDomain } from '../focus';
import { teamsFrame, useTeams } from '../state';
import { MemberHand, preloadCrewPortraits } from './MemberHand';

export function DomainDetail() {
  const state = useTeams(s => s.state), selected = useTeams(s => s.selected);
  const root = useRef<HTMLDivElement>(null);
  const open = state === 'domainDetail';
  // The people's portraits are fetched as the visitor comes to the portal (or round the loop into the
  // Crew), so a domain opens on its people.
  useEffect(() => {
    const ahead = (s: { state: string }) => s.state !== 'outside' && preloadCrewPortraits();
    ahead(useTeams.getState());
    return useTeams.subscribe(ahead);
  }, []);
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
