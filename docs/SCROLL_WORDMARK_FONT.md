# Door scroll, ACM-CEG reveal and shared Geist

Continuation in `/Users/arunnm/Projects/acm-ceg-world`, on the existing
`checkpoint/before-optimization` working tree. Existing changes were preserved;
no Git reset, stash, commit or branch switch. The testing folder was read-only.

## Events door → matrix

- The same Lenis uses normal physical-input smoothing in 3D, with constant wheel
  gain from the door opening, including its first quantized scroll pixel.
- The Intro's additional camera follow/cap releases gradually before the doorway,
  rather than releasing accumulated lag at the Events seam.
- Arrival has 180vh instead of 44vh. Shelf/room transforms, lens, lights and
  choreography are not changed by this pass; the walk simply has real travel.
- Editorial uses immediate response on that same Lenis, not a second scroll
  controller. Its existing foreground/deep-layer relationship is retained.
- Explicit room return budgets the room approach independently of record depth;
  real wheel/touch input can still interrupt it. See `EVENTS_CONTROL.md`.

## Imported reveal

The testing folder's `AcmCeg.tsx`, `acmWordmark.ts`, `Clouds.tsx`, `look.ts` and
`Sky.tsx` were ported together, not its unrelated mobile/audio/camera changes.
Only their required `goldIn`/`acmCegFormed` beats and shared `portraitOpen` camera
helper were integrated into the current Intro infrastructure.

Seven cast violet letters rise sequentially through a cloud shelf. Warm light
spreads through clouds/sky as they emerge. Scroll determines each letter's pose
and reverses the reveal. Portrait stacks ACM– above CEG; landscape fits the rail.
Existing resource disposal and quality-tier cloud budgets remain in place.

## Shared type

Root `next/font` now self-hosts variable Geist. Shared CSS role tokens and canvas
typesetting all read it, including navigation, event signage, Crew card/member
text, Archive and static event pages. Events no longer loads a second font.
Existing role weights/tracking and editorial hierarchy remain intact.

Authored sculptural entrance geometry is not a CSS text node. Its letterforms
remain authored geometry; the imported ACM-CEG identity retains the testing
folder's Clash Display Bold contours instead of changing the requested animation.

## Validation

The following records the prior animation/font pass. The subsequent darker
purple and room-selection pass is in `EVENTS_SELECTION.md`; port 3303 now serves
that newer `/tmp/acm-click-fix.VN3zk0` build. The testing folder remains untouched.

Typecheck and isolated production build passed. Latest build is
`/tmp/acm-geist-verified.WBoDSf`, served on port 3303; other existing servers were
not stopped or rebuilt.

- `site-refinements.mjs`: 26 passed, zero failures/browser errors. Desktop/phone
  slow, fast and reverse door input transfers the exact requested scroll distance;
  ordinary 3D smoothing, stopped navigation, one Canvas, fonts, seven letters,
  sequential rise and reversible reveal are checked.
- `events-motion.mjs`: 23 passed, zero failures/browser errors. Editorial wheel
  response is pixel-for-pixel within 100ms with zero measured tail. Room-to-wall
  return measured 2.13–2.18 seconds from room/read states; interruption works.
- `events-editorial.mjs`: 480 passed, zero failures/browser errors. All nine
  records at seven viewport sizes, touch, orientation and reduced motion.
- `events-control.mjs`: 362 passed, zero failures/browser errors on the preceding
  build (identical hall/room/camera system; before the final one-pixel door-boundary
  correction). Fixed room matrices, reverse poses, stopped control and playback.
- `events.mjs` (desktop, phone, landscape, reduced): 62 passed, zero
  failures/browser errors on the final build. Actual selection, return, record
  end actions, next event, touch and layout behavior remain functional.

Artifacts: `/tmp/acm-geist-refinements-final-verified`,
`/tmp/acm-geist-motion-final-verified`, `/tmp/acm-geist-editorial-verified`,
`/tmp/acm-geist-control-verified`, `/tmp/acm-geist-regression-verified`.

Also inspected the imported wordmark against the live testing-folder preview and
portrait/landscape/reduced-motion captures. Final in-app-browser walkthrough
covered forward/reverse hall scrolling, actual Prodigy selection, layered
editorial scrolling and reverse, then Escape return to the matrix. Its warning
and error log was empty. Emulation does not verify physical
iPhone/Android thermal performance, Safari GPU behavior or mobile browser chrome.
