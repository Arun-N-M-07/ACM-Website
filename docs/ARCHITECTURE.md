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
| THE CREW (the Teams world, `src/teams`) | somewhere else entirely (`TEAMS_ORIGIN`, far below and beyond the facility), reached only through the portal; THE CREW letters at its entrance, then the spine with CORE and the six domain cards on a helix around it (`teams/layout.ts`) |

Layouts that depend on content are computed from `src/content`, so adding an event re-flows the corridor. The Teams world is described in full in **[TEAMS_WORLD.md](TEAMS_WORLD.md)**.

## How the chapters connect

Scroll is a single normalised **progress** value (0 → 1) over a tall scroll track.

```
ScrollTimeline (Lenis + one ScrollTrigger) ──► progress.target
CameraRig (every frame): damp target → progress.value ──► publish to HTML overlays
                         segmentAt(value) → store.segment / chapter / activeRoom (on change only)
                         syncIntro(value) → the opening's beat (intro/controller)
                         updateTeams() → portal hold, walls, hover (teams/controller)
                         evaluateIntroShot() | evaluateCinematic(value) | evaluateTeamsShot() → camera pose
```

`src/config/timeline.ts` defines segment weights in viewport-heights:

| Segment | Camera | What happens |
|---|---|---|
| `arrival` | intro camera | the garden in pre-dawn mist |
| `story` | intro camera | four fragments of paper arrive, are read and burn; between the second and third, the chapter's name on a stone in the mist |
| `ceg` | intro camera | the mist clears on the red building; held; a glide over the pool to hover before the tower |
| `ascent` | intro camera | straight up the light-well's column, past the tower, through the cloud, above it |
| `descent` | intro camera | straight down through the cloud onto the light-well, which opens; down the shaft into the lobby; the EVENTS door opens; through into the corridor |
| `events` | EVENT_CAMERA | per room: walk out of the last portal, down the corridor and to the next portal (52%), then step inside while the installation performs (48%) |
| `portal` | cinematic | out of the last room, down the vestibule, stand square to the portal; from `PORTAL_DWELL` the camera holds there and scroll is walled at `PORTAL_GATE` until the portal is held |
| `teams` | Teams camera | through THE CREW (the camera flies between the letters), then the orbit: CORE and the six domain cards one by one around and down the spine, then the pull-back over the whole ring |

Every segment's first pose equals the previous segment's last pose (they share named states in `src/config/camera.ts`), so the move is continuous. Poses are yaw/pitch/roll (Euler YXZ) rather than look-at targets so the camera can interpolate all the way to straight down without flips.

**The opening** (`src/intro/`, **[INTRO.md](INTRO.md)**): its five segments are scrubbed by the same scroll as everything else — the rig hands the damped progress to `intro/controller`, which rescales it onto the opening's beat sheet (`intro/timeline.ts`); the camera (one Catmull-Rom path with a monotone time-warp, `intro/camera.ts`), the light (`intro/look.ts`) and every artefact are functions of that beat. It ends exactly on `facilityEnd`, the Events segment's first pose.

**The portal and the Teams world** (`src/teams/`): standing before the portal the visitor holds it for two seconds; the hold is the first stage of the transition (the world reacts progressively, and releasing early runs it all back). Completing it plays a timed travel (GSAP-clocked, scroll locked) through a streak tunnel into the Teams world, where scroll resumes and drives the orbit. A sustained upward scroll at the start of the world travels back out through the portal. The one `CameraRig` still owns the camera throughout — it calls `teams/controller` for the hold, the walls and the Teams shot. Details, the state machine and the reference study: **[TEAMS_WORLD.md](TEAMS_WORLD.md)**.

**Walls** (`systems/scroll/progress.ts`): `progress.lock` is `[0, PORTAL_GATE]` outside and `[PORTAL_GATE, 1]` inside; input past a wall is clamped and the page's scroll position is put back on it (`ScrollTimeline`). Jumps clamp too; navigation (`components/experience/navigation.ts`) is what crosses between worlds.

## The event rooms: walk-in installations

Every room is an installation you step into (`scenes/events/EventRoom.tsx`, `scenes/events/exhibits/`). The glass fronts are gone: each room opens onto the corridor through a lit portal with its number and title above it. Its back and side walls are one wraparound projection (`exhibits/walls.ts`), and a centrepiece (`exhibits/pieces.tsx`) performs the event in sync. Both are driven by the room clock (`exhibits/common.ts`): 0 → 1 through the visit, straight from scroll, so every installation rewinds when you scroll back.

| Room | Installation |
|---|---|
| C.O.D.E | the whiteboard round: a system design draws itself, the syllabus ticks off, the mock-interview clock runs |
| Tech Talks | *signal* — a line of light runs around the room at head height, fed by a cable from the stage's microphone; the speaker's phrases leave the microphone, climb into the wall and travel outward around the room toward the audience; the stage edge and the room's light follow the voice, and the speaker (from the event's facts) is named for a moment |
| MasterClass | a lecture hall — you sit at the back while the talk runs through its slides, then the questions |
| Head Start | fourteen columns insertion-sort themselves, one swap per scroll step; the wall runs the loop with the live `i`, `j` |
| PatternX | *what comes next?* — four plinths: three terms of a sequence in small cubes, lit in turn as you read them, and an empty fourth; the next is built from the last (a copy lifts across, what's missing drops in) and the wall says the rule in plain words; staying, the sequence changes (steps, squares, doubling) |
| CodeX | contest night: standings reshuffle, the clock runs down, a balloon rises over a desk for every solve |
| Prodigy | nine puzzle pieces, one per Prodigy event, fly together into the picture |
| Open Source Mentorship Program | *the contribution wall* — three pair stations (a mentor's screen with a review open beside a contributor's laptop) face a history built into the back wall: `main` runs across it as a patinated rod, the project's earlier commits studded along its start; six branches fork from it during the walk up and run down into their rows of a relief contribution field (a bronze-framed bay of cells lit from within as the programme's weeks pass, left to right, standing out by how much was committed, in its own jade-to-celadon scale), fed by inlays rising from the stations; each branch then leaves the field as a pull request, rises through its mentor's review ring (lit as it is reviewed) and merges back, and `main` lights on, warm, to each merge and at last to its head beside *Merged upstream.*; a key over the wall (fork → commit → pull request → mentor review → merge) lights step by step (`ContributionWall`, `OSS_WALL`, `CONTRIBUTIONS`, `OSS_U`) |
| CodHer | hack night: *the span* — a cable-stayed bridge built across the back wall over the hack tables; its bronze pylon rises on the room's axis behind the trophy, and the deck is built out from it both ways as a balanced cantilever, a segment each side in turn, each lifted up from below and hung on its own gold stay; at submissions close the last joint at each bank closes and light runs out along the deck to both banks and up to the pylon's head, beside *Ship it.*, as the trophy rises; the wall behind carries the drawing it was built from (`CodherSpan`, `CODHER_SPAN`, `SPAN_U`) |

**Signature rooms.** Tech Talks and PatternX don't scrub with the scroll: each has one authored event on its own clock (`useSignature` in `exhibits/common.ts`) — quiet → activity → the moment → hold → settle → a long quiet, and again if you stay (varied by `cycle`). How awake the room is follows the camera: faint next door, waking through the approach, full inside, settling as you walk on; a return from further off starts the event afresh. Scroll still only moves the camera. With reduced motion each holds its clearest moment. An installation can lift the room's light a little through `PieceProps.response`, and its walls read the same state through `signatureOf(index)`. Wall content keeps to the part of the back wall the reading card leaves open (`openSpan`).

The rooms follow the order of `EVENTS` (this year's lineup), alternating sides of the corridor; flagship rooms are larger, and the corridor's ceiling rises over them. Which installation a room gets is its event's `artifact` key (`exhibits/index.ts`). Facts on the walls come from the event record; the rest is illustration.

## Content: plates attached to the world

Text is never placed loose over the 3D, and paragraphs are never painted into it. In-world graphics are display type only (titles, numbers, the departures board); the reading happens on **plates** (`components/experience/Plate.tsx`):

- a plate is an HTML card with a progress range; it fades in over a soft scrim on its side of the screen, so it reads over any scene;
- it is tied to a **world anchor** (`config/anchors.ts` — the clock tower, a room's title wall, the portal). `experience/AnchorProjector.tsx` projects every anchor to screen space once per frame, right after the camera moves, and the plate draws a leader line and pin to it — the card lifts out of the anchor as it appears;
- on phones plates become a bottom sheet and the leader rises from its top edge;
- `Plates.tsx` holds the journey's plates (chapter, membership, mission, facility, legacy, one per event room, the portal). Inside the Teams world, an open domain's people are dealt out of its card as a hand of CSS 3D cards (`teams/ui/MemberHand.tsx`, mounted by `teams/ui/DomainDetail.tsx`).

Camera framing is designed around them: rooms, the board and the monument are framed to one side so their plate can sit on the other.

## Depth and stability

- **Adaptive near plane** (`CameraRig`): above ground the near plane scales with altitude (0.25 m at eye level, up to 3 m at drone height), so the campus's stacked flat layers never z-fight; interiors use 0.1 m.
- **Flat layers** are ≥ 1 cm apart: OSM areas < roads < footpaths < the forecourt, lawns and plaza in `Grounds.tsx`.
- **Resolution** only steps down (rarely) under load — it never flips back and forth mid-scroll.
- **Warm-up**: the Teams world mounts at the threshold and compiles its materials then — twice, for the canvas and for a render target, since inside the world everything is drawn through the post-processing composer and three links a separate program for that — and uploads its textures, so neither the portal crossing nor the loop's seam waits on a shader; its spine geometry is built in idle-time slices.
- **Portrait phones**: below ground the lens widens and the camera steps back so interiors keep landscape-like coverage.

## Residency (`experience/SceneDirector.tsx`)

The journey is a loop (`components/experience/JourneyLoop.tsx`): from any point, either end of the world is one short scroll away, so nothing is unmounted behind the camera — rebuilding the opening's papers alone is seconds of canvas work, and it stalled the loop's seam. Every chunk is built and compiled once and then stays resident; what the camera can't see is hidden (`visible = false`), not unmounted.

| Chunk | Built | Hidden while |
|---|---|---|
| campus | behind the loader | the opening's camera is down in the lobby, or outside the film |
| intro, underground kit, signal thread | behind the loader | the camera is in the Teams world |
| corridor (+ portal) | behind the loader | the film is still above the door |
| teams | at the threshold ("Enter"), compiled and its textures uploaded then | the camera is outside it (`TeamsWorld`) |

Mount decisions are debounced (0.25 s) except during jump fades. Unmounting (only on leaving the page) still disposes geometry, materials and canvas textures (`useDisposable`, `CanvasPanel`, shared prop geometry is ref-counted).

The Events rooms are the one thing still streamed (all nine would hold ~100 MB of canvas textures): `EventCorridor` mounts those within `roomWindow` of the camera's station — outside the Events, the corridor end the track is on — and they come in **one a frame, nearest first** (rooms that left go at once). One room's build fits a frame; three at once did not, and the window jumps from one end of the corridor to the other at the loop's seam and on a jump.

## The loop (`components/experience/JourneyLoop.tsx`)

The track's two ends are the same mist (`fx.mist`, one DOM layer over every world, a pure function of progress). Past the last card of the Crew, the world first comes apart into tiles — the mosaic (`fx.mosaic`, `experience/mosaic.ts`): the picture shows its joints, then from the edges in each tile's piece slides, settles to its own colour, gathers into a point of light and dissolves — and the mist follows it in through the `return` segment, whole by 65% of the way; the track begins with a few beats of that mist before the film (`T.mist` → `T.prologue`), through which the opening is put back together, tile by tile, from the centre out. The mosaic is one fullscreen pass drawn by the frame owner over whatever drew the frame (the finished frame is copied, and the copy given back a few seconds after the mosaic ends); like the mist it is a pure function of progress, so it scrubs and reverses exactly, and it is left out with reduced motion. Its sound (`mosaicShimmer`, `mosaicTone`) is likewise a function of it: silent at both ends, fullest halfway. The loop is a seam between two points inside those whole-mist margins (`END_SEAM`, `START_SEAM`), short of the hard ends, tested on the scroll target — and made only once the camera, which follows the scroll (in the film at a capped cinematic pace, so a hard fling back through the opening can leave it far behind), is in the whole mist too. Crossing one, `navigation.wrapToStart / wrapToEnd` → `ScrollTimeline.shiftProgress(delta)` moves the scroll target, the camera's progress and Lenis by exactly the seam's length and carries Lenis's pending smoothing across — the scroll's speed and direction continue, nothing fades or snaps. `progress.cut` makes the Teams orbit cut rather than spring. `wheelShape`'s input shaping is faded in through the return so a wheel notch moves the same distance on both sides of the seam. Reduced motion keeps still-to-still jumps (`loopToStart / loopToEnd`).

## Systems

- **Lighting** — `scenes/shared/WorldLights.tsx` mounts every light once (three.js recompiles every shader when the light count changes). Chapters only change intensities. Below ground, `LightPool` moves a fixed handful of point lights to the fixtures nearest the camera; scenes register fixtures with `useLightAnchor(s)`.
- **Shader warm-up** — `experience/ShaderWarmup.tsx` compiles all material variants against the real light rig while the loader is up, then draws the whole world once into a small target and once to the canvas (a program is only really linked the first time it draws, and drawing to the screen — the Events — takes programs of its own). Its variant materials are kept, not disposed: disposing the last user of a program deletes it. The gas march (a scene of its own) and both post chains warm themselves the same way when they are built.
- **Typography** — one family, Montserrat (`app/layout.tsx`, next/font, variable weight, roman and italic), and one hierarchy defined once in `globals.css`: weight tokens (`--w-display` 700 … `--w-body` 400; semibold interface and uppercase labels) and tracking tokens (`--t-display` −0.035em … `--t-label` 0.14em, `--t-mark` 0.22em for the wordmark only). Rules take their role's tokens rather than choosing their own; `--serif` / `--sans` / `--mono` remain as the role names (display, text, label), all Montserrat. The one other letterform is ACM-CEG's own 3D blade face (`intro/world/AcmCeg.tsx`); the building's clock keeps its Roman numerals.
- **Typography in 3D** — every sign, poster, plaque and screen is a `CanvasPanel` drawn with the page's own web fonts (read from the next/font CSS variables), with the same roles (`systems/textures/typeset.ts`: a display line is semibold, a label semibold with its tracking held in; the gas "22 YEARS AGO" is Montserrat at its heaviest, as a density field).
- **Post-processing** — two chains, both built once behind the loader and kept for the visit (never rebuilt at the handoff, the portal or the loop's seam; a chain unused for a few seconds gives its render targets back, but not its programs), and they follow the canvas's pixel ratio as it steps down. Each frame exactly one thing draws (`experience/lens.ts`; the owner is the frame callback in `teams/post/PostProcessing.tsx`): the portal's and Teams world's chain near the portal, in the Teams world and while the opening's first beats are wholly mist (three's own RenderPass → bloom → OutputPass → [FXAA below 1.5× pixel ratio] → one final pass for warp / aberration / flash); else the opening's chain while the film is on screen (`intro/post/IntroPost.tsx`: bloom and the colour script's grade); else the canvas renders directly. Where the journey comes round, the same owner then draws the loop's mosaic over the finished frame (`experience/mosaic.ts`; its program linked behind the loader).
- **Campus data** — `scripts/build-campus.mjs` (`npm run campus:build`) queries OpenStreetMap (Overpass API) around CEG, projects everything into world metres (rotated so the red building's front faces +z and centred on the clock tower) and writes `public/data/campus.json`. `CampusModel.tsx` extrudes the buildings, lays roads and green areas, and scatters instanced trees away from buildings and roads. Map data © OpenStreetMap contributors, ODbL.
- **Music** — `systems/audio/music.ts` plays one track (`config/music.ts`) through a Web Audio low-pass: open above ground, muffled as the journey goes underground (`MusicDirector.tsx`), ducked through the portal and clear again in the Teams world. Sound design (`systems/audio/sfx.ts`, directed by `SoundDirector.tsx`) is procedural Web Audio — layers (mist air, cloud air, tunnel air, room air) and cues (thunder, tunnel, Prodigy tiles, portal) — every level derived from where the journey is (and, for motion sounds, how fast the camera moves), so it plays the same forwards and backwards. Nothing plays until the visitor chooses sound; without the music file installed the music controls are disabled.

## Performance notes

- Static architecture is merged per material (`systems/geometry/build.ts`); the red building's repeated parts (windows, pilasters, balusters, voussoirs…) are instanced per category; all campus buildings are two draw calls (caps + walls), all trees two (instanced).
- The Teams world is a handful of draw calls: one merged spine, one point cloud, one merged mesh for THE CREW, seven cards (one material each, the lettering printed inside it) with their mounts, nothing extra for an open domain (its people are a DOM hand of cards, `teams/ui/MemberHand.tsx`), a tunnel that only draws while travelling. Frosted glass is physical transmission; its extra pass only redraws the opaque objects behind it, at reduced resolution on smaller tiers.
- Quality tiers (`config/quality.ts`): DPR cap, shadows (high only), tree/block counts, canvas texture scale, room streaming window, pooled light count. The tier is chosen once at start-up and everything is built at it: from the device (touch, screen, memory, cores) and, where the browser names it, the GPU (`systems/performance/quality.ts gpuCap`: a software renderer starts low, an older Intel HD/UHD chip no higher than medium; anything else or unknown keeps what the device earns). The pixel ratio is the tier's, up to a budget of pixels per frame (a 16-inch retina laptop's own frame; only larger screens come down). `PerformanceMonitor` (in `ExperienceCanvas`) steps the pixel ratio down to a pixel per CSS pixel; a device still struggling then raises `degrade` (store), which turns only knobs that rebuild nothing — the gas march's resolution and steps, bloom, the glass's transmission resolution; after those, the phones' tier (floor 0.75) goes below a pixel per CSS pixel. A decline is checked before it is acted on: three frames are timed whole (a 1-pixel read waits for the GPU), and if they take well under the interval the browser is giving them, the rate is a cap (iOS Low Power Mode, a battery saver: 30 a second whatever is drawn) and nothing steps down. The gas march is sized in CSS pixels, so on phones `degrade` has two rungs of its own below the low tier — coarser, never fewer steps (fewer would march past the words' thin sheet).
- The sun's shadow map is drawn again only when it would come out different — the sun moved or came up, or the campus arrived — never on a still frame, never before dawn, never underground (`WorldLights`). The campus is hidden from the moment the camera goes down the shaft (checked frame against frame: it adds no pixel there).
- Overlays write the DOM only when a value changes, and read layout only when it can have changed (`Plate` measures its card on showing and on resize, not every frame). The Events' projection walls redraw only when what they are drawn from moves (the visit, the window) — or, for walls that play on time (`Exhibit.timeWalls`), while near.
- Room streaming: a panel's first draw, once the journey is running, is queued and done a few milliseconds' worth a frame with its texture's upload (`CanvasPanel`); a queued panel stays hidden until drawn, and under a jump's fade the queue is drawn at once. Fitting a line of type to a width (`typeset.fitSize`) measures twice rather than stepping through every size, and remembers its answers; canvases aren't drawn a second time for web fonts that were already loaded.
- The gas march only fetches the words' fine detail inside a stroke's slab where the word has formed, and not the fine octaves where they are faded out entirely (the same picture: those terms are multiplied by zero there).
- See-through things seen from both sides — the paper sheets, the fountains' column and sheet — are drawn back faces then front, as three draws a double-sided transparent material, but as a mesh and a material per side (back first, same place, same order), so no program is re-resolved each frame.
- The page's first script carries no renderer: the 3D world (R3F and three's WebGL renderer) comes with the canvas's own chunk, fetched as the page hydrates. What the page's own code needs of the Events (the room clock, the Prodigy wall's timing) is in `scenes/events/exhibits/roomClock.ts`, apart from the exhibits' R3F code.
- Procedural textures: no image or font files are downloaded for the world itself (the soundtrack is the one optional download).
- Per-frame values (progress, camera, the portal hold, the orbit) never go through React; overlays mutate styles from the progress channel (`teams/state.ts` keeps the Teams world's per-frame values the same way).

## Phones and touch

One site, adapting: the same camera path, scroll track, worlds and effects, with responsive parameters where a phone differs.

- **Viewport** — the stage is `100lvh` tall (`globals.css .stage`) and the scroll track is measured in `lvh` (`--track`): as a phone's browser bars slide in and out they cover the canvas instead of resizing it (which reallocated every render target and, upright, changed the portrait lens mid-swipe), and the track's length never changes under the ScrollTrigger, which is — rightly — not re-measured for the bars. Every programmatic scroll position (jumps, the loop's seam, the walls, rotation) is placed by the trigger's own start/end (`ScrollTimeline.scrollAt`), never the window's current height. A point on screen is placed in the picture by the canvas's size (`anchors.stage` / `toNdc`), not the window's; DOM overlays lay out in the visible viewport.
- **Safe areas** — `viewport-fit=cover`; `--gutter` is never inside a notch or the Dynamic Island at the sides (a phone on its side), and offsets from the top or bottom add their own inset to `--gutter-y`.
- **Composition** — portrait framing is the shared path with aspect-aware parameters (the opening's portrait lens, `CameraRig`'s underground widening, the Teams layout). A phone on its side (`orientation: landscape` and `max-height: 520px`) gets a compact top bar (the rooms' titles and the portal's sign are at the top of the picture) and plates as compact side cards. The member hand (`MemberHand.measure`) keeps its desktop layout wherever it fits the screen; where it wouldn't (CORE's four cards upright, any hand on its side) the cards come smaller, clear of the chrome, and a drawn card larger, so names and roles read.
- **Touch** — touch scrolls natively (Lenis smooths the wheel only); the canvas is `pan-y`, and `none` while scrolling is locked. The portal ring is `pan-y` too: a finger held on it is a hold, a swipe that starts on it scrolls and lets go. On a touch screen the page's ends neither pull to refresh nor bounce (vertically), taps don't flash, a long press on a member card neither selects nor calls up a menu, and the domain numbers, the dossier's and the index's close are full-size targets that stay in reach while their panel scrolls.
- **Audio** — on a phone the sound pauses while the page is hidden (another app, the screen locked) and picks up where it was on return; a context the system took away (iOS: a call, Siri) is resumed as the page comes back, or on the next touch — never without a gesture where the browser requires one (`music.watchPage`). The loader doesn't wait for a score the browser won't fetch before a gesture (iOS loads no media before one; `music.held`).

## Accessibility

- **Text version** (T, top bar, skip link, loader): the complete chapter as semantic HTML, server-rendered in the page (`#archive`), also at `/archive`.
- **Reduced motion** (OS setting or toggle): the camera cuts between framed stills behind fades instead of flying; no shake, blur, bob or smooth-scroll.
- **Keyboard**: scroll keys travel; hold Space or Enter on the portal to go through; N / P step between framed stops (N at the portal goes through); inside, the domain index is buttons, Enter opens, ← / → move between open domains, Esc closes; M index; T text version.
- **Index** (M): jump to any chapter, event room, CORE or any of the six domains (entering through the portal).
- The canvas is `aria-hidden`; every plate, label, the portal's prompt and an open domain's text are real HTML.
- Reduced motion: the portal still fills as you hold, then fades straight through; the orbit steps between framed stills of each card.
- **No WebGL / context lost** → the printed edition becomes the page.

## Known limitations

- The red building is modelled from its real footprint and photographs, but by hand — not a survey. The campus is as good as OpenStreetMap is (heights are from `building:levels` or estimated).
- CORE and the six domains show names and members only (CORE: roles and roll numbers too); nothing else is invented until the chapter writes it.
- Photographs are not bundled (the source site blocks automated downloads); install them from the site's own `assets/img`.
- The spine is procedural (not an authored model); a GLB could replace it later if the chapter commissions one.
