# ACM · CEG — an immersive journey

The website of the **ACM-CEG Student Chapter**, College of Engineering Guindy, Anna University, Chennai, built as one continuous, scroll-driven 3D journey:

```
CEG red building → drone ascent → the campus → straight down the light-well → the underground facility
→ the events corridor (one room per programme) → the portal: TOUCH & HOLD
→ travel through it → THE TEAM → the Teams world: CORE and six domain cards around a spine
```

The event rooms are walk-in installations that perform their event as you scroll (columns that sort themselves for Head First, balloons rising over a contest for CodeX, a machine that boots for Bell Labs…). The corridor ends at a portal: press and hold it (mouse, touch or keyboard) and the world reacts stage by stage for two seconds, then carries you through a tunnel of light to **THE TEAM** — the words built as architecture, which scrolling flies you through into the **Teams world**: a massive vertebral spine with CORE and the chapter's six domains on frosted cards around it. Scroll orbits the spine card by card; choose any card and the camera flies through its surface into the domain's room: its name and members, on a screen at the end of a space in the domain's tone. See [docs/TEAMS_WORLD.md](docs/TEAMS_WORLD.md).

Content is never loose text over the 3D: every piece is a **plate** — a crisp HTML card that lifts out of the thing it describes (the clock tower, a room's title wall, the portal) and stays tied to it with a leader line and a pin; in the Teams world an open domain becomes a screen in a darkened room, its details typed in beside it. The facility has a split-flap departures board of every programme.

**Music or silence.** Enter with music and one track plays for the whole journey (muffled as you go underground); there are no other sounds. The track isn't in the repo — add your own copy at `public/audio/pink-white.mp3` (see docs/ASSETS.md).

No WASD: scrolling does everything, including the orbit of the Teams world; pointer and touch add a restrained parallax and open cards.

All factual content comes from the current site (https://auceg.acm.org) and lives in typed modules under `src/content/`. Every fact is also published as semantic HTML (the text version, `/archive`, `/events/[slug]`), so the site stays crawlable, accessible and usable without WebGL.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (runs the media scan first)
npm start          # serve the production build
npm run typecheck  # TypeScript only
npm run campus:build  # refresh public/data/campus.json from OpenStreetMap (needs internet)
```

Node 20+ (tested with Node 22). `npm run dev` / `build` first run `scripts/scan-media.mjs`, which records which optional photos / GLB models exist in `public/` so missing ones degrade to typographic stand-ins instead of broken requests.

## Project structure

```
src/
  app/                    Next.js App Router: /, /archive, /events/[slug], sitemap, robots, OG image
  content/                ← everything a committee edits: chapter, events, prodigy, teams (CORE + the
                            six domains + members), faculty, alumni, gallery, faq, newsletter, media manifest
  config/                 world layout, scroll timeline, camera states, quality tiers, palette, asset slots
  experience/             canvas root, chapter streaming (SceneDirector), shader warm-up
  scenes/
    campus/               sky, the CEG building (cegModel.ts), grounds, fountains + light-well, OSM campus
    underground/          material kit, descent shaft, facility hall
    events/               corridor, EventRoom (walk-in installation), exhibits/ (walls + centrepieces)
    shared/               atmosphere, world lights, signal thread, canvas panels, props, model slots, error boundary
  teams/                  the portal and the Teams world (docs/TEAMS_WORLD.md)
    portal/               the ring, membrane, motes (PortalEntry)
    world/                TeamsWorld scene: TeamEntrance + letters, Spine, ParticleField, DomainCards,
                          Tunnel, Backdrop, environment
    post/                 PostProcessing (bloom + one final pass; only near the portal and inside)
    ui/                   PortalHold, TeamsHud, DomainDetail + MemberHand (an open domain's hand of cards), TeamsInput, TypeIn, teams.css (mounted by TeamsExperience)
    state · layout · camera · travel · focus · controller   state machine, composition, shots, timelines
  systems/
    camera/               pose math, drone flight, cinematic shots, effects, CameraRig (the one camera owner)
    scroll/               progress channel (with the portal walls), Lenis + ScrollTrigger timeline
    lighting/             pooled point lights
    textures/             canvas typesetting, procedural surfaces
    audio/                the music player (one track, depth-filtered)
    anchors/              world points the HTML content cards point at
    performance/          device tiers, WebGL detection, GPU resource disposal
    geometry/             merge / metric-UV helpers
  components/
    experience/           HTML layer: loader, top bar, rail, chapter copy, captions, dossier,
                          content plates, index, keyboard, music director
    archive/              the printed edition (server-rendered)
  store/                  Zustand store (discrete state only)
docs/
  ARCHITECTURE.md         how the chapters connect, systems, performance
  CONTENT.md              updating events / the six domains / next year's committee
  ASSETS.md               photos, GLB slots, what still needs professional modelling
  TEAMS_WORLD.md          the portal + Teams world: reference study, design, systems, QA
```

## Documentation

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — the timeline, camera system, streaming, performance, accessibility, known limitations.
- **[docs/TEAMS_WORLD.md](docs/TEAMS_WORLD.md)** — the portal and the Teams world: the reference study, design and systems.
- **[docs/CONTENT.md](docs/CONTENT.md)** — how to update events, the six domains and everything else.
- **[docs/ASSETS.md](docs/ASSETS.md)** — installing the chapter's photographs, 3D model slots and their specs.

## Stack

Next.js 15 · React 19 · TypeScript · Three.js · React Three Fiber · Drei · GSAP ScrollTrigger · Lenis · Zustand. No physics engine, no post-processing library (the portal and Teams world use three's own composer passes; elsewhere vignette and fades are CSS over the canvas), no sound effects — the site is either playing its soundtrack or silent.

Campus map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, available under the Open Database License (ODbL).
