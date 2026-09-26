# Assets

The experience runs with **zero downloaded world assets**: geometry, textures and signage are generated at runtime (the soundtrack is the one optional file). Real photographs and professional models plug in through the manifests below and replace their stand-ins automatically — no code changes. After adding files, restart `npm run dev` (or rebuild) so `scripts/scan-media.mjs` records them.

## 1. Photographs (install from the current site)

Every photo slot mirrors a path on the current site's `assets/img/` folder. **Copy that folder into `public/media/`** (e.g. `assets/img/events/prodigy.jpg` → `public/media/events/prodigy.jpg`). The site blocks automated downloads, so this has to be done from the chapter's own copy of the site files.

| Used for | Files (under `public/media/`) |
|---|---|
| Event posters, dossiers, event pages | `events/prodigy.jpg`, `events/codher.jpeg`, `events/code.jpeg`, `events/codex.jpeg`, `events/headfirst.png`, `events/offcamp.png`, `events/schrodinger.png`, `events/ml.jpeg`, `events/masterclass.png`, `events/bell_labs.png` |
| Archive gallery | `venue-gallery/1.jpg` … `8.jpg`, `9.jpeg`, `10.jpeg`, `11.png`, `12.png`; `gallery/8.jpg`, `gallery/10.jpg` … `16.jpg`; `about/about1.jpg` |
| Archive faculty portraits | `team/Faculty/RP_Mam.jpg`, `BAMA_MAM.png`, `ANNIE_MAM.png` |
| Archive alumni | `alumni/2024-2025/*`, `alumni/2023_2024/directors/*`, `alumni/*.jpg` (see `content/alumni.ts`) |
| Brand | `public/brand/acm-ceg-logo-white.png` (from `assets/img/LOGO_white.png`; resize to ≤ 1200 px wide) |

Until a file exists, rooms show a typographic poster and the archive shows a captioned slot.

## 2. The soundtrack

The site plays **one track** in music mode — *Pink + White* by Frank Ocean (`src/config/music.ts`) — and nothing else. The audio file is **not** in this repository and must not be committed.

1. Put your copy at `public/audio/pink-white.mp3` (`.m4a`/`.ogg` work too — update `MUSIC.src`).
2. Restart `npm run dev` (or rebuild) so the media scan picks it up. Until then the music buttons are disabled and the loader explains why.

**Licensing:** playing a commercial recording on a public website needs permission from the rights holders (or a licence). Use it locally for the chapter's review, and clear it — or swap `MUSIC` to a track the chapter has rights to — before deploying.

## 3. 3D model slots (`src/config/assets.ts`)

GLB/GLTF, metres, +y up, facing +z, origin as noted. Draco or Meshopt compression and KTX2 textures are recommended (`gltf-transform optimize in.glb out.glb --compress draco --texture-compress ktx2`).

| Slot | Path | Replaces | Origin & budget |
|---|---|---|---|
| `cegBuilding` | `/models/campus/ceg-building.glb` | modelled red building | ground level, clock tower at world (0.2, 0, 0.6), front facade toward +z (OSM footprint rotated 7.9°; see `scenes/campus/cegModel.ts`); ≤ 150k tris, ≤ 4 materials, 2k textures |
| `cegCampus` | `/models/campus/ceg-campus.glb` | OpenStreetMap campus + trees | world coordinates as produced by `scripts/build-campus.mjs`; ≤ 300k tris, instanced trees; keep the garden, pool and the light-well (`CAMPUS.well`, z = 46) clear |
| `facilityHall` | `/models/underground/facility-hall.glb` | hall shell | world coordinates; hall floor at y = −60, x ∈ [−14, 14], z from `UNDERGROUND.hall` (north 20 → south 55), ceiling opening centred on the light-well |
| `corridor` | `/models/underground/corridor.glb` | corridor shell (not rooms) | world coordinates; must leave the room openings from `buildCorridorLayout()` |
Content-driven parts (event rooms, signage, the portal, the Teams world's cards) stay procedural so they keep updating from `src/content`. The Teams world's spine is procedural too (`src/teams/world/spineGeometry.ts`); it has no model slot yet.

## Still requiring professional work

1. **CEG red building** — survey-accurate model (photogrammetry or drawings). The current one follows the real footprint and photographs, but its details are modelled by eye.
2. **CEG campus** — the campus comes from OpenStreetMap (footprints, levels, roads, green areas); building detail and exact heights would need a survey. Re-run `npm run campus:build` to pick up map edits.
3. **Photographs** — install from the site's `assets/img` (section 1). The Teams world deliberately shows no photographs yet.
4. Optional: bespoke hall / corridor shells if the chapter wants a signature interior.
