# Updating content

Everything the chapter changes year to year lives in `src/content/`. Nothing in the 3D world is hard-coded to a person or an event — rooms, signage, the Teams world's cards, the archive and the sitemap are all generated from these files.

| File | What it holds |
|---|---|
| `chapter.ts` | about, mission, membership, contact people, email, address, socials, alumni stats |
| `events.ts` | this year's lineup (2026) — **array order = corridor order** |
| `prodigy.ts` | Prodigy sub-events (shown on the puzzle wall) |
| `teams.ts` | **CORE and the six domains, with their members** — order = order around the spine in the Teams world |
| `team.ts` | the founder and faculty (shown in the archive) |
| `alumni.ts` | past office bearers by year |
| `gallery.ts` | gallery photographs + categories |
| `faq.ts` | FAQ |
| `newsletter.ts` | Stack'D / ClickByte issues |
| `media.ts` | photo manifest (paths mirror the old site's `assets/img/`) |

Source of the current content: https://auceg.acm.org (home, events.html incl. the "Read More" descriptions, team.html, alumni.html, gallery.html, newsletter_index.html, prodigy.html, contact.html), inspected September 2026.

## CORE and the six domains (`teams.ts`)

Each entry is one card in the Teams world:

```ts
{ slug: 'web-and-app-development', number: 1, name: 'WEB AND APP DEVELOPMENT', members: ['Anieshwar Saravanan', 'Prithvi'], tone: '#7f9cc4' }
```

- `name` and `members` are shown exactly as written (card face, the open domain, the index, the archive). No roll numbers, photographs or bios are shown.
- `tone` tints the card's glass and, faintly, the open domain's member cards — a design choice, not content.
- CORE (the first entry) also carries `officers` (role, name, roll number): role and name are shown on its member cards and in the text version; the roll number is kept in the data only.
- The world is laid out for **seven** cards on authored stations (`ANGLES` / `HEIGHTS` / `RADII` in `src/teams/layout.ts`, one entry per card). Adding or removing a domain means adding or removing a station there, then re-checking the composition.
- An open domain shows its index, name and head count, then its people as a hand of cards (`src/teams/ui/MemberHand.tsx`): CORE's role over name, other members as MEMBER over name. The cards are real DOM text, so they are also the accessible copy. When the chapter has more copy (a role, a line of description), add fields here and render them on the cards — don't invent text in the meantime.

## Next year's committee

1. Move this year's office bearers into `alumni.ts` (newest year first).
2. Update the members in `teams.ts` (and the domains, if they change).
3. Update `chapter.ts → contact.phones` if the contact people change.

## Adding an event

Add to `EVENTS` in `events.ts`, where it belongs in the lineup (the corridor visits rooms in array order, alternating sides; flagships are larger rooms and the ceiling rises over them):

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
  flagship: false,              // true → a larger, taller room; the corridor's ceiling rises over it
}
```

The corridor, scroll length, room numbering, index menu, archive and sitemap update automatically. When a programme is no longer run, remove its entry (and, if nothing else uses it, its installation). To create a new installation, add a wall drawer to `scenes/events/exhibits/walls.ts`, a centrepiece to `exhibits/pieces.tsx`, register both in `exhibits/index.ts`, and add the key to `RoomArtifact`.

## Items to verify with the chapter

- **CORE and the six domains, and their members,** are exactly as supplied by the chapter; the previous directors list (from auceg.acm.org) has been retired from the site and the archive.
- **Faculty links** on the current site point to the same two URLs for both faculty heads, so they were not reused.
- **Prodigy registration forms** are the Google Forms linked from prodigy.html — confirm they are for the current edition.
- **Newsletter links**: the archive maps "November 2025" to `clickbyte/december/…` and "December 2025" to `clickbyte/january/…`, preserved as published.
