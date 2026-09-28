# SESSION HANDOFF — ACM-CEG World (master, Intro refinement pass 2 in progress)

Written at the end of a long session that is being transferred. Everything below is from the
actual repo state and from tests actually run in this session. Anything not verified says so.

> **Status at handoff (checked when this file was written):** `src/intro/world/AcmCeg.tsx` imports
> `{ useMemo, useRef }` and `./node_modules/.bin/tsc --noEmit --incremental false -p .` **passes (0 errors)**.
> `git diff --check` is clean. `next build` has **not** been run on the pass-2 tree.

---

## 0. TAKEOVER UPDATE (latest — supersedes §1, §5–§7 and §12 below wherever they conflict)

A later session took over from this handoff (HEAD still `653a5ca`, nothing committed or pushed, no
reset/stash/clean). All of it is uncommitted on master on top of the work described below. Every
item was checked in a real browser (headless Chrome with GPU against localhost:3100 unless noted).

**Fixed / implemented**
- **ASCENT post-cloud orientation bug (§7.1) — FIXED at the root.** `aim()` takes yaw from the
  horizontal direction to the look target; looking almost straight down, a target level with or south
  of the camera turns the picture round. Keys at 160.8 and `T.cloudBase` now keep the target north of
  the camera (`[W.x,125,W.z−7.8]`, `[W.x,90,W.z−0.9]`); `down(y, from)` now leads the camera north by
  1.2% of the drop (was a fixed 3 cm, which the position curve's wander crossed at 166.9–168.4 and in
  the shaft); the shaft's foot key (179.5) leans 2.5 m north into the tip-up (the look curve swung
  1.1 m south there). Verified: yaw sampled every 0.004 beat over the whole film (−44…201) — no step
  over 0.05°/sample; screenshots at 156–180 forward and reverse, desktop / 1024×768 / 390×844.
- **Loop resource growth — FIXED (it was still growing):** 5 geometries + 2 render-target textures per
  loop. (1) `scenes/shared/props.tsx useCachedGeometry` lost its entry when an effect was cleaned up and
  re-run (StrictMode, Fast Refresh) and never disposed the geometry it kept drawing (CodHer desks,
  chairs, laptops) — the effect now re-registers what it holds. (2) `teams/world/TeamsWorld.tsx` built a
  PMREM environment per visit (disposing only the render target's texture; StrictMode left a second
  one unowned) — now `teamsEnvironment(gl)`, one per renderer (like `chromeStudio`). Verified over 6
  loops: geometries 57/63 (streaming timing), textures 45/46, programs 44/45, heap ~140–149 MB, DOM
  990, window listeners 194 — flat. With sound: music continuous (never restarted), ~30 one-shot audio
  nodes per loop (short-lived), rail correct after each wrap.
- **First paper "A STORY BEGAN." (§2)** — `story/fragments.ts`.
- **Montserrat typography (§3)** — `app/layout.tsx` (next/font Montserrat, variable, roman + italic);
  `globals.css` tokens `--w-*` (display 700 … body 400; UI/labels 600; meta 500) and `--t-*`
  (display −0.035em … label 0.14em, mark 0.22em); every rule in globals.css / intro.css / teams.css
  takes its role's tokens (no Bodoni left; `font-stretch` removed). Canvases: `systems/textures/
  typeset.ts` maps roles (display semibold, label semibold with tracking capped). Gas words:
  Montserrat 800 (`gasFields.ts`). Not changed on purpose: ACM-CEG's blade letterform, the stone's
  blade letters, the building's clock numerals, the OG image (generic serif — needs a font file).
- **Rail (§13)** — Montserrat roles; active chapter label always shown, bold white figure, lit tick;
  inactive figures readable; per-glyph dark halo + a faint shade under the column (no panel). Checked
  over purple smog, cloud, sky, building, Events.
- **Chapter click (§14)** — `navigation.goToChapter`: the picture dims where it is, the jump runs at
  black (`progress.pending`, carried out by `CameraRig`), it lands a moment before the chapter
  (`jumpToProgress(p, lead)`, `progress.snapLead`) and the camera's own damped follow carries it in as
  the picture fades up (slower, `progress.fadeInRate`). Reduced motion: unchanged still-to-still cuts.
- **Audio (§6–§11)** — `systems/audio/sfx.ts` + `components/experience/SoundDirector.tsx`:
  thunder per storm (delay/timbre/rolls from each storm's distance + variant, low tail;
  `LIGHTNING` now carries `distance`, `variant`); cloud air (`cloudLow`/`cloudHigh`, by `look.ts
  cloud(t)` × camera speed, slow deterministic pan); tunnel (`tunnelAir`, noise-excited `tunnelRes`,
  `tunnelRes2` rising with depth; cues `tunnelEnter` at `T.shaft`, `tunnelRelease` at 181, `threshold`
  at `T.doorway`); room air beyond the door (`eventsAir`); **underground buzz removed at the source**
  (the `events` oscillator drone that played through the whole Events corridor, and the `shaft` drone —
  both deleted, with `drone()`); Prodigy tile moves/locks (`tileMove`/`tileLock`, fired on forward
  crossings of `exhibits/common.ts puzzleSpan`, shared with `PuzzlePieces`); portal (`portalTravel`
  build from `teams/travel.ts`, stopped by `kill()`; `portalCross` / `portalExitCross` at the
  crossing in `onUpdate`). Measured (not listened): Events standing silent; no tonal peaks anywhere;
  thunder/portal ≈ −31 dB peaks, tiles ≈ −40, cloud median ≈ −66; reverse silent. Headless audio runs
  at 16 kHz: filter frequencies are now capped at 0.45 × sampleRate (music + sfx).
- **Portrait (§24)** — gas words: second line set closer under "22" and the field raised (it sat in the
  road mist, cut by the ground) and fitted to 70–72% of the field; ACM-CEG fitted to the frame at the
  hold distance on every screen (84% of a portrait frame's width, 76% landscape — clear of the rail).
- QA scripts added: `scripts/qa/loop-memory.mjs` (with `--trace` attribution), `scripts/qa/audio.mjs`;
  `scripts/qa/interaction.mjs` updated (the finale plate no longer exists — it now asserts the loop).
- Docs: `docs/INTRO.md` (beats 84–201, ACM-CEG, orientation rule, sound), `docs/ARCHITECTURE.md`
  (typography), `docs/TEAMS_WORLD.md` (font name).

- **Teams end + loop — FINAL design (replaces the spine descent AND the outro pull-back).**
  Teams scrolling is the original, user-controlled follower (byte-identical to `6139f35`; verified
  against it with the same real wheel input). Past the 7th card the camera does not move at all
  (`teams/camera.ts orbitShot`: `c > LAST → c = LAST`; the old outro zoom-out is gone); scrolling on,
  the opening's mist takes the world (`fx.mist` from `carouselAt(progress.value)` between
  `C_MIST` = LAST+0.3 and `C_MIST_FULL` = 40% of the return; `return` segment `RETURN_VH` 180; HUD
  recedes from `C_MIST`). The track begins with a few beats of the same mist before the film
  (`T.mist = −55`, `INTRO_START = T.mist`; wholly mist to `T.mist + 6`, clearing by `T.prologue`;
  ENTER and chapter 01 land on `T.prologue`, clear; the rail's % counts from there).
- **Loop seam (the "hiccup" fix — supersedes the wrap-at-the-hard-ends design).** The loop is a *seam*
  between two points inside the two whole-mist margins, short of the track's hard ends
  (`JourneyLoop`: `END_SEAM` = 55% through the return, `START_SEAM` = `T.mist + 3`), triggered on the
  scroll target (`progress.target`). Crossing one, `navigation.wrapToStart / wrapToEnd` →
  `ScrollTimeline.shiftProgress(delta)` shifts target, value and Lenis by exactly the seam's length,
  and carries Lenis's pending smoothing across (`programmatic: false`, so Lenis doesn't pin
  `targetScroll`) — speed, direction and momentum continue; nothing snaps, nothing fades to black.
  Why the old one hitched: (1) wrapping at p ≥ 1 / p ≤ 0 meant Lenis decelerated into the page limit
  first (a velocity break) and landed with a jump; (2) `SceneDirector` unmounted the facility inside
  Teams, so every forward wrap rebuilt the opening's parchment textures (≈2.5 s `getImageData` stall)
  — now **every chapter stays resident** (hidden by visibility; only Teams waits for the loading
  phase); (3) `wheelShape` only shaped input before the portal, so the same wheel moved the scroll
  ~4× less after the forward seam — the shaping now fades in through the return (whole at 40%, where
  the mist is whole), identical on both sides of the seam; (4) the Teams post-processing composer was
  created on first entering Teams (backward wrap → 50 ms frames) — now mounted while the prelude's
  whole mist is on screen (`PostProcessing LOOP_SEAM_ZONE`), and Teams textures are uploaded in the
  warm-up (`gl.initTexture`). `progress.cut` makes the Teams orbit cut instead of springing across the
  seam. Reduced motion keeps the still-to-still `loopToStart/loopToEnd` jumps.
  Two more stalls were found and removed in the final QA pass (below): the Teams materials' render-
  target programs linked on first sight (a 33 ms frame on the backward seam), and the Events room
  window flipping ends of the corridor at the seam (three rooms built in one commit).
  Verified (headless Chrome, real wheel input, **production build**): forward and backward seam at
  slow / normal / fast wheel speeds — **0 frames over 25 ms** in all six runs, all under mist 1,
  fade 0; stopping just
  either side of the seam is stable and one notch crosses it either way; 3 full back-and-forth cycles
  identical, resources resident and flat (≈167–169 geometries, 70–71 textures, 153 programs, heap
  ≈130 MB, DOM 994); no console errors. Also by hand in the app's browser pane (forward: card 07 →
  mist → opening; reverse: opening → mist → card 07).
- **Rail — subdued by default.** `.rail` sits at 50% opacity (62% on touch screens, which can't
  hover) and rises to 100% on `:hover` / `:focus-within` over 0.5 s; no panel, no layout change, the
  active label and % stay visible. Checked in the browser pane: 0.5 → 1 on hover and keyboard focus,
  back to 0.5 after.

- **Final end-to-end QA pass (latest).** Audited every section forward and reverse at desktop
  (1440×900), laptop (1280×720), tablet (1024×768, 768×1024) and phone (390×844): contact sheets
  of every intro beat (−44…201), all nine Events rooms, the portal, THE TEAM, all seven cards, the
  end mist; frame timing on the production build; the loop; audio; resources. Fixed:
  - *Backward seam, dropped frame* — `teams/world/TeamsWorld.tsx` warm-up now compiles the world a
    second time with a render target bound: inside Teams everything draws through the composer's
    HalfFloat target, and three keys a separate program for that (no tone mapping, linear output);
    those linked on the first frame the world was seen (traced: three `GetProgramiv` waits ≈ 24 ms).
  - *Seam, room builds* — `scenes/events/EventCorridor.tsx`: the room window flips from one end of
    the corridor to the other across the seam (and on jumps); three rooms (canvas walls, exhibits)
    were built in one commit (16 + 32 ms tasks). Rooms now come in one a frame, nearest first
    (rooms that left go at once). Streaming kept: all nine resident would be ~100 MB of canvas textures.
  - *PatternX on tablets* — its stage words (OBSERVE … CODEX) overprinted each other in the narrow
    open span tablets get beside the dossier (`exhibits/common.ts openSpan`, 22% of the wall).
    `exhibits/walls.ts` measures them: crowded → every other word under the rail, and smaller only if
    still needed. Desktop and phone unchanged.
  - *Rail over the room card* — right-side plate cards reserved 72 px for the rail, from when chapter
    names showed only on hover; the active name ("EVENTS") is now always shown and ran over the card.
    `globals.css`: `right: gutter + 136px`; ≤1080 px the card is 384 px wide so its left edge (and the
    room it frames) stays put.
  - QA scripts: `interaction.mjs` / `loop-memory.mjs` asserted the old wrap-to-0; with seams a jump to
    the end lands in the opening's first beats (p ≈ 0.0247) — the checks now assert that.
  - Docs: `ARCHITECTURE.md` (residency table, the loop, room streaming, warm-up, post-processing,
    sound), `INTRO.md` (beats −55…−44), `TEAMS_WORLD.md` (residency).
  Results: production frame probe intro+Events forward 4267 frames max 17 ms, reverse max 33 ms (one
  frame); Events forward/reverse after the room change max 17 ms; Teams travel/orbit 16.7 ms avg,
  0 > 33 ms; seam 0 > 25 ms ×6; loop-memory 3 loops flat (172 geo / 71 tex / 154 programs, DOM 994,
  listeners 190, heap ≈ 132 MB), every loop wrapped; audio QA: every cue where expected, Events
  standing and Prodigy-in-reverse silent, no tonal peaks; music muffle 0 on both sides of the seam;
  `interaction.mjs` ✓ desktop + phone + fallbacks; `teams.mjs` card open/close ✓; no console errors
  anywhere. Rail and loop also checked by hand in the app's browser pane.
  - *Portrait "YEARS AGO" (fixed after the pass)* — the stacked second line read as a smudge on
    phones. Cause: the gas is ray-marched into a buffer sized as a share of the screen's *width*
    (0.42 on the phones' low tier → ~164 px across a 390 px phone, ~12 px per letter). `GasVolume`
    now sizes it by a pixel budget — what the tier spends on a 1440×900 frame — never below the old
    share (desktop unchanged; a phone gets ~0.83, still fewer pixels than a desktop). And the soft
    oval the words stand in is wider on portrait (`uRegion` 0.78 vs 0.66), where the second line's
    ends reached its edge (the "Y" faded). Tried and rejected: raising the field (moved it onto the
    gate), heavier strokes (dense strokes went dark, counters closed). Gas section 16.7 ms avg,
    0 > 33 ms at phone / tablet / desktop in headless Chrome; a real phone's GPU is untested.
  - *Next.js dev badge* — `next.config.ts devIndicators: false` (it covered "SOUND OFF" on phones in
    dev). The user confirmed the sound design is audible.

**Validation run**
- `npm run typecheck` ✓; `npm run build` ✓ (in a copy of the tree — never in the working tree while
  `next dev` runs); production server smoke test ✓ (no console errors); `git diff --check` ✓;
  `src/content/generated/available-assets.json` unmodified.
- `scripts/qa/interaction.mjs` ✓ desktop + phone (entrance, navigation, focus, dossier, signal
  rewind, portal gate, loop, reduced motion, archive, WebGL/no-JS fallbacks, no browser errors).
- `scripts/qa/teams.mjs` ✓ (portal hold → travel → THE TEAM → card → Escape → wheel orbit → Marketing).
- Frame timing (production, 1440×900 DPR1 and DPR2, this Apple-silicon machine, 60 Hz cap): every
  section 16.7 ms avg, max 16.8, 0 frames > 33 ms (smog/words, story, red building, cloud/ACM-CEG/
  descent, shaft/door, Prodigy, Teams orbit). Low-end devices not tested.
- Reverse scroll (descent, red building), reduced-motion stills (−32, −11, 13, N/P), red-building
  reveal under a steady scroll (continuous; speed 0.58 → 3.06 m/beat 84–116).

**Genuinely remaining**
- The user has heard the sound design; levels have not been tuned by ear beyond that.
- Low-end device performance, Safari/Firefox, touch pull at the loop's start (backward wrap) on a
  real phone.
- The 134 and 154 quick tilts (≈22°/beat) are the existing designed moves — left as they are.
- Tracked copyrighted `The Batman Michael Giacchino WaterTower.mp3` in the repo root (since `d6c5a5d`,
  in origin/master) — the user's decision.

## 1. Current Git State

- Repo: `/Users/arunnm/Projects/acm-ceg-world` (main worktree). Branch: **`master`**.
- HEAD: **`653a5ca`** "wip: preserve intro refinement progress".
- Working tree: **dirty** — all work of this session on master is **uncommitted** (by instruction:
  do not commit / do not push unless the user asks).
- Uncommitted, modified (31): `docs/INTRO.md`, `src/app/globals.css`,
  `src/components/archive/ArchiveLayerControls.tsx`, `src/components/experience/Experience.tsx`,
  `src/components/experience/SoundDirector.tsx`, `src/components/experience/navigation.ts`,
  `src/config/timeline.ts`, `src/intro/camera.ts`, `src/intro/fog.ts`, `src/intro/look.ts`,
  `src/intro/prologue/GasVolume.tsx`, `src/intro/prologue/layout.ts`, `src/intro/story/Parchment.tsx`,
  `src/intro/story/flight.ts`, `src/intro/story/parchmentMaterial.ts`,
  `src/intro/story/parchmentTexture.ts`, `src/intro/timeline.ts`, `src/intro/world/AcmStone.tsx`,
  `src/intro/world/Clouds.tsx`, `src/intro/world/IntroAtmosphere.tsx`, `src/intro/world/IntroWorld.tsx`,
  `src/intro/world/chromeStudio.ts`, `src/intro/world/lightning.ts`, `src/systems/audio/sfx.ts`,
  `src/systems/performance/useDisposable.ts`, `src/teams/camera.ts`, `src/teams/layout.ts`,
  `src/teams/travel.ts`, `src/teams/ui/TeamsHud.tsx`, `src/teams/ui/teams.css`,
  `src/teams/world/spineGeometry.ts`.
- Untracked: `intro_improv.txt` (the spec — the user calls it `intro_imprv.txt`; the file on disk is
  `intro_improv.txt`), `src/components/experience/JourneyLoop.tsx` (new), `src/intro/world/AcmCeg.tsx`
  (new), and this file.
- Recent commits (all local; nothing pushed this session):
  - `653a5ca` wip: preserve intro refinement progress (previous Claude's Intro WIP)
  - `6139f35` merge: integrate Teams experience into master (merged `dev` @ `ba2a781`)
  - `ba2a781` (dev) Teams: replace 3D domain rooms with a hand of member cards
  - `f50f0e6` (branch `pre-teams-integration-master`) cinematic prologue, sound design, scroll pacing
  - `b93dab8` (dev) Teams: dive through the card into editorial domain rooms…
  - `609beb2` 2026 events lineup, archive dossiers, intro refinement (snapshot)
- Safety branches: **`backup/intro-refinement-before-takeover` → `653a5ca`**,
  **`pre-teams-integration-master` → `f50f0e6`**. `origin/master` is `8c2f8b2`, `origin/dev` `a76fd91`.
- Other worktree: `/Users/arunnm/Projects/acm-ceg-world-dev` on branch `dev` (`ba2a781`), clean except
  untracked `.playwright-mcp/`. Not touched by the Intro work.
- No stashes were created. Never use `git stash`/`reset`/`clean` here (see §10).
- Dev servers: master on **http://localhost:3100** (started with `./node_modules/.bin/next dev --port 3100`),
  dev worktree on 3200. Do **not** use `npm run dev` — its `predev` media scan rewrites the tracked
  `src/content/generated/available-assets.json`.
- The Batman soundtrack `public/audio/the-batman.mp3` exists locally and is git-ignored; never commit it.

---

## 2. What Was Already Present Before This Session (preserve)

- **One scroll track** (`src/config/timeline.ts`): segments = Intro chapters (arrival, story, ceg,
  ascent, descent) → events → portal → teams (→ now `return`, see §3.2). Weights in viewport heights;
  Intro = beats × `INTRO_VH_PER_BEAT` (10).
- **Scroll** (`src/systems/scroll/ScrollTimeline.tsx`): one Lenis (lerp 0.085, `wheelShape.ts` compresses
  flings) + one ScrollTrigger → `progress.target`; `jumpToProgress` (cut behind `fx.fade`),
  `scrollToProgress`, `placeScroll`; walls in `progress.lock` (portal gate outside, Teams floor inside).
- **Camera**: single writer `src/systems/camera/CameraRig.tsx`. Damps `progress.value`
  (`CAMERA_RESPONSE.progressDamping` 5.5/s; Intro capped at 10 beats/s), calls `syncIntro`, picks the
  Intro shot (`intro/camera.ts` → `CameraPath` in `intro/path.ts`, arc-length traversal, Fritsch–Carlson
  warp), the Teams shot (`teams/controller.ts evaluateTeamsShot` / `teams/camera.ts orbitShot`), or the
  journey shot (`systems/camera/shots.ts`).
- **Intro** (`src/intro/`): beat sheet `timeline.ts` (`T`), colour script `look.ts`, mist `fog.ts`
  (`patchMist`), prologue (`prologue/`: canister roll, ray-marched smog `GasVolume.tsx`, gas words
  `gasFields.ts`), papers (`story/`), ACM stone (`world/AcmStone.tsx`, blade glyphs `acmGlyphs.ts`),
  clouds, lobby, door, lightning. `introFrame` per-frame + `intro()` store. Debug: `window.__acm.intro`
  (`snapshot()`, `at(beat)`, `scroll(beat,s)`, `cameraAt(beat)`).
- **Events**: `src/content/events.ts` (2026 lineup only: C.O.D.E, Tech Talks, MasterClass, Head Start,
  PatternX, CodeX, Prodigy, Open Source Mentorship Program, CodHer), `content/dossiers.ts`,
  `config/world.ts buildCorridorLayout`, `scenes/events/*` (rooms, exhibits), plates, dossiers.
- **Teams** (`src/teams/`): portal hold + travel (`travel.ts`), orbit/cards/spine (`world/`), member
  hand (`ui/MemberHand.tsx`), HUD, own input (`ui/TeamsInput.tsx`), own post stack. Debug:
  `window.__acm.teams` (`at(c)`, `snapshot()`, `pose`…).
- **State**: Zustand `store/experience.ts` (phase, chapter, activeRoom, dossier, reducedMotion…),
  `teams/state.ts` (useTeams + `teamsFrame`). No persistence.
- **Audio**: one `MusicPlayer` (`systems/audio/music.ts`), `MusicDirector` (muffle underground only),
  `SoundDirector` (per-frame director; layers via `setLayer`, one-shot cues on forward beat crossings via
  `cue()`), synthesis in `systems/audio/sfx.ts`. QA hooks: `window.__sfxLog = []` (cues) and
  `window.__sfxLayers = {}` (layer levels) — set them in the page before Enter.
- **Chapter rail** `components/experience/ChapterRail.tsx`: fill/percent/active all from damped
  `progress.value` (verified correct at every boundary).
- **Entry** `LoadingScreen.tsx`: deterministic start (reset + `jumpToProgress(0)`), hash deep links
  consumed once; head script sets `history.scrollRestoration='manual'`.
- QA harnesses: `scripts/qa/intro.mjs`, `scripts/qa/teams.mjs`, `scripts/qa/sheet.mjs` (contact sheets).

---

## 3. What THIS SESSION Implemented

The session had three phases on master (plus earlier Teams work on `dev`, already committed/merged).

### 3.0 Earlier in the session (dev branch, committed, merged into master by `6139f35`)
Teams card entry, member hand, dust force field, etc. — commits `991e359`, `b93dab8`, `ba2a781`.
Documented in `docs/TEAMS_WORLD.md` §7–§10 and `TEAMS_PROGRESS.md` on dev. Nothing pending there.

### 3.1 Intro pass 1 (spec v1) — uncommitted on master, VERIFIED (typecheck, build, browser)
| Change | Files | Notes |
|---|---|---|
| Stale `#team` hash from the archive TOC | `components/archive/ArchiveLayerControls.tsx` | TOC links inside the in-journey text version scroll the layer without touching the URL (root cause: archive section ids share the deep-link hash namespace). Verified: hash stays empty, reload+Enter → beat −44. |
| Gas words: no hard rectangle; gas-like letters | `intro/prologue/GasVolume.tsx`, `prologue/layout.ts` (`unstableAt`) | Soft oval word region inside wider bounds (fixed the visible rectangle); uneven density, winding clear-air channels, strokes off-plane, "restless" phase (`uUnstable`) before dissolving; slightly desaturated violet. |
| Smog: no visible box faces / far sparkle | `GasVolume.tsx` | Smog fades before the camera-following volume's faces; fine detail fades 9–14 m (`gDetail`). Perf improved (DPR2 smog: 0 frames >33 ms, was 6). |
| Papers discovered in the smog | `story/flight.ts` (`START_AHEAD` 8.5, `startFor`), `story/Parchment.tsx` (`uForm` edge→fibres, `uGhost` dark silhouette), `story/parchmentMaterial.ts` (`uGhost`), `story/parchmentTexture.ts` (smaller/fainter stains) | Sheet first a dark shape far off, edge, fibres, then ink. Grey "bokeh" circles were the stain rings — reduced. |
| ACM stone legibility | `intro/world/AcmStone.tsx` | Root cause of dim MACHINERY: letter normals tipped **down** at the foot mirrored the dark ground → now tipped up for all lines; steeper raking key; uplight moved to the plinth (no hot spot). |
| Lightning through fog | `intro/world/lightning.ts` (pulses with per-pulse sky direction; extra storm at T.acm+3; reduced-motion = one soft swell), `intro/look.ts` (`flashDir`, reduced flag), `intro/fog.ts` (`uMistFlash` directional glow scaled by fog amount), `IntroAtmosphere.tsx` | Deterministic, pure function of beat. |
| Smog audio no longer a standing hiss | `components/experience/SoundDirector.tsx` | `hiss` decays after release; `air` only while deep in smog; paper flight air/flaps scale with nearness. |
| QA hook for layer levels | `systems/audio/sfx.ts` (`__sfxLayers`) | Only active if a page defines `window.__sfxLayers`. |
| Rail legibility | `src/app/globals.css` (`.rail*`) | Weight 600/700 numerals, text-shadow halo, film opacity 0.8. |
| Autoprefixer warning | `globals.css` `.index-intro` `align-items: flex-end` | |
| Docs | `docs/INTRO.md` | Beat table, sound, lightning, smog, papers updated (reflects pass 1 only). |

### 3.2 Intro pass 2 (spec v2, current `intro_improv.txt`) — PARTIAL, uncommitted, mostly NOT fully verified
| Change | Files | Implementation | Verified? |
|---|---|---|---|
| **New ACM-CEG beats; descent shifted +13** | `intro/timeline.ts` | New `T.acmCegIn 139.5`, `T.acmCeg 144`, `T.acmCegHold 150.5`; `descend 155.5, cloudTop 158, cloudBase 163.5, plaza/wellOpen 172, shaft 175, lobby 182.5, door 189.5, doorway 197, end 201`; `STILLS` updated. Intro is now −44…201 beats. | Profile measured (see §4). |
| **Red building → rise continuity** | `intro/camera.ts` (`cruise()` helper; old `glide()` removed) | One spline per section with Hermite arc-length speed profile: clearing(84)→foot of tower(116) 0.55→3 m/beat; 116→cloudIn(132) 3→20 m/beat rounding into the column (no hover stop, no hero hold). Look target coupled to the position curve parameter. | Speed profile measured: continuous, no stops. **Not** re-tested with real wheel input/visually after the change. |
| **Aerial flight + ACM-CEG hold** | `intro/camera.ts` keys 135.5–160.8, `ACM_CEG` export `{x: W.x, y: 262, z: W.z−336}` | Level out over cloud → slow into composition at 144 → hold ~1 m/beat to 150.5 → tilt down (look targets far along the tilt) → drop back into cloud. | Screenshots OK (landscape). **Contains the orientation bug, §7.1.** |
| **ACM-CEG 3D identity** | `intro/world/AcmCeg.tsx` (new), mounted in `intro/world/IntroWorld.tsx` | Blade face (`bladeGlyph`, spiked 'A*', custom blade hyphen), cap 56 m, extruded 11 m; deep violet lacquer MeshPhysicalMaterial (clearcoat, light iridescence/sheen, chromeStudio env), `fog=false` + own 7% haze; letters rise out of the cloud in turn (scroll-driven); light sweep during hold; portrait layout "ACM-" / "CEG" (**portrait not checked**). | Landscape screenshots (aer5) OK. |
| **Cloud sight-line to the name** | `intro/world/Clouds.tsx` | `inSightLine()` corridor: far-ring masses in front of the name skipped; near masses in corridor lowered below the name's foot; 26 extra low "floor" masses out to/past the name (removes a visible sea-edge line). | Screenshots OK. |
| **Infinite loop (bounded)** | `config/timeline.ts` (new segment `return`, 340 vh, chapter `teams`), `teams/layout.ts` (`carouselAt`/`progressForCarousel` extended with matched slope; `C_RETURN`; `SPINE_BOTTOM` −12→−50), `teams/camera.ts` (orbitShot return: closes on spine, falls, looks down the spine, fov +8), `teams/travel.ts` (`tr.dark` ramps to black over the return), `teams/world/spineGeometry.ts` (filament turns scale with length), `components/experience/navigation.ts` (`loopToStart`, `loopToEnd` lands at `p−0.003`; `stepStop` wraps), `components/experience/JourneyLoop.tsx` (new; mounted in `Experience.tsx`) | Forward: when inside, teamsActive, target≥1−1e-4 and value≥1−3e-4 → `loopToStart()` (leave Teams, reset activeRoom/dossier/menu, `jumpToProgress(0)` — dark→dark behind the jump fade). Backward: at the opening's start (rested ≥600 ms) a sustained upward pull ≥520 px (wheel/touch, passive listeners) → `loopToEnd()`; the frame darkens with the pull. | Forward wrap ✓, backward wrap ✓ (after the `p−0.003` fix), return visuals ✓ (screens c6→c9.2). Chapter rail across the wrap, audio across the wrap, reduced-motion wrap, touch: **not verified**. |
| **Finale plate removed (no footer/CTA end)** | `teams/ui/TeamsHud.tsx`, `teams/ui/teams.css`, `globals.css` (`.finale-*` deleted) | "Made of many minds" plate, mailto CTA, socials, "Back to the red building" removed at source. Contact info still in archive/text version. | Typecheck ✓ (before AcmCeg break). |
| **GPU texture leak on scene streaming** | `systems/performance/useDisposable.ts`, `intro/world/chromeStudio.ts`, `AcmStone.tsx`, `AcmCeg.tsx` | `disposeDeep` now also disposes a material's textures (map slots + `uniforms`), **skipping render-target textures**. `chromeStudio()` cached per renderer (WeakMap), consumers use `useMemo` (not `useDisposable`). | Measured: Intro↔Events leaked +4 textures/cycle before, +2 after the disposeDeep change; the chromeStudio cache (for the remaining +2 — PMREM target from a StrictMode double-invoked factory) is applied but **NOT re-measured**. |

---

## 4. What Was VERIFIED (real browser = headless Chrome w/ GPU against localhost:3100, unless noted)

Pass 1 (all on the pass-1 tree):
- Entry: fresh Enter → beat −44, p 0, chapter arrival; deep scroll + reload → start, scrollY 0;
  `/#patternx` → room 4 once, hash consumed, refresh → start; `#faq` → start; `#team` → Teams (intentional
  alias); archive TOC click → hash unchanged.
- Chapter rail: active chapter/fill/percent agree at every boundary (fill 1/7, 2/7, 3/7, 5/7).
- Red building (pass-1 path): arc-length speed continuous; real wheel trace frames ≤22.7 ms.
- Prologue/story/stone/lightning screenshots; reduced-motion stills; Events→portal (no editorial card);
  portal hold → Teams → member hand → Escape.
- Audio (via `__sfxLog`/`__sfxLayers`, NOT by ear): roll contacts/friction follow motion, stop at rest,
  reverse; contact→ticks→settle→pressure→release order; burn ignite→crackle→pop→brittle→crumble→ashRelease,
  silent in reverse; no layers during building/drone; music running continuously (one player).
- Frame timing (headless Apple silicon, 60 Hz cap): smog DPR1 0 >33 ms, DPR2 0 >33 ms after fixes; story/CEG clean.
- `tsc` ✓, `next build` ✓ (incl. Next lint), `git diff --check` ✓, full-run console: 0 errors/warnings/hydration.

Pass 2 (partial):
- Camera speed/turn profile 80–185 beats measured via `__acm.intro.cameraAt` (reveal 0.58→1.5, pool 2.5,
  tower 3, rise 4.4→20, aerial ~8 → 1.9 at 144 → ~1.0 hold → ramps up; max speed step 0.7 m/beat/0.05 beat;
  tilt peak 22°/beat at 154–158 after moving look targets).
- ACM-CEG landscape screenshots (reveal wave at 142, hold 147).
- Loop: forward wrap and backward wrap work (state printouts); return visuals down the spine to black.
- Memory over 5 loops: geometries 63 stable, programs 45 stable, heap ~172 MB stable; **textures +6/loop**
  (before the chromeStudio fix — not re-measured).
- `tsc` passes on the current tree (0 errors, run at handoff) and `git diff --check` is clean. No pass-2 build, no pass-2
  full QA, no pass-2 `git diff --check`, no portrait, no audio listening.

---

## 5. PARTIALLY DONE (spec v2)

1. **ACM-CEG reveal/hold (spec §4–5, §26)** — landscape works; portrait stacking untested; reverse
   through the hold untested visually; the hold → descent contains the orientation bug (§7.1).
   Files: `intro/world/AcmCeg.tsx`, `intro/camera.ts` (keys `T.cloudOut`…160.8, `ACM_CEG`).
2. **Red-building continuity (§12, §26)** — path is continuous by measurement; needs real-input visual
   test (slow/fast/stop/reverse) and a check that the reveal composition still reads (the camera no
   longer pauses at 92–103). `intro/camera.ts cruise()` sections 1–2.
3. **Infinite loop (§15–18)** — works both ways; remaining: verify chapter rail, audio (no stale layers,
   music not restarted), reduced motion (`stepStop` wrap), touch pull, repeated loops memory after the
   texture fix, rail percent wrap; check the Teams HUD/nav during the return; check the spine extension
   cost (`SPINE_BOTTOM` −50 ≈ 3× vertebrae — measure triangles/draw time).
4. **Texture leak** — see §3.2; re-run the Intro↔Events and loop memory tests after fixing the import.
5. **Rail readability (§13)** — pass-1 legibility done; Montserrat hierarchy + persistent active label
   not done; still weak over bright aerial frames.
6. **Thunder (§11)** — thunder cue already exists (`sfx.ts cue('thunder')`, fired by `SoundDirector`
   CUES from `LIGHTNING`), delay fixed (1.1 s/2.2 s); spec wants per-event varied delay/timbre and a
   resonant tail — not done.

## 6. COMPLETELY MISSING (spec v2)

- **§2 First paper "A STORY BEGAN."** (uppercase) — `intro/story/fragments.ts` `began` line text is still
  `'A story began.'` (style `display`). Change text (or style) — keep animation/burn.
- **§3 Montserrat global typography** — `src/app/layout.tsx` still loads `Bodoni_Moda`;
  `globals.css` maps `--font-serif/--font-sans/--font-mono` and `--serif/--sans/--mono` to Bodoni. Needs a
  real hierarchy (weights/tracking per role) across globals.css, teams.css, intro.css, components, rail,
  Events plates/dossiers, Teams UI and in-world canvases (`systems/textures/typeset.ts` reads
  `--font-*`). Gas words (`gasFields.ts letterField`) use Helvetica 800 on purpose — may switch to
  Montserrat 800/900 (fonts are ready before the canvas mounts). Remove `font-stretch` no-ops.
- **§6 Cloud ambience SFX** — not started (add a `setLayer` layer in `sfx.ts` + drive from
  `SoundDirector` by `look.cloud` × camera speed, subtle, slow deterministic pan).
- **§7 Portal crossing SFX** — not started. Trigger from `teams/travel.ts` crossing moments
  (`ENTER_CROSS`/`EXIT_CROSS` in the GSAP onUpdate), via `cue()`; different cue for exit.
- **§8 Underground Events buzz** — source identified, NOT removed: `SoundDirector.tsx` sets
  `setLayer('events', 0.035 * world.underground * (1 - world.teams), { freq: 1200 })` whenever the film is
  not active (i.e. throughout the Events corridor); the `events` layer in `sfx.ts` is
  `drone(ctx, 'events', [98, 147, 196.3], 900)` (sustained oscillators = the "bzzz"). Also the `shaft`
  layer is a tonal drone `[55, 82.4, 110.6]`. Remove the post-film `events` layer; reconsider the
  through-door/shaft drones (spec §10 wants a designed tunnel sound instead).
- **§9 Prodigy tile-lock SFX** — not started. Find the Prodigy room tile animation in
  `src/scenes/events/exhibits/pieces.tsx` (Prodigy artifact `puzzle-wall`) — expose per-tile lock times as
  a pure function of room visit progress and fire `cue()` on forward crossings from `SoundDirector`
  (outside-film branch), with subtle per-tile variation.
- **§10 Events tunnel SFX** — not started (shaft `T.shaft`→`T.lobby`→door; replace drone with evolving
  layered design + exit transient cue).
- **§14 Chapter click** — not changed (still `jumpToProgress` cut behind `fx.fade`). Spec: intentional,
  not teleport, not 10 s fast-forward — e.g. proper fade-out→jump→fade-in in `navigation.goToChapter`.
- **§23 Performance review** of new parts (AcmCeg, extended spine, loop) — not done.
- **§24 Portrait** gas words + ACM-CEG — not checked.
- **§25 Sharp tilts** — the old 142 tilt is replaced by the new drop; the shaft tip-up (now ~181,
  ~81°/beat) is pre-existing/intentional — left as is.
- Docs for pass 2 (`docs/INTRO.md`, architecture/loop docs) — not written.

## 7. KNOWN BUGS

### 7.1 ASCENT post-cloud vertical-descent orientation bug (P0) — cause identified, NOT fixed
- **Where:** during the drop after the ACM-CEG hold, **beats ≈158 → 163.5** (`T.cloudTop` → `T.cloudBase`),
  visible as the camera exits the cloud base (cloud base y 155 ≈ beat 163) — the campus appears rotated
  180° (north at the bottom) and "corrects itself" when you scroll further.
- **Root cause (from the key data in `src/intro/camera.ts`, not yet confirmed in the browser):** the camera
  looks almost straight down, and `aim()` (systems/camera/pose) derives yaw from the horizontal direction
  to the look target. The keys put the look target on alternating sides of the camera:
  - `T.cloudTop` (158): pos `[W.x, 222, W.z−16]`, look `[W.x, 40, W.z−38]` → target **north** (−z)
  - `160.8`: pos `[W.x, 187, W.z−5]`, look `down(125)` = `[W.x, 125, W.z−0.03]` → target **south** (+z)
  - `T.cloudBase` (163.5): pos `up(152)` = `[W.x,152,W.z]`, look `down(90)` → target **north** (−0.03)
  So the look's horizontal offset crosses zero twice → yaw snaps 0°→180°→0°. The original design kept
  the look slightly north (`down()` = −0.03 z) precisely to fix "north at the top". This bug was
  introduced by the new aerial/descent keys in pass 2.
- **Fix:** edit those keys only, so the look target stays consistently **north (−z) of the camera** all
  the way down (e.g. at 160.8 use a look like `[W.x, 125, W.z − 5 − k]`, and blend smoothly to
  `down()` at the column), then verify with a per-beat yaw sample (`__acm.intro.cameraAt(t)`: compute
  `atan2(lookX−posX, lookZ−posZ)` for t = 150…170, no jumps) and screenshots slightly before/at/after
  163, forward and reverse, landscape + tablet + portrait.
- **Must NOT:** add a second camera controller, a roll/yaw override, a timeout/delayed correction, a
  scroll threshold, hide the scene, or special-case one viewport. Fix the key/look interpolation itself.

### 7.2 (Resolved) `AcmCeg.tsx` `useMemo` import — present on disk; `tsc` passes at handoff.
### 7.3 Texture growth per streaming cycle (P1) — fix applied, unverified (§3.2).
### 7.4 Pre-existing: descent-shaft tip-up is abrupt (~81°/beat at ~181) — intentional in the story; leave unless the user objects.
### 7.5 Rail contrast over the brightest aerial frames is still modest.

## 8. CURRENT `intro_improv.txt` STATUS

`intro_improv.txt` (repo root, untracked; the user refers to it as `intro_imprv.txt`) was **updated during
this workflow** and is the **authoritative spec** for the remaining Intro work. Its current contents:
§1–32 (second refinement pass) + an appended section "ASCENT — VERTICAL DESCENT / POST-CLOUD LAYOUT
ORIENTATION BUG" (= §7.1 above).
- Completed: §1 preserve list honoured; §15–17 loop core (with open verification); §4/§5 ACM-CEG
  (landscape); §12/§26 camera continuity by measurement; finale removed (§17 "no footer/CTA").
- Partial: §4/5 portrait, §12 visual validation, §13 rail, §18 loop determinism tests, §11 thunder,
  §23 perf, the appended ASCENT bug (diagnosed only).
- Remaining: §2, §3, §6, §7, §8, §9, §10, §14, §24, §29–31 QA/validation, §32 report.

## 9. `optimization.txt`

Not present in the repo (checked `ls` at the repo root). If the user provides it later, treat it as a
separate final performance pass, not done.

## 10. IMPORTANT ARCHITECTURE RULES (do not break)

- One camera writer (`CameraRig`); Intro camera = `INTRO_KEYS` → `CameraPath`. Fix motion by editing keys/
  helpers (`cruise()`), never by adding tweens/controllers on top.
- One scroll system: one Lenis + one ScrollTrigger in `ScrollTimeline.tsx`; one `progress` authority.
  `JourneyLoop` only listens at the start edge and calls navigation; keep it that way.
- One navigation layer (`components/experience/navigation.ts`) for all cross-world jumps.
- One audio architecture: `MusicPlayer` + `MusicDirector` + `SoundDirector` + `sfx.ts` (`setLayer`/`cue`).
  New sounds = new layers/cues there, triggered by deterministic state crossings (never React renders).
  Music must never restart (no calls to `music.playFrom` outside Enter).
- Everything cinematic is a pure function of scroll (beats / orbit `c`); forward and reverse must work.
- Preserve Events (2026 data), Teams (portal, orbit, member hand, Escape/keyboard, reduced motion), the
  loop (return segment + JourneyLoop), and pass-1 Intro work.
- Resources: allocate in `useDisposable`; GPU objects shared across mounts must be cached (like
  `chromeStudio`), not created per mount.
- Git: no reset/revert/stash/clean/force; stage explicit paths only; never commit the MP3; don't commit or
  push unless the user asks.

## 11. FILES CHANGED THIS SESSION (on master, uncommitted)

- `docs/INTRO.md` — pass-1 docs (beats, sound, lightning, smog, papers). Needs pass-2 update.
- `src/app/globals.css` — rail legibility (weights, halo, opacity); `.index-intro` flex-end; `.finale-*` removed.
- `src/components/archive/ArchiveLayerControls.tsx` — TOC links scroll within the layer (no hash).
- `src/components/experience/Experience.tsx` — mounts `JourneyLoop`.
- `src/components/experience/JourneyLoop.tsx` — NEW: loop forward/backward logic.
- `src/components/experience/SoundDirector.tsx` — smog hiss/air decay; paper flight air/flaps by nearness; `startFor`.
- `src/components/experience/navigation.ts` — `loopToStart`, `loopToEnd`, `stepStop` wrap; imports `placeInside`.
- `src/config/timeline.ts` — `return` segment (340 vh), SegmentId, teams chapter segments.
- `src/intro/camera.ts` — header; `cruise()` (replaces `glide()`); `ACM_CEG`; keys 84→201 rewritten/shifted.
- `src/intro/fog.ts` — `uMistFlash`/`uMistFlashColor` lightning glow in mist.
- `src/intro/look.ts` — `flashDir`, `evaluateLook(t, reduced)`, flash fog lerp 0.14.
- `src/intro/prologue/GasVolume.tsx` — word region/density rework, face fade, far detail fade, colours.
- `src/intro/prologue/layout.ts` — `unstableAt`.
- `src/intro/story/Parchment.tsx` — discovery arrival (`uForm`, `uGhost`, `startFor`).
- `src/intro/story/flight.ts` — far start in the air, `startFor`, `START_AHEAD` 8.5.
- `src/intro/story/parchmentMaterial.ts` — `uGhost` silhouette.
- `src/intro/story/parchmentTexture.ts` — smaller/fainter stains.
- `src/intro/timeline.ts` — ACM-CEG beats, +13 shift, STILLS.
- `src/intro/world/AcmCeg.tsx` — NEW: ACM-CEG identity object.
- `src/intro/world/AcmStone.tsx` — normals up, key/uplight, shared studio via useMemo.
- `src/intro/world/Clouds.tsx` — sight-line corridor, lowered masses, floor masses.
- `src/intro/world/IntroAtmosphere.tsx` — passes reduced flag; sets `uMistFlash`.
- `src/intro/world/IntroWorld.tsx` — mounts `AcmCeg`.
- `src/intro/world/chromeStudio.ts` — per-renderer cache.
- `src/intro/world/lightning.ts` — storms with per-pulse direction, reduced-motion swell, stone storms.
- `src/systems/audio/sfx.ts` — `__sfxLayers` QA hook.
- `src/systems/performance/useDisposable.ts` — dispose material textures (skip RT textures).
- `src/teams/camera.ts` — return descent in `orbitShot`.
- `src/teams/layout.ts` — return mapping (`END_SLOPE`, `RETURN_SPAN`, `C_RETURN`), `SPINE_BOTTOM` −50.
- `src/teams/travel.ts` — return darkness in `travelChannels`.
- `src/teams/ui/TeamsHud.tsx` — finale plate removed.
- `src/teams/ui/teams.css` — `.teams-outro` rules removed.
- `src/teams/world/spineGeometry.ts` — filament turns/samples scale with spine length.

## 12. NEXT PRIORITIES

- **P0**
  1. Run `next build` (dev server on 3100 stopped first) on the pass-2 tree; keep `tsc` passing.
  2. Fix the post-cloud descent orientation bug (§7.1) at the keys; verify yaw continuity + screenshots fwd/rev.
  3. Re-measure texture/memory across Intro↔Events cycles and 5+ loops; must be flat.
  4. Remove the underground Events buzz (§8) at its source.
  5. First paper → "A STORY BEGAN." (§2).
  6. Montserrat typography system (§3) + rail typography (§13).
  7. Verify the loop end-to-end (chapter rail, audio, reduced motion, touch, reload after looping).
- **P1**: portal SFX (§7), Events tunnel SFX (§10), Prodigy tile-lock SFX (§9), cloud ambience (§6),
  thunder variation/tail (§11), chapter-click transition (§14), real-input red-building/aerial checks.
- **P2**: portrait ACM-CEG + gas words (§24), ACM-CEG material polish, rail over bright frames, perf
  review of spine extension/AcmCeg (§23), docs.
- **P3**: micro timing/tails.

## 13. HOW TO CONTINUE

1. `cd /Users/arunnm/Projects/acm-ceg-world && git status && git log --oneline -5` — expect master,
   HEAD `653a5ca`, the dirty tree listed in §1. Do not reset/stash/clean.
2. Read this file, then `intro_improv.txt` (esp. §2–§18 and the appended ASCENT section).
3. `git diff` the files in §11 to see the exact current work; read `JourneyLoop.tsx`, `AcmCeg.tsx`.
4. Re-run `./node_modules/.bin/tsc --noEmit --incremental false -p .` (passed at handoff) before changing anything.
5. Start/verify the dev server: `./node_modules/.bin/next dev --port 3100` (not `npm run dev`).
6. Browser QA with `scripts/qa/intro.mjs` (`enter:quiet`, `at:<beat>`, `settle`, `shot:`, `scroll:`,
   `reduced:1`, `fstart/fstop`, `eval:`) and `scripts/qa/teams.mjs` (`at:<c>`, `card:<i>`, `hold:`,
   `portal:`); contact sheets with `scripts/qa/sheet.mjs <dir> <out.png> <files…>`. For camera math use
   `window.__acm.intro.cameraAt(t)`; for audio set `window.__sfxLog=[]; window.__sfxLayers={}` before Enter
   and read them; memory via `window.__acm.memory()` / `renderInfo()`.
7. Implement remaining items in priority order inside the existing systems (§10).
8. Validate: `tsc`, `./node_modules/.bin/next build` (stop the 3100 dev server first — build overwrites
   `.next`; restart it after), `git diff --check`, full browser pass (spec §29), reverse/reload/loop/reduced
   motion/portrait. Confirm `src/content/generated/available-assets.json` is unmodified.
9. Do not commit or push unless the user asks; if asked, stage explicit paths only (never the MP3,
   never `.playwright-mcp/`).
