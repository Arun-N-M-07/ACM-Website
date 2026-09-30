# Assets

The experience runs with **zero downloaded world assets**: geometry, textures and signage are generated at runtime (the soundtrack is the one optional file). Real photographs and professional models plug in through the manifests below and replace their stand-ins automatically — no code changes. After adding files, restart `npm run dev` (or rebuild) so `scripts/scan-media.mjs` records them.

## 1. Photographs (install from the current site)

Every photo slot mirrors a path on the current site's `assets/img/` folder. **Copy that folder into `public/media/`** (e.g. `assets/img/events/prodigy.jpg` → `public/media/events/prodigy.jpg`). The site blocks automated downloads, so this has to be done from the chapter's own copy of the site files.

| Used for | Files (under `public/media/`) |
|---|---|
| Event posters, dossiers, event pages | `events/prodigy.jpg`, `events/codher.jpeg`, `events/code.jpeg`, `events/codex.jpeg`, `events/headfirst.png` (Head Start), `events/masterclass.png` |
| Archive gallery | `venue-gallery/1.jpg` … `8.jpg`, `9.jpeg`, `10.jpeg`, `11.png`, `12.png`; `gallery/8.jpg`, `gallery/10.jpg` … `16.jpg`; `about/about1.jpg` |
| Archive faculty portraits | `team/Faculty/RP_Mam.jpg`, `BAMA_MAM.png`, `ANNIE_MAM.png` |
| Archive alumni | `alumni/2024-2025/*`, `alumni/2023_2024/directors/*`, `alumni/*.jpg` (see `content/alumni.ts`) |
| Brand | `public/brand/acm-ceg-logo-white.png` (from `assets/img/LOGO_white.png`; resize to ≤ 1200 px wide) |

Until a file exists, rooms show a typographic poster and the archive shows a captioned slot.

## 1a. Crew portraits (the member cards)

The member cards in THE CREW carry the chapter's own portraits, made from its photographs by `scripts/crew-portraits.mjs`:

```
node scripts/crew-portraits.mjs "acm photos"
```

- **Input:** a folder of photographs, **each named after its member** (`Prithvi.png`, `Manesh Ram.png`, …). The file name is the identity: it is matched to a member of `src/content/teams.ts` exactly (ignoring case, spaces and punctuation), by the start of the name (`SankaraKrishnan.png`, `Swayam.png`), or by a one-letter spelling variant of the first name that fits no one else (`Viswam.png` → Visvam Srinivasan). Anything unmatched, ambiguous, duplicated or missing stops the script with the list; nothing is guessed.
- **Output:** one WebP per member in `public/media/crew/` (named after the member, ~30–60 KB each), and the member → print table `src/content/generated/crew-portraits.json` (with each print's source file, how it was matched, and the face found in it).
- **Framing:** each face is found with macOS Vision (so the script runs on a Mac; the recorded faces are reused elsewhere while the photographs are unchanged) and brought to the same size and place on every card. A photograph is enlarged by at most 1.25× (the script stops beyond that): at this face size those whose faces are smallest in their frames are enlarged a little, by up to 1.19× (`janis.png`).
- **Treatment:** the tones are mapped from the card's shade to a warm paper white, the black ground is let go of (the card's coat shows instead, so there is no edge), and the print fades under the name, above the foot and at the sides, printed down a little below the chin.
- **Checking:** `node scripts/qa/crew-portraits.mjs [url] [out]` (`MOBILE=1 W=390 H=844` for a phone) verifies every member: the table against the file names, the face in each print against the face in every photograph, and every card in every domain on the site — then cycles the domains to check nothing accumulates, and writes a contact sheet of every drawn card.

The source folder (`acm photos/`) holds full-size photographs (~1.5 MB each); keep it out of the repository — only the generated prints and table are needed.

## 2. The soundtrack

The site plays **one track** in music mode — *The Batman* by Michael Giacchino (`src/config/music.ts`) — and nothing else. Entering with sound starts it about 1:10 into the recording (`SCORE_IN` in `src/intro/timeline.ts`), from inside the Enter click (the user gesture browsers require), and it plays on under the whole journey. The audio file is **not** in this repository and must not be committed.

1. Put your copy at `public/audio/the-batman.mp3` (`public/audio/` is git-ignored).
2. Restart `npm run dev` (or rebuild) so `scripts/scan-media.mjs` records it. Until then the opening plays in silence and the music controls stay hidden.

Because the file is git-ignored, a fresh clone or a deployment built from the repository has **no soundtrack** until the file is supplied there too.

**Licensing:** playing a commercial recording on a public website needs permission from the rights holders (or a licence). Use it locally for the chapter's review, and clear it — or swap `MUSIC` to a track the chapter has rights to — before deploying.

## 3. 3D model slots (`src/config/assets.ts`)

GLB/GLTF, metres, +y up, facing +z, origin as noted. Draco or Meshopt compression and KTX2 textures are recommended (`gltf-transform optimize in.glb out.glb --compress draco --texture-compress ktx2`).

| Slot | Path | Replaces | Origin & budget |
|---|---|---|---|
| `cegBuilding` | `/models/campus/ceg-building.glb` | modelled red building | ground level, clock tower at world (0.2, 0, 0.6), front facade toward +z (OSM footprint rotated 7.9°; see `scenes/campus/cegModel.ts`); ≤ 150k tris, ≤ 4 materials, 2k textures |
| `cegCampus` | `/models/campus/ceg-campus.glb` | OpenStreetMap campus + trees | world coordinates as produced by `scripts/build-campus.mjs`; ≤ 300k tris, instanced trees; keep the garden, pool and the light-well (`CAMPUS.well`, z = 46) clear |
| `corridor` | `/models/underground/corridor.glb` | corridor shell (not rooms) | world coordinates; must leave the room openings from `buildCorridorLayout()` |
Content-driven parts (event rooms, signage, the portal, the Teams world's cards) stay procedural so they keep updating from `src/content`. The Teams world's spine is procedural too (`src/teams/world/spineGeometry.ts`); it has no model slot yet.

## Still requiring professional work

1. **CEG red building** — survey-accurate model (photogrammetry or drawings). The current one follows the real footprint and photographs, but its details are modelled by eye.
2. **CEG campus** — the campus comes from OpenStreetMap (footprints, levels, roads, green areas); building detail and exact heights would need a survey. Re-run `npm run campus:build` to pick up map edits.
3. **Photographs** — install from the site's `assets/img` (section 1). The Crew's member cards carry the chapter's portraits (section 1a).
4. Optional: bespoke hall / corridor shells if the chapter wants a signature interior.
