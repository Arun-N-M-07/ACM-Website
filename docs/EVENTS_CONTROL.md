# Events: scroll control and physical continuity

This describes the current nine-room matrix, not the older corridor architecture.

## Existing system retained

- One Canvas, CameraRig, Lenis instance, ScrollTrigger and GSAP ticker.
- Three architectural columns containing nine actual, scaled 3D rooms.
- Existing room content, data, installation choreography and editorial design.
- Fixed quality-tier light count, adaptive rendering, resource disposal, mobile
  accessible hit regions and reduced-motion framed stills.

## Navigation and playback

`ScrollTimeline` maps the actual page scroll to `progress.target`. Within Events,
`CameraRig` samples it directly into `progress.value`. The existing Lenis uses
normal smoothing in the physical hall/room, and immediate wheel response (`lerp: 1`)
in the editorial. Both modes share the same input target, so crossing their boundary
does not drop outstanding input. Touch remains native (including OS momentum).
Events wheel gain is pixel-for-pixel
rather than velocity-shaped, starting when the Events door opens (including its
first quantized scroll pixel). The Intro's
extra follow/cap releases continuously through that handoff, avoiding accumulated
camera lag suddenly releasing at the Events boundary. Earlier Intro/Teams response
is unchanged.

`track.eventsNavigation(progress, selected)` returns entry and room navigation.
The existing quadratic camera path and easing use these values. A click, Enter or
single tap explicitly requests entry via the existing interruptible Lenis path,
ending inside that room. Only the hub's identical-pose stationary interval is
skipped. Wheel/touch input takes control back; an interrupted flight never resumes.
Visible rooms are actionable through the fully open doorway, not disabled until
the end of approach. Manual scroll never triggers a timed camera movie or an
animation-completion callback that advances editorial. Entry and room push have
dedicated scroll distances, previously only short clock thresholds.

`controller.stepClocks` updates only installation playback (`view.play`) on the
existing frame callback. Forward playback takes four seconds; backward playback
takes 1.6 seconds. Scroll direction chooses playback direction, not playback speed.
Stopping navigation can leave the installation playing, but cannot move the camera
or editorial. A fast scroll can pass the installation without waiting for it.

This distinction is intentional: a camera path cannot be both fixed-duration and
freely scrubbable/stoppable. Camera choreography retains its geometric path and
easing; the room's internal choreography retains its playback timing.

Editorial lift is derived from actual scroll pixels. In the subsequent
editorial refinement, the DOM sheet remains the foreground while the camera's
deep-layer view offset travels only 14% of a screen. They share navigation
progress, not equal travel. Reversing restores the same room view. See
`EVENTS_EDITORIAL.md` for the current typography, header-safe reading viewport
and validation (including pre-existing wider portal/Crew QA failures).

Explicit Back/Next buttons use the existing interruptible Lenis navigation on the
same path. Next visits another room only because the visitor explicitly requested it.
Explicit room entry uses a 3.2-second approach and 0.8-second room push;
return uses a 2.2-second approach budget and 0.6-second room push;
record retreat uses 1000 CSS pixels per second. Total Back time scales with the
record distance instead of compressing all depths into 2.4 seconds. Short start/stop
ramps do not apply another sine over the camera's authored easing. The arrival is
180vh rather than 44vh: a physical walk, not a few-notches zoom into the shelf.
Explicit Crew navigation retains the existing portal integration. Reduced motion
retains intentional framed-state fades instead of camera flights.

Room-selection reliability and the later darker-purple pass are documented in
`EVENTS_SELECTION.md`. A pressed bay now retains its release through pointer
capture, duplicate/stale selection is guarded, and entry stops one CSS pixel
before the editorial boundary. The identical-pose browsing interval has no time
budget during explicit entry; normal manual scrolling remains unchanged.

## Physical fixes

The nine room world transforms were already fixed to their compartments; they
were not replaced with new previews or adjusted with screenshot-specific offsets.

The lobby passage and Events south wall shared coplanar inner jamb faces; their
floors overlapped too. Events geometry now sits entirely on its side of the joint,
meeting the existing lobby edge-to-edge. Exact triangle-intersection tests cover
both joints. Merged hall UVs use metric origins instead of restarting texture phase
on each piece; floor coordinates match the lobby at the doorway.

Arrival, hub, bay and room now share one aspect-composed lens. Previously the lens
narrowed on approach, widened on entry and narrowed inside; portrait received an
extra generic projection adjustment. Events owns projection from its first frame.
Screen fitting uses camera distance, not room/shelf scaling. Portrait stops nearer
the physical threshold while still entering. Natural perspective growth remains.

The shelf was hidden by an entry-state threshold, even when the camera was still
outside the room. It is now culled only when camera and near plane fit physically
within the selected room bounds. Room/column transforms remain unchanged. All nine
previews share one reveal curve: earlier per-index thresholds exceeded the maximum
reveal for later rooms, leaving them veiled.

Hub pointer parallax is damped, then gated out of the approach and room.
It cannot leave residual camera motion in a room. Events has no handheld drift.

Light slots previously zeroed a lit source immediately before relocating it.
They now retire it before relocating and ramp the new fixture in. Room anchors
retain physical positions and constant priority, so distance decides selection;
distant room lights cannot steal hall slots on hover/entry. Gain changes continuously
and selection keeps the fixture active through entry. Zero-gain anchors do not
compete for slots. No additional lights or
render loops were added. Events uses the existing direct rendering path; no new
exposure, post-processing, material or geometry switch was introduced.

## Validation

- `npm run typecheck`
- `npm run build` (isolated checkout copy to avoid disturbing running servers)
- `node scripts/qa/events-visual.mjs BASE OUT`
- `node scripts/qa/events-control.mjs BASE OUT`
- `node scripts/qa/events.mjs BASE OUT rooms,phone,landscape,reduced`

The control suite checks all nine room transforms, wide/mid/near framing,
interrupted selection hold, stopped actual scroll, entry reversal, room/editorial reversal,
wheel gain, fixed playback rate, native touch and orientation/viewport changes.
It waits for Lenis settling before asserting a stopped scroll. Screenshot review
is still required for appearance. Emulated mobile testing is not physical-device
GPU, browser-chrome, thermal or memory verification.

The earlier hub-only checks missed the doorway overlap and masked broken selection
by injecting a debug scroll after activation. Those results are not sufficient
evidence for this correction. The new visual suite tests exact doorway coplanar
area, fixed lens, native slow/fast approach/hold/reverse, visible doorway selection,
all nine actual single-click/tap entries and returns, and wheel/touch interruption.
Regression UI-entry tests no longer inject a debug scroll after activation.

Verified correction: typecheck and isolated production build passed. The visual
suite passed 90 checks; the control suite passed 362; the room/mobile/landscape/
reduced-motion regression suite passed 59. All reported zero failures and browser
errors. Exact doorway overlap area was zero on both tested viewports; maximum held
room-camera movement after scroll settling was zero. Events FOV remained 54° on
desktop and 92.431° on portrait through approach and room entry.

Also verified through normal in-app-browser navigation on port 3303: Events chapter,
Prodigy selection, native scroll into editorial, reverse scroll into the room,
Escape return to the matrix, and empty warning/error logs.

Artifacts: `/tmp/acm-events-visual-final`, `/tmp/acm-events-control-verified`,
`/tmp/acm-events-regression-corrected`. Production source/build copy:
`/tmp/acm-events-final.uTqZiq`, served on port 3303 without disturbing other servers.
