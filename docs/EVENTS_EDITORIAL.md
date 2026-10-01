# Events editorial refinement

Scope: `EventsUI.tsx`, the Events editorial CSS, and the existing camera rig's
Events-only view offset. Event data, rooms, matrix, lighting, installation
choreography, timeline boundaries and Lenis ownership are unchanged. The
previous Events control/geometry fixes remain in place.

## Live reference study

Visited and interacted with Basement's [blog](https://basement.studio/blog),
[people](https://basement.studio/people) and [home](https://basement.studio/).
Scrolled forward/backward and inspected the rendered type, not their source.

At a 1280px viewport, the blog/people display type was Geist 600, approximately
98px/88px with −0.04em tracking. Supporting display copy used 38px/36px; body
copy 20px/20px; small metadata 13px/16px. Primary grey was #c4c4c4, muted grey
#757575, with black backgrounds and compact ruled columns. The foreground
content starts close to its black edge and overlaps a slower, still-live 3D
stage. These are observed rendering characteristics, not claims about their
underlying camera architecture.

No Basement code, media, text or branding was copied. Geist is obtained through
the project's existing `next/font/google` facility, self-hosted at build time.

## Typography

- The initial editorial pass scoped Geist 600 to `.evx-sheet`. At the user's
  subsequent request, Geist is now the site's shared variable family: root
  `next/font`, DOM role tokens, navigation, Archive/static event pages, and
  canvas typesetting. The editorial keeps its own weight, tracking and hierarchy.
  Authored sculptural entrance geometry and the imported ACM-CEG wordmark retain
  their identity letterforms. No additional package or duplicate font load.
- Event index and Back come first; then a 7/5 title/introduction grid. Long names
  wrap naturally instead of having their type reduced by estimated character
  counts. Display size is 7.65vw (64–156px), with 0.9 leading/−0.04em tracking.
- Primary grey #c4c4c4; secondary #b9b9b9; labels #858585 (slightly brighter than
  the reference for small-text contrast). Long paragraphs have 1.28 leading
  for readability rather than reproducing the reference's very tight body.
- Existing category/story/programme/details/room/related/next content remains.
  Ruled sections use 20–56px content-based rhythm, not viewport-sized spacers.
- Tablet uses a full-width title with two supporting columns; phone stacks the
  introduction/context and long-form text. Safe-area horizontal/bottom insets
  and a 44px phone Back target are retained/supported.

## Layer relationship

The same `eventsFrame.view.page` drives the sheet in the same existing
`onProjected` callback. Its position is still `readingHeight − page` relative
to the record viewport. The record viewport starts below the existing 76px +
safe-area site header, so the label is 16px from the sheet's edge and remains
readable when the foreground is established. ResizeObserver measures this
actual viewport and record length, including font/content changes.

CameraRig retains the same room pose, FOV and view-offset owner. Its Events-only
offset is now `unfold × canvasHeight × 0.14`, instead of a full-screen lift.
Thus the deep layer travels only a fraction of the foreground travel. The
opaque sheet covers it progressively; there is no room-opacity fade or hard
replacement. Both positions are pure functions of navigation progress and
reverse identically. Ambient installation motion continues at its existing
fixed pace; it never writes navigation progress.

Reduced motion keeps the existing framed still and native inner-record reading,
without view-offset travel or subsection reveal motion. No new camera, Lenis,
RAF, AudioContext, timers or playback-completion navigation was introduced.

## Verification

`npm run typecheck` and isolated production build passed.

- `events-editorial.mjs`: 480 assertions passed, zero failures/browser errors.
  All nine events at 1440×900, 1920×1080, 1024×768, 768×1024, 390×844,
  320×640 and 844×390. Checks title/content overflow, local/global fonts,
  hierarchy, top clearance, section rhythm, projected world anchors vs sheet
  travel, paused stability, no camera/lens/fade changes, native wheel reversal,
  real emulated touch swipes, orientation, return and reduced motion.
- `events-control.mjs`: 362 assertions passed, zero failures/browser errors.
  Preserves fixed room transforms, all nine approaches and reverse poses,
  scroll ownership/gain, fixed installation playback rate, Back and resizing.
- `events.mjs` (desktop, phone, landscape, reduced): 62 assertions passed,
  zero failures/browser errors, including editorial end choices and next/back.
- The wider scroll/cycles run passed ten room visits/returns with stable GPU
  resources and DOM. It also reported six **pre-existing broader QA failures**:
  four portal-closing reverse-continuity assertions, the Crew-loop debug-jump
  assertion, and its subsequent unclickable-button exception. All six reproduce
  against the untouched pre-editorial production snapshot on port 3303 at the
  same progress values. Portal/Crew code and those test assertions were left
  unchanged; this is not a claim that the whole-site suite passes.

Manually tested the final build through existing chapter navigation and real
Prodigy selection: room, slow foreground progression, stopped overlap, reverse
back to the same room and Escape back to the 3×3 matrix. Recompared the resulting
overlap/typography against the live blog. Proof images/results are in
`/tmp/acm-events-editorial-final-qa`; scope regression results in
`/tmp/acm-events-editorial-regression-scoped`; the wider comparison is in
`/tmp/acm-events-editorial-regression` and `.../acm-events-editorial-baseline-extra`.

These are Chromium browser tests and device-size/touch emulation, not physical
iPhone/Android, browser-toolbar safe-area or Safari GPU verification.

## Subsequent scroll refinement

Events keeps its existing single Lenis. The physical hall/room uses ordinary
`lerp: 0.085`, with constant pixel gain from the opening door; the editorial uses
`lerp: 1` so wheel velocity/direction are reflected immediately without an added
settling tail. Touch remains native. The camera follows Events navigation directly
instead of applying a second damped progress, and the Intro's extra cap/follow
releases gradually before the doorway. Arrival has 180vh of actual scroll travel,
not the former 44vh zoom. Nothing autoplays navigation.

Explicit Visit/Back travel reuses the same interruptible Lenis request. Room
approach is budgeted at 2.2 seconds, the short interior push at 0.6 seconds, and
editorial retreat at 1000 CSS px/s. Starting Back deeper down the record no longer
compresses the room-to-wall leg. Manual input interrupts that request and cannot
restart its completion. Installation playback is unchanged and never writes scroll.

`events-motion.mjs` measures real wheel input, settling, input interruption and
Back timing from different record depths. `site-refinements.mjs` additionally
checks the imported wordmark, global font, door input gain and hall ownership on
desktop/phone. These supplement the existing editorial/control/regression suites.
