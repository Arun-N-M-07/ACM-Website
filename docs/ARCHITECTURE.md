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
| The portal | set into the end wall of a tall vestibule (`PORTAL`) |
| The Teams world | somewhere else entirely (`TEAMS_ORIGIN`, far below and beyond the facility), reached only through the portal; the spine and the six domain cards on a helix around it (`teams/layout.ts`) |

Layouts that depend on content are computed from `src/content`, so adding an event re-flows the corridor. The Teams world is described in full in **[TEAMS_WORLD.md](TEAMS_WORLD.md)**.

## How the chapters connect

Scroll is a single normalised **progress** value (0 → 1) over a tall scroll track.

```
ScrollTimeline (Lenis + one ScrollTrigger) ──► progress.target
CameraRig (every frame): damp target → progress.value ──► publish to HTML overlays
                         segmentAt(value) → store.segment / chapter / activeRoom (on change only)
                         updateTeams() → portal hold, walls, hover (teams/controller)
                         evaluateCinematic(value) or evaluateTeamsShot() → camera pose
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
| `portal` | cinematic | out of the last room, down the vestibule, stand square to the portal; from `PORTAL_DWELL` the camera holds there and scroll is walled at `PORTAL_GATE` until the portal is held |
| `teams` | Teams camera | the orbit: an establishing view, the six cards one by one around and down the spine, then the pull-back over the whole ring |

Every segment's first pose equals the previous segment's last pose (they share named states in `src/config/camera.ts`), so the move is continuous. Poses are yaw/pitch/roll (Euler YXZ) rather than look-at targets so the camera can interpolate all the way to straight down without flips.

**The drone flight** (`systems/camera/flight.ts`): arrival → ascent → campus → top-down is one flight. Centripetal Catmull-Rom splines carry the camera position and its look target through the `FLIGHT` keys in `config/camera.ts`, and a monotone (Fritsch–Carlson) time-warp keeps the speed smooth with no overshoot, easing in and out at both ends.

**The portal and the Teams world** (`src/teams/`): standing before the portal the visitor holds it for two seconds; the hold is the first stage of the transition (the world reacts progressively, and releasing early runs it all back). Completing it plays a timed travel (GSAP-clocked, scroll locked) through a streak tunnel into the Teams world, where scroll resumes and drives the orbit. A sustained upward scroll at the start of the world travels back out through the portal. The one `CameraRig` still owns the camera throughout — it calls `teams/controller` for the hold, the walls and the Teams shot. Details, the state machine and the reference study: **[TEAMS_WORLD.md](TEAMS_WORLD.md)**.

**Walls** (`systems/scroll/progress.ts`): `progress.lock` is `[0, PORTAL_GATE]` outside and `[PORTAL_GATE, 1]` inside; input past a wall is clamped and the page's scroll position is put back on it (`ScrollTimeline`). Jumps clamp too; navigation (`components/experience/navigation.ts`) is what crosses between worlds.

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

## Content: plates attached to the world

Text is never placed loose over the 3D, and paragraphs are never painted into it. In-world graphics are display type only (titles, numbers, the departures board); the reading happens on **plates** (`components/experience/Plate.tsx`):

- a plate is an HTML card with a progress range; it fades in over a soft scrim on its side of the screen, so it reads over any scene;
- it is tied to a **world anchor** (`config/anchors.ts` — the clock tower, a room's title wall, the portal). `experience/AnchorProjector.tsx` projects every anchor to screen space once per frame, right after the camera moves, and the plate draws a leader line and pin to it — the card lifts out of the anchor as it appears;
- on phones plates become a bottom sheet and the leader rises from its top edge;
- `Plates.tsx` holds the journey's plates (chapter, membership, mission, facility, legacy, one per event room, the portal). Inside the Teams world, an open domain's details type in beside its card (`teams/ui/DomainDetail.tsx`).

Camera framing is designed around them: rooms, the board and the monument are framed to one side so their plate can sit on the other.

## Depth and stability

- **Adaptive near plane** (`CameraRig`): above ground the near plane scales with altitude (0.25 m at eye level, up to 3 m at drone height), so the campus's stacked flat layers never z-fight; interiors use 0.1 m.
- **Flat layers** are ≥ 1 cm apart: OSM areas < roads < footpaths < the forecourt, lawns and plaza in `Grounds.tsx`.
- **Resolution** only steps down (rarely) under load — it never flips back and forth mid-scroll.
- **Warm-up**: the Teams world mounts during the walk down the vestibule and compiles its materials then (`compileAsync`), so the crossing never hitches; its spine geometry is built in idle-time slices.
- **Portrait phones**: below ground the lens widens and the camera steps back so interiors keep landscape-like coverage.

## Streaming (`experience/SceneDirector.tsx`)

| Chunk | Mounted while |
|---|---|
| campus | arrival → 70% of the descent |
| shaft | topdown → 30% into the facility |
| hall | 30% into the descent → 30% into the events |
| corridor (+ portal) | 72% into the descent → the portal gate; rooms stream within `roomWindow` of the current station. Remounted as soon as the visitor starts travelling back out. |
| teams | from a quarter of the way down the vestibule, while travelling, and inside |

Decisions are debounced (0.25 s) except during jump fades. Unmounting disposes geometry, materials and canvas textures (`useDisposable`, `CanvasPanel`, shared prop geometry is ref-counted).

## Systems

- **Lighting** — `scenes/shared/WorldLights.tsx` mounts every light once (three.js recompiles every shader when the light count changes). Chapters only change intensities. Below ground, `LightPool` moves a fixed handful of point lights to the fixtures nearest the camera; scenes register fixtures with `useLightAnchor(s)`.
- **Shader warm-up** — `experience/ShaderWarmup.tsx` compiles all material variants against the real light rig while the loader is up.
- **Typography in 3D** — every sign, poster, plaque and screen is a `CanvasPanel` drawn with the page's own web fonts (read from the next/font CSS variables).
- **Post-processing** — only near the portal and in the Teams world (`teams/post/PostProcessing.tsx`: three's own RenderPass → bloom → OutputPass → one final pass for warp / aberration / flash). Everywhere else the canvas renders directly.
- **Campus data** — `scripts/build-campus.mjs` (`npm run campus:build`) queries OpenStreetMap (Overpass API) around CEG, projects everything into world metres (rotated so the red building's front faces +z and centred on the clock tower) and writes `public/data/campus.json`. `CampusModel.tsx` extrudes the buildings, lays roads and green areas, and scatters instanced trees away from buildings and roads. Map data © OpenStreetMap contributors, ODbL.
- **Music** — `systems/audio/music.ts` plays one track (`config/music.ts`) through a Web Audio low-pass: open above ground, muffled as the journey goes underground (`MusicDirector.tsx`), ducked through the portal and clear again in the Teams world. There are no sound effects. Nothing plays until the visitor chooses music; without the file installed the music controls are disabled.

## Performance notes

- Static architecture is merged per material (`systems/geometry/build.ts`); the red building's repeated parts (windows, pilasters, balusters, voussoirs…) are instanced per category; all campus buildings are two draw calls (caps + walls), all trees two (instanced).
- The Teams world is a handful of draw calls: one merged spine, one point cloud, six cards (glass + face), a tunnel that only draws while travelling. Frosted glass is physical transmission; its extra pass only redraws the spine, at reduced resolution on smaller tiers.
- Quality tiers (`config/quality.ts`): DPR cap, shadows (high only; the shadow map stops updating underground), tree/block counts, canvas texture scale, room streaming window, pooled light count. `PerformanceMonitor` lowers DPR and, if the device keeps struggling, the tier.
- Procedural textures: no image or font files are downloaded for the world itself (the soundtrack is the one optional download).
- Per-frame values (progress, camera, the portal hold, the orbit) never go through React; overlays mutate styles from the progress channel (`teams/state.ts` keeps the Teams world's per-frame values the same way).

## Accessibility

- **Text version** (T, top bar, skip link, loader): the complete chapter as semantic HTML, server-rendered in the page (`#archive`), also at `/archive`.
- **Reduced motion** (OS setting or toggle): the camera cuts between framed stills behind fades instead of flying; no shake, blur, bob or smooth-scroll.
- **Keyboard**: scroll keys travel; hold Space or Enter on the portal to go through; N / P step between framed stops (N at the portal goes through); inside, the domain index is buttons, Enter opens, ← / → move between open domains, Esc closes; M index; T text version.
- **Index** (M): jump to any chapter, event room, or any of the six domains (entering through the portal).
- The canvas is `aria-hidden`; every plate, label, the portal's prompt and an open domain's text are real HTML.
- Reduced motion: the portal still fills as you hold, then fades straight through; the orbit steps between framed stills of each card.
- **No WebGL / context lost** → the printed edition becomes the page.

## Known limitations

- The red building is modelled from its real footprint and photographs, but by hand — not a survey. The campus is as good as OpenStreetMap is (heights are from `building:levels` or estimated).
- The six domains show names and members only; everything else is marked `[CONTENT PLACEHOLDER]` until the chapter writes it.
- Photographs are not bundled (the source site blocks automated downloads); install them from the site's own `assets/img`.
- The spine is procedural (not an authored model); a GLB could replace it later if the chapter commissions one.
