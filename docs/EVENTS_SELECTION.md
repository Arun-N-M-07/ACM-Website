# Darker wordmark and reliable room selection

Continued the existing working tree, without branch changes, commits, resets,
stashing or edits to the testing project. Only the wordmark palette, Events input/
controller and the minimum existing-scroll cancellation helper changed in the app.

## Reproduced causes

- A bay's projected hit rectangle moves with camera parallax and input settling.
  A stationary edge press could start on the bay and release on the background,
  losing the native click. Held-edge and moving-press baseline tests reproduced it.
- Duplicate clicks could restart an existing room approach.
- Doorway selections traversed the hub's stationary browsing interval as part of
  timed navigation, creating an idle stretch between two physical movements.
- Controller selection was not restricted to the matrix; stale callers could
  replace room data inside an existing editorial. That was tested directly, not
  claimed as the sole cause of the user's reported editorial skip.

## In-place changes

- Wordmark face/bevel/side colors: `#50107b`, `#5c2095`, `#1c0634`. Existing
  geometry, sequential rise, cloud shelf and light response are retained.
- Bay pointer capture keeps release on the actual pressed button. More than 10
  CSS pixels of pointer travel cancels selection; native touch pan/cancel and
  keyboard activation remain supported. No selection is fired on pointer-down.
- Valid presses cancel old scroll settling using the existing Lenis public
  stop/start pair and current native scroll position. No private API, timer,
  second Lenis, RAF or scroll controller is added.
- The hit layer becomes inert synchronously on selection. `canVisitEvent`
  restricts selection to the available matrix/doorway and rejects stale entry/
  editorial activation.
- Explicit entry budgets 3.2 seconds for the existing approach, 0.8 seconds for
  the interior push, and no time for the identical-pose browsing interval.
  Doorway travel keeps its own approach budget. Manual scroll remains unchanged
  and immediately interrupts explicit navigation.
- Camera pointer lean releases over the first 24% of entry rather than collapsing
  with the UI's first few frames. Camera geometry, lens and room transforms remain.
- Selection stops one CSS pixel before the room/editorial boundary; browser
  rounding cannot turn the click itself into an editorial reveal. Continued
  actual scroll raises the existing sheet; reverse restores the same room.
- Return timing remains independent of editorial length. Installation playback
  continues to use its independent existing frame-based clock.

## Validation

- Typecheck and isolated production build passed. The build was made in
  `/tmp/acm-click-fix.VN3zk0` to preserve running development build state.
- `events-selection.mjs`: 54 checks passed, zero failures/browser errors. Actual
  mouse, held-edge, press during settling, duplicate, keyboard and touch entry,
  return/reselect, stale selection rejection, drag/swipe cancellation and palette.
  No debug jump is injected after a tested click to make entry succeed.
- `events-motion.mjs`: 23 checks passed, zero failures/browser errors. Immediate
  editorial wheel response, interrupted Visit/Back and consistent return pace.
- `events.mjs` desktop/phone/landscape/reduced: 62 checks passed, zero
  failures/browser errors. Selection, record navigation, return and mobile UI.
- `events-visual.mjs`: 90 checks passed, zero failures/browser errors. All nine
  real click/tap entries and returns, doorway
  selection, lens stability, input reversal and physical coplanar joints. Its fast
  reversal assertion compares the exact native CSS pixel: a repeated debug jump
  can keep fractional fixture progress when its rounded pixel is already current.
  Four focused repetitions returned to the exact starting native pixel.
- Manual in-app-browser verification: Prodigy selection stops in 3D, deliberate
  scroll reveals the sheet, reverse restores the room, Escape returns to the
  matrix, and PatternX remains selectable. Warning/error log empty.

Stable-entry traces measured peak camera movement normalized to a 60Hz frame at
0.168m desktop / 0.183m portrait, versus 0.243m / 0.268m in the baseline. No >50ms
frame gaps were observed in those traces. This is a local measurement, not a
promise of identical performance on all hardware. Touch emulation does not
verify physical iPhone/Android GPU, Safari, thermal or browser-toolbar behavior.

Artifacts: `/tmp/acm-click-selection-fixed`, `/tmp/acm-click-visual-verified`,
`/tmp/acm-click-regression-fixed`, `/tmp/acm-click-motion-fixed`.
The verified production copy is served on port 3303. Only the previous agent-owned
3303 preview was replaced; the temporary 3304 QA server was stopped. Existing user
development servers, including the testing-folder preview, were not stopped.
