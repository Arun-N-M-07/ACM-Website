/**
 * Prodigy sub-events. Source: "Detailed Description — Prodigy 2026 Events"
 * (the chapter's Prodigy 2026 document): four technical events, then four
 * non-technical ones, in the document's order and with its names.
 * Shown on the puzzle wall and chalkboards inside the Prodigy room, on the
 * Prodigy event page and in the archive.
 */
export type ProdigyTrack = 'Technical' | 'Non-Technical';

export const PRODIGY_PROGRAMME: { title: string; text: string; track: ProdigyTrack }[] = [
  {
    title: 'Mind Rush',
    track: 'Technical',
    text: 'Two rounds, teams of 2–3. Round 1 (rolling) is a STEM escape room: interactive booths of hands-on Physics, Chemistry and Maths challenges, each solved puzzle unlocking a clue towards a final master riddle. The top 8 teams enter Round 2, an elimination arena where teams spend points to challenge one another in tech and non-tech mini-games; the highest score takes the crown.',
  },
  {
    title: 'The End Game',
    track: 'Technical',
    text: 'Two rounds, teams of 2–3. Round 1 (rolling) is a written, escape-room-style qualifier without code: broken flowcharts, sequential logic grids and “checkmate” board scenarios. The top 8 teams then design an algorithm to outsmart their opponents at a familiar game such as Tic-Tac-Toe (XO), facing off one-on-one in a knockout tournament.',
  },
  {
    title: 'Ideathon',
    track: 'Technical',
    text: 'Teams of 2–3 high school students develop product ideas for everyday challenges such as environmental issues or health and wellness — problem, solution and roadmap — then present detailed plans to judges.',
  },
  {
    title: 'Workshop',
    track: 'Technical',
    text: 'Details and registrations to be announced at a later date. First-come-first-serve.',
  },
  {
    title: 'Family Feud',
    track: 'Non-Technical',
    text: 'Teams of 4–5 answer survey-based questions on school subjects, pop culture and general knowledge. Fastest to buzz answers first; wrong answers can be stolen by the opposing team.',
  },
  {
    title: 'Masters of Mystery',
    track: 'Non-Technical',
    text: 'One round, teams of 2–3. Players are secretly assigned roles such as Mafia, Doctor and Citizens, and each day brings questions and challenges that earn points. Higher scores protect players from the Mafia, Doctors spend points to save others, and only those who survive to the end emerge victorious.',
  },
  {
    title: 'Shipwrecked Tales',
    track: 'Non-Technical',
    text: 'Round 1, Convince the Captain: one minute to win the last life jacket in character. Round 2, Storytelling Challenge: improvise why the ship sank, with mystery words and genre switches.',
  },
  {
    title: 'Ask-Me-Anything',
    track: 'Non-Technical',
    text: 'An AMA session where school students interact with professionals and students from various engineering streams, including computer science, about career paths, college life and preparing for the future. Questions can be submitted in advance and are answered anonymously.',
  },
];
