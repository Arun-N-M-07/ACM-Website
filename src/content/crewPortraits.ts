/**
 * THE CREW's portraits: which print belongs to whom.
 *
 * The table is generated from the chapter's own photographs by
 * scripts/crew-portraits.mjs — each photograph matched to its member by its
 * file name (never by order or appearance), framed from the face in it, and
 * printed into the member card's coat — and it is keyed by the member's name
 * exactly as it stands in content/teams.ts, so it holds however the crew is
 * ordered. A member without a print, or whose print isn't installed (see
 * content/media.ts), keeps the typographic card.
 */
import generated from './generated/crew-portraits.json';
import { isAvailable } from './media';

export interface CrewPortrait {
  src: string;
  width: number;
  height: number;
}

/** The print's band on a member card, in card widths: where it starts under the name, and its height. */
export const PRINT_BAND: { top: number; height: number } = generated.print;
/** Where every face is on the card, and how tall (card widths; Vision's face box, brows to chin). */
export const PRINT_FACE: { x: number; y: number; h: number } = generated.face;

const table: Record<string, CrewPortrait> = generated.members;

export function crewPortrait(name: string): CrewPortrait | null {
  const p = table[name];
  return p && isAvailable(p.src) ? { src: p.src, width: p.width, height: p.height } : null;
}

/** Every installed print (for fetching them ahead of the domains). */
export const crewPortraitSources = () => Object.values(table).map((p) => p.src).filter((src) => isAvailable(src));
