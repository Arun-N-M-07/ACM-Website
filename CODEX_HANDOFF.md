# Handoff prompt — ACM-CEG World (paste this to Codex)

You are taking over an in-progress, production-quality creative web project. Read this whole brief before touching code. Then read `README.md` and `docs/ARCHITECTURE.md`, `docs/CONTENT.md` and `docs/ASSETS.md` in the repo; they are up to date.

---

## 1. What this is

**ACM-CEG World** is the website of the **ACM-CEG Student Chapter** (Association for Computing Machinery student chapter at the College of Engineering Guindy, Anna University, Chennai; established 2004). It is built as **one continuous, scroll-driven 3D journey** rather than a normal website:

```
CEG red building at golden hour (on the fountain-pool axis)
→ drone rise up the clock tower → the whole campus from above (real OpenStreetMap data)
→ straight down a glass light-well into an underground facility
→ facility hall: split-flap "DEPARTURES" board of every programme + a 2004 monument wall
→ the events corridor: 10 walk-in rooms, one per programme, each a live installation
→ "Beyond the events" door → a timed push through it (the impact)
→ the team workspace: a scroll-driven first-person walk meeting every domain and its directors
→ the core: a hologram of the entire journey + a ring of every chapter member's name + the ending
```

Everything is driven by **scroll only** (no WASD, no click-to-walk). Scrolling backwards rewinds everything. Every factual word comes from the current site https://auceg.acm.org and lives in typed modules under `src/content/`. The same content is also server-rendered as semantic HTML (the text version, `/archive`, `/events/[slug]`), so it is crawlable, accessible and works without WebGL.

- **Location:** `~/Projects/acm-ceg-world` (macOS; this is not a git repo yet — see §9).
- **Owner's intent:** this is the chapter's flagship site. It should feel like an Awwwards-level experience (think Active Theory / Lusion / Igloo Inc) and be something nobody has seen from a student chapter.

## 2. The owner's aims (read carefully — this is the brief)

The owner writes casually and fast (often from a phone, often with screenshots). Interpret the intent, not the literal words. Their standing requirements:

1. **Content first, presented innovatively.** Content is the most important thing. Every page of content must be *extremely clear and readable*, but presented in inventive ways that belong to the 3D world, not as generic text boxes. "Innovative" must never mean "hard to read".
2. **Professional, never crappy.** Creative and bold, but polished: clean typography, consistent design system, no gimmicks that look cheap, no clutter, no overlapping text, nothing half-finished. When in doubt, choose restraint and craft over more effects.
3. **Highly creative, beyond the literal ask.** They explicitly give full creative freedom: "do something more creative and innovative than what I said". Propose and build ideas, but always in service of the content and always finished to a professional standard.
4. **Scroll-only first person.** In the team section you *meet* each domain by scrolling. Each meeting must be unique and tied to what that domain does. They loved:
   - the CP Wing: whiteboard of formulas, Striver's lecture on a laptop;
   - the Web & App wall of screens rippling into one picture;
   - the directors walking up to greet you.
5. **The red building must be a faithful replica of CEG**, and the opening drone shot must be smooth.
6. **No glitching or twitching:** smooth 60 fps, no z-fighting, no jitter, no hitches.
7. **Sound:** music mode plays *Pink + White* by Frank Ocean with **no other sound effects**; silent mode must remain. (The track is not bundled — see §8.)
8. **Mobile must work well** (portrait phones).

## 3. Hard rules (non-negotiable)

- **Never fabricate facts.** Names, roles, events, numbers, sponsors and prizes come only from `src/content/*` (sourced from auceg.acm.org).
  - Illustrative flavour (a scoreboard's team names, a boot log, meeting dialogue lines) is allowed only when it clearly isn't a factual claim.
  - Meeting lines live in `src/content/meetings.ts` and are flagged as editable flavour.
- **People:**
  - Avatars must be respectful, normally proportioned, professional; never sexualised or caricatured.
  - **Never infer anyone's gender, pronouns or appearance from their name.** Use they/them. Appearance is only set from reference photos (`appearance` in `content/team.ts`); otherwise it's a neutral placeholder.
- **Copyright:** do not download or commit the song or any copyrighted media. `public/audio/` is gitignored.
- **Scroll is the only input** for moving the camera. Everything must be a pure function of scroll progress, so it scrubs both ways.
- **Accessibility:** reduced motion (framed stills with fades), keyboard (N/P stops, M index, T text version), a full text version, real HTML text for all content, and `aria-hidden` on the canvas.
- **Don't break** the text version, SEO (sitemap, robots, OG image, `/events/[slug]`), or the WebGL-failure fallback.

## 4. Run it

```bash
cd ~/Projects/acm-ceg-world
npm install            # react/react-dom are pinned to ~19.2.0 on purpose (R3F 9.7 peer range)
npm run dev -- --port 3100
npm run typecheck
npm run build          # see note below
npm run campus:build   # refresh public/data/campus.json from OpenStreetMap (network)
```

- `predev`/`prebuild` run `scripts/scan-media.mjs`, which records which optional files exist under `public/media`, `public/models`, `public/brand` and `public/audio`. Missing ones degrade gracefully (no 404s).
- **Building while the dev server runs:** `next build` writes `.next`, which clobbers the running dev server. Either stop dev first, or build in a copy:
  ```bash
  rsync -a --exclude .next --exclude node_modules ./ /tmp/b/ && ln -s "$PWD/node_modules" /tmp/b/node_modules && (cd /tmp/b && npx next build)
  ```
- **Debug hook (dev, or `?debug` in production):** `window.__acm = { jump(p), scroll(p, seconds), store, progress, segments, tourProgress(stop, meet), roomProgress(room, visit), music }`.

## 5. Stack and architecture (short map — details in docs/ARCHITECTURE.md)

**Stack:**
- Next.js 15.5 (App Router), React 19.2, TypeScript.
- three 0.180, @react-three/fiber 9.7, drei 10.7.
- GSAP ScrollTrigger + Lenis, Zustand 5.
- No post-processing library, no physics engine, and no audio besides the one music track.

**Core ideas:**
- **One timeline.** `src/config/timeline.ts` defines segments in viewport-heights:
  - arrival 110, ascent 150, campus 110, topdown 70, descent 210, facility 130;
  - events (per room: 85, flagships 125, +40);
  - door 150, threshold 45, through 55;
  - team (160 + 118 per domain), core 190.

  Scroll → `progress.target` → damped `progress.value` in `CameraRig`.
- **Camera** (`src/systems/camera/`), with poses as yaw/pitch/roll (Euler YXZ):
  - `flight.ts` (drone flight): centripetal Catmull-Rom plus a Fritsch–Carlson time-warp.
  - `shots.ts`: per-segment shots. Event rooms: the camera walks from portal to portal on a Bézier through a corridor waypoint, then steps in during the visit.
  - `impact.ts`: the timed push through the door.
  - `tour.ts`: the team walk. Each stop = 40% walk + 60% meeting; `tourAt(p)` gives `{index, walk, meet}`.
  - `CameraRig.tsx`: owns the camera. Handles the adaptive near plane (fixes z-fighting from the drone), meeting focus/eye blending with a smoothed target, portrait-phone widening underground, and the impact → tour handover via `placeScroll`.
- **Streaming** (`src/experience/SceneDirector.tsx`): chapters mount and unmount by progress windows. The team hall mounts one domain set every couple of frames (no hitch). `useDisposable` disposes GPU resources.
- **Lighting:** `WorldLights` mounts every light once (to avoid shader recompiles). `LightPool` moves a fixed set of point lights to nearby fixtures via `useLightAnchor`. Materials for underground come from `scenes/underground/kit.tsx`.
- **Text in 3D:** `CanvasPanel` (Canvas-2D textures drawn with the page's own fonts via `systems/textures/typeset.ts`). Rule: **display type only in 3D** (titles, numbers, boards). No paragraphs painted into the world.
- **Content presentation — "plates"** (`components/experience/Plate.tsx`, `Plates.tsx`):
  - Every piece of content is a crisp HTML card that lifts out of the thing it describes. It stays tied to that thing with a leader line and pin, over a soft scrim.
  - World points come from `config/anchors.ts` (plus people's heads via `trackAnchor`) and are projected each frame by `experience/AnchorProjector.tsx`.
  - On phones, plates become a bottom sheet.
  - This is the site's signature content system: **use it for any new content.**
- **Campus:**
  - `scenes/campus/cegModel.ts` + `CEGBuilding.tsx`: the red building, from its real OSM footprint (rotated 7.9°, tower at origin, front toward +z), with instanced details, hipped roofs, clock and sign.
  - `CampusModel.tsx`: OSM buildings, roads and areas, plus instanced trees.
  - `Grounds.tsx`: forecourt, pool with water jets, plaza, and the glass light-well.
  - Flat layers are stacked ≥1–1.5 cm apart (OSM areas < roads < footpaths < forecourt/lawns/plaza). Keep that spacing, or z-fighting returns.
- **Facility:** `scenes/underground/FacilityHall.tsx`, `DeparturesBoard.tsx` (split-flap board that flips in with scroll; shows Chennai time), and `hallGraphics.ts` (monument wall).
- **Event rooms** (`scenes/events/EventRoom.tsx` + `exhibits/`): walk-in installations. Each room has open lit portals, three projection walls (`exhibits/walls.ts`) and a performing centrepiece (`exhibits/pieces.tsx`). Both are driven by the room clock (`exhibits/common.ts`, visit progress 0→1). The registry is keyed by each event's `artifact` (`exhibits/index.ts`):
  - Head First: columns sort themselves.
  - CodeX: contest night with a balloon for every solve.
  - C.O.D.E: a system design draws itself on a whiteboard.
  - Bell Labs: the room boots.
  - ML 101: gradient descent on a loss surface.
  - Schr0ding3r5: capture the flag, and the box opens.
  - MasterClass: a lecture hall.
  - OffCamp: cards pin up and paper planes fly out.
  - Prodigy: nine puzzle pieces assemble.
  - CodHer: a commit wall fills and the trophy rises.
- **Team** (`scenes/team/`):
  - `TeamWorkspace.tsx`: hall, commons, staged bays, NPCs, core.
  - `sets/*`: one choreographed set per domain station kind:
    - `Welcome.tsx`: the Chairperson's handshake.
    - `Makers.tsx`: CP Wing whiteboard + Striver laptop (camera leans over shoulders), Web & App 15-screen video wall, VDM photo studio with a flash, Content newspaper.
    - `Ops.tsx`: Events stage spotlight + confetti, HR badge on a lanyard, Sponsorship "take a seat" pitch, External Marketing phone, Internal Marketing roll-up banner + flying poster, Logistics conveyor + scan-in.
  - Choreography flows through `systems/characters/cues.ts`: `cue()` per person per frame, `focusOn(stop, target, weight, zoom, eye?)`, the handshake state, and the `tour` state.
  - `NPC.tsx` reads cues. People are procedural rigs (`systems/characters/rig.ts`, `poses.ts`), with GLB slots per member.
  - `MeetingDirector.tsx` turns `content/meetings.ts` lines into subtitles. `TeamHud.tsx` shows the domain plate and a speaker line from the subtitle to whoever is talking.
- **Core** (`scenes/final/CoreRoom.tsx`):
  - A projection table with a hologram of the whole journey: campus outlines, the red building, and underground plans with the route tube, a travelling comet and "you are here".
  - A rotating ring of every name: directors, faculty and alumni office bearers.
  - `FinaleOverlay.tsx` holds the ending text.
- **Music:**
  - `config/music.ts`: title, artist, `src: /audio/pink-white.mp3`.
  - `systems/audio/music.ts`: HTMLAudio + a Web Audio low-pass that muffles underground and ducks during the impact.
  - `MusicDirector.tsx` drives it.
  - The loader offers "Enter with music" / "Enter silently"; the top bar has a music toggle. Both are disabled with a hint when the file is missing.
- **Store** (`src/store/experience.ts`): discrete state only (phase: loading | ready | cinematic | impact; segment; chapter; activeRoom; tourStop; tourDomain; speech; musicOn; …). Per-frame values never go through React.

## 6. Conventions (follow them)

- Everything visual is a **pure function of scroll progress** (plus time for ambient motion). No state that only works when scrolling forward.
- New content goes on a **plate** with an anchor, never as loose text over the canvas.
- In-world type is **display scale only**. Keep it legible from the camera's actual distance, and check with a screenshot.
- Keep GPU resources in `useDisposable`, text surfaces in `CanvasPanel`, and never add or remove lights at runtime.
- Animate canvases only when near (`near` flags); keep 60 fps.
- Code style: match the surrounding code, with short explanatory header comments per file. TypeScript must pass `tsc --noEmit`.
- Docs (`README.md`, `docs/*.md`) are kept current. Update them with any structural change.

## 7. How to verify (do this for every visual change)

The QA scripts are in `scripts/qa/`. They need `npm i -D puppeteer-core` and Google Chrome at `/Applications/Google Chrome.app` (override with `CHROME=`).

```bash
# screenshots at named points (see the header of shots.mjs for all notations)
node scripts/qa/shots.mjs http://localhost:3100 /tmp/shots "0,0.085,gfacility:0.45,r1:0.6,t1:0.75,t11:0.6"
MOBILE=1 W=390 H=844 node scripts/qa/shots.mjs http://localhost:3100 /tmp/shots-m "r4:0.5,t2:0.8"
node scripts/qa/sheet.mjs /tmp/shots /tmp/shots/sheet.png 0.png 0.085.png   # contact sheet
node scripts/qa/probe.mjs http://localhost:3100 0 1 90                      # frame times while scrolling
```

- **Notations:**
  - `0.2`: raw progress.
  - `gSEG:f`: fraction of a segment.
  - `rN:f`: visit to event room N.
  - `xN:f`: walk into room N.
  - `tN:m`: team stop N's meeting (0 = welcome, 11 = core).
  - `wN:f`: walk into team stop N.
- **Last measured** (headless Chrome, Apple M3 Max): a steady 60 fps across the whole journey (median 16.7 ms, max 33–50 ms). Also test on a weaker machine and a real phone if you can.
- Look at every screenshot yourself. The owner judges visually: crooked framing, overlapping text, cropped titles or clutter count as bugs.

## 8. Known gaps and open items

1. **Photographs aren't installed.** The site's images (event posters, gallery, team photos, logo) couldn't be downloaded automatically; typographic fallbacks are used. `docs/ASSETS.md` lists every path to fill from auceg.acm.org's `assets/img/`. Photos would improve the team plates, event dossiers and archive.
2. **The soundtrack isn't included.** The owner must add their own `public/audio/pink-white.mp3`. Publishing it publicly needs a licence; flag this before any deployment.
3. **Avatars are stylised procedural rigs** (improved eyes; still simple bodies and clothing). They are the weakest visual element up close. Options: better procedural modelling (hands, clothing folds, hair), or consented GLB likenesses per member (slots exist; see `docs/ASSETS.md`). Never guess appearance from names.
4. **CEG building fidelity:** it's built from the real footprint and photos, but by eye. The owner wants an "insanely perfect replica". Compare against real front-elevation photos: porch proportions, window rhythm, tower stages, dome, colours.
5. **The core** was just redesigned (hologram + name ring). Refine the composition:
   - Hologram labels for its layers (Campus / Facility / Events / Team).
   - Highlight the route by chapter.
   - Improve the finale overlay layout.
   - Improve phone framing (the hologram reads small in portrait).
6. **Event rooms** were just rebuilt as installations. Polish each one:
   - CodeX desks are empty (seated contestants?).
   - The MasterClass speaker is absent.
   - Check that OffCamp's paper planes read clearly.
   - Material and lighting quality (floor reflections, light bloom) without hurting performance.
7. **Reduced motion:** verify every plate and installation lands on a sensible still (`REDUCED_MOTION_STOPS` in `shots.ts`).
8. **No git and no ESLint config.** Run `git init` and commit the current state first so every change is reversible. Add lint if useful.
9. **Deployment** (Vercel is the natural fit) hasn't been done. `metadataBase`/OG and the sitemap are in place.

## 9. What to do first

1. `git init && git add -A && git commit -m "Baseline: ACM-CEG World"` so everything is reversible.
2. `npm install && npm i -D puppeteer-core`, start dev on port 3100, and run the QA shots across the whole journey on desktop and mobile. Build your own picture of the current state.
3. Ask the owner what they want next, or pick from §8, **always** keeping §2 and §3 in mind: content first, innovative *and* legible, professional polish, no fabricated facts, and 60 fps.

## 10. Tone of work

- Be ambitious and inventive, but ship finished work.
- Every change should look deliberate, consistent with the existing design system, and verified with screenshots at desktop and phone size.
- Colours: ink `#0b0b0c`, bone `#efe9df`, CEG red `#a8412f`, ACM blue `#2b74d9`, warm `#ffb86b` (see `src/config/palette.ts`).
- Fonts (`src/app/layout.tsx`): Instrument Serif for display, Archivo (expanded width) for signage, and IBM Plex Mono for labels.
- When you report back, say plainly what changed, what you verified and what's still open.
