/**
 * Which installation each event gets, by its `artifact` key (content/events.ts).
 * A new event can reuse any of these.
 */
import type { RoomArtifact } from '@/content/events';
import type { Exhibit } from './common';
import { ContestFloor, ContributionLoom, HackNight, InterviewTable, LectureHall, PatternRoom, PuzzlePieces, SortColumns, TalkSignal } from './pieces';
import { WALLS } from './walls';

export const EXHIBITS: Record<RoomArtifact, Exhibit> = {
  blocks: { idea: 'Fourteen columns sort themselves, one swap per scroll step, while the wall runs the loop.', walls: WALLS.headStart, Piece: SortColumns, timeWalls: ['left', 'right'] },
  leaderboard: { idea: 'Contest night: the standings reshuffle and a balloon rises for every solve.', walls: WALLS.codex, Piece: ContestFloor },
  interview: { idea: 'The whiteboard round: a system design draws itself, the syllabus ticks off, the clock runs.', walls: WALLS.code, Piece: InterviewTable },
  lectern: { idea: 'A lecture hall: take a seat at the back while the talk runs through its slides.', walls: WALLS.masterclass, Piece: LectureHall },
  'puzzle-wall': { idea: 'Nine puzzle pieces — one per Prodigy event — fly together into the picture.', walls: WALLS.prodigy, Piece: PuzzlePieces },
  'hack-tables': { idea: 'Hack night: the commit wall fills, submissions close, the trophy rises.', walls: WALLS.codher, Piece: HackNight },
  voices: { idea: 'One voice, carried from the microphone down a cable into the wall and outward around the room toward the audience; the stage and the room’s light follow it, and the speaker is named for a moment.', walls: WALLS.techTalks, Piece: TalkSignal },
  sequence: { idea: 'Scattered lit cells on an inlaid floor find the grid, then a path whose steps grow like the sequence on the plinths; the fourth term is built from the third; the path leads out to CodeX.', walls: WALLS.patternx, Piece: PatternRoom },
  'contribution-graph': { idea: 'A loom held up by ACM-CEG and GDG-AU: the warp hangs from the mentors’ beam, and the cohort’s contributions are woven into the project’s cloth row by row — shuttle across, reed beats it in — until a light passes up through the finished piece.', walls: WALLS.openSource, Piece: ContributionLoom },
};
