# ACM · CEG — an immersive journey

The website of the **ACM-CEG Student Chapter**, College of Engineering Guindy, Anna University, Chennai, built as one continuous, scroll-driven 3D journey:

```
CEG red building → drone ascent → the campus → straight down the light-well → the underground facility
→ the events corridor (one room per programme) → "Beyond the events" door → impact
→ scroll through the team workspace, meeting every domain and its directors → the core
```

The event rooms are walk-in installations that perform their event as you scroll (columns that sort themselves for Head First, balloons rising over a contest for CodeX, a machine that boots for Bell Labs…), and the journey ends in the core at a hologram of the whole route.

Content is never loose text over the 3D: every piece is a **plate** — a crisp HTML card that lifts out of the thing it describes (the clock tower, a room's title wall, a domain's sign) and stays tied to it with a leader line and a pin. The facility has a split-flap departures board of every programme.

**Music or silence.** Enter with music and one track plays for the whole journey (muffled as you go underground); there are no other sounds. The track isn't in the repo — add your own copy at `public/audio/pink-white.mp3` (see docs/ASSETS.md).

No WASD: scrolling does everything, including walking the team. Each domain stages its own moment — the CP Wing watching Striver on a laptop under a whiteboard of formulas, Web & App's wall of screens rippling into one picture, a flash in the VDM studio, your badge from HR, and so on (see docs/ARCHITECTURE.md).

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
  content/                ← everything a committee edits: chapter, events, prodigy, team, domains,
                            alumni, gallery, faq, newsletter, media manifest, avatar schema
  config/                 world layout, scroll timeline, camera states, quality tiers, palette, asset slots
  experience/             canvas root, chapter streaming (SceneDirector), shader warm-up
  scenes/
    campus/               sky, the CEG building (cegModel.ts), grounds, fountains + light-well, OSM campus
    underground/          material kit, descent shaft, facility hall
    events/               corridor, EventRoom (walk-in installation), exhibits/ (walls + centrepieces), final door
    team/                 workspace, NPC, player hand, layout, meeting subtitles
      sets/               the welcome + one staged set per domain (Makers.tsx, Ops.tsx)
    final/                the core
    shared/               atmosphere, world lights, canvas panels, props, model slots, error boundary
  systems/
    camera/               pose math, drone flight, cinematic shots, impact, team tour, effects, CameraRig
    scroll/               progress channel, Lenis + ScrollTrigger timeline
    characters/           avatar rig, poses, choreography cues, appearance, registry
    lighting/             pooled point lights
    textures/             canvas typesetting, procedural surfaces
    audio/                the music player (one track, depth-filtered)
    anchors/              world points the HTML content cards point at
    performance/          device tiers, WebGL detection, GPU resource disposal
    geometry/             merge / metric-UV helpers
  components/
    experience/           HTML layer: loader, top bar, rail, chapter copy, captions, dossier,
                          content plates, team HUD, finale, index, keyboard, music director
    archive/              the printed edition (server-rendered)
  store/                  Zustand store (discrete state only)
docs/
  ARCHITECTURE.md         how the chapters connect, systems, performance
  CONTENT.md              updating events / team / next year's committee
  ASSETS.md               photos, GLB slots, avatar specs, what still needs professional modelling
```

## Documentation

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — the timeline, camera system, streaming, NPCs, performance, accessibility, known limitations.
- **[docs/CONTENT.md](docs/CONTENT.md)** — how to update events, the team, domains and everything else.
- **[docs/ASSETS.md](docs/ASSETS.md)** — installing the chapter's photographs, 3D model slots and their specs, avatar matching.

## Stack

Next.js 15 · React 19 · TypeScript · Three.js · React Three Fiber · Drei · GSAP ScrollTrigger · Lenis · Zustand. No physics engine (the team tour is choreographed, not simulated), no post-processing library (impact blur, vignette and the studio flash are CSS over the canvas), no sound effects — the site is either playing its soundtrack or silent.

Campus map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, available under the Open Database License (ODbL).
