/**
 * Who draws the frame.
 *
 * There are two post chains — the opening's (intro/post/IntroPost) and the portal's and Teams
 * world's (teams/post/PostProcessing) — and both are built once and kept for the whole visit: their
 * shader programs are never thrown away at a chapter's edge (rebuilding them at the handoff, the
 * portal and on every loop cost a relink stall each time). Each frame exactly one thing draws, chosen
 * by the one frame owner (teams/post/PostProcessing): the Teams chain where the portal or the Teams
 * world is on screen (and in the whole mist where the loop comes round, as it always was), else the
 * opening's chain while the film is on screen, else R3F's own direct render.
 */
export interface Lens {
  /** This chain wants the frame. */
  wants(): boolean;
  /** Draw the frame through this chain. */
  render(dt: number): void;
  /** Called on frames this chain doesn't draw (it gives its render targets back after a while). */
  idle(dt: number): void;
}

export const lenses: { teams: Lens | null; intro: Lens | null } = { teams: null, intro: null };

/** How long a chain goes unused before its render targets are shrunk (its programs stay). */
export const LENS_IDLE_RELEASE = 3;
