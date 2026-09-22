# Architecture

## One world, one timeline

The whole journey is one continuous coordinate system (metres, +y up):

| Place | Where |
|---|---|
| CEG red building | built from its OpenStreetMap footprint, clock tower at the origin, front toward +z (`scenes/campus/cegModel.ts`) |
| The campus | every building, road and green area around it from OpenStreetMap (`public/data/campus.json`) |
| Glass light-well | in the plaza between the building and the pool (`CAMPUS.well`), opens during the descent |
| Facility hall | y = −60, directly under the lawn (`UNDERGROUND.hall`) |
| Events corridor | runs north under the building; rooms alternate left/right; flagships face each other in a taller transept (`buildCorridorLayout`) |
| The door | end of a tall vestibule (`DOOR`) |
| Team workspace | beyond the door (`TEAM_ORIGIN`, `TEAM_HALL`); domain bays around the perimeter (`buildTeamLayout`) |
| The core | octagonal room at the centre of the workspace |

Layouts that depend on content are computed from `src/content`, so adding an event or a domain re-flows the world.

## How the chapters connect

Scroll is a single normalised **progress** value (0 → 1) over a tall scroll track.

```
ScrollTimeline (Lenis + one ScrollTrigger) ──► progress.target
CameraRig (every frame): damp target → progress.value ──► publish to HTML overlays
                         segmentAt(value) → store.segment / chapter / activeRoom (on change only)
                         evaluateCinematic(value) → camera pose
```

`src/config/timeline.ts` defines segment weights in viewport-heights:

| Segment | Camera | What happens |
|---|---|---|
| `arrival` | ARRIVAL_CAMERA | on the pool axis at the fountains, the red building at golden hour |
| `ascent` | DRONE_CAMERA | a drone rise up the garden, over the porch, up the face of the clock tower |
| `campus` | CAMPUS_CAMERA | pull back over the tower until the whole campus is in view |
| `topdown` | CAMPUS_CAMERA | orientation eases to a straight-down view over the light-well |
| `descent` | DESCENT_CAMERA | drop to 6 m, pause while the glass slides open, plunge down the shaft (depth meter), level out in the hall |
| `facility` | DESCENT_CAMERA | turn to the departures board, push in, pan past the corridor mouth to the 2004 monument, out into the corridor |
| `events` | EVENT_CAMERA | per room: walk out of the last portal, down the corridor and to the next portal (52%), then step inside while the installation performs (48%) |
| `door` | DOOR_CAMERA | approach, look up at "BEYOND THE EVENTS", door opens |
| `threshold` | DOOR_CAMERA | lean into the doorway; scrolling on across `IMPACT_TRIGGER` starts the impact |
| `through` | DOOR_CAMERA | only seen scrolling back: the way back out through the door |
| `team` | FIRST_PERSON_CAMERA | the tour: the welcome, then one stop per domain |
| `core` | FIRST_PERSON_CAMERA | walk into the core; the ending |

Every segment's first pose equals the previous segment's last pose (they share named states in `src/config/camera.ts`), so the move is continuous. Poses are yaw/pitch/roll (Euler YXZ) rather than look-at targets so the camera can interpolate all the way to straight down without flips.

**The drone flight** (`systems/camera/flight.ts`): arrival → ascent → campus → top-down is one flight. Centripetal Catmull-Rom splines carry the camera position and its look target through the `FLIGHT` keys in `config/camera.ts`, and a monotone (Fritsch–Carlson) time-warp keeps the speed smooth with no overshoot, easing in and out at both ends.

**Impact** (`systems/camera/impact.ts`): a timed, deterministic 1.9 s sequence — rush (accelerate, FOV opens, blur), jolt (decaying shake, head dip, small roll), recovery — that lands exactly on the first pose of the tour (`TOUR_START_POSE`). Scrolling is locked while it plays; then the page's scroll position is placed at the start of the `team` segment (`placeScroll`), and scroll drives the camera again.

**The team tour** (`systems/camera/tour.ts`): no WASD — scroll walks you through the workspace. Each stop is a slice of the `team`/`core` segments (`TOUR_WEIGHTS`): the first 40% of a slice is the walk (a Catmull-Rom path at eye height, head leading into the turn, a light footstep bob), the rest is the **meeting**. `tourAt(p)` gives `{ index, walk, meet }`; the rig publishes it on `tour` (`systems/characters/cues.ts`) every frame.

**Meetings are choreography, not AI.** Each domain's set (`scenes/team/sets/`) is a pure function of its stop's `meet` value, so every moment scrubs forwards and backwards with the scroll:

- sets write a `Cue` per person each frame (look, turn, wave, point at, extend a hand, stand, walk to…); `NPC.tsx` reads it and blends poses;
- sets can steer the camera with `focusOn(stop, target, weight, zoom, eye?)` — look at the laptop, lean over a shoulder, take a seat — which the rig blends on top of the tour pose;
- objects handed to the visitor (the newspaper, the badge, the phone) live in `CameraSpace`;
- `MeetingDirector.tsx` shows the lines from `content/meetings.ts` as subtitles for the stretch of `meet` they cover.

| Stop | Set | The moment |
|---|---|---|
| welcome | `Welcome.tsx` | the Chairperson walks over and shakes your hand (your own arm, `PlayerHand.tsx`), the office bearers wave, then a gesture into the hall |
| CP Wing | `GrindSet` | a whiteboard full of formulas; the camera leans over two directors' shoulders to watch Striver explain binary search on a laptop at 2× |
| Web & App | `TerminalWallSet` | fifteen screens of builds, diffs, app previews; the dev spins round, hits enter and the wall ripples into one picture — a map of the build with "you are here" |
| VDM | `StudioSet` | the tripod swings round, flash, and your photo lands on the design display as a poster |
| Content | `NewsroomSet` | today's Stack'D front page spins into your hands |
| Events | `StageSet` | house lights dip, the follow-spot swings off the stage onto you, confetti |
| HR | `PeopleDeskSet` | the org chart draws itself; the director brings over your badge and you join the chart |
| Sponsorship | `PitchSet` | you take a seat; the deck advances with your scroll, counters run up |
| External Marketing | `OutreachSet` | the reach map lights up; your phone buzzes — @acmceg — follow |
| Internal Marketing | `PosterWallSet` | the open-call banner rolls up out of its stand; a poster of you flies onto the wall |
| Logistics | `WarehouseSet` | crates ride the conveyor, the checklist ticks itself off, you get scanned and checked in |
| the core | `CoreRoom.tsx` | its door slides open as you arrive; the ending overlay |

Sets are chosen by each domain's `station` (`sets/index.tsx`), so a new domain can reuse any of them.

**Back to the journey** is just scrolling (or a jump): the whole experience is one timeline.

## The event rooms: walk-in installations

Every room is an installation you step into (`scenes/events/EventRoom.tsx`, `scenes/events/exhibits/`). The glass fronts are gone: each room opens onto the corridor through a lit portal with its number and title above it. Its back and side walls are one wraparound projection (`exhibits/walls.ts`), and a centrepiece (`exhibits/pieces.tsx`) performs the event in sync. Both are driven by the room clock (`exhibits/common.ts`): 0 → 1 through the visit, straight from scroll, so every installation rewinds when you scroll back.

| Room | Installation |
|---|---|
| Head First | fourteen columns insertion-sort themselves, one swap per scroll step; the wall runs the loop with the live `i`, `j` |
| CodeX | contest night: standings reshuffle, the clock runs down, a balloon rises over a desk for every solve |
| C.O.D.E | the whiteboard round: a system design draws itself, the syllabus ticks off, the mock-interview clock runs |
| Bell Labs | a dark room that boots — POST, bootloader, paging, scheduler — and powers the lights up with it |
| Machine Learning 101 | gradient descent on a real loss surface while the network trains and the loss curve falls |
| Schr0ding3r5 | capture the flag: the flag cracks character by character and the box opens |
| MasterClass | a lecture hall — you sit at the back while the talk runs through its slides, then the questions |
| OffCamp | opportunities pin themselves to the wall and fly out past you as paper planes |
| Prodigy | nine puzzle pieces, one per Prodigy event, fly together into the picture |
| CodHer | hack night: the commit wall fills, submissions close, the trophy rises |

Which installation a room gets is its event's `artifact` key (`exhibits/index.ts`). Facts on the walls come from the event record; the rest is illustration.

## The core: the journey as a hologram

`scenes/final/CoreRoom.tsx`: a projection table carries a hologram of the whole journey at 1:88 — the campus above (OpenStreetMap footprints as lines, the red building in red), and below it the shaft, facility, corridor and rooms, door, team hall and the core, with the route you took traced through them and a light running along it. A ring of names turns slowly around the walls: this year's team, the faculty and every office bearer in `content/alumni.ts`.

## Content: plates attached to the world

Text is never placed loose over the 3D, and paragraphs are never painted into it. In-world graphics are display type only (titles, numbers, the departures board); the reading happens on **plates** (`components/experience/Plate.tsx`):

- a plate is an HTML card with a progress range; it fades in over a soft scrim on its side of the screen, so it reads over any scene;
- it is tied to a **world anchor** (`config/anchors.ts` — the clock tower, a room's title wall, a domain's sign, a person's head). `experience/AnchorProjector.tsx` projects every anchor to screen space once per frame, right after the camera moves, and the plate draws a leader line and pin to it — the card lifts out of the anchor as it appears;
- on phones plates become a bottom sheet and the leader rises from its top edge;
- `Plates.tsx` holds the journey's plates (chapter, membership, mission, facility, legacy, one per event room, the door); `TeamHud.tsx` adds each domain's plate and the speaker line from the subtitle to whoever is talking.

Camera framing is designed around them: rooms, the board and the monument are framed to one side so their plate can sit on the other.

## Depth and stability

- **Adaptive near plane** (`CameraRig`): above ground the near plane scales with altitude (0.25 m at eye level, up to 3 m at drone height), so the campus's stacked flat layers never z-fight; interiors use 0.1 m.
- **Flat layers** are ≥ 1 cm apart: OSM areas < roads < footpaths < the forecourt, lawns and plaza in `Grounds.tsx`.
- **Resolution** only steps down (rarely) under load — it never flips back and forth mid-scroll.
- **Streaming**: the team hall mounts one domain set every couple of frames behind the closed door, instead of all at once.
- **Portrait phones**: below ground the lens widens and the camera steps back so interiors keep landscape-like coverage.

## Streaming (`experience/SceneDirector.tsx`)

| Chunk | Mounted while |
|---|---|
| campus | arrival → 70% of the descent |
| shaft | topdown → 30% into the facility |
| hall | 30% into the descent → 30% into the events |
| corridor (+ door) | 72% into the descent → the start of the team; rooms stream within `roomWindow` of the current station |
| team | from the door segment on, and during the impact |

Decisions are debounced (0.25 s) except during jump fades. Unmounting disposes geometry, materials and canvas textures (`useDisposable`, `CanvasPanel`, shared prop geometry is ref-counted).

## Systems

- **Lighting** — `scenes/shared/WorldLights.tsx` mounts every light once (three.js recompiles every shader when the light count changes). Chapters only change intensities. Below ground, `LightPool` moves a fixed handful of point lights to the fixtures nearest the camera; scenes register fixtures with `useLightAnchor(s)`.
- **Shader warm-up** — `experience/ShaderWarmup.tsx` compiles all material variants against the real light rig while the loader is up.
- **Typography in 3D** — every sign, poster, plaque and screen is a `CanvasPanel` drawn with the page's own web fonts (read from the next/font CSS variables).
- **Characters** — `systems/characters/`: `rig.ts` builds a normally-proportioned stylised person (12 draw calls, one shared vertex-coloured material); `poses.ts` holds activity poses + look/wave/point/handshake/walk overlays blended every frame; `cues.ts` is the choreography channel the sets write and the people read. With no cue, people keep working and glance up as you pass. `NPC.tsx` renders a GLB instead when one is installed.
- **Campus data** — `scripts/build-campus.mjs` (`npm run campus:build`) queries OpenStreetMap (Overpass API) around CEG, projects everything into world metres (rotated so the red building's front faces +z and centred on the clock tower) and writes `public/data/campus.json`. `CampusModel.tsx` extrudes the buildings, lays roads and green areas, and scatters instanced trees away from buildings and roads. Map data © OpenStreetMap contributors, ODbL.
- **Music** — `systems/audio/music.ts` plays one track (`config/music.ts`) through a Web Audio low-pass: open above ground, muffled as the journey goes underground (`MusicDirector.tsx`), ducked for the push through the door. There are no sound effects. Nothing plays until the visitor chooses music; without the file installed the music controls are disabled.

## Performance notes

- Static architecture is merged per material (`systems/geometry/build.ts`); the red building's repeated parts (windows, pilasters, balusters, voussoirs…) are instanced per category; all campus buildings are two draw calls (caps + walls), all trees two (instanced).
- Every team set animates its screens only when the tour is within one stop of it (`useStopClock().near`).
- Quality tiers (`config/quality.ts`): DPR cap, shadows (high only; the shadow map stops updating underground), tree/block counts, canvas texture scale, room streaming window, pooled light count. `PerformanceMonitor` lowers DPR and, if the device keeps struggling, the tier.
- Procedural textures: no image or font files are downloaded for the world itself (the soundtrack is the one optional download).
- Per-frame values (progress, camera, NPC internals) never go through React; overlays mutate styles from the progress channel.

## Accessibility

- **Text version** (T, top bar, skip link, loader): the complete chapter as semantic HTML, server-rendered in the page (`#archive`), also at `/archive`.
- **Reduced motion** (OS setting or toggle): the camera cuts between framed stills behind fades instead of flying; no shake, blur, bob or smooth-scroll.
- **Keyboard**: scroll keys travel (through the team too); N / P step between framed stops, including every meeting; M index; T text version; Esc closes dialogs. The tour bar's ‹ › buttons walk to the previous / next domain.
- **Index** (M): jump to any chapter, event room, any domain in the team, or the core.
- The canvas is `aria-hidden`; every plate, spoken line (subtitle) and label is real HTML text, rendered whether or not it is on screen.
- Reduced motion also turns the studio's camera flash off, and each meeting becomes two framed stills.
- **No WebGL / context lost** → the printed edition becomes the page.

## Known limitations

- The red building is modelled from its real footprint and photographs, but by hand — not a survey. The campus is as good as OpenStreetMap is (heights are from `building:levels` or estimated).
- Avatars are procedural placeholders with neutral appearance until matched to reference photos or replaced by GLBs.
- Director titles are inferred from the team page's image filenames; verify against the card images.
- Photographs are not bundled (the source site blocks automated downloads); install them from the site's own `assets/img`.
- Meeting lines in `content/meetings.ts` are light, friendly flavour written for the tour, not quotes; the chapter should edit them to taste.
