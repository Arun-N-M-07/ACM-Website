# Design Strategies by Aesthetic

## Neo-Brutalist

**When:** Dev tools, SaaS, technical startups, agencies that want to look serious and bold

**Core moves:**
- Border: `1px solid #000` or `2px solid #000` on everything
- Border-radius: 0 everywhere
- Typography: oversized, left-aligned, bleeds off screen
- Colors: black + white + one accent (never more than 3)
- Hover states: instant color fill, no transition or very fast (100ms linear)
- Buttons: solid fill, square, high contrast

**Font pairings:**
- DIN + mono (technical authority)
- Neue Haas Grotesk + no secondary (confident)
- Clash Display + Satoshi (startup energy)

**Layout pattern:**
```
[oversized headline bleeding off right edge]
[single line subhead, much smaller]
[raw CTA: text only with underline or block]
         [3D model or hero visual, right-heavy]
```

---

## Typographic / Editorial

**When:** Content businesses, media, high-end agencies, creative studios

**Core moves:**
- Type IS the design — no illustrations needed
- Mix serif (display) + grotesque (body) aggressively
- Extreme weight contrast: 900 headline, 300 body
- Tracking: very tight on display, loose on labels
- Margins: generous, white space is a feature

**Font pairings:**
- Canela + Neue Haas Grotesk
- Freight Display + Inter (editorial but accessible)
- Editorial New + ABC Diatype

**Layout pattern:**
```
[full-width serif headline, 3-4 lines]
[one line of small grotesque below]
[large image, full bleed or asymmetrically cropped]
[text + image alternating, no cards]
```

---

## Dark / Technical

**When:** Dev tools, APIs, infrastructure, anything that needs to feel precise and capable

**Core moves:**
- Background: #111 or #141414 (not pure black)
- Monospace for labels, stats, technical details
- Single accent color used sparingly (Vercel uses white; Linear uses purple; Raycast uses orange)
- Grid lines as decoration
- Data/metrics as visual elements
- Motion: no bounce, mechanical easing (CustomEase or `power1.inOut`)

**Inspired by:** Vercel, Linear, Railway, Warp, animejs.com

**Font pairings:**
- Geist Mono + Geist Sans (Vercel's system)
- JetBrains Mono + Inter (readable dev default)
- DIN + Mono (technical authority)

---

## Motion-First

**When:** Animation libraries, creative tools, game-adjacent products, anything where motion IS the product

**Core moves:**
- Every section demonstrates the product's capability
- Scroll-driven timeline for everything (animejs.com approach)
- Background color morph between sections
- 3D model is central — not decorative
- Code snippets animate their own properties in real-time

**Implementation:**
- GSAP ScrollTrigger scrubbing a master timeline
- Lenis for smooth scroll feeding into ScrollTrigger
- One canvas per demo section
- Model loaded once, reused across sections

---

## Organic / Expressive

**When:** Creative agencies, personal portfolios, lifestyle brands, anything that should feel human

**Core moves:**
- Slight misalignment is intentional — things are 3° off axis
- Color: unexpected combinations, muted + one saturated pop
- Type: variable fonts that morph, or display fonts with personality
- Motion: spring-based, physics feel — Framer Motion spring config
- Images: candidly shot or treated with grain/duotone

**Font pairings:**
- Syne + Syne Mono (cohesive, expressive)
- Migra + Neue Montreal (editorial + clean)
- Any variable font that morphs on interaction

---

## Luxury / Minimal

**When:** Fashion, jewelry, architecture, premium consumer products

**Core moves:**
- Extreme whitespace — content floats
- Palette: cream (#f5f0e8), black, one material accent (gold, stone)
- Photography does the heavy lifting
- No hover effects on most elements
- Motion: slow (1.2s+), no bounce, ease-out only
- Type: editorial serif (Cormorant, Canela, Freight) + small grotesque

**Rule:** If in doubt, remove an element. Then remove another.
