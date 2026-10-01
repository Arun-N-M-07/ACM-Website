# Current mobile specification audit

Read `mobile.txt` completely (898 lines), alongside all 1,714 lines of
`optimization.txt`, against the current repository, not an older corridor or
Teams implementation. Initial audit HEAD: `d35a3a6`, branch
`checkpoint/before-optimization`; worktree initially clean.

`mobile.txt` is a final stress/validation pass. It expressly excludes Safari,
Firefox, physical iPhone/Android and a new mobile rewrite. “Satisfied” below
means the implementation and the cited coverage are present; it does not imply
physical-device verification. Test results for this pass are recorded separately
and pending checks are not represented as passed.

## Requirement classification before this pass

| Mobile section | Initial classification | Existing implementation / coverage | Remaining verification |
| --- | --- | --- | --- |
| 1. Inspect current state | SATISFIED | Current source, Git, rendering/camera/scroll ownership and QA read directly | Final diff review |
| 2. Phone/aspect matrix | PARTIAL | Events editorial has seven-size coverage; Crew capture tools accept arbitrary formats | Whole-journey seven-format composition matrix |
| 3. Every important scene | PARTIAL | `intro.mjs`, `teams.mjs`, Events assertion suites and portrait QA | One consolidated complete scene/format sweep |
| 4. Portrait composition | SATISFIED in code; PARTIAL verification | `intro/camera.ts`, `teams/layout.ts`, Events responsive track and `MemberHand.measure` recompose subjects | Minimum-width and short portrait rendered checks |
| 5. Landscape composition | PARTIAL | Short-height top bar and Events/Crew layouts, portrait/card fit parameters | 844×390 and 740×320 complete journeys |
| 6. Dynamic viewport | PARTIAL | `.stage`/`.scroll-track` use `100lvh`; `stage` NDC matches Canvas; ScrollTrigger refresh preserves normalized progress | Height expansion/contraction at all worlds; actual browser toolbar behavior unavailable |
| 7. Orientation stress | PARTIAL | Same camera updates aspect; scroll refresh calls existing Lenis resize and restores progress | Repeated landscape/portrait during Intro, room, Crew and loop |
| 8. Touch scroll stress | PARTIAL | Native pan-y and one Lenis; Events real-touch tests, input cancellation | Slow/fast/tiny/reverse multi-world swipes |
| 9. Touch interactions | PARTIAL | Portal captured pointer/cancel; Events press retention; Crew tap-vs-drag and native member buttons | Repeated/interrupted hold, all seven real card taps and member returns |
| 10. Background/foreground | PARTIAL | Existing visibility audio policy, pointer blur release, one frame owner | Browser lifecycle freeze/resume state/resource test; exact OS/background unavailable |
| 11. Audio lifecycle | PARTIAL | One music context, SoundDirector/SFX bus, visibility/unlock ownership | Dedicated audio agent’s hidden/suspended/context tests; audible-device listening separate |
| 12. Mobile UI polish | PARTIAL | Compact top bar, projected room hit boxes, responsive Crew/member layouts | Seven-format bounds/readability/touch-target captures |
| 13. Safe areas | PARTIAL | `env(safe-area-inset-*)` in chrome, Crew controls and editorial | Emulator cannot validate hardware notch/home indicator; code audit and portrait/landscape bounds |
| 14. 3D readability | PARTIAL | Re-composed physical cards, names fitted to member surfaces, Events same true rooms | Screenshot inspection required; geometry invariants alone do not prove visual quality |
| 15. Performance stress | PARTIAL | Fixed quality tier plus measured adaptive resolution; inactive-world visibility gates | Baseline/reprofile, long rapid scroll, source-gated update audit |
| 16. Memory/resource stress | PARTIAL | Resident scenes, resource disposal; `loop-memory.mjs` telemetry | Five cycles, all seven member hands, live listener-identity and GPU/collected heap assertions |
| 17. Loading/reload | PARTIAL | Font readiness, prefetch Canvas, deterministic Enter and consumed deep links | Intro/Events/Crew reloads and repeated-cycle sample |
| 18. Slow network | PARTIAL | Async bundled Canvas, cached fonts/assets, bounded loading fallback | Throttled cold opening; network emulation not unreliable physical radio |
| 19. Reduced motion | PARTIAL | Media listener, framed stills, reduced portal/card transitions, useful archive | Mobile all seven domains plus Events and loop stills |
| 20. Error/recovery | PARTIAL | Context loss recreates once; repeated loss goes to accessible print; SafeBoundary | Forced context loss recovery/fallback; arbitrary asset failure remains separately reported |
| 21. End→start/reverse loop | PARTIAL | Pure progress mosaic/mist, `shiftProgress` preserves input target and canonical finite track | Real-touch forward/reverse seam crossings, five complete cycles |
| 22. Desktop regression | PARTIAL | Existing desktop Events/site/interaction suites | Rerun against final production build |
| 23. Fix policy | SATISFIED process | Reproduce → root cause → smallest change → retest; no duplicate owners | Record genuine failures separately from stale fixtures |
| 24. No over-optimization | SATISFIED process | No visual cuts or quality reductions solely for score | Compare relevant before/after frames |
| 25. Final validation | PARTIAL | Relevant existing suites available | Consolidated mobile stress plus regression |
| 26. Commands | PARTIAL | Existing typecheck/build workflow | Final typecheck, isolated production build and diff check |
| 27. Git safety | SATISFIED | No Git mutation during audit | No commit/push/reset/revert/stash/clean |

No source requirement was classified BROKEN solely from inspection: a suspected
gap is not a reproduced defect. The test matrix is required before changing
already-working mobile architecture.

### Reproduced baseline defect

The first consolidated baseline run on production port 3303 passed 65 touch
checks and 82 resize checks, with two genuine resize failures and no browser
errors. Shrinking 390×844 to 390×744 at Crew domain 4 changed navigation from
`0.8975771179968991` to `0.8815171360470229`; at final domain 6 it changed from
`0.9285863050470923` to the same value. This is the native browser's shorter
document maximum divided by the old ScrollTrigger range, not a random camera
offset. `ScrollTimeline` guarded that pre-refresh geometry/clamp callback only
inside Events; Crew let it overwrite `progress.target` before refresh captured
the position. Requirements 6/7/21 therefore have a BROKEN case until the shared
owner is fixed and the same regression rerun. No additional mobile camera or
timer is justified.

The seven-format baseline sweep then passed 651 checks and four simulated
safe-area checks with no browser errors. Visual inspection identified a further
requirement 5/12 defect not covered by its original bounds checks: at 844×390 the
Events invitation hint overlapped the bottom room row. Its projection clamped a
two-row invitation using a fixed 104px footer reserve, irrespective of actual
content/safe-area height. The targeted correction measures its border box on
layout changes, reserves the existing gutter/home-indicator padding, and sets
the same hint and full-size button side-by-side on short landscape screens.
Camera, shelf, bay geometry, lens and navigation remain untouched. A strict
invitation-content-versus-all-nine-bay overlap assertion was added; the rendered
result still must pass that assertion and visual inspection before completion.

## Current ownership (preserved)

- `ScrollTimeline.tsx`: one Lenis, GSAP ticker, one ScrollTrigger, physical page
  track, resize position preservation and explicit navigation cancellation.
- `CameraRig.tsx`: one perspective camera; responsive composition parameters
  shared with authored Intro, Events and Crew paths. Events editorial’s deep
  layer moves only 14% of foreground sheet travel.
- `ExperienceCanvas.tsx`: one R3F renderer, fixed starting quality tier, adaptive
  DPR without scene-tree quality oscillation, bounded context recovery.
- `JourneyLoop.tsx` / `navigation.ts`: one canonical finite scroll track;
  reversible mosaic/mist seams, no appended DOM or world rebuild per loop.
- `TeamsInput.tsx` / `PortalHold.tsx`: cancellation and tap/drag policy; physical
  domain pick proxies remain inside the same world.
- `MemberHand.tsx`: measured responsive DOM/CSS physical people cards; shared
  frame subscription rather than React animation state.

## QA inventory and limitations

Events assertion suites: `events.mjs`, `events-control.mjs`,
`events-editorial.mjs`, `events-visual.mjs`, `events-motion.mjs`,
`events-selection.mjs`. Whole-site assertions: `site-refinements.mjs`,
`interaction.mjs`; portrait/data assertions: `crew-portraits.mjs`.
Command-driven captures/telemetry: `intro.mjs`, `teams.mjs`, `probe.mjs`,
`shots.mjs`, `sheet.mjs`, `sheet-portrait.mjs`, `loop-memory.mjs`, `audio.mjs`.

Legacy `loop-memory.mjs` reports but does not assert resource plateaus; it visits
three Crew coordinates, not all seven domains, and does not cross the reverse
loop seam. Its listener metric counts add/remove calls rather than unique live
listeners. The added `mobile-stress.mjs` does not weaken that script; it adds
asserted live identity tracking, actual touch seam crossing and seven-domain
coverage. At baseline the old audio meter required the development-only SFX bus;
this pass updated `audio.mjs` with a test-side observer of the existing bus and
the `?debug` production fixture. The dedicated final audio test passed 13/13
checks without browser errors. This does not create a second audio owner and
does not verify physically audible playback or native OS interruptions.

Run consolidated groups separately to avoid competing with performance profiling:

```sh
node scripts/qa/mobile-stress.mjs http://localhost:3303 /tmp/acm-mobile-baseline resize,touch
node scripts/qa/mobile-stress.mjs http://localhost:3303 /tmp/acm-mobile-baseline matrix
node scripts/qa/mobile-stress.mjs http://localhost:3303 /tmp/acm-mobile-baseline loops,lifecycle,reduced
```

Debug hooks only place fixtures. Portal holds, domain/member activation, close
controls and seam crossing use actual input. Viewport emulation cannot establish
hardware performance, browser toolbar geometry, hardware safe areas, thermal
behavior, Safari/Firefox compatibility or physically audible quality.
