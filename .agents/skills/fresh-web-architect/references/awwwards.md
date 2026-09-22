# Awwwards Design Principles

## What separates SOTD-level work from good work

### 1. Strong Point of View from Frame 1
The site communicates a personality within 300ms of load. Color, type, spacing — all say the same thing. No mixed signals. You know immediately if this is raw/industrial or refined/editorial or playful/expressive.

### 2. Typography as Architecture
Type is not decoration — it's structural. Headlines bleed off screen. Letters overlap images. Weight contrast is extreme (900 next to 100). Tracking is intentional. The font choice is unexpected and fits like it was custom-made.

### 3. Earned Motion
Every animation exists for a reason. Scroll-driven reveals show hierarchy. Hover states add information or delight. Nothing moves just to move. The motion has a logic you feel even if you can't articulate it.

### 4. Spatial Depth
Layers. Parallax with restraint. Elements at different depths give the page weight. The 3D model or canvas element earns its place — it doesn't sit on the page, it IS the page.

### 5. Restraint + One Bold Bet
The best SOTD sites make one wild creative bet (a 3D hero, a completely unexpected color, extreme typography) and keep everything else restrained. Not maximalism — one statement, everything else in service of it.

---

## Style-Specific Principles

### Neo-Brutalist (best for: SaaS, dev tools, agencies, startups)
- Hard black borders, no border-radius
- High contrast: pure black + white + one accent
- Type as the main visual: oversized, bleeds off screen
- Hover: color fills, inverts — fast, no easing
- Grid: rigid and visible, or deliberately broken
- References: Linear's old site, Craft CMS, Basement Studio

### Editorial / Magazine
- White space as a design element
- Serif + grotesque pairing
- Slow, deliberate scroll — content reveals have weight
- Images: full-bleed or brutally cropped
- No cards — type and image directly on page
- References: Stripe's blog, NY Times Cooking, Offscreen

### Dark / Technical / Precision
- Near-black background (#111–#1a1a1a), not pure black
- Monospace + geometric sans
- Grid lines, data visualization, technical diagrams as decoration
- Accent: single saturated color (red, orange, green) used sparingly
- Interactions: precise, no bounce, mechanical timing
- References: Vercel, Linear, Raycast, animejs.com

### Organic / Expressive
- Custom illustration or 3D that looks handmade
- Irregular grid, things slightly off-axis
- Color: earthy, unexpected, muted + one pop
- Type: variable, morphs, or has personality
- Motion: physics-based, springy, organic
- References: Mailchimp (old), Notion (early), Figma's old site

### Luxury / High-End
- Extreme negative space
- Muted palette: cream, stone, black, gold
- Editorial serif as primary font
- No hover effects — everything is calm
- Photography: fashion editorial quality
- Motion: slow, deliberate — nothing bounces

---

## Techniques Worth Stealing

### Horizontal scroll section
One section that scrolls horizontally while page scrolls vertically. Controlled with GSAP ScrollTrigger pinning. Creates depth and breaks the monotony of vertical scrolling.

### Text clip-path reveal
Text masked behind a shape that reveals on scroll or load. CSS `clip-path` animated with GSAP. Feels expensive.

### Scroll-scrubbed timeline
Single GSAP timeline scrubbed by scroll position. Everything — model rotation, background color, text position — mapped to one scroll progress value. What animejs.com does.

### Magnetic hover
Elements subtly attracted to cursor position. GSAP + mousemove. Works on buttons, headings, images. Feels alive.

### SVG path drawing
Connector lines draw in as you scroll. `stroke-dashoffset` animated with GSAP ScrollTrigger. Works for technical/diagram aesthetics.

### Variable font on scroll
Font weight or width changes as user scrolls. CSS `font-variation-settings` animated. Typographic without being gimmicky.

### Background color morph
Page background color transitions between sections on scroll. GSAP ScrollTrigger + `backgroundColor` tween. animejs.com does dark → beige → dark.
