/**
 * Which installation each event gets, by its `artifact` key (content/events.ts).
 * A new event can reuse any of these.
 */
import type { RoomArtifact } from '@/content/events';
import type { Exhibit } from './common';
import { BootTower, ContestFloor, FlagBox, HackNight, InterviewTable, LectureHall, LossLandscape, PaperPlanes, PuzzlePieces, SortColumns } from './pieces';
import { BOOTED, WALLS } from './walls';

export const EXHIBITS: Record<RoomArtifact, Exhibit> = {
  blocks: { idea: 'Fourteen columns sort themselves, one swap per scroll step, while the wall runs the loop.', walls: WALLS.headFirst, Piece: SortColumns },
  leaderboard: { idea: 'Contest night: the standings reshuffle and a balloon rises for every solve.', walls: WALLS.codex, Piece: ContestFloor },
  interview: { idea: 'The whiteboard round: a system design draws itself, the syllabus ticks off, the clock runs.', walls: WALLS.code, Piece: InterviewTable },
  'memory-stack': { idea: 'A dark room that boots: POST, bootloader, paging, scheduler — and the lights come on.', walls: WALLS.bellLabs, Piece: BootTower, darkUntil: BOOTED },
  'neural-net': { idea: 'Gradient descent on a real loss surface, while the network trains on the walls.', walls: WALLS.ml101, Piece: LossLandscape },
  'locked-box': { idea: 'Capture the flag: the flag cracks character by character and the box opens.', walls: WALLS.schrodingers, Piece: FlagBox },
  lectern: { idea: 'A lecture hall: take a seat at the back while the talk runs through its slides.', walls: WALLS.masterclass, Piece: LectureHall },
  pinboard: { idea: 'Opportunities pin themselves to the wall and fly out past you as paper planes.', walls: WALLS.offcamp, Piece: PaperPlanes },
  'puzzle-wall': { idea: 'Nine puzzle pieces — one per Prodigy event — fly together into the picture.', walls: WALLS.prodigy, Piece: PuzzlePieces },
  'hack-tables': { idea: 'Hack night: the commit wall fills, submissions close, the trophy rises.', walls: WALLS.codher, Piece: HackNight },
};
