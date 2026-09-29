/**
 * Screen-space effects driven by the camera system and applied by the DOM
 * overlay (CSS filter / vignette): cheaper and more controllable than a
 * post-processing pass for a brief, subtle moment.
 */
export const fx = {
  /** Canvas blur in px (impact). */
  blur: 0,
  /** Extra vignette 0..1 (impact, descent). */
  vignette: 0,
  /** Full-screen fade to black 0..1 (reduced-motion cuts, jumps). */
  fade: 0,
  /** White camera flash 0..1 (the VDM studio). */
  flash: 0,
  /**
   * The opening's mist over everything 0..1 (not the interface): the world swallowed by it at the
   * end of the journey, and the opening emerging from it again (JourneyLoop). Drawn the same over
   * every world, so the loop has no seam.
   */
  mist: 0,
  /**
   * Where the journey comes round, the world taken apart into tiles and put back together 0..1
   * (JourneyLoop; drawn over the finished frame by experience/mosaic), and on which side of the
   * seam (0 the Crew's end, 1 the opening's start: the tiles fall differently on each).
   */
  mosaic: 0,
  mosaicSide: 0,
};
