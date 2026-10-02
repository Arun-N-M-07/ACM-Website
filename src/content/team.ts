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
  /** Original image dimensions: reserve the correct ratio without cropping portraits. */
  photoSize: readonly [number, number];
}

export const FACULTY: FacultyMember[] = [
  {
    id: 'ranjani-parthasarathi',
    name: 'Dr. Ranjani Parthasarathi',
    role: 'Founder',
    bio: 'Holds a Ph.D. in Electrical Engineering from IIT Madras and an MS in Electrical & Computer Engineering from Illinois Institute of Technology. She served at Anna University Chennai and CEG for over 27 years and founded the ACM-CEG student chapter.',
    photo: siteMedia('faculty.rp', 'team/Faculty/RP_Mam.jpg', 'Dr. Ranjani Parthasarathi'),
    photoSize: [336, 393],
  },
  {
    id: 'bama-srinivasan',
    name: 'Dr. Bama Srinivasan',
    role: 'Faculty Head',
    bio: 'Serves as an Associate Professor in Anna University\'s Department of Information Science and Technology. Her interests include artificial intelligence, free and open-source software, and Indian philosophical logic, with research on formal representations of actions and instructions.',
    photo: siteMedia('faculty.bama', 'team/Faculty/BAMA_MAM.png', 'Dr. Bama Srinivasan'),
    photoSize: [1254, 1254],
  },
  {
    id: 'arockia-xavier-annie',
    name: 'Dr. R Arockia Xavier Annie',
    role: 'Faculty Head',
    bio: 'Serves as an Associate Professor in Anna University\'s Department of Computer Science and Engineering. Her research spans multimedia systems and networks, video processing, data mining and analytics, and applications of artificial intelligence and machine learning.',
    photo: siteMedia('faculty.annie', 'team/Faculty/ANNIE_MAM.png', 'Dr. R Arockia Xavier Annie'),
    photoSize: [1254, 1254],
  },
];
