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
- **Pacing.** One beat is `INTRO_VH_PER_BEAT` (10) viewport-heights of scroll — about one wheel notch (measured: 0.97 beats per notch at 1440×900). Moments get beats in proportion to their weight, and the camera keys are spaced so that what the eye sees changes at a steady rate: slow near things (a fragment arrives over ~5 notches and stays legible for ~6; the rise passes the tower at ~4 m a notch), faster where the ground is far away (~20 m a notch high above the campus). Within the opening the camera follows the scroll no faster than `INTRO_MAX_BEATS_PER_SECOND` (18): a hard fling still reads as a move — it arrives about a second or two later — while ordinary scrolling never meets the limit.
- Reduced motion uses the journey's own stills (`REDUCED_MOTION_STOPS`, which begin with the opening's `STILLS`): the scroll cuts between framed moments behind a fade; `N` / `P` step between them.

Pacing lives in one place: the beats in `intro/timeline.ts` (`T`). The five chapters (01 Arrival · 02 The Story · 03 CEG · 04 Ascent · 05 Descent) are scroll segments (`config/timeline.ts`), so the index, the chapter rail and deep links (`#story`, `#ceg`, `#ascent`, `#descent`…) work like any other chapter.

## The beats

| Beats | What happens |
|---|---|
| 0 – 4 | the garden in pre-dawn mist, lamps burning |
| 4 – 20.5 | *"22 years ago, a story began."* arrives, is read, burns |
| 19 – 35.5 | *"Within CEG, a community was born."* arrives, is read, burns |
| 33 – 56 | the camera turns aside to a stone in the mist: **ASSOCIATION FOR COMPUTING MACHINERY** in brushed-steel letters on dark basalt; its uplight wakes, a light runs across the name, the camera reads it and walks on |
| 55 – 86.5 | *"Not just to learn…"*, *"Years passed… the story continues."* |
| 84 – 92 | the last fragment burnt, the mist clears: the red building emerges |
| 92 – 99 | the building, complete; held |
| 99 – 116 | a glide over the fountain pool (clear of its jets) to hover over the plaza before the tower |
| 116 – 131.5 | straight up the light-well's column: past the face of the tower, the building sinking below and the campus spreading, into the cloud and out of it |
| 131.5 – 138.5 | above the cloud: the camera tilts up to the horizon over a sea of cloud, then down |
| 138.5 – 155 | straight down the same column: through the cloud, out of its base with the campus below and the light-well at the centre of the frame |
| 155 – 165.5 | the well's glass slides open; straight down the shaft (the "tunnel"); tipping up, level in the lobby |
| 165.5 – 180 | across the lobby to the EVENTS door, its lettering lit above it; the door wakes, unlocks and swings open on its hinges, light spilling out and gas pouring over the threshold; through |
| 180 – 184 | onto the Events' first pose |

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
| `world/lobbyLayout.ts`, `Lobby.tsx`, `EventsTitle.tsx`, `Gate.tsx` | the compact lobby; EVENTS as dimensional lettering mounted above the door; the four-leaf hinged door, its light spill and its gas |
| `scenes/underground/DescentShaft.tsx` | the light-well shaft (restored from the original journey) |
| `post/IntroPost.tsx` | bloom + grade while the opening is on screen (neutral at the handoff) |
| `IntroExperience.tsx`, `ui/intro.css` | Skip, Sound, the scroll cue, the story for screen readers |

## Sound

Enter with sound starts the score (`SCORE_IN` into the recording) inside the click, and it plays on under the whole journey; the opening doesn't pause or re-sync it. See [ASSETS.md](ASSETS.md) — the file is git-ignored and must be supplied locally.

## QA

`scripts/qa/intro.mjs <url> <out> "<steps>"` drives the page in headless Chrome: `at:<beat>` (cut the scroll there), `scroll:<beat>:<s>`, `settle`, `wheel(s)`, `swipe`, `key`, `shot`, `state`, `fstart`/`fstop` (frame timing), `reduced`, `eval(file)`. `window.__acm.intro` exposes `snapshot()`, `at(beat)`, `scroll(beat, s)`, `progressAt(beat)`, `skip()` in dev builds (or with `?debug`).
