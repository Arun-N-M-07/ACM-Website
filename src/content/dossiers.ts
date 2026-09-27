/**
 * The deeper layer of each event's dossier: how the programme works, what it
 * connects to, and one line on its role.
 *
 * Everything here restructures what the event's own record (events.ts,
 * prodigy.ts) already says — it adds no dates, numbers, people or claims. A
 * flow marked `reading` is the exhibition's way of showing the idea (what the
 * room performs), not the programme's syllabus, and the dossier labels it so.
 */

export interface DossierStep {
  title: string;
  note?: string;
}

export interface DossierFlow {
  label: string;
  /** 'sequence' reads as steps in order; 'set' as parts side by side. */
  kind: 'sequence' | 'set';
  steps: DossierStep[];
  /** The exhibition's reading of the idea, not the record's wording. */
  reading?: boolean;
}

export interface Dossier {
  /** One editorial line on the programme's role, drawn from its record. */
  character: string;
  flows: DossierFlow[];
  /** Other ACM-CEG programmes the records connect it to, and how. */
  related?: { slug: string; note: string }[];
  /** Other organisations its record names. */
  with?: string[];
}

export const DOSSIERS: Record<string, Dossier> = {
  code: {
    character: 'Interview preparation, organised as a semester of practice.',
    flows: [
      {
        label: 'How it runs',
        kind: 'sequence',
        steps: [
          { title: 'Problem sheets', note: 'Curated, and categorised by topic' },
          { title: 'Topic contests', note: 'A contest for each topic' },
          { title: 'Interview material', note: 'OS · DBMS · Networks · System Design' },
          { title: 'Grand finale', note: 'A contest to evaluate the whole' },
          { title: 'Mock interview', note: 'With mentors assigned throughout' },
        ],
      },
    ],
  },
  'tech-talks': {
    character: 'Many voices on one subject — computer science, in its variety.',
    flows: [
      {
        label: 'Conducted by',
        kind: 'set',
        steps: [{ title: 'Alumni' }, { title: 'Industry experts' }, { title: 'Researchers' }],
      },
    ],
  },
  masterclass: {
    character: "The road to a master's degree, told by those already on it.",
    flows: [
      {
        label: 'What a session gives',
        kind: 'sequence',
        steps: [
          { title: 'Firsthand experience', note: "From alumni pursuing master's degrees" },
          { title: 'Across fields', note: 'Computer Science · AI · ECE · MBA' },
          { title: 'Planning', note: 'Pursuing a specific degree, and what comes after' },
          { title: 'Resources', note: 'GRE preparation material and articles' },
          { title: 'Applications', note: 'Navigating the graduate-school process' },
        ],
      },
    ],
  },
  'head-start': {
    character: 'Where the first year begins: the fundamentals, before anything else.',
    flows: [
      {
        label: 'The journey',
        kind: 'sequence',
        steps: [
          { title: 'First year', note: 'Designed for first-year students' },
          { title: 'Challenges & problem sets', note: 'Curated for beginners' },
          { title: 'Programming logic' },
          { title: 'Essential data structures' },
          { title: 'A foundation', note: 'For the coding journey ahead' },
        ],
      },
    ],
    related: [{ slug: 'codex', note: 'Head Start is designed similar to CodeX, for first-year students.' }],
  },
  patternx: {
    character: 'The step before CodeX: learning to see the pattern in a problem.',
    flows: [
      {
        label: 'How the room reads it',
        kind: 'sequence',
        reading: true,
        steps: [{ title: 'Observe' }, { title: 'Identify' }, { title: 'Understand' }, { title: 'Solve' }, { title: 'CodeX' }],
      },
    ],
    related: [{ slug: 'codex', note: 'PatternX is conducted as a precursor to CodeX.' }],
  },
  codex: {
    character: 'Competitive programming, month by month: contest, editorial, session.',
    flows: [
      {
        label: 'Each round',
        kind: 'sequence',
        steps: [
          { title: 'Contest', note: "Problems that assess problem-solving" },
          { title: 'Editorial', note: 'The optimal approaches, for every contest' },
          { title: 'Sessions', note: 'Algorithms · mathematics · data structures' },
        ],
      },
      {
        label: 'Beyond the contests',
        kind: 'set',
        steps: [{ title: 'ICPC', note: 'Information sessions on the International Collegiate Programming Contest' }],
      },
    ],
    related: [
      { slug: 'patternx', note: 'Its precursor: a beginner series on finding patterns.' },
      { slug: 'head-start', note: 'Designed similar to CodeX, for first-year students.' },
    ],
  },
  prodigy: {
    character: 'Computer science, carried to schools across the state — for more than fifteen years.',
    flows: [
      {
        label: 'The event',
        kind: 'set',
        steps: [
          { title: 'For', note: 'Students in grades 9–12' },
          { title: 'Reach', note: 'Schools and students across the state' },
          { title: 'Aim', note: 'Technological awareness, and a passion for computer science' },
        ],
      },
    ],
  },
  'open-source-mentorship-program': {
    character: 'Open source, learned from those who have done it — former GSoC contributors, mentoring a cohort.',
    flows: [
      {
        label: 'How it works',
        kind: 'sequence',
        steps: [
          { title: 'A collaboration', note: 'ACM-CEG with GDG-AU' },
          { title: 'Mentors', note: 'Former GSoC contributors' },
          { title: 'A cohort', note: 'Students, mentored together' },
          { title: 'Contributing', note: 'How to contribute to open source' },
          { title: 'Applying', note: 'To prestigious programs such as GSoC' },
        ],
      },
      {
        label: 'What the room shows',
        kind: 'sequence',
        reading: true,
        steps: [{ title: 'Issue' }, { title: 'Contribution' }, { title: 'Review' }, { title: 'Merge' }],
      },
    ],
    with: ['GDG-AU'],
  },
  codher: {
    character: 'A dedicated platform for women developers, in the world of hackathons.',
    flows: [
      {
        label: 'The hackathon',
        kind: 'set',
        steps: [
          { title: 'Format', note: 'Women-only hackathon' },
          { title: 'Prizes', note: 'Cash prizes exceeding 50k, and internships' },
          { title: 'Sponsors', note: 'Motorq · GitHub' },
        ],
      },
    ],
  },
};
