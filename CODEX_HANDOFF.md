# ACM-CEG World — Current Development Handoff
## Teams Track / Claude Code #2

You are taking over an in-progress, production-quality creative web project.

You are the SECOND development agent working specifically on the
Teams experience.

Read this entire handoff before touching code.

Then inspect the actual repository and current implementation.

IMPORTANT:
This document contains project intent, architecture, constraints,
and current requirements.

The CURRENT SOURCE CODE is the final source of truth.

Do not blindly implement an older description if the current
implementation has already evolved beyond it.

Before changing anything, inspect:
- README.md
- docs/ARCHITECTURE.md
- docs/TEAMS_WORLD.md
- docs/CONTENT.md
- docs/ASSETS.md
- src/teams/
- src/content/teams.ts
- relevant camera / scroll / scene infrastructure
- git status
- recent git history

Do not rebuild working systems merely because an older section of
this document describes them differently.

---

# 1. PROJECT

ACM-CEG World is the flagship website for the ACM-CEG Student
Chapter at the College of Engineering Guindy, Anna University,
Chennai.

The website is designed as one continuous, scroll-driven,
cinematic 3D journey rather than a conventional website.

The experience includes:

CEG red building
→ campus drone ascent
→ campus overview
→ underground facility
→ facility hall
→ events corridor
→ event installations
→ Teams portal
→ Teams world
→ domain exploration
→ eventual continuation back into the larger site journey

The project is intended to feel like a premium interactive
experience at the quality level of high-end WebGL / experiential
websites.

Active Theory is an INTERACTION AND QUALITY reference only.

Do NOT clone Active Theory's visual identity, source code,
layout, assets, or website.

The implementation must remain original to ACM-CEG.

---

# 2. CURRENT PARALLEL DEVELOPMENT MODEL

This project is being developed by two Claude Code sessions
simultaneously.

## MASTER TRACK

Another Claude Code session owns:

master

and is working primarily on:

Cinematic Intro

The master track is responsible for the larger cinematic
introductory journey.

## DEV TRACK — YOUR TRACK

You are working in:

/Users/arunnm/Projects/acm-ceg-world-dev

Your branch is:

dev

Your responsibility is:

THE TEAMS EXPERIENCE

You are NOT the owner of the cinematic Intro.

---

# 3. PARALLEL DEVELOPMENT RULES

CRITICAL.

Another Claude Code session is simultaneously modifying the
master branch.

You must:

- remain on dev
- never switch to master
- never reset master
- never merge master into dev unless explicitly instructed
- never revert another agent's work
- never modify unrelated Intro systems
- avoid touching shared infrastructure unless genuinely required
- keep Teams-specific changes scoped to the Teams subsystem whenever
  reasonably possible
- inspect before editing
- preserve existing functionality

Do not assume that because you can see a file that you should modify it.

If a shared file must be changed for Teams integration, first
understand exactly what the file owns and make the smallest
necessary change.

The goal is:

MASTER
→ Cinematic Intro

DEV
→ Teams

These tracks will be integrated later.

---

# 4. GIT STATE

This repository is ALREADY a Git repository.

Do NOT run:

git init

Do NOT create a new repository.

Do NOT create a new baseline commit.

Do NOT reset the repository.

Do NOT overwrite existing work.

Your worktree should look approximately like:

/Users/arunnm/Projects/acm-ceg-world
    → master
    → Cinematic Intro

/Users/arunnm/Projects/acm-ceg-world-dev
    → dev
    → Teams

Before making changes:

git status
git branch --show-current
git log --oneline -5

Expected branch:

dev

The working tree may initially be clean.

That is normal.

---

# 5. TECHNOLOGY STACK

Current stack:

- Next.js 15
- App Router
- React 19
- TypeScript
- Three.js
- React Three Fiber
- drei
- GSAP
- GSAP ScrollTrigger
- Lenis
- Zustand

The existing architecture has been deliberately structured around
a single scroll-driven experience.

Do not introduce a competing rendering architecture without a
strong reason.

Do not introduce another global scroll controller.

Do not create another independent camera owner.

Do not duplicate state systems unnecessarily.

---

# 6. GLOBAL EXPERIENCE PHILOSOPHY

The site is fundamentally scroll-driven.

The user's scroll is the timeline.

Conceptually:

scroll
→ timeline progress
→ camera / scene / object state
→ cinematic experience

The experience must remain reversible.

Scrolling forward should progress through the experience.

Scrolling backward should reverse the experience.

Avoid:

- autoplay sequences
- arbitrary timers controlling progression
- forced camera movement unrelated to scroll
- irreversible transitions
- snapping that removes user control
- competing scroll controllers
- hidden state machines that only work in one direction

Damping and inertia are allowed.

The user must still feel in control.

---

# 7. PROJECT-WIDE CONTENT RULES

Never fabricate factual content.

Names, roles, event information, numbers, sponsors, prizes,
team members and other factual information must come from the
existing typed content sources.

Primary content sources live under:

src/content/

Do not invent:

- people
- roles
- bios
- team memberships
- event facts
- achievements
- statistics
- dates
- organizations
- sponsors

If content is not available, use the project's existing
CONTENT PLACEHOLDER convention rather than inventing copy.

---

# 8. PEOPLE / TEAM DATA RULES

Do not infer:

- gender
- pronouns
- appearance
- personality
- biography

from names.

Use existing structured content.

Do not introduce team photographs unless the content/assets system
already provides them or the owner explicitly supplies them.

For Teams, the member names and assignments are authoritative
content.

---

# 9. EXISTING TEAMS ARCHITECTURE

The Teams subsystem already exists.

Do NOT rebuild it from scratch.

Primary Teams directory:

src/teams/

The current subsystem includes the following conceptual layers:

## Experience / HTML interaction layer

TeamsExperience.tsx

Responsible for the higher-level Teams interaction composition,
DOM/UI coordination and integration with the WebGL world.

## WebGL world

TeamsWorld.tsx

Owns the primary Teams 3D world composition.

## State

state.ts

Owns discrete Teams state and per-frame channels.

Per-frame animation data should not unnecessarily flow through
React state.

## Controller

controller.ts

Coordinates Teams interaction and maps the global experience state
into Teams behavior.

## Layout

layout.ts

Contains spatial layout logic including:

- card dimensions
- spatial composition
- mobile composition
- scroll-to-carousel mapping
- Teams positioning

## Camera

camera.ts

Contains Teams-specific camera behavior including:

- arrival
- orbit
- focus
- tunnel / travel shots
- domain entry / exit camera choreography

## Travel

travel.ts

Owns the major Teams travel timelines and transition clocks.

## Focus

focus.ts

Owns domain card focusing / opening / closing / switching behavior.

---

# 10. OTHER IMPORTANT SYSTEMS

Before changing Teams, inspect how Teams integrates with these:

## Global scroll

src/.../ScrollTimeline.tsx

There should remain one authoritative Lenis / ScrollTrigger
pipeline.

Do not introduce another global scroll listener/controller.

## Global progress

progress.ts

Understand the relationship between:

progress.target
progress.value
damping
Teams progress

before changing scroll behavior.

## Camera

CameraRig.tsx

The global experience must maintain a clear camera ownership model.

Do not create a second competing global camera writer.

Teams may provide camera poses / behavior through the existing
Teams controller architecture.

## Spine

Spine.tsx

spineGeometry.ts

These define the physical Teams spine.

## Cards

DomainCards.tsx

cardFace.ts

These define domain-card rendering and interaction.

## Input

TeamsInput.tsx

Pointer/touch interaction belongs here or through the existing
interaction architecture.

Do not create a separate competing pointer system.

## Particles

ParticleField.tsx

The Teams world already contains a substantial particle system.

Performance matters.

Do not add expensive per-object CPU cursor calculations to
thousands of particles.

## Grain / screen effects

ScreenFx.tsx

Existing CSS/WebGL screen effects should be understood before
replacing them.

## Domain details

DomainDetail.tsx

TeamsHud.tsx

These coordinate domain information and interface state.

The long-term visual goal is for domain details to feel integrated
into the spatial scene rather than appearing as an unrelated
modal.

## Post processing

PostProcessing.tsx

Understand the current post stack before adding new effects.

## Scene streaming

SceneDirector.tsx

Teams is part of the larger streamed cinematic experience.

Do not break mounting/unmounting or resource disposal.

---

# 11. IMPORTANT CURRENT ARCHITECTURAL PRINCIPLE

The existing system is intentionally structured rather than being
a collection of disconnected Three.js demos.

Preserve that structure.

Current high-level flow:

Document scroll
→ Lenis
→ global scroll progress
→ damped progress
→ Teams controller
→ Teams spatial coordinate
→ camera / spine / cards / particles
→ domain focus / travel state

The experience may contain multiple damping layers.

That is intentional when it produces different physical response
times.

Do not remove all damping simply because it makes the code look
simpler.

---

# 12. THE TEAMS EXPERIENCE — CURRENT TARGET

The Teams experience is NOT supposed to be a normal card carousel.

It should feel like entering a physical, cinematic, spatial
installation.

The target characteristics are:

- minimal
- cinematic
- spatial
- tactile
- premium
- editorial
- restrained
- physically grounded
- responsive
- atmospheric

It should NOT feel like:

- a normal website carousel
- a generic Three.js demo
- a gaming UI
- generic glassmorphism
- a flat card layout
- a CSS perspective trick
- a neon cyberpunk scene
- a collection of floating UI panels

---

# 13. THE TEAM ENTRY

Before the Teams domain environment is revealed, the experience
contains a large physical 3D typographic title:

THE TEAM

This must exist as part of the 3D scene.

It should not be implemented as a normal HTML heading positioned
over the canvas.

The sequence is:

THE TEAM
↓
camera approaches
↓
typography becomes enormous
↓
camera gets close to the physical letter geometry
↓
camera passes between / through the typography
↓
typography moves behind the camera
↓
open spatial environment emerges
↓
Teams spine becomes visible
↓
domain cards emerge into readable composition

The transition must be continuous.

No hard cut.

No arbitrary loading transition.

No "portal" made by simply placing a glowing rectangle behind
the letters.

IMPORTANT:

THE TEAM is NOT a literal tunnel or portal.

The camera should physically pass through / between large
typographic geometry.

The letters should then remain behind the viewer.

---

# 14. 3D TYPOGRAPHY

THE TEAM typography must feel physical.

Desired qualities:

- extrusion
- depth
- controlled bevel
- physical material
- perspective
- edge response
- restrained lighting
- realistic spatial scale
- environmental integration

Avoid:

- neon outlines
- excessive glow
- cartoon extrusion
- excessive bloom
- floating CSS text
- cheap gaming typography

The typography is part of the environment.

---

# 15. TEAMS SPINE

The spine is one of the major physical objects in the Teams world.

It must NOT look like:

- a decorative diagonal line
- a thin curve behind cards
- a background graphic
- a UI connector

It should read as a real spatial structure.

Important properties:

- real 3D depth
- controlled curvature
- spatial orientation
- perspective
- material response
- edge response
- environmental lighting
- card relationship
- vertical / horizontal distribution
- depth variation
- subtle movement
- independent response timing

The spine should remain visually important even when cards are
the primary readable objects.

---

# 16. DOMAIN CARDS

Domain cards are physical objects in the environment.

They are NOT ordinary HTML cards floating in a Three.js scene.

They should have:

- physical thickness
- front/back surfaces
- depth
- edge response
- controlled transmission
- restrained reflection
- roughness variation
- environmental response
- perspective
- foreshortening
- depth separation
- foreground/background hierarchy

The cards may use translucent materials, but they should NOT
look like generic frosted-glass UI.

The visual language should be closer to:

a physical translucent/tinted material suspended in space

rather than:

a website glassmorphism panel.

---

# 17. CARD COMPOSITION

Cards should occupy meaningful 3D positions around the spine.

They need:

- X/Y/Z placement
- rotation
- scale
- perspective
- depth separation
- foreground/background hierarchy

Nearby cards should feel physically closer.

Far cards should be strongly foreshortened and partially recede
into depth.

Do not arrange all cards in a flat readable row.

Do not make every card equally prominent.

There should be a clear active / near / mid / far hierarchy.

---

# 18. CARD TYPOGRAPHY

Card text should feel integrated with the physical card surface.

Avoid the appearance of:

HTML text
+
transparent rectangle

Instead aim for:

physical surface
+
integrated typography
+
material response
+
environmental lighting

Typography must remain readable.

Do not sacrifice legibility for effects.

---

# 19. DOMAIN ORDER

The Teams experience now contains CORE plus the six domains.

The exact order is:

1. CORE
2. Web and App Development
3. Competitive Programming and Technical Development
4. Events and Functioning
5. Contents and Design
6. HR and Logistics
7. Marketing

Do not change this order without explicit instruction.

---

# 20. CORE

CORE is a first-class spatial Teams destination.

It must use the same physical 3D interaction language as the other
domains.

Do NOT implement CORE as:

- a flat HTML table
- a modal
- a special unrelated page
- a static image
- a different interaction paradigm

CORE members:

CHAIRPERSON
Visvam Srinivasan
2023103004

VICE CHAIRPERSON
Sankara Krishnan P
2023115074

SECRETARY
Purushothaman V
2023115035

TREASURER
Manesh Ram
2023103037

CORE should participate in:

- card selection
- camera focus
- domain entry
- detail reveal
- reverse navigation
- scroll continuity

using the same spatial system.

---

# 21. EXISTING DOMAIN ASSIGNMENT REQUIREMENTS

The existing domain assignments are authoritative.

Preserve all current assignments.

Two specific assignments must NOT be accidentally removed:

Prithvi is also in:

Web and App Development

Varshhaa is also in:

HR and Logistics

Do not deduplicate these people away simply because they appear
in another domain.

---

# 22. SCROLL INTERACTION

Scrolling should drive the spatial journey.

The response should include appropriate combinations of:

- translation
- rotation
- scale
- Z movement
- camera movement
- spine relationship
- active-card emphasis
- damping
- interpolation
- easing

The motion should feel physical.

Avoid:

- snapping
- mechanical carousel steps
- abrupt interpolation
- obvious "slide 1 → slide 2" behavior

The user should feel like they are moving through a continuous
3D environment.

---

# 23. CAMERA IS A CORE INTERACTION

Camera behavior is one of the most important aspects of Teams.

Camera behavior may involve:

- position
- FOV
- rotation
- look-at
- depth
- approach distance
- framing
- damping
- orbit
- focus
- travel
- domain entry
- domain exit
- reverse travel

Do not treat the camera as a passive observer.

The camera is part of the interaction design.

However, preserve the existing global camera ownership model.

---

# 24. IMPORTANT CURRENT COMPOSITION GOAL

The existing architecture may historically have behaved primarily
as a camera moving around a static card helix.

The target is a more unified spatial composition.

Do not blindly preserve a composition simply because it already
exists.

Evaluate:

- how dominant the spine feels
- how upright the composition feels
- card depth
- card foreshortening
- active-card readability
- neighboring-card disappearance into depth
- camera distance
- perspective
- environmental density
- relative motion speeds

The final result should feel like one physical system.

---

# 25. MULTIPLE RESPONSE SPEEDS

Not every element should settle simultaneously.

A high-quality physical response can have:

- card movement
- spine movement
- camera movement
- particle movement
- material response
- cursor response

all operating with subtly different response speeds.

This should feel organic.

Avoid making every object follow the same interpolation curve.

However:

Do not introduce excessive lag.

The user should never feel that the interface is fighting their
input.

---

# 26. CURSOR RESPONSE

Pointer interaction should be subtle.

Desired behavior:

cursor movement
→ small localized force
→ subtle displacement
→ short inertia
→ smooth recovery

The current target is explicitly NOT a sticky cursor effect.

Avoid:

- large cursor blobs
- excessive displacement
- long trailing lag
- objects permanently chasing the pointer
- every object reacting equally

Cursor response should feel like the environment is lightly
responding to the user.

Not like every object is attached to the cursor.

---

# 27. GRAIN / ATMOSPHERE

The visual grain should feel integrated into the rendering.

The atmosphere should remain alive even when scroll is stationary.

Avoid making grain:

- excessively noisy
- distracting
- dominant
- obviously layered on top as a cheap filter

The desired cursor relationship is subtle and localized.

If replacing the existing global CSS grain, ensure the replacement
does not increase GPU cost unnecessarily.

Remember that the particle field is already substantial.

---

# 28. PARTICLE PERFORMANCE

The Teams world already contains a significant particle field.

Do not assume more particles means better quality.

Before adding GPU/CPU work:

- inspect current particle count
- inspect current interaction logic
- inspect mobile behavior
- inspect frame time
- reuse existing systems where possible

Do not perform expensive CPU calculations for every particle
every frame.

Prefer GPU-friendly approaches when the visual benefit justifies
them.

---

# 29. CARD SELECTION / DOMAIN ENTRY

Selecting a domain should feel like physically entering the
selected domain.

Desired sequence:

selected card
↓
becomes dominant
↓
neighboring cards respond
↓
spine responds
↓
camera approaches
↓
selected card grows through perspective
↓
camera crosses the card surface
↓
domain environment is revealed

The card itself is the transition.

Do NOT simply:

click card
→ stop camera
→ display HTML modal

The domain content should feel spatially continuous with the card.

---

# 30. DOMAIN DETAIL

The current system may use a hybrid WebGL + DOM approach.

That is acceptable.

Accessibility and readability remain important.

However, visually:

DomainDetail should feel synchronized with the spatial transition.

The desired effect is:

physical card
→ camera passes through card
→ domain information exists in the resulting spatial state

rather than:

physical card
→ modal suddenly appears over the screen

The HTML layer may still be used where appropriate for readable
content.

Do not sacrifice accessibility merely to make something "more 3D".

---

# 31. FORWARD AND REVERSE JOURNEYS

Every major Teams transition must work in both directions.

Forward:

Teams entry
→ spine
→ cards
→ domain
→ detail

Reverse:

detail
→ card
→ Teams world
→ spine
→ previous experience

No one-way animation hacks.

No state that only works after moving forward.

No assumptions that the user can only travel in one direction.

---

# 32. PORTAL RELATIONSHIP

The portal is the transition from the Events corridor into Teams.

The existing project architecture contains:

src/teams/portal/

and Teams travel systems.

Understand the existing portal before replacing anything.

The portal should lead naturally into:

THE TEAM
→ spatial typography transition
→ Teams world

Do not create an unrelated second portal if the existing architecture
already owns this transition.

---

# 33. POST PROCESSING

Post-processing should remain restrained.

Avoid:

- excessive bloom
- excessive chromatic aberration
- excessive blur
- heavy distortion
- game-like visual effects

Effects should support:

- material depth
- atmosphere
- spatial hierarchy
- cinematic quality

not replace them.

---

# 34. MATERIAL LANGUAGE

The Teams world should have a coherent material language.

Cards should not all look like generic transparent glass.

Use subtle variation in:

- opacity
- roughness
- transmission
- tint
- reflection
- edge response
- environmental lighting

The spine should have its own physical material identity.

Particles should support atmosphere rather than look like generic
"space dust".

The scene should remain sophisticated and restrained.

---

# 35. LIGHTING

Lighting should reinforce physicality.

Prefer:

- controlled environment lighting
- subtle highlights
- material response
- restrained reflections
- depth cues

Avoid:

- neon everywhere
- colored light overload
- bloom as a substitute for form
- arbitrary moving lights

Remember the project's broader rule:

lights should not be repeatedly created/destroyed at runtime.

Understand the existing LightPool / WorldLights architecture before
adding new lights.

---

# 36. TYPOGRAPHY

The site currently uses:

- Instrument Serif for display
- Archivo for signage / expanded typography
- IBM Plex Mono for labels

Follow the existing typography system.

Do not randomly introduce another font.

For 3D display typography:

- keep it legible
- match the visual system
- use physical geometry only where appropriate
- avoid excessive text extrusion

Do not put paragraphs into 3D geometry.

Readable content should remain HTML/semantic wherever possible.

---

# 37. ACCESSIBILITY

The 3D experience must not destroy accessibility.

Preserve:

- semantic HTML
- accessible domain information
- keyboard navigation
- reduced-motion behavior
- text version
- aria-hidden canvas behavior

The visual experience is an enhancement.

It is not the only way to access the information.

---

# 38. MOBILE

Mobile is a first-class target.

Do not simply shrink the desktop composition.

Inspect and test:

- portrait layout
- card depth
- card readability
- touch interaction
- domain selection
- camera framing
- reduced motion
- performance
- particle count
- post-processing cost

Touch should feel deliberate.

Do not require hover for essential information.

---

# 39. PERFORMANCE

The project targets smooth interaction.

The current reference target is approximately 60 FPS on capable
hardware.

But do not optimize only for an M3 Max.

Also consider:

- weaker GPUs
- laptops
- mobile Safari
- mobile Chrome
- thermal throttling
- memory pressure

Avoid:

- unnecessary allocations in useFrame
- excessive object creation
- repeated geometry creation
- repeated material creation
- excessive render targets
- unnecessary state updates
- expensive DOM synchronization every frame
- unnecessary high DPR

Reuse resources.

Dispose resources correctly.

Use the existing project conventions.

---

# 40. RESOURCE MANAGEMENT

The project uses disposable resource patterns.

Preserve:

useDisposable

and the existing disposal architecture.

Do not create resources in render loops.

Do not leak:

- geometries
- materials
- textures
- render targets
- event listeners
- GSAP timelines
- animation frames

---

# 41. DO NOT CREATE A SECOND GLOBAL SYSTEM

Do not add:

- another Lenis instance
- another global ScrollTrigger
- another global camera writer
- another Zustand store for the same state
- another pointer system
- another post-processing stack
- another scene streaming mechanism

Before adding infrastructure, inspect what already exists.

---

# 42. FILE OWNERSHIP

Prefer keeping Teams changes within:

src/teams/

and:

src/content/teams.ts

when possible.

Possible shared integration files may include:

- camera systems
- scroll timeline
- scene director
- global content
- shared styling

Touch those only when necessary.

When you must modify a shared file:

1. inspect its responsibilities
2. identify the exact reason
3. make the smallest safe change
4. verify that Intro behavior is unaffected

---

# 43. CURRENT TEAMS AUDIT REQUIREMENT

Before implementing anything substantial, perform an audit.

Inspect the current code and determine:

1. How THE TEAM entrance currently works.
2. How the camera currently enters Teams.
3. How the spine is currently generated.
4. How cards are positioned.
5. How card depth is represented.
6. How card materials are implemented.
7. How card typography is rendered.
8. How scroll maps to Teams coordinates.
9. How damping is implemented.
10. How pointer response works.
11. How grain currently works.
12. How particles respond to the pointer.
13. How domain selection works.
14. How domain focus works.
15. How camera entry works.
16. How domain detail is revealed.
17. How reverse travel works.
18. How CORE is represented.
19. How the domain order is stored.
20. How mobile differs from desktop.
21. What the current performance costs are.
22. Which requirements are already complete.
23. Which requirements remain incomplete.
24. Which files must actually change.

Do NOT start by rewriting.

---

# 44. IMPORTANT: CURRENT CODE > HANDOFF

This handoff is deliberately comprehensive, but it is not a substitute
for inspecting the implementation.

If you find:

handoff says X
but current code implements Y

do NOT automatically revert Y to X.

Instead:

1. determine whether Y is a newer implementation
2. inspect git history
3. inspect docs
4. preserve the newer working behavior unless it conflicts with
   the current explicit requirements

When uncertain, prefer the current code and explicit current task.

---

# 45. QA PROCESS

Every meaningful visual change must be verified.

Start the application using the project's documented commands.

Typical development command:

npm run dev -- --port 3100

Typecheck:

npm run typecheck

Build:

npm run build

Follow the repository's current build instructions.

Do not run a destructive build over an active development server
if the project's documented workflow warns against it.

---

# 46. TEAMS QA

Use the existing Teams QA tooling where available.

The project currently provides Teams-oriented QA such as:

node scripts/qa/teams.mjs ...

and screenshot tooling.

Before trusting a visual change:

- run the relevant route
- inspect screenshots
- inspect the Teams entry
- inspect card composition
- inspect active card
- inspect domain entry
- inspect reverse entry
- inspect mobile
- inspect frame time when appropriate

Do not rely only on "the code compiles".

---

# 47. VISUAL QA STANDARD

Look at screenshots yourself.

Check for:

- crooked framing
- cards clipping into each other
- cards looking flat
- spine looking like a line
- incorrect depth
- excessive transparency
- unreadable text
- typography floating above surfaces
- excessive glow
- excessive grain
- cursor response being too sticky
- camera overshoot
- snapping
- mechanical motion
- domain detail appearing as a modal
- mobile cropping
- broken reverse transitions

A technically valid implementation can still be visually wrong.

---

# 48. THINGS TO AVOID

Do NOT create:

- generic glassmorphism
- a flat card carousel
- fake CSS perspective
- gaming UI
- excessive neon
- excessive bloom
- excessive blur
- giant cursor blobs
- unnecessary chromatic aberration
- excessive grain
- generic particle wallpaper
- cards floating without physical relationships
- a spine that reads as a simple line
- a literal THE TEAM tunnel
- a flat CORE table
- a modal masquerading as a 3D transition
- hard cuts between major spatial states
- unnecessary architecture rewrites

---

# 49. CREATIVE FREEDOM

You have creative freedom within the established system.

If you identify an improvement that is:

- more spatial
- more cinematic
- more physically believable
- more readable
- more performant
- more coherent with ACM-CEG

you may implement it.

But:

Creative freedom does NOT mean changing requirements.

Do not introduce effects merely because they look impressive in
isolation.

Every effect must improve the overall experience.

---

# 50. PRIORITY ORDER

Use this priority order when deciding what to fix.

## P0 — Architecture / safety

- preserve existing architecture
- preserve scroll ownership
- preserve camera ownership
- preserve Intro isolation
- preserve content correctness
- avoid regressions

## P1 — THE TEAM entrance

- physical 3D typography
- camera approach
- camera pass-through
- typography behind camera
- seamless transition into Teams

## P2 — Spatial composition

- spine physicality
- card arrangement
- depth
- perspective
- foreground/background separation

## P3 — Materials

- physical translucent card surfaces
- edge response
- roughness
- reflection
- controlled transmission
- environmental response

## P4 — Camera

- approach
- framing
- FOV
- damping
- orbit
- focus
- depth
- travel

## P5 — Scroll

- smooth continuous mapping
- no snapping
- controlled inertia
- reversible behavior

## P6 — Cursor / atmosphere

- subtle localized pointer response
- non-sticky grain
- layered response timing
- restrained particles

## P7 — Domain entry

- physical card crossing
- spatial domain reveal
- continuity
- reverse travel

## P8 — CORE

- first-class CORE card
- correct members
- same interaction system
- correct ordering

## P9 — Content correctness

- domain names
- member assignments
- placeholders
- no invented information

## P10 — Mobile / accessibility

- touch
- responsive composition
- reduced motion
- keyboard
- readable content

## P11 — Performance / polish

- GPU cost
- memory
- frame time
- material quality
- final visual refinement

---

# 51. FIRST SESSION BEHAVIOR

When you first start this task:

DO NOT immediately edit files.

First run:

git status
git branch --show-current
git log --oneline -5

Then inspect:

README.md
docs/ARCHITECTURE.md
docs/TEAMS_WORLD.md
docs/CONTENT.md
docs/ASSETS.md

Then inspect:

src/teams/

Then inspect:

src/content/teams.ts

Then inspect the shared camera / scroll systems.

Then run the project if possible.

Then perform the Teams audit described above.

---

# 52. FIRST RESPONSE / AUDIT

Before major implementation, report a concise audit containing:

## Current state

What Teams currently does.

## Already complete

Requirements that are already implemented.

## Remaining

Requirements that are missing or visually insufficient.

## Architecture

Which files own which behavior.

## Risks

Potential performance, integration or architecture risks.

## Planned changes

Exact files you expect to modify.

Do not produce a giant speculative rewrite plan.

Base the plan on actual inspected code.

---

# 53. IMPLEMENTATION STYLE

Make changes incrementally.

After each meaningful group of changes:

1. typecheck
2. run the app
3. inspect the result
4. run relevant QA
5. fix regressions

Do not accumulate hundreds of speculative changes and only test
at the end.

Prefer small coherent commits.

---

# 54. GIT COMMITS

When a meaningful piece of work is complete:

create a focused commit.

Examples:

Teams: refine physical card materials

Teams: improve THE TEAM entrance choreography

Teams: integrate CORE domain

Teams: refine domain entry transition

Do not make one enormous commit containing unrelated changes.

Do not push or merge into master unless explicitly instructed.

---

# 55. FINAL REPORT

When reporting back, state plainly:

1. What changed.
2. Which files changed.
3. What was verified.
4. What screenshots / QA were checked.
5. Performance observations.
6. What remains open.
7. Any integration concerns for master.

Do not claim something was tested if it was not tested.

Do not claim visual quality based solely on compilation.

---

# 56. CURRENT ASSIGNMENT

You are the Teams implementation owner.

Do NOT ask what to work on next.

First audit the current Teams implementation.

Then continue implementing the current Teams requirements.

Your primary mission is:

Build a premium, cinematic, physically convincing Teams world
that feels like a spatial installation rather than a UI carousel.

The target journey is:

THE TEAM
↓
camera approaches
↓
typography becomes enormous
↓
camera passes through / between typography
↓
typography moves behind
↓
spatial Teams environment
↓
physical spine
↓
CORE + six domains
↓
continuous scroll-driven spatial navigation
↓
physical card selection
↓
camera enters selected card
↓
domain environment
↓
continuous reverse journey

The experience must feel:

cinematic
spatial
tactile
minimal
premium
original
physically grounded
responsive

while remaining:

readable
accessible
performant
reversible
maintainable

---

# 57. NON-NEGOTIABLE FINAL RULE

Do not optimize for the amount of code changed.

Optimize for the quality of the resulting experience.

Do not rebuild working architecture for aesthetic reasons.

Do not add effects simply because they are technically possible.

Do not sacrifice performance for decoration.

Do not sacrifice readability for 3D effects.

Do not sacrifice accessibility for visual spectacle.

Do not interfere with the other Claude session's Intro work.

Inspect.
Understand.
Implement.
Verify.
Refine.
---

# 58. STATUS AFTER THE SECOND TEAMS PASS (September 2026)

Details of what changed, what was verified and what remains open are in docs/TEAMS_WORLD.md §7. In brief:

- THE TEAM: letterforms traced from the site's Archivo Expanded Bold (src/teams/world/letters.ts). The camera follows a keyed, scroll-driven path through the passage between the words (the slot between the lines in portrait) and lands on card 01. The tunnel hands straight over to scroll; there is no timed arrival glide.
- Composition: a spine about twice as thick; larger, thicker cards on a wider ring; the ambient dust moved into the air round the column (no starfield).
- Cards: frosted physical transmission on every tier, under a clearcoat, with the lettering printed inside the glass material.
- Motion: a critically damped orbit follower on the Lenis target, plus separate velocity channels for the cards, the spine (torsion) and the dust. Measured settle times are roughly half the old ones, with no rubber-banding.
- Card entry: commit → travel → surface → crossing → settle, one path keyed on the focus scalar. The chosen card's frost clears at the threshold into the domain's room (src/teams/world/DomainInterior.tsx). Return runs the same path back to the exact orbit position.
- QA: scripts/qa/teams.mjs now skips the intro film and adds the `trace` and `pose` steps.
- Not yet done: measurement on a real mid-range phone; removal of dead code in post/PostProcessing.tsx and cardFace.ts; reconciling master's uncommitted edits to the same Teams files.
