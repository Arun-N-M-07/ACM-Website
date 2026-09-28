# The Teams world — reverse-engineering report & implementation plan

This document records the investigation that preceded the Teams redesign and
the plan it was built from. It covers the repo audit (phase 0), the reference
audit of activetheory.net/work in a real browser (phase 1), the DDW-X research
repository (phase 2), and the plan.

The reference was studied for *behaviour*. No Active Theory code, shaders,
geometry, textures or media were copied; everything in `src/teams/` is
original and procedural.

---

## 0 · Repo audit

**Stack.** The app runs Next 15.5 (App Router) with React ~19.2 and
TypeScript. The 3D uses three 0.180, @react-three/fiber 9 and drei 10. Scroll
uses GSAP ScrollTrigger with Lenis 1.3, and state uses Zustand 5. There is no
post-processing library.

**Architecture that matters here:**

- **One canvas and one camera owner.** `systems/camera/CameraRig.tsx` damps
  scroll progress into `progress.value`, evaluates the shot for that progress,
  and applies drift, portrait widening and the adaptive near plane. Two systems
  writing the camera would fight, so the Teams camera is evaluated *by* this
  rig, not by a second rig.
- **One scroll track.** `systems/scroll/ScrollTimeline.tsx` drives Lenis and a
  single ScrollTrigger, which feeds `progress.setTarget(0..1)`. Everything else
  derives from `config/timeline.ts` (segment vh weights).
- **Residency.** `experience/SceneDirector.tsx` builds every world chunk once
  (the Teams world at the threshold) and keeps it resident, hiding what the
  camera can't see — the journey loops, so either end is always one short
  scroll away. `useDisposable` frees GPU memory on unmount (leaving the page).
- **Global look.** `Atmosphere` (fog, background, environment) and
  `WorldLights` (a constant light set plus `LightPool` point lights) blend by
  `world.underground`.
- **DOM overlay.** `AnchorProjector` projects world anchors every frame.
  `Plates` and HUDs position themselves from those anchors without re-rendering
  React.

**How Events ended before.** The events corridor (`scenes/events/EventCorridor.tsx`)
ends in a tall vestibule at `DOOR.z`. The `door` → `threshold` → `through`
segments opened `FinalDoor`. Crossing `IMPACT_TRIGGER` played a timed push
(`impact.ts`, phase `'impact'`). The camera then handed over to the old
first-person tour (`team` and `core` segments: `TeamWorkspace` with NPCs,
bays and meetings, then `CoreRoom`).

**Integration point.** Replace everything from the door onwards:

```
… events │ portal (scroll-driven approach, gated) ║ HOLD ║ travel (timed) │ teams (scroll-driven) │
```

- The vestibule's end wall becomes the portal.
- The `door`, `threshold`, `through`, `team` and `core` segments become
  `portal` and `teams`.
- The old team workspace, NPC and character systems, the core room, the tour,
  the impact and the team HUD are removed.
- Nothing before the events corridor changes.

**Reuse.** The Teams world reuses the camera owner, the progress channel,
Lenis, the anchor projector, the canvas typesetting (Archivo, Plex Mono and
Instrument Serif), `useDisposable`, the quality tiers, the ScreenFx fade and
the music system.

**Dependencies.** No new runtime dependency is needed. Bloom, output and
custom passes come from `three/examples/jsm/postprocessing`, which ships inside
`three`.

---

## 1 · Reference audit — activetheory.net/work

The site was driven in the in-app browser at 1440×900 and 390×844. The
audit covered load, idle, wheel input at 1-, 2-, 3- and 10-tick bursts,
stopping mid-scroll, reversing, pointer sweeps, hover, clicking the centre card
and a side card, closing by scroll, and the home → work transition.

### Rendering split

- **WebGL.** One full-screen WebGL2 canvas (DPR 2) renders the spine, the cards
  and the card titles (SDF text), the particles, the background and the detail
  "device".
- **DOM.** The DOM holds the nav pill, the "What are you looking for?" filter
  list, "Ask me anything", the music controls, the detail copy and
  "Scroll to close".
- **Hidden accessible mirror.** An off-screen mirror of links (every project
  name) serves accessibility and SEO.
- **No native scroll.** The document never scrolls (`body{overflow:hidden}`,
  scroll height = viewport). Scrolling is virtual: wheel and touch deltas feed
  a smoothed value.

### Initial state

- **Spine.** A tall vertical organic column (vertebra-like) runs through the
  centre of the frame from above the top edge to below the bottom edge. It is
  glassy and iridescent: pink, violet and cyan thin-film sheen, with sharp
  specular highlights. It has an irregular, spiky silhouette. Colour shifts
  with the viewing angle.
- **Centre card.** It sits in front of the spine, facing the camera, at about
  55 % of the viewport width. It is a rounded rectangle (corner radius ≈ 4 %
  of its width) with a thin light edge.
- **Card material.** Frosted, translucent glass. The spine behind it shows
  through, blurred. The card carries project imagery (video) at partial
  opacity.
- **Neighbours.** The next card appears at the right edge, rotated about 50–60°
  and further back. The previous card sits at the left edge, rotated the other
  way. This reads as an orbit.
- **Particles.** Dense, colourful dust clusters ("blooms" of pink, violet and
  blue) sit behind the cards around the spine, plus sparse fine dust.
- **Background and grade.** Near-black with a blue-teal wash at the top right
  and a violet haze at the bottom left. The image shows grain, soft bloom and
  vignette.
- **Card titles.** The client logo sits above the title. The title is a wide
  geometric monospace-like display face in uppercase, centred, about 9 % of the
  card height.

### Scroll

- **Continuous, not paged.** One wheel tick moves the carousel a fraction of a
  card. There is no snap after release: it drifts to rest with long inertia
  (~1–2 s) and then stays exactly there. With no input, nothing advances.
- **Motion.** Cards travel right → centre → left along a curved path around the
  spine, turning to face the camera at centre and away at the sides. The
  camera appears to orbit and descend: vertebrae slide upward on screen as you
  progress. It feels like travelling around an object, not scrolling a page.
- **Velocity.**
  - Particle clusters burst outward and stream with scroll velocity, then
    re-condense.
  - Titles run a scramble/decode: arriving cards decode character by
    character; leaving titles glitch-duplicate and break up.
- **Reverse.** Reversing is fully symmetric. Scrolling up past the first card
  continues upward into the home page (headline and ring) without a cut. Home
  and work are one continuous vertical space.

### Pointer

- The camera and the focused card tilt a few degrees towards the pointer and
  ease back.
- Hover (corrected in the second pass, below): a bright soft glint follows the
  cursor across the card under it, side cards included, and the card drifts a
  few px towards the pointer. The cursor is the ordinary hand; there is no
  custom cursor.
- Moving the pointer leaves a wake in the dust.
- Overall it is restrained: under about 3° of rotation and a few px of
  translation.

### Selection

This covers both the centre card and a side card.

- **Motion.** The URL changes to `/work/<slug>` immediately. The camera
  pushes into the clicked card: a side card is flown to directly, with no
  prior centring. The push takes ~1.0–1.2 s on a strong ease-in-out
  (expo/quart-like).
- **The card.** It scales to fill the centre and becomes a bezelled "device"
  showing the project.
- **The scene.** The spine, the other cards and the particles leave the frame.
  The world dims to a dark navy with a scanline/grain texture.
- **Detail copy.** It is DOM, bottom-left: title, year / client / type, a
  one-line description and links. It types in over ~1 s. "Scroll to close"
  appears at the top.
- **Closing.** Scroll or "← Close" reverses everything in ~1.5 s back to the
  carousel at the same scroll position.

### Second pass: side-by-side comparison

After the first build, the reference and ours were run side by side in the
same browser at 1440×900, moment by moment: at rest, idle, pointer sweeps,
hover, a single wheel notch, a fast scroll, a click and the close. Findings,
and what changed to match:

| Moment | Reference | Change made |
|---|---|---|
| At rest | Card ≈ 52 % wide, centre ≈ 59 % down, spine rising above it; neighbour turned ≈ 45° | Card 3.2 × 2.2 (≈ 1.45), gaze raised so the card sits ≈ 60 % down; spine 1.22× thicker; cards turn part-way towards the orbiting camera |
| Card face | Only a small mark above a centred, wide, glowing title | Face redrawn: `01 / 06` above the centred name, glow baked into the lettering; no frame or footer; a milky lit panel behind it at rest |
| Titles | Off-centre cards carry broken titles; arriving ones stutter in (doubled letters); leaving ones break apart | Four title states (settled / decoding / glitched / leaving), glyph-by-glyph |
| One wheel notch | A slow, weighted glide that keeps easing for > 3 s | The orbit follows scroll through an extra weighted glide (`ORBIT_GLIDE`) |
| Hover | Glint at the cursor on the card; small drift; hand cursor | Glint sprite at the exact hit point (eased); lean and drift towards it; hand cursor; the custom ring removed |
| Pointer | Dust wake behind a moving pointer | Pointer velocity drives a trailing displacement in the dust shader |
| Click | Camera dives through the card (title rushes up, lens warp) then settles | Dive past the framing with a barrel surge in the final pass |
| Open state | Dark room (blue-green, scanlines); media as a screen centre-right; mono details typed in at lower-left; SCROLL TO CLOSE at top | Everything outside the card sinks into a blue-green scanlined room; the card becomes a dark screen framed centre-right; the details (name, meta, members, placeholders, ← CLOSE) type in at lower-left; SCROLL TO CLOSE at top |
| Close | Quick (≈ 1 s): copy gone at once, camera pulls back | Unchanged (already ≈ 1.1 s); the nav types back in |
| Nav | "What are you looking for?" list, bottom-left, mono, `->` items | THE SIX DOMAINS list in the same place and voice; hidden while a domain is open |

The ‹‹ ›› arrows at the top right of the reference's detail are its music
player, not project navigation, so they were not reproduced (our previous /
next sit in the detail block instead).

### Third pass: the full flow, and smaller windows

The whole flow was run again against the reference: portal → hold → travel →
arrival → hover → open (centre and side cards) → hop → close → scroll → pull
out. It was also run at the in-app browser's size (1024×768) and at 800×600,
1180×820 and 1280×720.

| Moment | Reference | Change made |
|---|---|---|
| After arriving | The work opens on its first project, centred | The arrival now settles on card 01 centred (it used to rest on the establishing view before it, with the card smaller and right of centre); scrolling back up from card 01 still passes through that view before the pull-out |
| Nav at smaller windows | Its short filter names sit over the card's edge on a dark card | Our long domain names crossed the pale glass and lost contrast; the list now wraps inside the strip left of the card (`max(23.5vw, 50vw − 40.73vh)`, from the card fit) |
| Detail copy | The whole block types in | PREV · NEXT and CLOSE used to appear at once, ahead of the text; they now type in last, with the second placeholder |

### Home → work transition

The camera passes through the chrome ring logo (a portal) into a dark space.
Particles scatter, the headline pixel-dissolves, and the work spine and cards
rise from below. This is exactly the "enter a new world" idea the brief wants.

### Mobile (390×844)

- The same composition in portrait: the spine fills the height, the centre
  card overflows the width, and the next card peeks in at the right.
- Nothing was reorganised for portrait. Our build does reorganise (below).
- Touch input could not be exercised with a mouse emulator, so touch was not
  audited.

---

## 2 · DDW-X research repository

**What it is.** A third-party write-up with a "reconstructed" bundle. It is
treated as secondary and unverified. Its README documents engine-level systems
(the author's claims); nothing in it is specific to the work carousel or the
spine. The decompiled bundle was **not** mined: the brief forbids copying, and
the observed behaviour plus the documented techniques were enough.

### Relevant ideas, adapted rather than copied

| Reference effect | Observed behaviour | Likely technique | Our implementation |
|---|---|---|---|
| Virtual scroll with inertia | Long glide, no snap, symmetric reverse | Normalised wheel deltas → frame-rate-normalised lerp | Existing Lenis track → `progress.target` → exponential damping in `CameraRig` (same maths, already frame-rate independent). No second scroller. |
| Camera travels along content | Orbit and descent around the spine | Scroll value → camera transform | `teams/camera.ts`: carousel coordinate `c(u)` → orbit angle, height, dolly and look target. It is a pure function of progress plus layered parallax and velocity terms. |
| Frosted cards showing the spine | Blurred spine through the cards | Refraction/transmission or FBO sample | `MeshPhysicalMaterial` transmission + roughness (three renders a mip-blurred transmission target). Low tier falls back to a translucent non-transmissive glass. |
| Iridescent organic spine | Thin-film rainbow, sharp speculars, spiky silhouette | Authored mesh + env reflections + custom shading | Procedural vertebrae (merged, noise-displaced primitives), `MeshPhysicalMaterial` iridescence + clearcoat, and a studio env map (PMREM of a custom light-box scene). An `onBeforeCompile` hook adds a travelling "breath" wave and a fresnel inner tint. |
| Particle blooms | Coloured clusters, burst with scroll velocity | GPGPU (FBO ping-pong, curl noise) | Stateless GPU particles: rest positions in a `BufferGeometry` and motion in the vertex shader (analytic sin-based curl-like flow + velocity dispersal + pointer repulsion). There is no persistent state to simulate, so no FBO is needed. |
| Title scramble / decode | Glyphs cycle then settle left → right | SDF text with per-glyph animation | Canvas-typeset card faces redrawn for ~0.6 s while decoding (one card at a time). |
| Bloom / grain / vignette / CA | Soft highlights, film texture | Dual-filter bloom, rgb-shift, FXAA passes | `EffectComposer`: `RenderPass` → `UnrealBloomPass` (off on low) → `OutputPass` → one custom `FinalPass`. `FinalPass` does radial zoom blur, edge-weighted chromatic aberration, vignette and grain in one fullscreen draw. |
| Accessible WebGL | Hidden DOM mirror of GL objects | `.GLA11y` clipped DOM tree | Real `<button>`s: the hold target, a domain index (one button per card), the detail layer (DOM text) and Escape / scroll to close. |
| Frame-rate normalised lerp | Same feel at 60/120 Hz | `1 - exp(log(1-a)·hz)` | We already use `1 - exp(-dt·k)` everywhere. |

**Not needed:**

- Navier–Stokes fluid;
- the GLUI orthographic DOM-matching stage;
- KTX2/Draco pipelines (we have no heavy assets);
- worker time-slicing;
- UBO alignment;
- zero-GC pooling beyond what we already do (scratch vectors, no per-frame
  allocation).

---

## 3 · The design

### The portal

- **Placement.** It stands at the end of the events vestibule where the door
  was. The blue signal thread that runs through the whole journey now ends in
  the portal.
- **Build.**
  - The ring is a dark brushed-steel torus.
  - A thin light channel inside it fills clockwise as the hold progresses.
  - The membrane is a shader disc: a receding "depth well" of faint filaments
    in polar space.
  - Idle motes drift in front of it.
- **Prompt.** The DOM label reads `TOUCH & HOLD`. The hit target is the
  portal's projected disc: a real `<button>` that works with pointer, touch,
  pen and keyboard (Space/Enter held).

### The hold

The hold is a progress value `h`. It advances at 1/2 s while held, and on
release it falls back smoothly (critically damped), so the whole world reverses
with it. Each stage keys off `h`, so the hold *is* the first stage of the
transition:

| hold | reaction |
|---|---|
| 0.25 s | Ring tightens, membrane quickens, label → HOLD |
| 0.5 s | Light channel and membrane rim glow (bloom) |
| 0.75 s | Motes turn towards the portal and spiral in |
| 1.0 s | Corridor lights dim; the signal thread floods towards the portal (the environment "pulls") |
| 1.25 s | Camera starts to dolly in |
| 1.5 s | Dolly accelerates, FOV opens |
| 1.75 s | Radial blur + chromatic aberration rise |
| 2.0 s | Complete → the travel timeline takes over at the same velocity |

### Travel

A GSAP timeline (~2.8 s) tweens a plain `travel` object; nothing goes through
React. The stages:

1. The camera accelerates through the membrane (a flash peak hides the
   teleport).
2. The camera enters a streak tunnel, with streaks rushing past in the vertex
   shader. It builds from the events' signal blue towards the Teams palette.
3. FOV runs 90 → 38 (compression), with radial blur and CA peaking mid-tunnel.
4. It exits into darkness.

### Arrival

A second timeline (~3.2 s) reveals the world in stages:

1. dust;
2. the spine silhouette;
3. spine lighting and reflections;
4. depth fog;
5. card 01;
6. cards 02–06 (staggered);
7. the cards settle;
8. the camera stabilises;
9. interaction unlocks.

It ends exactly on the scroll pose, so scroll takes over without a jump. That
pose is card 01 centred, as the reference's work opens on its first project.
The establishing view lies behind it, between card 01 and the gate.

### The world

- **Spine.** A vertical S-curved column of about 26 vertebrae. A thin signal
  filament spirals up it: the journey's thread, continued.
- **Cards.** Six cards on a descending helix around the spine, 60° apart, so
  the full ring closes on the sixth card. Cards face outward.
- **Camera.** It orbits outside the ring at the current card's angle and
  descends with it. The centre card faces the camera. Its neighbours sit rotated
  at the edges, further back, which reproduces the reference's orbit language.
- **Particles.** Blooms sit between the cards near the spine, inside a wide
  dust volume.
- **Palette.** A restrained ink-black, bone, dusty rose, muted violet and steel
  blue. No neon.

### Scroll

- The Teams segment maps to a continuous carousel coordinate `c`. It runs from
  −0.24 (establishing) through 0 … 5 (each card centred) to 5.9 (outro: the
  camera lifts and pulls back to show the whole ring, and the chapter's
  closing plate).
- Between cards the camera eases out slightly (a "breath").
- Scroll velocity adds:
  - bank (roll);
  - card lag and twist (inertia);
  - particle dispersal;
  - spine twist.
- **Gate.** Scroll is walled at the portal until the hold completes. Inside the
  world, scrolling back past the start has to be sustained ("pull"). Once it
  is, a reverse travel returns you through the portal to the corridor, and the
  portal re-arms.

### Pointer

All pointer response is smoothed:

- camera parallax (±1.2°, ±0.12 m);
- the card in view tilts slightly towards the pointer; the hovered card leans
  and drifts towards the exact point under it;
- a glint follows the pointer across the hovered card (and a faint light
  slides over the spine and glass);
- the dust parts around the pointer and trails a wake behind its movement.

The cursor is the ordinary hand over a card. On touch, a tap selects.

### Selection and detail

The states run `teamsActive → cardFocused → domainDetail`.

- **Lock.** Scroll and hover are locked.
- **Camera.** It flies to the chosen card (any card, as in the reference),
  diving past the final framing — the name rushes up under a lens surge —
  then settling with the card framed centre-right (portrait: high). ~1.35 s,
  power3 in-out.
- **Chosen card.** It comes forward and squares up; a dark screen switches on
  behind its name.
- **The room.** Everything outside the card sinks into a deep blue-green with
  faint scanlines (final pass, masked by the card's screen rectangle).
- **Other cards.** They push outward and dim. **Spine.** Dimmed, behind.
  **Particles.** They calm.
- **Detail layer.** A small mono block at lower-left types itself in: the
  domain name, `DOMAIN 01 / 06 · N MEMBERS`, the members, two
  `[CONTENT PLACEHOLDER]` lines, `<- PREV · NEXT ->` and `<- CLOSE`; SCROLL TO
  CLOSE sits at the top. On portrait screens the block sits under the card.
- **Exit.** Close, Escape, scroll or a tap off the card reverses everything to
  the exact scroll pose (≈ 1.1 s).

### Responsive

Portrait screens get portrait cards, a tighter ring and a further, higher
camera. The composition is re-authored for portrait, not scaled. The detail
card fills about 88 % of the width.

### Reduced motion

- The hold still fills.
- Travel becomes a fade cut.
- The arrival is instant.
- Scroll stops at framed stills of each card.

---

## 4 · Plan (milestones)

1. **Integration.** Timeline `portal` + `teams` segments. Remove the door,
   impact, tour and old team/core code. Gate the scroll. Update the store,
   chapters, navigation, SceneDirector windows, the signal thread, the map,
   anchors, plates and the archive.
2. **Portal entry.** Ring, membrane, motes and the vestibule wall.
3. **Hold.** DOM hit target, pointer capture and keyboard; the `h` channel and
   its staged reactions; cancel/reverse.
4. **Travel.** GSAP timeline, tunnel streaks, composer + FinalPass, and reverse
   travel.
5. **Teams world.** Group, atmosphere and lights, env map and warm-up.
6. **Spine.** Procedural geometry and material.
7. **Particles.** Blooms and dust.
8. **Six cards.** Geometry, glass, faces and decode.
9. **Camera.** Arrival, scroll pose, idle and drift.
10. **Scroll.** Velocity coupling (bank, lag, dispersal).
11. **Pointer.** Parallax, tilt, key light and hover.
12. **Selection.** Focus flight and card choreography.
13. **Detail.** DOM layer, controls and exit.
14. **Visual tuning** against the reference captures.
15. **Performance.** Tiers (transmission and bloom off on low), DPR cap and
    allocation audit.
16. **Responsive.** Portrait composition and all six viewports.

QA runs throughout with `scripts/qa/teams.mjs`, headless Chrome with a GPU. It
walks the 20 interaction scenarios, captures frame sequences at each viewport,
and checks renderer memory across repeated enter/exit cycles.

---

## 5 · What was built

### Module map (`src/teams/`)

| File | Role |
|---|---|
| `state.ts` | `useTeams`: the discrete states. `teamsFrame`: the per-frame channel (hold, travel clocks, orbit `c`, pointer, focus, the chosen card's screen rect). |
| `layout.ts` | Composition (landscape and portrait), the helix, scroll → orbit (`carouselAt`, `progressForDomain`). |
| `camera.ts` | Pure shot functions: orbit, focus, cylindrical blends, tunnel frame, portal hold dolly, travel in/out. |
| `controller.ts` | Per-frame logic called by `CameraRig`: arming, hold integration, walls → pull, card picking, the Teams shot. |
| `travel.ts` | GSAP clocks for enter / arrival / exit, the travel channels, and the scroll walls (`progress.lock`). |
| `focus.ts` | Select, close, and hop between domains (GSAP-eased focus blend). |
| `portal/` | `Portal.tsx` (wall, ring, light channel, membrane, motes) and `shaders.ts`. |
| `world/` | `TeamsWorld` (mount, compile, lights), `Spine` + `spineGeometry`, `ParticleField`, `DomainCards` + `cardFace`, `Tunnel`, `Backdrop`, `environment`. |
| `post/` | `PostProcessing`: bloom and the final pass; only mounted near the portal and inside. |
| `ui/` | `PortalHold`, `TeamsHud` (the six-domains nav, pull, outro), `DomainDetail`, `TeamsInput`, `TypeIn`, `teams.css` — mounted together by `TeamsExperience.tsx`. |
| `debug.ts` | `window.__acm.teams` for the QA harness. |

### States

```
outside ─(stand before the portal)→ portalIdle ─(press)→ portalHolding ─(2 s)→ portalEntering
   ↑                                   ↑   └──(release: runs back)──┘              │ crossing (flash)
   │                                   │                                           ▼
   │                                   └──────────── portalExiting ←─(pull)── teamsEntering → teamsActive
   │                                                                                   ⇅ select / close
   └──(menu / rail jump to an earlier chapter: instant, behind the jump fade)   cardFocused ⇄ domainDetail
```

- Scroll is locked in `portalEntering`, `teamsEntering`, `cardFocused`, `domainDetail` and `portalExiting`.
- Global `phase` is `travel` while crossing in either direction and during the arrival.

## 6 · QA record

`scripts/qa/teams.mjs` drives the real UI in headless Chrome with the GPU: real pointer and touch holds on the portal button, wheel streams, card clicks, keys and resizes. It logs `window.__acm.teams.snapshot()` and frame timings. `scripts/qa/interaction.mjs` is the site-wide regression and now includes the portal gate and the Teams outro.

### The 20 interaction scenarios

| # | Scenario | Result |
|---|---|---|
| 1 | Events → portal | The walk from the last room down the vestibule ends standing square to the ring; the plate introduces the portal. |
| 2 | Portal idle | The ring breathes; pulses circle the light channel; the membrane recedes; motes drift. |
| 3 | Touch / hold | Mouse, touch (CDP touch events) and keyboard (Space on the focused button) all hold. |
| 4 | Release early | Hold 0.35 → 0 within ~0.9 s, smoothly; the camera, light, motes and haze all run back. |
| 5 | Successful hold | At 2.0 s the travel starts from the dolly's pose (no jump). |
| 6 | Portal transition | Plunge → flash-hidden crossing → streak tunnel (blue → rose) → out into darkness. |
| 7 | Teams arrival | Darkness → dust → spine silhouette → spine lit → card 01 decodes → the rest arrive → the camera settles. |
| 8 | Idle Teams state | The camera breathes; a slow wave passes down the spine and the helix; the dust drifts. |
| 9 | Mouse movement | Camera parallax, a tilt on the card in view, dust parts and trails a wake. |
| 10 | Card hover | Picking is exact; a glint follows the pointer on the card; the card leans towards it; hand cursor; its title settles if broken. |
| 11 | Card selection | Any card, centred or not; the camera dives in (lens surge) and settles centre-right; the room darkens. |
| 12 | Domain detail | The card becomes a screen; name, meta, members, two placeholders and controls type in at lower-left. |
| 13 | Domain exit | Close, Esc, scroll or a tap off the card reverse it to the exact orbit pose; ←/→ or PREV / NEXT hop between domains. |
| 14 | Scroll | Continuous orbit with a hold at each card; velocity drives bank, card lag, dust dispersal and the spine wave. |
| 15 | Reverse scroll | Symmetric. A sustained pull at the start travels back out through the portal, which re-arms. |
| 16 | Rapid scroll | 30 wheel events in 1 s: `c` ≈ 2.1 → settles; back to the floor with no accidental exit. |
| 17 | Touch interaction | Swipe to orbit, tap to open, tap off the card to close; the hold works by touch. |
| 18 | Resize | Landscape ⇄ portrait re-composes (portrait cards, tighter ring) and keeps the scroll position. |
| 19 | Mobile | 390×844 and 375×812 (touch hold, swipe, tap to open, tap off to close): portrait composition, details under the card, numbered domain row. |
| 20 | Repeated navigation | Enter / exit / enter via the portal and the menu. Renderer memory is flat across four full exit → enter cycles (27 geometries, 36 textures, 34 programs inside the world). |

### Frame times

Production build, headless Chrome, Apple silicon: 60 fps with zero frames over 33 ms. This held through the portal idle, the hold, the travel, the arrival, orbit scrolling, open/close and the exit, at DPR 1 and 2 at 1440×900, and at DPR 3 in 390×844 phone emulation.

### Viewports checked

1920×1080, 1440×900, 1280×800, 1280×720, 1180×820, 1024×768, 800×600, 768×1024, 390×844 and 375×812.

---

## 7 · Second pass (September 2026): one physical world

This pass kept every system above: the single `CameraRig` camera owner, the one Lenis + ScrollTrigger scroll track, the `teamsFrame` / `useTeams` split, the state machine, card picking, streaming, `useDisposable` and the quality tiers. It reworked what those systems draw and how they move.

### What changed

| Area | Before | Now |
|---|---|---|
| **THE TEAM** | Hand-drawn blocky outlines; a straight dolly at constant height and FOV; the letters never hidden (they showed behind later cards) | Glyphs traced from the site's own Archivo (expanded, bold) into exact polygons (`world/letters.ts`), extruded 1.3 m with bevels, in a bone satin material with a clearcoat. The camera follows a keyed C¹ Hermite path (`camera.ts`, `entryShotAt`): from the tunnel mouth, framing the whole title, it approaches, skims the letter faces with the lens opening, passes between the words and lands on card 01 at the orbit's own velocity. Portrait stacks THE above TEAM, and the camera flies through the slot between the lines. The letters stop drawing once the orbit is under way. |
| **Arrival** | A 1.8 s timed glide with scroll locked (`teamsEntering`) | The tunnel ends exactly on the entrance path's first pose, and scroll takes over at once (`travel.ts`, `arrive`). The world's light comes up on a non-blocking tween. `teamsEntering` is no longer entered. |
| **Rest pose** | Rested on the portal gate, so the top bar read "07 The Portal" | `TEAMS_FLOOR` is a few pixels inside the Teams segment. |
| **Composition** | A thin spine (about 7 % of the frame), 3.2 × 2.2 × 0.11 cards on a 3.65 m ring, a uniform starfield | The spine is about twice as thick (body about 12 % of the frame, processes about a third). The cards are 3.4 × 2.32 × 0.16 on a 4.4 m ring (portrait 2.3 × 3.1 on 3.25 m). The ambient dust sits in the air round the column and along the entrance path. |
| **Cards** | Nearly clear transmission, and the lettering on a separate plane 15 mm above the glass | Frosted physical transmission (roughness about 0.6–0.7, IOR 1.5, per-card frost variation) under a glossy clearcoat. The lettering is printed into the glass material, front face only, inside the clearcoat. Wider bevels. Every tier frosts: the low tier renders transmission at half resolution. |
| **Scroll response** | Three stacked tails (Lenis → 5.5/s → glide 4.2/s) | A critically damped follower (ω = 20/s) on the Lenis-smoothed target. Measured at 1440×900: one notch settles in 0.82 s (was 1.46 s), a burst in 1.07 s (was 1.92 s), a reversal in 1.03 s (was 1.84 s), and the orbit turns 0.17 s after reversed input. There are no direction changes after stopping. |
| **Layered motion** | Everything followed one coordinate | Camera (the spring, and bank / FOV at 6/s) → cards (7/s: the near ones trail and settle forward) → spine (3.2/s: a torsional twist about its curved axis; the anchors stay fixed) → dust (6/s in, 3.2/s out). |
| **Cursor** | Parallax on a 2.6/s tail; the lean popped on leave; proximity invisible | Parallax at 4.5/s. Hover eases in at 12/s and out at 6/s, using the last point held (no pop). A velocity-aware press, and a local sheen (smoother, slightly brighter) at the point touched. The pointer light is kept faint. |
| **Card entry** | A focus blend, then a cut to a flat page | A quick commit (the card comes forward and squares up), then one continuous camera path keyed on the focus scalar: a breath back, travel (arcing round the spine), square to the card, through its surface (the lens opens a little), and settle inside. The other cards recede in order of distance, and the spine fades and turns slightly. Near the surface the chosen card's frost clears and its print fades: it becomes the threshold. |
| **Open domain** | A transparent text plane in a void | A room behind the card (`world/DomainInterior.tsx`): an opaque shell in the domain's tone, with ribs converging on a lit screen that carries the content. It is opaque, so it is already visible, blurred, through the frosted card. The DOM detail (screen-reader article plus controls) stays. Pointer parallax is active inside the room. |
| **Return** | Reverse of the focus blend | The same scalar run back: the room recedes behind the glass as it frosts again, and the card, the other cards and the spine restore to the exact orbit position (checked: `c` is identical before and after). |
| **Exit pull** | Counted any upward scroll at the floor, so one hard fling could exit | Counts only after 0.4 s at rest at the entrance. |
| **Content** | "DOMAIN DIRECTORS" label; reduced motion stopped at six domains; card faces drawn before the fonts loaded | "MEMBERS". Reduced-motion stills come from the content (the entrance plus all seven). Faces redraw after `fontsReady()`. Room titles fit without clipping. |

### Verified (browser, headless Chrome with GPU, `scripts/qa/teams.mjs`)

- **Journey:** portal hold → tunnel → hand-over at the floor → wheel scrolling through THE TEAM → orbit → click a card → room → Escape → the same orbit position → scroll back to the floor → deliberate pull → back at the portal. A long fling back to the entrance stops there.
- **Entry path:** checked frame by frame with `pose:<i>:<focus>` for CORE, Web and App, Competitive Programming, Events, Contents and Design, and Marketing.
- **Portrait (390×844, DPR 2):** the stacked entrance, the orbit, frosted cards, the entry, and the room for CORE, Web and App, Competitive Programming and Events.
- **Reduced motion:** framed stills (the entrance, then each domain); a nav button opens a domain instantly with focus on its heading; → hops; Escape closes and returns focus to the domain's nav button.
- **Frame times (headless, Apple silicon, 60 Hz cap):** 16.7 ms average with 0 frames over 33 ms during orbit scrolling, card entry and the room, at DPR 1 and DPR 2. Portrait had one 50 ms frame at the start of a touch swipe. Renderer memory was flat across three select/close cycles (21–23 geometries, 26–27 textures, 35–37 programs).
- **QA harness additions:**
  - the intro film is skipped before Teams steps;
  - `trace:<label>:<ms>:<n>` samples motion;
  - `pose:<i>:<focus>` holds the entry;
  - `teamsDebug.camera()` and `teamsDebug.pose(i, focus)` back those steps.

### Still open

- Frame times were only measured in headless Chrome on Apple silicon; a real mid-range phone is untested.
- Touch was exercised with emulated touch events (swipe, tap), not on a device.
- The open domain's copy is display type on a WebGL screen; the readable, accessible version is the screen-reader article (and the text version), so the visible screen text can't be zoomed or selected.
- Dead code remains in `post/PostProcessing.tsx` (`uBarrel` / `dive`, `uDim` / `uRect` / `cardRect`) and in `cardFace.ts` (the decoding / glitched title modes).
- The master worktree has uncommitted edits to several of the same Teams files; merging dev and master will need them reconciled by hand.

---

## 8 · Refinement pass: touch, enter, people (September 2026)

The goal of this pass: "I touched this physical object and entered it", not "I clicked a card and a page opened". The architecture is unchanged:
- one camera writer (`CameraRig`);
- one scroll pipeline (Lenis + one ScrollTrigger);
- one pointer channel (`teamsFrame.pointer`, fed by `TeamsInput`);
- one post stack.

### One physics language (`src/teams/pointer.ts`)

- **`stepSpring`:** a critically damped spring that is quick towards a new target and slower back to rest. No bounce.
- **`impulse`:** the response of a damped particle to a kick. It keeps moving briefly, then settles.
- **`stir`:** a slow-release copy of the pointer's energy, plus the pointer's last direction of movement.

The cards, the dust and the grain all use these.

### Before the click (`world/DomainCards.tsx`, `ui/TeamsInput.tsx`)

- **Springs:** each card is a plate on its mount, with springs for tilt about both axes and for depth (attack 16/s, release 6/s).
- **Pointer force:** the pointer presses the side it rests on, and a pointer moving across the card drags it slightly the same way.
- **The press lands before the click:** on pointer-down or touch-down over a card (`teamsFrame.press`), the plate pushes in, tilts towards the touch, and a clearer, brighter spot gathers in the frost under it.
- **Material:** the edges brighten near the pointer, and slightly more light passes through the body.
- **Release:** a drag of more than 12 px releases the press.

### Entering (`focus.ts`, `camera.ts`)

- **Commit:** the card comes forward at once (0.4 s). The pointer's force hands over to the commit, so the plate straightens.
- **Timing curve:** the camera follows an authored monotone curve: acceleration, travel, a slower beat while the frosted surface fills the whole view, a quicker crossing, then the settle. Closing is its exact time reverse.
- **Path:** monotone (Fritsch–Carlson) tangents, so the camera never drifts back before it goes forward. The squaring-up takes its share of the path by distance: a centred card is entered almost at once, while a side card arcs round the ring first.
- **Traced (CORE):** no reverse travel; about 5.5 m/s at the peak of travel, about 4 m/s while the surface fills the view, the crossing at about 1.75 s, settled by about 2.3 s.
- **Selecting mid-scroll:** the orbit glides to where its momentum would stop (`c + v/ω`, no reversal), and the scroll is moved there. Closing returns to exactly that place (traced: `c` 1.7682 before and after).
- **The world responds:**
  - neighbours part to either side, and far cards sink and dim in order of distance;
  - the spine's band at the card's level lifts slightly while the rest recedes, then the column fades;
  - the pooled light turns towards the chosen card;
  - a soft puff of dust leaves the card.
- **Threshold:** the glass clears only in the last metre (from about 1.1 m to 0.15 m), so the frosted surface fills the view for a beat first.

### The domain room (`world/DomainInterior.tsx`)

- **No screen:** the screen panel is gone.
- **Label:** a small architectural label ("ACM CEG · 0N / 07", plus the domain name) sits on the far wall.
- **People:** each person is a role in small caps where the chapter gives one (CORE only), then the name in large type. Each stands on its own plate at its own depth, stepping down and forward through the room, so the parallax separates them.
- **Arrival:** they come in one after another as the camera crosses, and recede in reverse.
- **Layout:** a measured flow layout that wraps without orphaned words and scales to fit the wall.
- **CORE chamber:** a slightly larger room, stronger courses, and an inset frame on the far wall.
- **Roll numbers are no longer rendered** in the room or in the screen-reader article. They stay in `src/content/teams.ts`.

### Dust and grain (`src/teams/dust.ts`, `world/ParticleField.tsx`, `post/PostProcessing.tsx`)

- **Force field:** while the pointer moves, a stroke is recorded every 80 ms in world space, 3.2 m in front of the eye, with the pointer's velocity carried to that depth (capped at 4 m/s). The ring holds 16 impulses.
- **Shader response:** every mote near a stroke is kicked along it and slightly outward. The falloff is an ellipsoid of radius 0.9 m, reaching about 2.7 m either way along the view. The kick carries on and settles (ω 5.5/s, gone in about 1.5 s). Nothing stays displaced (checked: 7 impulses live straight after a sweep, 0 two seconds later).
- **Air layer:** a new layer of fine motes (2400 / 1500 / 800 by tier), world-fixed but wrapped round the space in front of the camera, so there is always air between the eye and the cards.
- **Grain:** it follows the image's brightness. Near the pointer it streaks along the direction of motion and relaxes on the slow `stir` channel.

### Verified

- **All seven domains**, by real click: the correct people; no 10-digit number anywhere on the page; Escape returns to the identical `c`; hover picks the card again afterwards.
- **Motion edge cases:**
  - select while scrolling;
  - Escape mid-entry (a smooth reversal);
  - press then drag off (no selection);
  - clicks during a close (ignored until it finishes).
- **Touch (390×844):** a finger-down press response, tap to enter, tap to return.
- **Reduced motion:** a direct open and close, with no dust forces.
- **Frame times:** 16.7 ms average with 0 frames over 33 ms, with pointer sweeps plus scroll, entry and room, at DPR 1 and 2 (headless Chrome, Apple silicon, 60 Hz cap).
- **Memory:** renderer memory did not grow over repeated open/close cycles.
- **Build:** the typecheck and `next build` pass.
- **QA additions:**
  - harness steps: `mdown` / `mup`, `tdown` / `tup` and `sweep`;
  - debug hooks: `teamsDebug.still()`, `teamsDebug.dust()` and `teamsDebug.dustGain()`.

### Still open

- The dust response is deliberately subtle. It was confirmed from the recorded impulses and before/after crops, but it is hard to judge from stills: judge it live.
- A small reflection of the commit light can show near the chosen card's top edge.
- Performance on a real mid-range phone is still unmeasured.

## 9 · Card → domain entry and domain interior (September 2026)

The brief: the entry felt slow, awkward and generic, and the room felt like a game level. Now the card is a threshold you dive through, and the room is an editorial gallery. The architecture is unchanged (one camera writer, one scroll pipeline, one pointer channel, one post stack). This pass targets desktop; the phone rooms were left as they were at the user's request.

### The entry (`focus.ts`, `camera.ts`, `world/DomainCards.tsx`)

- **Duration:** open 1.35 s (from about 2.3 s), close 1.1 s, and the card's commit 0.28 s.
- **Timing curve:** a new monotone timing curve (`BEATS`). The eye gathers momentum almost at once, travels, crosses the surface about two thirds of the way through, and decelerates into the room. The close runs the same curve in reverse (`exitEase`).
- **Path:**
  - no pull-back: the first key moves 10 % towards the squared-up pose;
  - the squared-up key sits 0.84 of the orbit distance in front of the pushed card, and its place along the path is proportional to distance, so a centred card is entered almost at once;
  - the crossing is 0.12 m past the surface with the lens 4° wider;
  - the settle is 0.9 m inside the room.
- **Threshold:** as the eye reaches the card, its type fills the view, then an aperture opens from the card's centre. Inside it the ink and the coat's reflection are removed, so the room shows through the opening with a thin rim, and the camera passes through it. The card is never faded out or swapped.
- **Traced (real click, desktop):**
  - entry: first movement about 94 ms after the click, settled at about 1.33 s;
  - Escape: first movement about 124 ms, back at about 1.10 s, at the same orbit position, with focus on the domain's nav button.

### The room (`world/DomainInterior.tsx`, `world/domainPieces.ts`)

- **Shell:** matte plaster. A light slot in the ceiling just before the back wall washes the far wall from above. The side walls, ceiling and floor fall into shade towards the entrance, and a soft pool of light lies on the floor. The corners are soft, with no hard seams, and there is no grid and no glow.
- **Name:** signage on the back wall in the cards' own type (Archivo, expanded): the index ("0N / 07"), the name in up to three lines, a rule, and the count ("N MEMBERS" / "N OFFICERS"). On desktop it is set left and never runs behind the centrepiece.
- **People:** a freestanding frosted pane in the card's own material:
  - a "MEMBERS" label and hairline, then a quiet index and each name in the site's serif;
  - the pane is only as tall as its names need;
  - it stands to the left of the axis, placed from the window's aspect so it is never cut off by the frame.
- **CORE:** a symmetrical chamber. Four frosted steles, one per office (role in mono small caps, name in large serif), line a converging nave on an axis inlaid in the floor. It has no centrepiece: its officers are its architecture.
- **Centrepieces**, one per domain. Each is abstract and says nothing factual about the domain:
  - **Web and App:** three device frames, one with a frosted pane;
  - **Competitive Programming:** a search tree with one solution path in the domain's colour;
  - **Events:** a programme of stages stepping out of the far end of the room and towards the viewer, with one of them marked "now";
  - **Contents and Design:** a layout sheet (image block, headline, columns, swatch);
  - **HR and Logistics:** a knotted line with a bead where it is held;
  - **Marketing:** ripples spreading from one source.
- **Arrival:** the room's light comes up over everything in it together, so nothing appears as a black cut-out. After that the name inks in, the centrepiece settles into place, and the people ink in. It is all keyed on the focus scalar, so leaving reverses it exactly.
- **Glass:** the room glass has a satin coat (clearcoat roughness 0.34). The sharper coat focused the room's key light into a hot point on the pane's edge.

### Light

- **Room key:** it now sits above and just ahead of the eye, so its highlight falls away from the lens.
- **Pointer light:** it is lifted well above the pointer ray, so its reflection in the cards' coat rides their top edge. Before, it showed as a spot on the card's index text.

### Verified (desktop, headless Chrome with the GPU, 1440×900)

- **Rooms:** all seven, with the correct people (CORE: roles and names; Prithvi in Web and App; Varshhaa in HR and Logistics) and no roll numbers.
- **Entry, frame by frame:** posed for a side card (Contents and Design from Events) and a centred card (Web and App): swing and squaring up, approach, type filling the view, aperture, crossing, arrival, settled room.
- **Real input:** hover, press, click, the room, then Escape back to the same card with focus on its nav button.
- **Reduced motion:** a direct cut into the room and back, ArrowRight to the next domain, focus restored.
- **Frames:** 916 across real opens, closes, a next step and pointer moves in the rooms: 16.7 ms average, max 16.8 ms, 0 over 33 ms, at DPR 1 and 2. This is capped at 60 Hz, so it shows no stalls, not headroom.
- **Memory:** the JS heap ended lower than it started.
- **Build:** the typecheck and `next build` pass.

### Still open

- **Phone rooms (390×844):** they need their own layout. The pane and the outer CORE steles are cut off at the frame edge. This was deferred at the user's request.
- **Room type:** it is drawn into the 3D scene, so it can't be selected. The accessible copy is the DOM article.
- **Edge line:** a faint dashed highlight can show along the top edge of a room pane at DPR 1.

## 10 · The domain interior replaced by a hand of member cards (September 2026)

This supersedes the room design in §9. The rooms were visually overbuilt for what they communicate: walls, floor, props and panels around a few names. An open domain is now its people, dealt out of its card as a small hand of physical cards. The 3D world stays for exploring: carousel, spine, cards, atmosphere, pointer and scroll.

### What was removed

- **Deleted:** `world/DomainInterior.tsx` and `world/domainPieces.ts`:
  - seven always-mounted rooms (shell, signage, panes, CORE's steles);
  - the six centrepieces;
  - their three custom shader programs (shell, signage, printed pane);
  - about seventeen canvas textures.
- **Room key light:** removed from `TeamsWorld`.
- **Camera constants:** `roomSize` is removed; `ROOM_EYE` / `roomFov` are now `BEYOND_EYE` / `beyondFov`, since the eye still settles just through the card.

### The handover (unchanged path, new destination)

- **Unchanged:** the entry path of §9 (commit, travel, type filling the view, the aperture opening, the crossing).
- **Behind the card:** only the Teams atmosphere. The spine is already gone at that point, the ring has given way, and the dust is kept at 22 % (it was 10 %) as a depth field.
- **The deal:** the member cards rise out of the aperture as a stack and fan out while the camera settles (focus 0.66 → 1). The domain's identity arrives with them, and the controls come last.
- **Reversible:** it is all keyed on the focus scalar, so closing collapses the hand back into the opening, and Next / Previous collapse one hand and deal the next.

### The hand (`ui/MemberHand.tsx`, styles in `ui/teams.css`)

- **Cards:** DOM and CSS 3D, no WebGL. Each is a dark, faintly tinted coated surface with:
  - a thin body plate behind it (a turned card shows its edge);
  - a thin edge, brightest along the top;
  - a shadow it throws on the cards beneath;
  - light that slides across the coat from the pointer.
- **Typography:** the CORE language: a short rule, ROLE as a label, NAME as a display line (the site's Montserrat; see ARCHITECTURE.md → Typography). Members have no role in the data, so they read MEMBER. Each name is measured in the loaded serif and set as large as its card allows, with no lone initial on a line. The foot carries "0N / 0N"; a drawn card also shows the domain's name. No roll numbers, nothing invented.
- **Composition by count:**
  - **one card** (Marketing): the hero, slightly off-axis;
  - **two**: an overlapping pair;
  - **four** (CORE): a fan with the Chairperson standing slightly proud.
  - Every fan is stacked in depth with the top card nearest (36 px apart, so turned neighbours never cut through each other), with fixed small irregularities. Every name sits in the part of its card that stays visible.
- **Pointer** (the Teams pointer channel). Hover is decided from the hand's rest geometry, with a little hysteresis, so a moving card never flickers its own hover.
  - Approaching turns the nearest card slightly.
  - Reaching it pulls it out: +95 px forward, up, a little towards its own open side, squared to the eye, tilting a few degrees with the pointer.
  - The cards above it make room (0.14 of a card width), the cards below give a little, and the outer cards sink back.
  - Springs are critically damped (ω 24 out, 15 back; no overshoot).
- **Click (or Enter):** draws the card to the centre, square, at 1.22×, and the rest recede and dim. Escape or a click beside the hand puts it back; a second one leaves the domain. `teamsFrame.member` carries this; `TeamsInput` stays the only input handler.
- **Accessibility:**
  - the cards are buttons with real text, so they are the accessible copy;
  - `aria-pressed` marks the drawn card;
  - keyboard focus lifts a card like hover does;
  - the domain name is the focused heading on open.
- **Reduced motion:** the hand appears and responds without travel or tilt.

### Verified (desktop 1440×900, headless Chrome with the GPU)

- **Real clicks:** CORE (four), Web and App and Competitive Programming (pairs) and Marketing (one): hover pull, neighbours giving way, drawing, putting back, closing.
- **The handover, posed frame by frame:** type filling the view, the first card rising in the aperture, the fan opening, the identity arriving.
- **Keyboard:** Tab to a card, Enter draws it (`aria-pressed` true on that card only), Escape puts it back with the domain still open, ArrowRight moves to the next domain, and Escape leaves.
- **Data:** no 10-digit number on the page.
- **Reduced motion:** open, then close with focus restored.
- **Frames:** 1,133 at DPR 1 and 1,142 at DPR 2 through open, hover sweeps, draw, put back, next and close. All at 16.7 ms, max 16.8 ms, none over 33 ms (headless, 60 Hz cap). The JS heap ended lower than it started.
- **Checks:** the typecheck passes.

### Still open

- **Phone (390×844):** the pair fits, but CORE's four-card fan runs off both sides. The phone layout was deferred at the user's request.
- **Real device:** not yet measured on a real device.
