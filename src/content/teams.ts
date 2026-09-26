/**
 * CORE followed by the team's six domains, in the order they appear in the Teams world.
 *
 * Names and members are exactly as supplied by the chapter — do not reorder,
 * shorten or rename them. CORE roles and roll numbers are chapter-supplied;
 * no photographs, bios or project descriptions are invented.
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
  officers?: readonly { role: string; name: string; rollNumber: string }[];
}

export const CORE_OFFICERS = [
  { role: 'CHAIRPERSON', name: 'Visvam Srinivasan', rollNumber: '2023103004' },
  { role: 'VICE CHAIRPERSON', name: 'Sankara Krishnan P', rollNumber: '2023115074' },
  { role: 'SECRETARY', name: 'Purushothaman V', rollNumber: '2023115035' },
  { role: 'TREASURER', name: 'Manesh Ram', rollNumber: '2023103037' },
] as const;

export const TEAM_DOMAINS: readonly TeamDomain[] = [
  { slug: 'core', number: 1, name: 'CORE', members: CORE_OFFICERS.map((p) => p.name), officers: CORE_OFFICERS, tone: '#c6b89d' },
  { slug: 'web-and-app-development', number: 2, name: 'WEB AND APP DEVELOPMENT', members: ['Anieshwar Saravanan', 'Prithvi'], tone: '#7f9cc4' },
  { slug: 'competitive-programming-and-technical-development', number: 3, name: 'COMPETITIVE PROGRAMMING AND TECHNICAL DEVELOPMENT', members: ['Renuka Devi A C', 'Suhasri S'], tone: '#8b86c2' },
  { slug: 'events-and-functioning', number: 4, name: 'EVENTS AND FUNCTIONING', members: ['Ananyalakshmi V K', 'Harini J S'], tone: '#c49a86' },
  { slug: 'contents-and-design', number: 5, name: 'CONTENTS AND DESIGN', members: ['Swayamprabha Narayanan', 'Janis Miracline A'], tone: '#b88aa8' },
  { slug: 'hr-and-logistics', number: 6, name: 'HR AND LOGISTICS', members: ['Naveen.O.T', 'Varshhaa'], tone: '#86aaa4' },
  { slug: 'marketing', number: 7, name: 'MARKETING', members: ['Keerthana Kathirvel'], tone: '#b7a37e' },
];

export const DOMAIN_COUNT = TEAM_DOMAINS.length;

export const domainBySlug = (slug: string) => TEAM_DOMAINS.find((d) => d.slug === slug);

/** "01 / 07" */
export const domainIndexLabel = (i: number) => `${String(i + 1).padStart(2, '0')} / ${String(DOMAIN_COUNT).padStart(2, '0')}`;
