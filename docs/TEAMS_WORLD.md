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
- **Streaming.** `experience/SceneDirector.tsx` mounts and unmounts world
  chunks by progress window. `useDisposable` frees GPU memory on unmount.
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
