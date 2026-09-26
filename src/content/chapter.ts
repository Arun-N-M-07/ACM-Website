/**
 * Chapter-level facts. Source: https://auceg.acm.org (home, contact, alumni pages).
 * Update this file when contact people or social links change.
 */
export const CHAPTER = {
  name: 'ACM-CEG Student Chapter',
  shortName: 'ACM CEG',
  institution: 'College of Engineering Guindy',
  university: 'Anna University',
  city: 'Chennai',
  established: 2004,
  acmFullForm: 'Association for Computing Machinery',
  siteUrl: 'https://auceg.acm.org',

  about:
    'The ACM-CEG Student Chapter, initiated in 2004, aims to instill an unwavering enthusiasm for computer science in students. The club provides a plethora of networking opportunities and helps to seek advice from the top experts in the field. The club has been steadily working to inculcate an unalloyed interest in Computer Science in students and consequently, stimulating the advancement of computer science as a whole.',

  whatIsAcm:
    "The ACM-CEG Student Chapter is a student organization focused on fostering a passion for Computer Science. The club aims to spark interest in the field, regardless of an individual's background, and contribute to the advancement of computer science as a whole.",

  mission:
    'Our mission is to inspire students to learn and master computer science tools, cultivating a genuine passion for the discipline. We are dedicated to removing obstacles, offering clear guidance, and empowering students to achieve their goals.',

  whatWeDo:
    'We organize a variety of events, including CODHER, which promotes female representation in technology, and PRODIGY, which fosters a passion for computer science among school students. We also host webinars and alumni talks to offer insights into new technologies and provide career guidance.',

  membership: {
    openTo: 'Anyone from any department can be a part of this club.',
    fee: 'There is no membership fee to join.',
    howToJoin: 'An open call is conducted annually during the even semesters. Those who attend can become a part of the club.',
  },

  /** Programmes listed in the site FAQ that do not have their own event card. */
  alsoRuns: [
    { name: 'Periodic Sessions', text: 'Cover emerging technologies.' },
    { name: 'Webinars & Alumni Talks', text: 'Insights into new technologies and career guidance.' },
  ],

  /** Email and phone contacts: the chapter's 2026–27 "For further queries" card. */
  contact: {
    email: 'acm.ceg.26@gmail.com',
    phones: [
      { name: 'Visvam Srinivasan', role: 'Chairperson', number: '+91 6385050355' },
      { name: 'Sankara Krishnan P', role: 'Vice-Chairperson', number: '+91 8870393359' },
    ],
    address: ['College of Engineering Guindy', 'Anna University', 'Chennai, Tamil Nadu - 600025'],
    officeNote: 'Our office is located in the Computer Science department building.',
  },

  socials: [
    { label: 'Instagram', handle: '@acmceg', href: 'https://www.instagram.com/acmceg/' },
    { label: 'LinkedIn', handle: 'ACM Student Chapter of CEG', href: 'https://www.linkedin.com/in/acm-ceg/' },
  ],

  /** From the alumni page. */
  legacy: {
    stats: [
      { value: '500+', label: 'Alumni network' },
      { value: '50+', label: 'Companies' },
      { value: '15+', label: 'Years legacy' },
    ],
    text: 'Our alumni have gone on to work at top tech companies including Google, Microsoft, Amazon, and leading startups. They continue to contribute to the computing community through research, innovation, and mentorship.',
  },
} as const;

export const yearsActive = (now = new Date()) => now.getFullYear() - CHAPTER.established;
