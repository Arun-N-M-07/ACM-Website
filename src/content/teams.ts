/**
 * The team's six domains, in the order they appear in the Teams world.
 *
 * Names and members are exactly as supplied by the chapter — do not reorder,
 * shorten or rename them, and do not add roll numbers, photographs, bios or
 * project descriptions here. Anything not yet written is rendered as an
 * explicit [CONTENT PLACEHOLDER] in the detail view.
 *
 * `slug` is only an identifier (keys, deep links); `tone` is the card's glass
 * tint — a design choice, not content.
 */
export interface TeamDomain {
  slug: string;
  /** 1-based position in the world. */
  number: number;
  name: string;
  members: readonly string[];
  tone: string;
}

export const TEAM_DOMAINS: readonly TeamDomain[] = [
  { slug: 'web-and-app-development', number: 1, name: 'WEB AND APP DEVELOPMENT', members: ['Anieshwar Saravanan', 'Prithvi'], tone: '#7f9cc4' },
  { slug: 'competitive-programming-and-technical-development', number: 2, name: 'COMPETITIVE PROGRAMMING AND TECHNICAL DEVELOPMENT', members: ['Renuka Devi A C', 'Suhasri S'], tone: '#8b86c2' },
  { slug: 'events-and-functioning', number: 3, name: 'EVENTS AND FUNCTIONING', members: ['Ananyalakshmi V K', 'Harini J S'], tone: '#c49a86' },
  { slug: 'contents-and-design', number: 4, name: 'CONTENTS AND DESIGN', members: ['Swayamprabha Narayanan', 'Janis Miracline A'], tone: '#b88aa8' },
  { slug: 'hr-and-logistics', number: 5, name: 'HR AND LOGISTICS', members: ['Naveen.O.T', 'Varshhaa'], tone: '#86aaa4' },
  { slug: 'marketing', number: 6, name: 'MARKETING', members: ['Keerthana Kathirvel'], tone: '#b7a37e' },
];

export const DOMAIN_COUNT = TEAM_DOMAINS.length;

export const domainBySlug = (slug: string) => TEAM_DOMAINS.find((d) => d.slug === slug);

/** "01 / 06" */
export const domainIndexLabel = (i: number) => `${String(i + 1).padStart(2, '0')} / ${String(DOMAIN_COUNT).padStart(2, '0')}`;
