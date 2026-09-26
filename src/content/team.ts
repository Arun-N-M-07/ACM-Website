/**
 * The chapter's founder and faculty. Source: https://auceg.acm.org/team.html
 *
 * The student team — the six domains and their members — lives in
 * content/teams.ts (it is what the Teams world is built from).
 */
import { siteMedia, type MediaAsset } from './media';

export interface FacultyMember {
  id: string;
  name: string;
  role: string;
  bio?: string;
  photo: MediaAsset;
}

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
