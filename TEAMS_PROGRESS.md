# Teams — progress so far

Branch: `dev` (worktree `/Users/arunnm/Projects/acm-ceg-world-dev`). The master worktree (Cinematic Intro) has not been touched.

State of the work:
- **Committed on `dev`:** one commit, `991e359`.
- **Uncommitted:** everything else below, left uncommitted as instructed.
- **Checks:** the typecheck and the production build (`next build`) both pass.

More detail on the second pass is in `docs/TEAMS_WORLD.md` §7.

---

## 1. Audit (first session)

- **Read:** the handoff, the docs, all of `src/teams/`, `src/content/teams.ts`, and the shared camera, scroll, streaming, post-processing and lighting code.
- **Browser QA:** ran the site in headless Chrome and screenshotted the entrance, the orbit, card selection, the open domain and the close.
- **Motion baseline:** measured with the new QA trace. One wheel notch kept moving for about 1.5 s, a burst of scrolling took about 1.9 s to settle, and a reversal about 1.8 s.
- **Reference study:** studied activetheory.net/work in the browser (idle, scroll, cursor, hover, selection, close). The main lessons were a much more dominant spine, larger cards, and an open state that reads as a screen inside a room.
- **Findings raised:**
  - The master session has uncommitted edits in the same Teams files.
  - The Batman MP3 was committed in `d6c5a5d` and pushed to both branches.
  - The Teams QA harness was broken by the intro film.

---

## 2. Committed — `991e359`

- **Arrival label:** the arrival rests just inside the Teams segment, so the top bar reads "08 The Teams", not "07 The Portal".
- **Reduced motion:** its stills come from the content (the entrance plus all 7 domains), so Marketing is reachable.
- **QA harness:** it skips the intro film before running Teams steps.

---

## 3. Second pass — uncommitted

### THE TEAM entrance
- **Letters:** traced from the site's own font (Archivo, expanded, bold), extruded 1.3 m with bevels, in a warm bone satin material with a clearcoat. New file: `src/teams/world/letters.ts`.
- **Camera path, driven by scroll:**
  - it starts at the tunnel mouth with the whole title in view;
  - it approaches until the letters are enormous, with their faces sweeping past the lens;
  - it passes between the words;
  - it lands on CORE at the same speed the orbit continues with.
- **Portrait:** THE sits above TEAM, and the camera flies through the gap between the lines.
- **Arrival:** the timed 1.8 s glide after the tunnel is gone. Scrolling takes over immediately, and the world's lights come up without locking scroll.
- **Visibility:** the letters stop drawing once the orbit is under way. Before, the "M" appeared behind later cards.

### Composition
- **Spine:** about twice as thick, so it reads as the structure of the world.
- **Cards:** larger and thicker (3.4 × 2.32 × 0.16 m) on a wider ring (4.4 m). Portrait was recomposed separately.
- **Dust:** the uniform "starfield" of dots is gone. Dust now sits in the air around the spine and along the entrance path, and fades with distance.

### Cards (material and typography)
- **Glass:** frosted, so the spine behind reads as a soft glow; a glossy clearcoat on top; wider bevelled edges; slightly different frost per card.
- **Text:** printed into the glass material itself instead of on a separate plane floating above it.
- **Phones:** now get the same frosted look. Before, the low tier drew plain see-through glass.
- **Fonts:** card text redraws once the web fonts have loaded.

### Motion (scroll, layers, cursor)
- **Scroll response:** a new, faster follower with no bounce.

  | | Before | Now |
  |---|---|---|
  | One wheel notch settles | 1.46 s | 0.82 s |
  | A burst settles | 1.92 s | 1.07 s |
  | A reversal settles | 1.84 s | 1.03 s |
  | Motion turns round after you reverse | about 0.48 s (simulated) | 0.17 s |

  Nothing moves back after you stop.
- **Layers:** the camera responds first, then the cards (the near ones trail slightly), then the spine (a gentle twist around its own axis), then the dust. Each settles at its own speed.
- **Cursor:** subtle and non-sticky. The camera follows the mouse quickly without trailing; a card under the cursor leans slightly with a soft sheen and eases back when you leave; the pointer light is faint, with no bright dot.

### Opening a domain (card → room)
- **Click:** the card comes forward at once.
- **Commit:** the camera draws back a breath, then commits and travels, arcing around the spine if needed. The other cards recede in order of distance, and the spine fades and turns slightly.
- **Threshold:** close to the card, its frost clears and its text fades, so the card becomes a window, then a doorway.
- **Room:** the camera passes through into the domain's room, a space in that domain's colour with walls converging on a screen that shows the name and members (CORE: roles, names and roll numbers). File: `src/teams/world/DomainInterior.tsx`.
- **Return:** closing runs the same path backwards, back to exactly where you were scrolled.
- **Content fix:** the invented label "DOMAIN DIRECTORS" is now "MEMBERS". Long titles never clip.

### Leaving back through the portal
- **Accidental exits:** one hard scroll back to THE TEAM now stops there.
- **Deliberate exit:** you only exit with a deliberate scroll up after resting at the entrance for a moment.

### QA tools added (`scripts/qa/teams.mjs`)
- `trace:<label>:<ms>:<n>` records motion over time (settle time, reversal).
- `pose:<card>:<focus>` holds a card-opening at any point so it can be inspected frame by frame.

### Documentation updated
- `docs/TEAMS_WORLD.md` §7
- `docs/CONTENT.md`
- `docs/ARCHITECTURE.md`
- `README.md`
- `CODEX_HANDOFF.md` §58

---

## 4. What was tested

- **Full journey:** portal hold → tunnel → into the world → scroll through THE TEAM → orbit → open a card → close → back to the same position → scroll to the entrance → pull out through the portal.
- **Domains:**
  - opening path checked frame by frame for CORE, Web and App, Competitive Programming, Events, Contents and Design, and Marketing;
  - all 7 in the correct order;
  - Prithvi and Varshhaa kept in both of their domains.
- **Portrait (390×844):** entrance, orbit, cards, opening, and the domain rooms.
- **Reduced motion and keyboard:**
  - stills for each domain;
  - opening from the nav buttons, with focus moving to the heading;
  - arrow keys to the next domain;
  - Escape, with focus returned to the right button.
- **Performance:** smooth throughout (16.7 ms average, no frames over 33 ms) at DPR 1 and 2. This was measured only in headless Chrome on Apple silicon, capped at 60 fps.
- **Memory:** did not grow across repeated open/close cycles.

---

## 5. Still open

- **Real hardware:** not tested on a real mid-range phone, and touch was only simulated.
- **Domain room text:** it's drawn in 3D, so it can't be zoomed or selected. The accessible version is a hidden screen-reader article plus the text version.
- **Dead code:** a little remains in `post/PostProcessing.tsx` and `world/cardFace.ts`.
- **Merge:** master has uncommitted edits to several of the same Teams files, so merging `dev` and master will need care. Copying master's fixes over was blocked by auto mode, so they weren't applied here.
- **Console 404:** every run logs a 404 for `/audio/the-batman.mp3`. The committed asset list names it, but the file isn't in this worktree. This isn't a Teams issue.
- **MP3 in git history:** it is still in the git history of both branches. Nothing has been changed about this.
- **Ponytail:** it isn't installed; you told me to continue without it.

---

## 6. Housekeeping notes

- **Not tracked by git:** `node_modules` (a copy-on-write clone of master's) and `.next` were added to this worktree; both are gitignored.
- **Don't commit:** the untracked `.playwright-mcp/` folder, or the MP3.
- **Dev server:** stopped. To run it again, use `./node_modules/.bin/next dev --port 3200`. Avoid `npm run dev`, which rewrites the tracked `available-assets.json`. Port 3100 is the master session's server.

---

## 7. Refinement pass: touch → enter → people (uncommitted)

- **Cards feel physical before the click:**
  - a spring per card (tilt and depth), with a fast response and a slower recovery;
  - the pointer presses the side it rests on, and sweeping the pointer drags the card slightly;
  - pressing (mouse or finger) pushes the card in, with a clearer spot in the frost under the touch;
  - the edges brighten near the pointer.
- **Click:**
  - the card comes forward at once;
  - the neighbours part, and far cards sink and dim in order of distance;
  - the spine's band at that level lifts, then the spine fades;
  - the light turns towards the card, and a puff of dust leaves it.
- **Camera:**
  - a new authored timing curve: acceleration, travel, a slower beat while the frosted surface fills the view, the crossing, then the settle;
  - the exit retraces it exactly;
  - no backward drift, and a centred card is entered almost immediately;
  - selecting mid-scroll glides the orbit to rest, and closing returns there exactly.
- **Domain room:**
  - the people are the content: a small domain label, then role (CORE) plus a large name, each at its own depth, arriving one by one as you cross in;
  - CORE is a slightly larger chamber with a frame;
  - **no roll numbers** anywhere in the Teams experience (the data model keeps them).
- **Dust:**
  - it's now a real force field: pointer strokes kick nearby dust, which carries on briefly and settles;
  - a new fine air layer sits between the eye and the cards;
  - the grain streaks locally along the pointer's motion.
- **Tested:**
  - all seven domains (correct people, no roll numbers, exact return, pointer still works);
  - select while scrolling, abort mid-entry, press-drag, and touch press/tap on portrait;
  - reduced motion;
  - 60 fps at DPR 1 and 2 (headless);
  - memory steady;
  - typecheck and build pass.
- **New file:** `src/teams/dust.ts`.
- **More QA tools:** `mdown` / `mup`, `tdown` / `tup` and `sweep` steps; `still()`, `dust()` and `dustGain()` debug hooks.

---

## 8. Card → domain entry and domain interior (desktop, uncommitted)

- **The entry is a dive through the card:**
  - the card answers the click at once (0.28 s commit), and the camera sets off without pulling back;
  - the camera squares up to the card, the card's type fills the view, and an aperture opens from its centre with the room behind it;
  - the camera passes through the aperture and settles inside the room;
  - no fades, no swaps, no modal.
  - Open takes about 1.33 s (was about 2.3 s). Escape takes about 1.1 s, back along the same path to the same place.
- **The room is a gallery, not a game level:**
  - plaster walls lit by a ceiling light slot that washes the back wall, with the rest falling into shade;
  - the domain's name set into the back wall in the cards' type;
  - one abstract centrepiece per domain;
  - the members on a frosted pane in the card's material, with serif names.
- **CORE** is a chamber: four officer steles along a nave, on an axis inlaid in the floor.
- **Arrival:** the room lights up as one, then the name, then the centrepiece settles, then the names ink in. Leaving reverses it.
- **Fixed along the way:**
  - panes cut off by the frame;
  - the centrepiece covering the Contents and Design title;
  - Events stages running under the page controls;
  - black silhouettes during arrival;
  - a hot glint on the pane edge;
  - the pointer light's spot on the card's index text.
- **Tested (desktop):**
  - all seven rooms (correct people, no roll numbers);
  - the entry frame by frame for a side card and a centred card;
  - a real hover, press, click and return;
  - reduced motion (cut in and out, next domain);
  - 60 fps with no long frames at DPR 1 and 2 (headless);
  - memory steady;
  - typecheck and build pass.
- **Not done:** phone rooms (the pane and the outer CORE steles are cut off at 390×844). Deferred as you asked.
- **Details:** `docs/TEAMS_WORLD.md` §9.
