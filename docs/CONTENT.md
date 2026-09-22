# Updating content

Everything the chapter changes year to year lives in `src/content/`. Nothing in the 3D world is hard-coded to a person or an event — rooms, bays, signage, walls in the core, the archive and the sitemap are all generated from these files.

| File | What it holds |
|---|---|
| `chapter.ts` | about, mission, membership, contact people, email, address, socials, alumni stats |
| `events.ts` | programmes/events — **array order = corridor order** |
| `prodigy.ts` | Prodigy sub-events (shown on the puzzle wall) |
| `domains.ts` | team domains, their signage, tagline, colour and station type — **order = bay order** |
| `team.ts` | faculty and directors, roles, domain, activity, appearance, optional GLB |
| `meetings.ts` | what happens when the visitor meets each domain: the lines people say (subtitles, timed through the meeting) and the copy on the set pieces — the CP whiteboard, the lecture title, the newspaper, the pitch deck, the banner, the checklist |
| `alumni.ts` | past office bearers by year |
| `gallery.ts` | gallery photographs + categories |
| `faq.ts` | FAQ |
| `newsletter.ts` | Stack'D / ClickByte issues |
| `media.ts` | photo manifest (paths mirror the old site's `assets/img/`) |

Source of the current content: https://auceg.acm.org (home, events.html incl. the "Read More" descriptions, team.html, alumni.html, gallery.html, newsletter_index.html, prodigy.html, contact.html), inspected September 2026.

## Next year's committee

1. Move this year's office bearers into `alumni.ts` (newest year first).
2. Replace `DIRECTORS` in `team.ts`. For each person set:
   - `domain` — one of the ids in `domains.ts`
   - `role` — e.g. `'Chairperson'`, `'Director, Web'`
   - `activity` — what they're doing when not being met (most people are restaged by their domain's set)
   - `appearance` — match their photo (see ASSETS.md); omit for the neutral placeholder
   - `photo` — the team-card image path under `/media/team/…`
3. Update the `who` ids in `meetings.ts` so each line is said by someone in that domain.
4. Update `chapter.ts → contact.phones` if the contact people change.

Placement is automatic: office bearers gather at the commons by the entrance (the first one does the welcome handshake); each domain's members take the roles of its set in order (`STATION_SPOTS` in `scenes/team/teamLayout.ts` — e.g. in the CP Wing the first member works the whiteboard and the next two watch the lecture). Members beyond a set's designed spots stand in front of the bay.

## Meeting lines

Each entry in `MEETINGS` (`meetings.ts`) is one domain's moment. A line has `who` (a member id), `text`, `at` (0–1: how far through the meeting it starts) and `dur` (how long it stays up). The timings line up with the set's choreography — e.g. in the VDM studio the flash fires at 0.37–0.45, so "Hold still…" sits just before it. Keep lines short and friendly; they are flavour, not quotes, and should never state facts that aren't on the chapter's site.

## Adding or changing a domain

Add an entry to `DOMAINS` with a `station` — which set its bay gets: `grind` (whiteboard + lecture), `terminal-wall` (video wall), `studio` (photo studio), `newsroom`, `stage`, `people-desk` (badge), `pitch` (deck), `outreach` (reach map + phone), `poster-wall`, `warehouse` (conveyor + checklist). Order in `DOMAINS` = order of the tour. There are ten perimeter bays; the office uses the commons. Add a `MEETINGS` entry for its lines.

## Adding an event

Append to `EVENTS` in `events.ts`:

```ts
{
  slug: 'new-event',            // URL: /events/new-event
  title: 'New Event',
  kind: 'Workshop',
  cadence: 'Semester Program',
  summary: 'One line.',
  description: 'Full description…',
  facts: [{ label: 'For', value: 'Second-year students' }],
  links: [{ label: 'Register', href: 'https://…' }],
  image: siteMedia('event.new', 'events/new.jpg', 'Alt text'),   // optional
  accent: '#7f9c86',
  artifact: 'blocks',           // which installation the room gets (see scenes/events/exhibits/index.ts)
  flagship: false,              // true → joins the flagship transept at the end
}
```

The corridor, scroll length, room numbering, departures board, index menu, archive, sitemap and the core's hologram update automatically. To create a new installation, add a wall drawer to `scenes/events/exhibits/walls.ts`, a centrepiece to `exhibits/pieces.tsx`, register both in `exhibits/index.ts`, and add the key to `RoomArtifact`.

## Items to verify with the chapter

- **Director titles** were read from the team-card image filenames (`chair`, `vc`, `secretary`, `treasurer`, `events`, `hr`, `cpwing`, `vdm`, `web`, `exmar`, `inmar`, `logi`, `sponsor`, `cont`); full names from alt text and LinkedIn profile URLs. The printed titles on the card images are authoritative.
- **"VDM"** is shown as "Design and media"; confirm the expansion.
- **Faculty links** on the current site point to the same two URLs for both faculty heads, so they were not reused.
- **Prodigy registration forms** are the Google Forms linked from prodigy.html — confirm they are for the current edition.
- **Newsletter links**: the archive maps "November 2025" to `clickbyte/december/…` and "December 2025" to `clickbyte/january/…`, preserved as published.
