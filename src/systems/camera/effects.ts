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
};
