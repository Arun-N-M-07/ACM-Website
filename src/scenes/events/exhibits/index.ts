/**
 * Which installation each event gets, by its `artifact` key (content/events.ts).
 * A new event can reuse any of these.
 */
import type { RoomArtifact } from '@/content/events';
import type { Exhibit } from './common';
import { ContestFloor, HackNight, InterviewTable, LectureHall, OpenSourceStudio, PatternRoom, PuzzlePieces, SortColumns, TalkSignal } from './pieces';
import { WALLS } from './walls';

export const EXHIBITS: Record<RoomArtifact, Exhibit> = {
  blocks: { idea: 'Fourteen columns sort themselves, one swap per scroll step, while the wall runs the loop.', walls: WALLS.headStart, Piece: SortColumns, timeWalls: ['left', 'right'] },
  leaderboard: { idea: 'Contest night: the standings reshuffle and a balloon rises for every solve.', walls: WALLS.codex, Piece: ContestFloor },
  interview: { idea: 'The whiteboard round: a system design draws itself, the syllabus ticks off, the clock runs.', walls: WALLS.code, Piece: InterviewTable },
  lectern: { idea: 'A lecture hall: take a seat at the back while the talk runs through its slides.', walls: WALLS.masterclass, Piece: LectureHall },
  'puzzle-wall': { idea: 'Nine puzzle pieces — one per Prodigy event — fly together into the picture.', walls: WALLS.prodigy, Piece: PuzzlePieces },
  'hack-tables': { idea: 'Hack night: a cable-stayed span is built out across the wall from a pylon behind the trophy, a segment each side in turn, each hung on its own stay; at submissions close the banks are joined, light runs out along the deck, and the trophy rises.', walls: WALLS.codher, Piece: HackNight },
  voices: { idea: 'One voice, carried from the microphone down a cable into the wall and outward around the room toward the audience; the stage and the room’s light follow it, and the speaker is named for a moment.', walls: WALLS.techTalks, Piece: TalkSignal },
  sequence: { idea: 'Scattered lit cells on an inlaid floor find the grid, then a path whose steps grow like the sequence on the plinths; the fourth term is built from the third; the path leads out to CodeX.', walls: WALLS.patternx, Piece: PatternRoom },
  'contribution-graph': { idea: 'Pair stations feed a contribution wall: six branches fork from main into rows of a relief heatmap that light week by week, then leave as pull requests, pass their mentors’ review rings and merge back, until main runs lit to its head.', walls: WALLS.openSource, Piece: OpenSourceStudio },
};
