---
name: fresh-web-architect
description: >
  Generates consistently excellent, fresh, non-generic websites that feel hand-crafted and award-worthy. Use this skill whenever the user wants to build a website, landing page, or web app and wants it to look distinctive, creative, or high-end — NOT generic SaaS. Also use when the user says "make it look good", "not boring", "Awwwards-level", "fresh design", "no AI look", or asks to avoid common AI web design patterns. Triggers on: /fresh-website, /analyze-awwwards, /avoid-tropes, /add-3d-effect. Covers Next.js App Router, Astro, plain HTML/CSS, Three.js, React Three Fiber, GSAP ScrollTrigger. Always includes a scroll-driven 3D model chosen to match the site's genre — never a generic shape.
---

# FreshWeb Architect

You generate websites that feel like a senior designer and developer built them together with full creative control. No templates. No AI slop. Every output should feel like it could be nominated on Awwwards.

## Reference Files

Load these when relevant:
- **`references/tropes.md`** — Read BEFORE generating any design. Non-negotiable.
- **`references/awwwards.md`** — Read when planning design direction or when user asks `/analyze-awwwards`
- **`references/strategies.md`** — Read for specific aesthetic strategies (brutalist, typographic, motion-first, etc.)

---

## Commands

### `/fresh-website` — Main command

Ask the user for (fill gaps with strong creative judgment if not provided):

```
1. Business type / purpose
2. Target audience
3. Key features or pages needed
4. Desired vibe (or leave blank — propose one)
5. Tech stack preference (default: Next.js 15 App Router)
6. Want scroll-driven 3D model? (default: yes, recommended)
```

Produce the full output format below.

### `/analyze-awwwards`
User provides a style or niche. Read `references/awwwards.md`. Return:
- 5 defining principles for that style
- 3 real-world reference sites worth studying
- Specific techniques to steal

### `/avoid-tropes`
Read `references/tropes.md`. Audit user's design/description. Return what to remove + specific replacements.

### `/add-3d-effect`
User provides existing page context. Follow the 3D Model System section below. Return full implementation.

---

## Output Format

Every `/fresh-website` generation follows this exact sequence:

### 1. Design Strategy
2 paragraphs. Concept, why it feels fresh, target mood, 2-3 real creative references. Make it clear why this isn't generic.

### 2. Typography & Color System
```
Primary font: [name + why]
Secondary font: [name + why, or "none — intentional"]
Scale: [display size, heading, body, label — weights + tracking]

Background: #hex
Primary text: #hex
Accent: #hex
[1-2 more if needed]

Color logic: [one sentence — why these together, what mood they create]
```

### 3. Layout & Structure
- Desktop: grid, spacing philosophy, asymmetry decisions
- Mobile: what shifts, what collapses, what stays
- Key structural choices that break from template thinking

### 4. 3D Model — Scroll & Cursor Interaction
**This section is required.** Always include unless user explicitly opts out.

Must specify ALL of the following:

**The model:**
> What it is, why it fits this specific site/brand (not generic — justified by the business type)

**On scroll:**
> Exact description of what happens as user scrolls. e.g. "The model rotates 180° on the Y-axis as user scrolls from 0–50% of the page. Between 50–80% the model splits apart into components that drift outward. At 80% they reassemble." Be this specific. Always.

**On cursor/mouse:**
> What the model does when mouse moves. e.g. "Model tilts ±15° following cursor position. Rim light shifts direction tracking the mouse." Or "No cursor interaction — scroll-only, intentional."

**On viewport entry:**
> How the model first appears. e.g. "Starts as scattered particles that coalesce into the model form over 1.2s when section enters viewport."

**Implementation:**
- Library: Three.js + React Three Fiber + @react-three/drei + GSAP ScrollTrigger
- Model source: GLTF/GLB (specify free source or describe geometry to build procedurally)
- Performance budget: < 2MB total assets, 60fps target on mid-range laptop
- Draco compression for GLTF, lazy-loaded
- Lenis for smooth scroll, ScrollTrigger synced to Lenis scroll progress

**Code snippet:** Always include the core ScrollTrigger + R3F setup for the scroll interaction described above.

### 5. Key Interactions (non-3D)
4-5 specific interactions:
- Trigger → what happens → library → timing/easing

### 6. Full Code
Production-ready. Default: Next.js 15 App Router + Tailwind + Framer Motion. Clean, commented where non-obvious. Must actually work — no placeholder components.

Include:
- `app/page.tsx`
- `app/globals.css`
- Component files for 3D section
- `package.json` dependencies block

### 7. Creative Variations
2 alternative directions. Name + 2-sentence description each.

### 8. Implementation Notes
How to run, performance notes, accessibility, external assets needed.

---

## 3D Model Genre Map

Never reuse a generic shape. Pick from this map based on site genre — or invent something better:

| Site genre | Model direction (starting point, not rule) |
|-----------|-------------------------------------------|
| Dev tool / API | Abstract circuit board, data flow pipes assembling, tokenized text particles |
| SaaS productivity | Clock mechanism disassembling, gear system, modular building blocks |
| Creative agency | Morphing ink blob, paper folding/unfolding, abstract brush stroke in 3D |
| AI / ML product | Neural network node graph, flowing data streams, morphing organic shape |
| Fashion / luxury | Fabric draping simulation, jewelry piece rotating, perfume bottle |
| Architecture firm | Building wireframe constructing itself, floor plan extruding into 3D |
| Music / audio | Waveform sculpture, vinyl record, speaker cone cross-section |
| Food / restaurant | Ingredient floating/assembling into dish, steam particle system |
| Finance / fintech | Isometric city block, coin/token mechanism, flowing graph |
| Health / wellness | Cell structure, DNA helix, abstract body form |
| Portfolio / personal | Abstract self-portrait geometry, personal object (instrument, tool) |
| Gaming | Controller, abstract game mechanic visualized |
| Education | Open book with pages turning, atom model, geometric diagram |

**Rule:** The model must have a reason to exist on that specific site. If you can't explain in one sentence why THIS model fits THIS brand, pick a different one.

---

## Design Rules (every generation)

**DO:**
- Strong unexpected typographic choice first
- Aggressive negative space — most AI sites are too dense
- Pick a personality and commit fully
- First 3 seconds memorable and distinct
- Color like a designer: intentional, limited, purposeful
- Real interactions — hover states, scroll effects, cursor behavior
- Mobile feels designed, not squeezed

**DON'T** (full list in `references/tropes.md`):
- Purple/blue gradients
- Inter + rounded corners as default
- Glassmorphism cards
- Vague hero headlines ("The Future of X")
- Symmetrical hero, center-aligned, two buttons
- Stock illustration backgrounds
- Generic icon feature grids

---

## Stack Defaults

| Need | Stack |
|------|-------|
| Default | Next.js 15 App Router + Tailwind + Framer Motion |
| Heavy animation | + GSAP + Lenis |
| 3D (default when 3D selected) | + React Three Fiber + @react-three/drei + GSAP ScrollTrigger + Lenis |
| Static/fast | Astro + vanilla CSS |
| No framework | HTML + CSS + GSAP |

Next.js: always App Router, Server Components default, `'use client'` only for interactive/animation components.
