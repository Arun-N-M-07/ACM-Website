import { CHAPTER } from '@/content/chapter';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? CHAPTER.siteUrl;

export const SITE_TITLE = 'ACM-CEG Student Chapter | Anna University';

export const SITE_DESCRIPTION =
  'The ACM-CEG Student Chapter at the College of Engineering Guindy, Anna University — since 2004. Travel from the red building to the heart of the chapter: C.O.D.E, Tech Talks, MasterClass, Head Start, PatternX, CodeX, Prodigy, the Open Source Mentorship Program, CodHer and the team behind them.';

export const KEYWORDS = [
  'ACM CEG',
  'ACM-CEG Student Chapter',
  'Anna University',
  'College of Engineering Guindy',
  'computer science club',
  'Prodigy',
  'CodHer',
  'hackathon',
  'competitive programming',
  'Chennai',
];

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: CHAPTER.name,
    alternateName: CHAPTER.shortName,
    url: SITE_URL,
    logo: `${SITE_URL}/brand/acm-ceg-logo-white.png`,
    foundingDate: String(CHAPTER.established),
    email: CHAPTER.contact.email,
    parentOrganization: { '@type': 'CollegeOrUniversity', name: `${CHAPTER.institution}, ${CHAPTER.university}` },
    address: {
      '@type': 'PostalAddress',
      streetAddress: CHAPTER.contact.address[0],
      addressLocality: 'Chennai',
      addressRegion: 'Tamil Nadu',
      postalCode: '600025',
      addressCountry: 'IN',
    },
    sameAs: CHAPTER.socials.map((s) => s.href),
  };
}
