/**
 * Meeting the team — what happens at each domain when the visitor arrives.
 *
 * The walk through the workspace is scroll-driven; at every domain the
 * directors stage a short, domain-specific moment. Lines here are what they
 * say (subtitles); `at` is how far through the stop (0..1) the line starts.
 * Lines are light, friendly flavour — edit them freely each year.
 *
 * Screen / board copy for the set pieces also lives here, so the chapter can
 * update it without touching the 3D code.
 */
import type { DomainId } from './domains';

export interface Line {
  /** Team member id (content/team.ts). */
  who: string;
  text: string;
  /** 0..1 through the stop. */
  at: number;
  /** How long it stays up, as a fraction of the stop. */
  dur?: number;
}

export interface Meeting {
  domain: DomainId;
  title: string;
  lines: Line[];
}

export const MEETINGS: Meeting[] = [
  {
    domain: 'office',
    title: 'The welcome',
    lines: [
      { who: 'anagha', text: 'Hey — you made it through the door! Welcome to ACM-CEG.', at: 0.3, dur: 0.24 },
      { who: 'dharaniraj', text: 'Good to have you here.', at: 0.6, dur: 0.14 },
      { who: 'anagha', text: 'The whole team’s in today. Go say hi.', at: 0.78, dur: 0.2 },
    ],
  },
  {
    domain: 'cp-wing',
    title: 'The grind',
    lines: [
      { who: 'deepak', text: 'Hey! Binary search on the answer — pull up a chair.', at: 0.12, dur: 0.26 },
      { who: 'deepan', text: 'Striver’s explaining it better than us anyway.', at: 0.56, dur: 0.22 },
      { who: 'vamsi', text: 'One more problem. Then sleep.', at: 0.8, dur: 0.16 },
    ],
  },
  {
    domain: 'web',
    title: 'The terminal wall',
    lines: [
      { who: 'ganesh', text: 'Oh — hi! Watch this.', at: 0.18, dur: 0.22 },
      { who: 'ganesh', text: 'Fun fact: you’re walking through our build right now.', at: 0.6, dur: 0.34 },
    ],
  },
  {
    domain: 'vdm',
    title: 'The studio',
    lines: [
      { who: 'gabriella', text: 'Hold still…', at: 0.22, dur: 0.14 },
      { who: 'gabriella', text: 'Perfect. That one’s going on the gram.', at: 0.45, dur: 0.18 },
      { who: 'muthu-vaishnavi', text: 'Every poster downstairs started on this screen. Yours too.', at: 0.66, dur: 0.28 },
    ],
  },
  {
    domain: 'content',
    title: 'Hot off the press',
    lines: [
      { who: 'niranjan', text: 'Oh, it’s you!', at: 0.18, dur: 0.12 },
      { who: 'niranjan', text: 'Hot off the press — you made the front page.', at: 0.5, dur: 0.3 },
    ],
  },
  {
    domain: 'events',
    title: 'Showtime',
    lines: [
      { who: 'neelakandan', text: 'Lights… and you’re on!', at: 0.28, dur: 0.2 },
      { who: 'shashank', text: 'Every event we run starts on a stage like this one.', at: 0.62, dur: 0.28 },
    ],
  },
  {
    domain: 'hr',
    title: 'Your badge',
    lines: [
      { who: 'gokul', text: 'There you are. One sec…', at: 0.16, dur: 0.16 },
      { who: 'gokul', text: 'Here — your badge. You’re part of the chapter now.', at: 0.46, dur: 0.3 },
    ],
  },
  {
    domain: 'sponsorship',
    title: 'The pitch',
    lines: [
      { who: 'sahana', text: 'Take a seat — thirty seconds on why brands partner with us.', at: 0.1, dur: 0.22 },
      { who: 'sahana', text: 'And if you know a sponsor… you know where to find us.', at: 0.78, dur: 0.2 },
    ],
  },
  {
    domain: 'external-marketing',
    title: 'Outreach',
    lines: [
      { who: 'samyuktha', text: '…yes, Prodigy, for school students — one sec — hi!', at: 0.18, dur: 0.24 },
      { who: 'samyuktha', text: 'Follow us — @acmceg. That’s where it all goes out.', at: 0.6, dur: 0.26 },
    ],
  },
  {
    domain: 'internal-marketing',
    title: 'Across campus',
    lines: [
      { who: 'shakith', text: 'Open call’s every even semester. Watch —', at: 0.22, dur: 0.22 },
      { who: 'shakith', text: 'Seen our posters around CEG? You will now.', at: 0.64, dur: 0.28 },
    ],
  },
  {
    domain: 'logistics',
    title: 'Everything, on time',
    lines: [
      { who: 'krisna', text: 'Chairs, mics, extension cords…', at: 0.2, dur: 0.24 },
      { who: 'krisna', text: '…and you. Checked in.', at: 0.7, dur: 0.24 },
    ],
  },
];

export const meetingFor = (d: DomainId) => MEETINGS.find((m) => m.domain === d);

/** Copy for the set pieces. */
export const SET_COPY = {
  cpBoard: {
    heading: 'Today: binary search on the answer',
    formulas: [
      'lo = 0, hi = 1e18',
      'while (lo < hi):',
      '   mid = lo + (hi − lo) / 2',
      '   if ok(mid): hi = mid  else: lo = mid + 1',
      'dp[i][j] = min(dp[i−1][j], dp[i][j−1]) + a[i][j]',
      'dist[v] = min(dist[v], dist[u] + w(u,v))',
      'a⁻¹ ≡ a^(p−2) (mod p)',
      'π[i] = max k : s[0..k) = s[i−k+1..i]',
      'T(n) = 2T(n/2) + O(n) ⇒ O(n log n)',
      'seg[x] = seg[2x] + seg[2x+1]',
    ],
  },
  cpVideo: {
    channel: 'take U forward',
    title: 'Binary Search on Answers | Striver’s A2Z DSA Course',
  },
  webScreens: ['npm run build', 'git push origin main', 'app preview', 'auceg.acm.org', 'lighthouse', 'deploy'],
  newspaper: {
    masthead: "STACK'D",
    kicker: 'EXTRA · THE ACM-CEG NEWSLETTER',
    headline: 'Visitor spotted in the ACM-CEG facility',
    deck: 'Walked the events corridor, made it through the door, and — sources confirm — is still scrolling.',
  },
  pitchSlides: [
    { title: 'Partner with ACM-CEG', body: 'The student chapter of the Association for Computing Machinery at CEG, since 2004.' },
    { title: 'Reach', body: '500+ alumni network · 50+ companies' },
    { title: 'CodHer', body: 'A women-only hackathon — with sponsors like Motorq and GitHub.' },
    { title: 'Let’s talk', body: 'acmceg2019@gmail.com' },
  ],
  banner: 'OPEN CALL — EVERY EVEN SEMESTER',
  checklist: ['Venue booked', 'Chairs × 200', 'Mics & PA', 'Extension cords', 'Projector', 'Water & snacks', 'Visitor — checked in'],
} as const;
