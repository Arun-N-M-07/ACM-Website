/**
 * Team domains. Source: the director cards on https://auceg.acm.org/team.html
 * (domain names are taken from the card image filenames: chair, vc, secretary,
 * treasurer, events, hr, cpwing, vdm, web, exmar, inmar, logi, sponsor, cont).
 *
 * The ORDER below (after `office`) is the order in which domains are assigned
 * to the perimeter bays of the team workspace. `office` always occupies the
 * commons at the entrance.
 *
 * `station` picks the set and the staged moment at the bay (see scenes/team/sets and content/meetings.ts).
 */
export type DomainId =
  | 'office'
  | 'cp-wing'
  | 'web'
  | 'vdm'
  | 'content'
  | 'events'
  | 'hr'
  | 'sponsorship'
  | 'external-marketing'
  | 'internal-marketing'
  | 'logistics';

export type StationKind =
  | 'commons'
  | 'grind'
  | 'terminal-wall'
  | 'studio'
  | 'newsroom'
  | 'stage'
  | 'people-desk'
  | 'pitch'
  | 'outreach'
  | 'poster-wall'
  | 'warehouse';

export interface Domain {
  id: DomainId;
  name: string;
  /** Large wall signage. */
  signage: string;
  /** One line describing the domain's function. Kept generic on purpose. */
  tagline: string;
  station: StationKind;
  accent: string;
}

export const DOMAINS: Domain[] = [
  { id: 'office', name: 'Office Bearers', signage: 'OFFICE BEARERS', tagline: 'Chairperson, Vice Chairperson, Secretary and Treasurer.', station: 'commons', accent: '#b5452f' },
  { id: 'cp-wing', name: 'CP Wing', signage: 'CP WING', tagline: 'Competitive programming.', station: 'grind', accent: '#3d7be0' },
  { id: 'web', name: 'Web & App', signage: 'WEB & APP', tagline: 'Web and app development.', station: 'terminal-wall', accent: '#5b8fd6' },
  { id: 'vdm', name: 'VDM', signage: 'VDM', tagline: 'Design and media.', station: 'studio', accent: '#c9b28f' },
  { id: 'content', name: 'Content', signage: 'CONTENT', tagline: 'Writing, editing and the newsletter.', station: 'newsroom', accent: '#e8e1d4' },
  { id: 'events', name: 'Events', signage: 'EVENTS', tagline: 'Planning and running the chapter’s events.', station: 'stage', accent: '#d4a24c' },
  { id: 'hr', name: 'HR', signage: 'HR', tagline: 'Human resources — the people of the chapter.', station: 'people-desk', accent: '#8c83c4' },
  { id: 'sponsorship', name: 'Sponsorship', signage: 'SPONSORSHIP', tagline: 'Partners and sponsors.', station: 'pitch', accent: '#7f9c86' },
  { id: 'external-marketing', name: 'External Marketing', signage: 'EXTERNAL MARKETING', tagline: 'Outreach beyond campus.', station: 'outreach', accent: '#cf7a58' },
  { id: 'internal-marketing', name: 'Internal Marketing', signage: 'INTERNAL MARKETING', tagline: 'Outreach across CEG.', station: 'poster-wall', accent: '#4f9d95' },
  { id: 'logistics', name: 'Logistics', signage: 'LOGISTICS', tagline: 'Venues, equipment and everything that has to arrive on time.', station: 'warehouse', accent: '#9fb4c9' },
];

export const domainById = (id: DomainId) => DOMAINS.find((d) => d.id === id)!;
/** Domains that count towards "explored everything" (the office is where you arrive). */
export const EXPLORABLE_DOMAINS = DOMAINS.filter((d) => d.id !== 'office');
