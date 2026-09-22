/**
 * The team. Source: https://auceg.acm.org/team.html
 *
 * Director names come from the card image alt text and the LinkedIn profile
 * links on each card; roles/domains come from the card image filenames
 * (the rendered card images carry the exact printed titles — verify against
 * them when updating, see docs/CONTENT.md).
 *
 * NEXT YEAR'S TEAM: replace the `DIRECTORS` array. Nothing in the 3D scene is
 * hard-coded to a person — members take their domain set's roles in order
 * (the first office bearer does the welcome handshake), and what they say is
 * in meetings.ts.
 *
 *   appearance → match to the reference photo (docs/ASSETS.md)
 *   model      → optional GLB path under /public/models/team/
 */
import type { Activity, AvatarAppearance } from './avatar';
import type { DomainId } from './domains';
import { siteMedia, type MediaAsset } from './media';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  domain: DomainId;
  linkedin?: string;
  photo: MediaAsset;
  /** What they're doing at their desk when nobody's meeting them (the sets restage most people). */
  activity: Activity;
  appearance?: Partial<AvatarAppearance>;
  model?: string;
}

export interface FacultyMember {
  id: string;
  name: string;
  role: string;
  bio?: string;
  photo: MediaAsset;
}

const dir = (file: string, name: string) => siteMedia(`team.${file}`, `team/dir/${file}.png`, `${name}, ACM-CEG`);

export const FACULTY: FacultyMember[] = [
  {
    id: 'ranjani-parthasarathi',
    name: 'Dr. Ranjani Parthasarathi',
    role: 'Founder',
    bio: 'Holds a Ph.D. in Electrical Engineering from IIT Madras and an MS in Electrical & Computer Engineering from Illinois Institute of Technology. She served at Anna University Chennai and CEG for over 27 years and founded the ACM-CEG student chapter.',
    photo: siteMedia('faculty.rp', 'team/Faculty/RP_Mam.jpg', 'Dr. Ranjani Parthasarathi'),
  },
  {
    id: 'bama-srinivasan',
    name: 'Dr. Bama Srinivasan',
    role: 'Faculty Head',
    photo: siteMedia('faculty.bama', 'team/Faculty/BAMA_MAM.png', 'Dr. Bama Srinivasan'),
  },
  {
    id: 'arockia-xavier-annie',
    name: 'Dr. R Arockia Xavier Annie',
    role: 'Faculty Head',
    photo: siteMedia('faculty.annie', 'team/Faculty/ANNIE_MAM.png', 'Dr. R Arockia Xavier Annie'),
  },
];

export const DIRECTORS: TeamMember[] = [
  // Office bearers — the chapter's leadership. They shake hands.
  {
    id: 'anagha',
    name: 'Anagha Srikrishna',
    role: 'Chairperson',
    domain: 'office',
    linkedin: 'http://www.linkedin.com/in/anagha-srikrishna-b6a4ba215',
    photo: dir('chair', 'Anagha Srikrishna'),
    activity: 'reviewing',
  },
  {
    id: 'dharaniraj',
    name: 'Dharaniraj',
    role: 'Vice Chairperson',
    domain: 'office',
    linkedin: 'https://www.linkedin.com/in/dharaniraj-vm',
    photo: dir('vc', 'Dharaniraj'),
    activity: 'presenting',
  },
  {
    id: 'karthik',
    name: 'Karthik Krishna',
    role: 'Secretary',
    domain: 'office',
    linkedin: 'https://www.linkedin.com/in/karthik-krishna-1006-',
    photo: dir('secretary', 'Karthik Krishna'),
    activity: 'clipboard',
  },
  {
    id: 'ezhil',
    name: 'Ezhil Dhiraviya J',
    role: 'Treasurer',
    domain: 'office',
    linkedin: 'https://www.linkedin.com/in/ezhil-dhiraviya-j-0b97a9272',
    photo: dir('treasurer', 'Ezhil Dhiraviya J'),
    activity: 'reviewing',
  },

  // Domain directors — they notice you and say hello.
  { id: 'neelakandan', name: 'Neelakandan S', role: 'Director, Events', domain: 'events', linkedin: 'https://www.linkedin.com/in/neelakandan-s-profile', photo: dir('events1', 'Neelakandan S'), activity: 'pointing' },
  { id: 'shashank', name: 'Shashank Narayan Ram', role: 'Director, Events', domain: 'events', linkedin: 'https://www.linkedin.com/in/shashank-narayan-ram/', photo: dir('events2', 'Shashank Narayan Ram'), activity: 'clipboard' },
  { id: 'gokul', name: 'Gokul Kishore T', role: 'Director, HR', domain: 'hr', linkedin: 'https://www.linkedin.com/in/gokul-kishore-t', photo: dir('hr', 'Gokul Kishore T'), activity: 'writing' },
  { id: 'deepak', name: 'Deepak Chandhru', role: 'Director, CP Wing', domain: 'cp-wing', linkedin: 'http://www.linkedin.com/in/deepak-chandhru', photo: dir('cpwing1', 'Deepak Chandhru'), activity: 'typing' },
  { id: 'deepan', name: 'Deepan B', role: 'Director, CP Wing', domain: 'cp-wing', linkedin: 'https://www.linkedin.com/in/deepan-b-449234251/', photo: dir('cpwing2', 'Deepan B'), activity: 'thinking' },
  { id: 'vamsi', name: 'Vamsi Venkat', role: 'Director, CP Wing', domain: 'cp-wing', linkedin: 'http://www.linkedin.com/in/vamsivenkat', photo: dir('cpwing3', 'Vamsi Venkat'), activity: 'typing' },
  { id: 'gabriella', name: 'Gabriella D', role: 'Director, VDM', domain: 'vdm', linkedin: 'https://www.linkedin.com/in/dgabriella', photo: dir('vdm1', 'Gabriella D'), activity: 'sketching' },
  { id: 'muthu-vaishnavi', name: 'Muthu Vaishnavi Anand', role: 'Director, VDM', domain: 'vdm', linkedin: 'http://www.linkedin.com/in/muthu-vaishnavi-anand', photo: dir('vdm2', 'Muthu Vaishnavi Anand'), activity: 'reviewing' },
  { id: 'ganesh', name: 'Ganesh S', role: 'Director, Web', domain: 'web', linkedin: 'https://www.linkedin.com/in/ganesh-s-60ba63339', photo: dir('web2', 'Ganesh S'), activity: 'typing' },
  { id: 'samyuktha', name: 'Samyuktha Senthilkumar', role: 'Director, External Marketing', domain: 'external-marketing', linkedin: 'https://www.linkedin.com/in/samyuktha-senthilkumar-786061260', photo: dir('exmar', 'Samyuktha Senthilkumar'), activity: 'phone' },
  { id: 'shakith', name: 'Shakith A', role: 'Director, Internal Marketing', domain: 'internal-marketing', linkedin: 'https://in.linkedin.com/in/shakith-a-110ba6252', photo: dir('inmar', 'Shakith A'), activity: 'pinning' },
  { id: 'krisna', name: 'Krisna VJ', role: 'Director, Logistics', domain: 'logistics', linkedin: 'http://www.linkedin.com/in/krisna-vj', photo: dir('logi', 'Krisna VJ'), activity: 'clipboard' },
  { id: 'sahana', name: 'Sahana Shanmugam', role: 'Director, Sponsorship', domain: 'sponsorship', linkedin: 'https://www.linkedin.com/in/sahana-shanmugam', photo: dir('sponsor', 'Sahana Shanmugam'), activity: 'presenting' },
  { id: 'niranjan', name: 'Niranjan K', role: 'Director, Content', domain: 'content', linkedin: 'https://www.linkedin.com/in/niranjank2022', photo: dir('cont', 'Niranjan K'), activity: 'writing' },
];

export const membersOf = (domain: DomainId) => DIRECTORS.filter((m) => m.domain === domain);
