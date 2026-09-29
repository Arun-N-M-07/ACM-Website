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
- Reduced motion uses the journey's own stills (`REDUCED_MOTION_STOPS`, which begin with the opening's `STILLS`: the canister at rest, the words, each sheet, the stone…): the scroll cuts between framed moments behind a fade; `N` / `P` step between them. Lightning becomes one soft swell of light, without flicker.

Pacing lives in one place: the beats in `intro/timeline.ts` (`T`). The five chapters (01 Arrival · 02 The Story · 03 CEG · 04 Ascent · 05 Descent) are scroll segments (`config/timeline.ts`), so the index, the chapter rail and deep links (`#story`, `#ceg`, `#ascent`, `#descent`…) work like any other chapter.

## The beats

| Beats | What happens |
|---|---|
| −55 – −44 | before the film: the mist the journey comes round through (ENTER starts at −44, clear; scrolling back from −44 thickens it, wholly mist from −49 back; at −52 — the loop's seam — the journey continues from its end, in the same mist, at the same speed — see `components/experience/JourneyLoop.tsx`) |
| −44 – −33 | the prologue: on the road in the pre-dawn mist, the camera 16 cm off the ground; a sealed canister rolls out of the fog towards the lens — touching down, rolling (its turn is its travel over its radius), slowing under friction, wobbling — and rocks to rest a couple of metres off |
| −30.5 – −28 | pressure: its seam wakes violet, it trembles; then it vents — not an explosion: jets along the ground, a dense core, and the smog FLOODS the air, running out past the camera and rising overhead; the view lifts a little |
| −28 – −19 | the camera rises into the smog and is inside it: dense rolls, clear pockets, light in some places and none in others — no shape to see from outside |
| −19 – −3 | the smog's own density becomes **22 YEARS AGO**: it gathers, partial strokes, *22*, *YEARS*, *AGO*, readable while the camera travels slowly through the smog towards it; then it grows restless, frays, and dissolves back into the smog |
| −3 – 4 | the camera passes through where the words were into the story's first shot; the smog stays, thinner |
| 4 – 20.5 | *"A STORY BEGAN."* is discovered in the air: a dark shape far off in the smog, its torn edge, the smog parting, its fibres resolving as it drifts in (rolled up, unfurling); its ink surfaces; it is read; it burns |
| 19 – 35.5 | *"Within CEG, a community was born."* is found the same way, from the other side; the violet air is still there, and begins to clear as it burns |
| 33 – 56 | the camera turns aside to a stone in the mist: **ASSOCIATION FOR COMPUTING MACHINERY** in brushed-steel letters on dark basalt, lit by a steep key and an uplight grazing its face; a distant storm lights the air as the camera comes to it, and again, nearer, as the name is read — irregular flickers from different parts of the sky, the fog holding the light; the camera walks on |
| 55 – 89 | *"Not just to learn…"*, *"Years passed… the story continues."* (each found in the mist the same way) — the last sheet stands over the tower and burns from its middle outwards as the mist begins to clear: the opening it leaves is where the building comes out |
| 84 – 116 | the mist clears and the move carries on through the red building's reveal — it never stops to pose: gathering pace evenly (0.6 → 3 m/beat) over the fountain pool towards the tower |
| 116 – 132 | curving up into the light-well's column without a halt and straight up it, past the face of the tower, the building sinking below, the campus spreading, gathering speed into the cloud (a faint flash inside it) |
| 132 – 139.5 | out of the cloud's top; levelling into flight over the sea of cloud |
| 139.5 – 150.5 | **ACM-CEG** rises out of the cloud ahead, letter by letter — a huge 3D title cast in polished gold (Montserrat 560, tracked wide, the hyphen drawn as the E's middle arm), revealed by the cloud: each letter comes up out of it veiled in its light, a dark silhouette while it still leans, and the light catches it as it settles; the camera slows into the composition (≈1 m/beat), holds it while a light runs across it, drifting in a little (stacked ACM- / CEG, and fitted to the frame, on a portrait screen) |
| 150.5 – 163.5 | tilting down to the cloud and dropping back into it, home to the column inside it; out of its base straight down, north at the top of the frame all the way (the look target leads the camera north — see `down()` in camera.ts), lightning lighting its underside |
| 163.5 – 175 | down the column onto the light-well; its glass slides open |
| 175 – 182.5 | straight down the shaft (the tunnel), leaning into the tip-up at its foot; tipping up, level in the lobby |
| 182.5 – 197 | across the lobby to the EVENTS door, its lettering lit above it; the seams wake, the seal lets go with gas at the seams, the four panels part and retract into the architecture; light and cold gas pour out; through |
| 197 – 201 | onto the Events' first pose |

## Pieces

| File | What |
|---|---|
| `timeline.ts` | the beat sheet, chapters, stills, easing helpers |
| `controller.ts` | progress ↔ beat, the interface state (chapter, legible line, scroll cue), skip |
| `camera.ts` | the path (keys per beat; `cruise()` sections with a continuous speed profile through the reveal and the rise), portrait framing that converges on the rig's own portrait lens at the handoff. Looking nearly straight down, which way is up in the frame comes from which side of the camera the look target lies (`aim()`): the descent keeps it north of the camera by a margin (`down(y, from)`: 1.2% of the drop), so the picture never turns round |
| `look.ts` | the colour script: fog, ground mist, sun, sky, lamps, exposure, grade |
| `story/` | the paper: drawn once at load (`parchmentTexture.ts`), shaded with ink, heat, char and ember (`parchmentMaterial.ts`), discovered in the air — a dark shape far off, its edge, then its fibres resolving as it drifts in rolled up and unfurls (`flight.ts`, `Parchment.tsx`), a little dust shaken off as it snaps flat (`UnfurlDust.tsx`), the smog parting around it (`paperOccluders.ts`) — and ash (`Ash.tsx`) |
| `world/AcmStone.tsx`, `world/acmGlyphs.ts`, `world/stoneLayout.ts`, `world/chromeStudio.ts` | the name: an original blade letterform, cut in brushed steel on a dark stone in the garden, lit by its own uplight; in the same mist as everything else |
| `world/AcmCeg.tsx` | ACM-CEG: the 3D identity over the cloud (Montserrat outlines at weight 560 from the site's own variable font, `world/acmWordmark.ts`: 0.2 em tracking, the hyphen drawn as the E's middle arm; cast deep, a broad rounded bevel cut inside the letterform so the silhouette keeps the type's weight, smooth-shaded curves and dead-flat faces; fully metallic polished gold with a faint variation in its polish, lit as a jeweller lights gold by a studio made for it, `world/goldStudio.ts`: champagne faces with slanting glare, deepening toward their feet under a key from above, deep amber sides, shadow beneath, the rolled edges answering the light most and the upward ones blooming a little; below the cloud's top the letters are veiled in the cloud's light, the veil's edge wavering, kept under the name's resting foot; the passing light brightens the metal's own reflection, most on the edges; its own haze), surfacing in turn and holding while a light crosses it; fitted to the frame on any screen (84% of a portrait frame's width, 76% of a landscape one's — clear of the chapter rail), stacked in portrait |
| `world/Clouds.tsx`, `MistLayers.tsx`, `Motes.tsx`, `Halos.tsx` | the air |
| `world/lobbyLayout.ts`, `Lobby.tsx`, `EventsTitle.tsx`, `Gate.tsx` | the compact lobby; EVENTS as dimensional lettering mounted above the door; the four-panel retracting door (panels run into recessed channels), its light spill and its gas |
| `prologue/` | the prologue: `layout.ts` (staging and choreography, all functions of the beat), `Canister.tsx`, `RoadLamp.tsx` (the lamp, the wet road), `gasFields.ts` (a noise volume, and the words as a density field), `GasVolume.tsx` (one ray-marched volume of mist and purple smog that travels with the camera — thinning to nothing before any of its faces, and losing fine detail with distance, so it has no visible edge; the words are regions of higher density in it — uneven, crossed by clear air, off the plane — eroded and warped by its own noise; rendered at reduced resolution and composited) |
| `world/lightning.ts` | storms as pulse sequences on the beat — at the stone, in and under the cloud; each pulse strikes from its own part of the sky; a pure function of the scroll (forwards, backwards, scrubbed); one soft swell with reduced motion. `fog.ts` holds the flash in the mist (most towards it, and the more air, the more light) |
| `scenes/underground/DescentShaft.tsx` | the light-well shaft (restored from the original journey) |
| `post/IntroPost.tsx` | bloom + grade while the opening is on screen (neutral at the handoff) |
| `IntroExperience.tsx`, `ui/intro.css` | Skip, Sound, the scroll cue, the story for screen readers |

## Sound

Enter with sound starts the score (`SCORE_IN` into the recording) inside the click, and it plays on under the whole journey; the opening doesn't pause or re-sync it. See [ASSETS.md](ASSETS.md) — the file is git-ignored and must be supplied locally.

Sound effects are synthesised in the same audio context (`systems/audio/sfx.ts` — noise and a few oscillators, no files) and run by `components/experience/SoundDirector.tsx` from where the film is. The visual state is the authority — every sound is made by something the film is doing right then:

- **The canister** — its touch-down (a muted knock); a contact each time a band or seam meets the road, so the rhythm *is* its rotation (quicker as it rolls faster, sparser as it slows, whichever way the scroll turns it); a friction rub whose level is its actual speed (silent the moment it stops); its settle (scrape, rock, a last tick). Then quiet, and the pressure and the release as separate events.
- **The smog** — the vent's hiss, dying away after the release, and a low breath of moved air while you are deep in it; gone before the first sheet. No standing wind anywhere: the drone's rise and the approach to the building have none.
- **A sheet** — heard only as it comes near: its flaps, the air past it, the snap as it unfurls. **Burning**, the sound follows the burn's own progress: the first edge catching, dry crackles and tiny pops while the front runs, fine brittle ticks as it curls, drier fainter ash crumbling, a last almost silent breath — forward only; scrolled back it is silent.
- **The world** — thunder after every flash, late and the later the farther: each storm has its own distance (the fainter, the farther — later, lower, longer) and its own roll, the same every time, with a long low tail. Moving through the cloud, its air: soft pressure and displaced air in two broad bands, each wandering on its own slow course across the stereo field, only as loud as the camera is fast (no wind, no loop you can hear). The light-well's shaft as a tube of air: its resonances (narrow bands of noise, not tones) rising as the camera goes down, the air brightening with its speed; a push of pressure going in, a release as it opens into the lobby; the room beyond the Events door heard as air, opening as the door does; the door's mechanism; one soft transient at the threshold into the Events.
- **The Events** — nothing plays in the rooms but their own moments (no bed, no hum: the music is the bed). The Prodigy wall: each piece's move (a soft push of air) and its lock — contact tick, a short deep thunk, a brief struck-plate ring, a tiny buzz of material — each piece its own pitch and weight, the centre piece a fuller, lower lock; timed from the same function as the picture (`exhibits/common.ts: puzzleSpan`), forward only.
- **The portal** (`teams/travel.ts`) — the travel builds to its crossing (low movement gathering, air rising, two close tones whose beating quickens) and the crossing itself is a transient with a tone that blooms (falling away when going back out); an abandoned travel stops its sound.

One-off cues play when the film crosses their beat going forward (never scrubbed back, never on a jump) and re-arm once it is back before them. The music is never lowered for an effect — it is muffled only underground (`MusicDirector`). With sound off, nothing is made. (QA: `window.__sfxLog = []` and `window.__sfxLayers = {}`, set before Enter, record the cues and the layers' levels.)

## QA

`scripts/qa/intro.mjs <url> <out> "<steps>"` drives the page in headless Chrome (`scripts/qa/loop-memory.mjs` runs whole journeys through the loop and reports GPU resources, heap, DOM, listeners and audio nodes per loop; `scripts/qa/audio.mjs` measures the effects bus section by section — cues, level, tonal peaks): `at:<beat>` (cut the scroll there), `scroll:<beat>:<s>`, `settle`, `wheel(s)`, `swipe`, `key`, `shot`, `state`, `fstart`/`fstop` (frame timing), `reduced`, `eval(file)`. `window.__acm.intro` exposes `snapshot()`, `at(beat)`, `scroll(beat, s)`, `progressAt(beat)`, `skip()` in dev builds (or with `?debug`).
