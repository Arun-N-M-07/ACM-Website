# The opening

Everything from Enter to the first frame of the Events: `src/intro/`.

## Scroll owns it

The opening is the first stretch of the journey's one scroll track — the same Lenis + ScrollTrigger timeline, the same damping (`CAMERA_RESPONSE.progressDamping`) as the rest of the journey. Nothing in it runs on its own clock:

```
page scroll ─► progress.target ─► CameraRig damps ─► progress.value
                                                    └► intro/controller.syncIntro(value)
                                                         beat t = value / INTRO_PROGRESS_END × T.end
camera (intro/camera.ts), light (intro/look.ts), paper, ash, the name, cloud,
well, lobby, door, gas — each a pure function of t
```

- Stop scrolling and it stops; scroll back and it plays backwards, through every beat (paper arrival, ink, fire, the stone's light, the reveal, the rise, the cloud, the well's glass, the door and its gas).
- No input capture, no scroll locking, no rest points, no snapping, no timed moves. The only things that move on their own are ambient: a small breath in the camera, paper idling in the air, drifting mist, cloud and gas.
- **Pacing.** One beat is `INTRO_VH_PER_BEAT` (10) viewport-heights of scroll — about one wheel notch. Moments get beats in proportion to their weight, and the camera keys are spaced so that what the eye sees changes at a steady rate. Wheel and trackpad input is shaped before it becomes scroll (`systems/scroll/wheelShape.ts`): a trackpad flick delivers far more pixels than anyone means to travel, so each wheel event is scaled by how fast input is arriving — deliberate scrolling passes nearly as it is, a fling is compressed (measured at 1440×900: a mouse notch 0.85 beats; a normal trackpad flick 2.95 beats, was 4.98; a hard one 4.39, was 12.1). Nothing is delayed or replayed, and it applies only before the portal. The camera also follows the scroll no faster than `INTRO_MAX_BEATS_PER_SECOND` (10).
- Reduced motion uses the journey's own stills (`REDUCED_MOTION_STOPS`, which begin with the opening's `STILLS`): the scroll cuts between framed moments behind a fade; `N` / `P` step between them.

Pacing lives in one place: the beats in `intro/timeline.ts` (`T`). The five chapters (01 Arrival · 02 The Story · 03 CEG · 04 Ascent · 05 Descent) are scroll segments (`config/timeline.ts`), so the index, the chapter rail and deep links (`#story`, `#ceg`, `#ascent`, `#descent`…) work like any other chapter.

## The beats

| Beats | What happens |
|---|---|
| −26 – −16.5 | the prologue: on the road in the pre-dawn mist, the camera 18 cm off the ground; a sealed canister rolls out of the fog towards the lens — rolling, not thrown — slows and rocks to rest |
| −14.5 – −12.5 | pressure: its seam wakes violet, it trembles; then it vents — not an explosion: jets along the ground, a dense purple core, the mist pushed aside; the view lifts a little |
| −9.5 – −2.5 | the smoke's own density becomes **22 YEARS AGO** (word by word), readable for a moment, then loosens and rises back into smoke |
| −2.5 – 4 | the smoke thins, drifts down the road and mixes into the mist; the camera rises into the story's first shot |
| 4 – 20.5 | *"22 years ago, a story began."* condenses out of the mist (its torn edge first, then the fibres), is read, burns |
| 19 – 35.5 | *"Within CEG, a community was born."* arrives, is read, burns |
| 33 – 56 | the camera turns aside to a stone in the mist: **ASSOCIATION FOR COMPUTING MACHINERY** in brushed-steel letters on dark basalt; its uplight wakes, a light runs across the name, the camera reads it and walks on |
| 55 – 89 | *"Not just to learn…"*, *"Years passed… the story continues."* — the last sheet stands over the tower and burns from its middle outwards as the mist begins to clear: the opening it leaves is where the building comes out |
| 84 – 92 | the mist clears: the red building emerges |
| 92 – 103 | the building, complete; held, with a slow drift |
| 103 – 120 | a glide over the fountain pool (clear of its jets) to hover over the plaza before the tower |
| 120 – 135.5 | straight up the light-well's column: past the face of the tower, the building sinking below and the campus spreading, into the cloud (a faint flash inside it) and out of it |
| 135.5 – 142.5 | above the cloud: the rise settles, looking out over the sea of cloud to the horizon |
| 142.5 – 159 | straight down the same column: through the cloud (lightning lights it from within, thunder follows), out of its base with the campus below and the light-well at the centre of the frame |
| 159 – 169.5 | the well's glass slides open; straight down the shaft (the "tunnel"); tipping up, level in the lobby |
| 169.5 – 184 | across the lobby to the EVENTS door, its lettering lit above it; the Events are heard through it; the seams wake, the seal lets go with gas at the seams, the four panels part at the centre and retract into channels in the head, the jambs and the floor; light and cold gas pour out; through |
| 184 – 188 | onto the Events' first pose |

## Pieces

| File | What |
|---|---|
| `timeline.ts` | the beat sheet, chapters, stills, easing helpers |
| `controller.ts` | progress ↔ beat, the interface state (chapter, legible line, scroll cue), skip |
| `camera.ts` | the path (keys per beat), portrait framing that converges on the rig's own portrait lens at the handoff |
| `look.ts` | the colour script: fog, ground mist, sun, sky, lamps, exposure, grade |
| `story/` | the paper: drawn once at load (`parchmentTexture.ts`), shaded with ink, heat, char and ember (`parchmentMaterial.ts`), staged arrival with anticipation, tumble, overshoot and a mist wake (`Parchment.tsx`), ash (`Ash.tsx`) |
| `world/AcmStone.tsx`, `world/acmGlyphs.ts`, `world/stoneLayout.ts`, `world/chromeStudio.ts` | the name: an original blade letterform, cut in brushed steel on a dark stone in the garden, lit by its own uplight; in the same mist as everything else |
| `world/Clouds.tsx`, `MistLayers.tsx`, `Motes.tsx`, `Halos.tsx` | the air |
| `world/lobbyLayout.ts`, `Lobby.tsx`, `EventsTitle.tsx`, `Gate.tsx` | the compact lobby; EVENTS as dimensional lettering mounted above the door; the four-panel retracting door (panels run into recessed channels), its light spill and its gas |
| `prologue/` | the prologue: `layout.ts` (staging and choreography, all functions of the beat), `Canister.tsx`, `RoadLamp.tsx` (the lamp, the wet road), `gasFields.ts` (a noise volume, and the words as a density field), `GasVolume.tsx` (one ray-marched volume of mist and purple smoke — the words are regions of higher density in it, eroded and warped by its own noise; rendered at reduced resolution and composited) |
| `world/lightning.ts` | three rare flashes in and under the cloud (struck by forward scroll, played in real time, never frozen) |
| `scenes/underground/DescentShaft.tsx` | the light-well shaft (restored from the original journey) |
| `post/IntroPost.tsx` | bloom + grade while the opening is on screen (neutral at the handoff) |
| `IntroExperience.tsx`, `ui/intro.css` | Skip, Sound, the scroll cue, the story for screen readers |

## Sound

Enter with sound starts the score (`SCORE_IN` into the recording) inside the click, and it plays on under the whole journey; the opening doesn't pause or re-sync it. See [ASSETS.md](ASSETS.md) — the file is git-ignored and must be supplied locally.

Sound effects are synthesised in the same audio context (`systems/audio/sfx.ts` — noise and a few oscillators, no files) and run by `components/experience/SoundDirector.tsx` from where the film is: continuous layers (the canister's roll by its speed and side, the gas, the wind by the camera's speed through the air and muffled in the cloud, the shaft's resonance, the Events heard through the door before it opens) and one-shot cues played only when the film crosses their beat going forward (settle, pressure, the release, the words' swell, paper fibres, ash, thunder, the door's wake, seal, travel and home). The music leaves room: low under the prologue, swelling with the words, easing at the door (`MusicDirector`). With sound off, nothing is made.

## QA

`scripts/qa/intro.mjs <url> <out> "<steps>"` drives the page in headless Chrome: `at:<beat>` (cut the scroll there), `scroll:<beat>:<s>`, `settle`, `wheel(s)`, `swipe`, `key`, `shot`, `state`, `fstart`/`fstop` (frame timing), `reduced`, `eval(file)`. `window.__acm.intro` exposes `snapshot()`, `at(beat)`, `scroll(beat, s)`, `progressAt(beat)`, `skip()` in dev builds (or with `?debug`).
