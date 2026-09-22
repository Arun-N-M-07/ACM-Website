# awwwards-motion

A Claude Code skill for building Awwwards-quality web experiences. Spring physics, GLSL shaders, React Three Fiber, post-processing, particle systems, Framer Motion, and interactive 3D — everything you need to ship sites that win awards.

## Install

```bash
npx skills add adamperlis/awwwards-motion
```

## What this skill teaches your agent

- **Physics-based motion** — Spring animations with overshoot and settle, never duration-based easing
- **Glass surfaces** — Multi-layered glassmorphism with backdrop blur, gradient borders, and ambient occlusion shadows
- **GLSL shaders** — Vertex and fragment shaders in React Three Fiber, uniforms, varyings, noise functions
- **Particle systems** — BufferGeometry for thousands, FBOs for 100k+, GPU-side simulation
- **Render targets** — Transparent materials, portals, scene transitions, post-processing pipelines
- **Refraction & light** — Chromatic dispersion, Blinn-Phong, Fresnel, backside rendering
- **Post-processing** — Halftone, pixelation, ASCII, CMYK, threshold matrices, trompe l'oeil effects
- **Framer Motion** — Layout animations, shared layout, AnimatePresence, Reorder
- **Scroll-driven effects** — GSAP ScrollTrigger, parallax, shader-based reveals
- **Page transitions** — WebGL dissolves, fluid simulations, SVG mask reveals

## Inspired by

The craft behind Awwwards Site of the Day winners, built from deep study of:

- [Maxime Heckel's blog](https://blog.maximeheckel.com/) — shader craft, R3F patterns, post-processing as a creative medium
- [Codrops](https://tympanus.net/codrops/) — scroll-driven galleries, page transitions, creative WebGL experiments
- [The Book of Shaders](https://thebookofshaders.com/) — foundational GLSL knowledge
- [Shadertoy](https://www.shadertoy.com/) — technique inspiration

## Tech stack

React Three Fiber, Three.js, GLSL, Framer Motion, GSAP + ScrollTrigger, @react-three/drei, @react-three/postprocessing, WebGPU/TSL
