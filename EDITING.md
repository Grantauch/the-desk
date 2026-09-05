# EDITING GUIDE — which file to touch

For curriculum organization, public/private boundaries, and the Three-Course Lecture Remix route, read `CURRICULUM-PUBLISHING.md` before adding files or Drive links.

## Edit public wording without code

Open **https://grant-desk.com/editor/**. The private control panel edits the homepage, shared header and footer, three course introductions, About page, Announcements page, News Today + Then, and Curiosity Desk. Press **publish site words** when the batch is ready.

The same editor posts announcements with a normal headline, date, class dropdown, and message box. No Markdown file or Git command is required. See `EDITOR-SETUP.md` for the one-time secure connection and recovery details.

## Post an announcement

Add a new file in `src/content/announcements/`, named like `2026-08-20-first-day.md`:

```markdown
---
title: "first day of school"
date: 2026-08-20
course: "us history"       # optional. "hidden history" and "beyond the scoreboard" also work. Omit for all classes
---

Write the announcement text here. Markdown works: **bold**, [links](https://example.com), lists.
```

It appears on the home page (latest 3) and the announcements page automatically.

## Update what unit a class is on

Open the class page (`src/pages/us-history.astro`, `hidden-history.astro`, or `beyond-the-scoreboard.astro`). Find the `units` array. Move `current: true` to the unit you're on (only one unit should have it). Blurbs can be edited freely.

Renaming a unit is different. A unit's `name` is also the key that `src/data/unit-materials.json` uses to attach resources, so a rename has to change both in the same commit or the unit quietly loses its materials. Leave `hubSlug` alone either way, since that is what links the unit to its learning hub and to its public URL.

## Edit a unit's "what's inside" list

Same files — each unit has an optional `topics` array. Add, remove, or reword lines freely. Delete the whole `topics` array to remove the dropdown for that unit.

## Edit a class glossary ("words worth knowing")

Course glossary terms live in the relevant class page as `{ term, def }` pairs and appear through `CoursePage` when that course supplies a glossary.

## Add a resource link to a class

Add or update the record in the ignored private inventory at `src/data/resources.private.json`. Set `onWebsite` to `true` only for a student-safe file with the intended Drive permissions, then run:

```powershell
npm.cmd run resources:sync
```

That rebuilds the public catalog without putting teacher-only links in the public GitHub source. Unit-specific hand-wired links are allowed only when the unit explicitly sets `materialsAudience: 'student'`.

## Edit the "daily desk" cards on a class page

Each class page has arrays near the top (`todayEvents`/`sportsEvents`, `myths`, `verdicts`, `stats`, etc.).
Add or edit entries freely — cards rotate one entry per day automatically.
Dated cards use `{ m: 7, d: 20, y: 1969, text: '...' }` (m = month, d = day, y = year).
Rotating cards use `{ tag: 'small line under the text', text: 'the main text' }`.

## Add a game or lessonhub

Two steps:

1. Drop the standalone HTML file into `public/hubs/` (lowercase-with-dashes name, e.g. `market-structures.html`)
2. Add an entry to the `hubs` array in `src/pages/games.astro` — there's a commented template at the bottom of the array

The file is served as-is at `/hubs/market-structures.html`, so localStorage progress saving works normally.

## Add or edit a simulation

`src/pages/simulations.astro` — edit the `sims` array. Each sim can have optional `details` sections (`{ heading, items }`) that render as expandable dropdowns — the mock trial objection cheat sheet lives there.

## The tools page

`src/pages/tools.astro` — timer, group maker, cold call picker. Nothing typed there is saved or sent anywhere. The roster lives in memory and disappears when the tab closes. Edit button presets or labels directly in the file.

## RSS + sitemap (automatic)

- `/rss.xml` — announcement feed, builds itself from the announcements folder. Zero maintenance.
- `/sitemap.xml` — built from a path list in `src/pages/sitemap.xml.ts`. **If you add a page, add its path there too.**

## Social sharing image

`public/og.png` — the card shown when the site is shared in texts/social media. Regenerate or replace anytime; keep it 1200×630.

## Change the accent color or fonts

`src/styles/global.css` — the `@theme` block at the top. Change `--color-accent` and everything updates.

## Add a whole new page

1. Create `src/pages/yourpage.astro` (copy `about.astro` as a starting point).
2. Add it to the `links` array in `src/components/Nav.astro`.

## Personalize the about page

`src/pages/about.astro` — update the teacher description or contact wording whenever public details change.

## Using Claude Code for any of this

Once you have Claude Code set up (see CLAUDE.md), you can skip all of the above and just say things like:

- "post an announcement that the reconstruction case file is due friday"
- "move us history to the gilded age unit"
- "add a resources link to hidden history for the unit 2 evidence packet: [paste url]"
- "change the accent color to a darker blue"

Then stage only the files that actually changed, read the staged diff, and commit and push those. Do not run `git add .` while other work is sitting uncommitted, because it sweeps that work into your commit too.
