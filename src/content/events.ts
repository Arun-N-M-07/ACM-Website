/**
 * Events & programmes.
 *
 * Source: https://auceg.acm.org/events.html (cards + "Read More" descriptions),
 * the home page flagship section, the FAQ, and prodigy.html; the 2026 lineup
 * and the Prodigy 2026 programme from the chapter.
 *
 * `EVENTS` is this year's lineup — the rooms in the Events matrix underground,
 * the index, the printed archive and the /events pages. Its ORDER is the
 * matrix's: row by row from the top left (config/world: EVENT_ROOMS), and the
 * order "Visit next" follows; `flagship: true` rooms are larger and taller
 * (their bays add a lintel over them).
 *
 * To add an event: add an object to EVENTS where it belongs in the lineup, and
 * give it an `artifact` — its room's installation (scenes/events/exhibits).
 * (The matrix is three to a row: a tenth event starts a fourth row.)
 */
import { MEDIA, type MediaAsset } from './media';
import { PRODIGY_PROGRAMME } from './prodigy';

export type RoomArtifact = 'blocks' | 'leaderboard' | 'interview' | 'lectern' | 'puzzle-wall' | 'hack-tables' | 'voices' | 'sequence' | 'contribution-graph';

export interface EventFact {
  label: string;
  value: string;
}

export interface EventLink {
  label: string;
  href: string;
}

export interface EventRecord {
  slug: string;
  title: string;
  /** Tag shown on the source site's card, e.g. "Training". */
  kind: string;
  /** Second tag on the source card, e.g. "Semester Program". */
  cadence: string;
  flagship?: boolean;
  /** One-line card summary from the source site. */
  summary: string;
  /** Full "Read More" description from the source site. */
  description: string;
  facts: EventFact[];
  links: EventLink[];
  image?: MediaAsset;
  /** Room accent colour (used sparingly: floor inlay, light temperature, poster). */
  accent: string;
  artifact: RoomArtifact;
  /** Optional list of sub-events shown inside the room. */
  programme?: { title: string; text: string }[];
}

/** The 2026 lineup, in order. */
export const EVENTS: EventRecord[] = [
  {
    slug: 'code',
    title: 'C.O.D.E',
    kind: 'Training',
    cadence: 'Semester Program',
    summary: 'A transformative program with curated problem sheets and contests to prepare students for internship and placement interviews.',
    description:
      'Embark on a transformative journey with C.O.D.E, our premier event meticulously crafted to equip students for internship and placement interviews. C.O.D.E aims to empower participants by immersing them in carefully curated problem sheets, thoughtfully categorized by topics, fostering skill fortification across crucial areas. Engage in distinct contests tailored to each topic, providing a laser-focused mastery experience. The grand finale contest awaits to evaluate your comprehensive understanding and showcase your prowess. Access exclusive materials encompassing vital interview aspects such as OS, DBMS, Networks, and System Design. C.O.D.E aspires to guide you through this process with experienced mentors assigned throughout the event. Elevate your preparation through a mock interview experience, ensuring you emerge truly interview-ready.',
    facts: [
      { label: 'For', value: 'Pre-final and final year students' },
      { label: 'Covers', value: 'OS · DBMS · Networks · System Design' },
      { label: 'Ends with', value: 'Grand finale contest · mock interviews' },
    ],
    links: [],
    image: MEDIA.eventCode,
    accent: '#7f9c86',
    artifact: 'interview',
  },
  {
    slug: 'tech-talks',
    title: 'Tech Talks',
    kind: 'Talk',
    cadence: 'Session Series',
    summary: 'A series of sessions conducted by alumni, industry experts and researchers on varied topics in Computer Science.',
    description: 'Tech Talks is a series of sessions conducted by alumni, industry experts and researchers on varied topics in Computer Science.',
    facts: [
      { label: 'Speakers', value: 'Alumni · industry experts · researchers' },
      { label: 'Topics', value: 'Varied topics in Computer Science' },
    ],
    links: [],
    accent: '#d9774a',
    artifact: 'voices',
  },
  {
    slug: 'masterclass',
    title: 'MasterClass',
    kind: 'Talk',
    cadence: 'Guest Sessions',
    summary: 'Sessions with alumni sharing insights on higher studies and career paths.',
    description:
      "Elevate your academic aspirations with \"Masterclass,\" a unique event featuring insightful sessions led by students pursuing master's degrees in diverse fields. Explore firsthand experiences from individuals in Computer Science, AI, ECE and even MBA, gaining valuable insights on pursuing specific degrees and planning for the future. Beyond sharing experiences, Masterclass equips participants with GRE preparation materials, empowering them to navigate the graduate school application process. Access a wealth of resources, including GRE study materials and informative articles, to guide your path towards higher education. Join Masterclass to glean wisdom from those who have walked the master's journey and embark on your own educational odyssey with confidence.",
    facts: [
      { label: 'Speakers', value: "Alumni pursuing master's degrees" },
      { label: 'Fields', value: 'Computer Science · AI · ECE · MBA' },
      { label: 'Resources', value: 'GRE preparation material' },
    ],
    links: [],
    image: MEDIA.eventMasterclass,
    accent: '#c9b28f',
    artifact: 'lectern',
  },
  {
    slug: 'head-start',
    title: 'Head Start',
    kind: 'Workshop',
    cadence: 'Beginner Program',
    summary: 'A beginner-friendly program for first-year students to learn programming logic and data structures.',
    description:
      'Head Start is a tailored event designed exclusively for first-year students. Similar to CodeX, this initiative prioritizes the unique needs of beginners, offering challenges and problem sets curated to align with their introductory programming and basic data structure understanding. Through Head Start, first-year students are guided through a learning journey that familiarizes them with programming logic and essential data structures. Join us in laying the foundation for a successful coding journey and witness the transformative experience of diving into the world of programming at its very beginning.',
    facts: [
      { label: 'For', value: 'First-year students' },
      { label: 'Focus', value: 'Programming logic · basic data structures' },
      { label: 'Goal', value: 'Fundamentals of DSA for competitive programming' },
    ],
    links: [],
    image: MEDIA.eventHeadStart,
    accent: '#9fb4c9',
    artifact: 'blocks',
  },
  {
    slug: 'patternx',
    title: 'PatternX',
    kind: 'Training',
    cadence: 'Beginner Series',
    summary: 'A beginner series conducted as a precursor to CodeX, guiding students on how to find patterns and problem solve.',
    description: 'PatternX is a beginner series conducted as a precursor to CodeX, to guide students on how to find patterns and problem solve.',
    facts: [
      { label: 'For', value: 'Beginners' },
      { label: 'Focus', value: 'Finding patterns · problem solving' },
      { label: 'Leads into', value: 'CodeX' },
    ],
    links: [],
    accent: '#a98ad6',
    artifact: 'sequence',
  },
  {
    slug: 'codex',
    title: 'CodeX',
    kind: 'Competition',
    cadence: 'Monthly Series',
    summary: 'A series of competitive programming contests with editorials and sessions on algorithms and data structures.',
    description:
      "CodeX is our dedicated event tailored to enhance students' competitive programming skills. CodeX revolves around a series of challenging contests designed to assess participants' problem-solving abilities. Dive into the world of competitive programming with insightful editorials for each contest, offering valuable perspectives on optimal problem-solving approaches. CodeX goes beyond contests by hosting informative sessions covering the best algorithms, mathematical concepts, and data structures essential for mastering competitive programming. Additionally, gain valuable insights into the prestigious International Collegiate Programming Contest (ICPC) through exclusive information sessions. Join CodeX to sharpen your coding prowess and unlock the secrets to success in the dynamic realm of competitive programming.",
    facts: [
      { label: 'Format', value: 'Contest series with editorials' },
      { label: 'Sessions', value: 'Algorithms · mathematics · data structures' },
      { label: 'Also', value: 'ICPC information sessions' },
    ],
    links: [],
    image: MEDIA.eventCodex,
    accent: '#3d7be0',
    artifact: 'leaderboard',
  },
  {
    slug: 'prodigy',
    title: 'Prodigy',
    kind: 'Competition',
    cadence: 'Annual Event',
    flagship: true,
    summary: 'A state-level technical event for high school students to explore computing trends.',
    description:
      'Prodigy, an annual state-level technical event organized by the ACM-CEG chapter at Anna University, is a pioneering initiative designed exclusively for students in grades 9-12. Rooted in the ethos of promoting technological awareness and fostering a passion for computer science, Prodigy goes beyond traditional education, providing a dynamic platform for young minds to delve into the exciting realms of computing and technology. Over the span of more than 15 years, Prodigy has transcended its identity as a mere technical event; it has evolved into a transformative experience. By reaching out to schools and students across the state, Prodigy has become a beacon of inspiration, sparking a passion for technology that extends far beyond the duration of the event. The legacy of Prodigy is etched in the minds of those who have participated, fostering a community of young enthusiasts who are not just consumers but creators in the world of technology.',
    facts: [
      { label: 'For', value: 'School students, grades 9–12' },
      { label: 'Scale', value: 'Annual · state-level' },
      { label: 'Legacy', value: 'More than 15 years' },
    ],
    links: [
      { label: 'School registration', href: 'https://forms.gle/B28ropzrbtBJhhu57' },
      { label: 'Student registration', href: 'https://forms.gle/Wq9mtdzBJwwWNTB5A' },
      { label: 'Prodigy page', href: 'https://auceg.acm.org/prodigy.html' },
    ],
    image: MEDIA.eventProdigy,
    accent: '#b5452f',
    artifact: 'puzzle-wall',
    programme: PRODIGY_PROGRAMME,
  },
  {
    slug: 'open-source-mentorship-program',
    title: 'Open Source Mentorship Program',
    kind: 'Mentorship',
    cadence: 'Cohort Program',
    summary: 'A collaborative initiative with GDG-AU where former GSoC contributors mentor a cohort of students in open source.',
    description:
      'The Open Source Mentorship Program is a collaborative initiative with GDG-AU where former GSoC contributors mentor a cohort of students on how to contribute to open source and apply for prestigious programs such as GSoC.',
    facts: [
      { label: 'With', value: 'GDG-AU' },
      { label: 'Mentors', value: 'Former GSoC contributors' },
      { label: 'Goal', value: 'Contributing to open source · applying to programs such as GSoC' },
    ],
    links: [],
    accent: '#5fb58a',
    artifact: 'contribution-graph',
  },
  {
    slug: 'codher',
    title: 'CodHer',
    kind: 'Competition',
    cadence: 'Annual Event',
    flagship: true,
    summary: 'CodHer is a women-only hackathon empowering female developers through innovation and collaboration.',
    description:
      'Empowerment takes center stage at CodHer, our exclusive women-only hackathon designed to inspire and motivate female developers to actively engage in the dynamic world of hackathons. Providing a dedicated platform for female talent, CodHer is a showcase of skills, innovation, and collaboration. With renowned sponsors like Motorq and GitHub, participants have the opportunity to compete for cash prizes exceeding 50k, along with the chance to secure coveted internships. Join CodHer and become a part of a supportive community, celebrating the prowess of women in the tech space and encouraging their active participation in the ever-evolving landscape of hackathons.',
    facts: [
      { label: 'Format', value: 'Women-only hackathon' },
      { label: 'Prizes', value: 'Cash prizes exceeding 50k · internships' },
      { label: 'Sponsors', value: 'Motorq · GitHub' },
    ],
    links: [
      { label: 'Register', href: 'https://codher.in/' },
      { label: 'Explore CodHer', href: 'https://aucodher.vercel.app/' },
    ],
    image: MEDIA.eventCodher,
    accent: '#d4a24c',
    artifact: 'hack-tables',
  },
];

export const FLAGSHIPS = EVENTS.filter((e) => e.flagship);
export const eventBySlug = (slug: string) => EVENTS.find((e) => e.slug === slug);
