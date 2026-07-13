# EDITING GUIDE — which file to touch

## Post an announcement

Add a new file in `src/content/announcements/`, named like `2026-08-20-first-day.md`:

```markdown
---
title: "first day of school"
date: 2026-08-20
course: "economics"        # optional — omit for all-class announcements
---

Write the announcement text here. Markdown works: **bold**, [links](https://example.com), lists.
```

It appears on the home page (latest 3) and the announcements page automatically.

## Update what unit a class is on

Open the class page (`src/pages/us-history.astro`, `economics.astro`, or `law.astro`). Find the `units` array. Move `current: true` to the unit you're on (only one unit should have it). Edit names/blurbs freely.

## Edit a unit's "what's inside" list

Same files — each unit has an optional `topics` array. Add, remove, or reword lines freely. Delete the whole `topics` array to remove the dropdown for that unit.

## Edit a class glossary ("words worth knowing")

`economics.astro` and `law.astro` have a `glossary` array — `{ term, def }` pairs. Add one to `us-history.astro` the same way if you ever want it (pass `glossary={glossary}` to CoursePage).

## Add a resource link to a class

Same files — add a line to the `resources` array:

```js
{ label: 'Unit 4 study guide', href: 'https://docs.google.com/...' },
```

## Add a game or lessonhub

Two steps:

1. Drop the standalone HTML file into `public/hubs/` (lowercase-with-dashes name, e.g. `market-structures.html`)
2. Add an entry to the `hubs` array in `src/pages/games.astro` — there's a commented template at the bottom of the array

The file is served as-is at `/hubs/market-structures.html`, so localStorage progress saving works normally.

## Add or edit a simulation

`src/pages/simulations.astro` — edit the `sims` array. Each sim can have optional `details` sections (`{ heading, items }`) that render as expandable dropdowns — the mock trial objection cheat sheet lives there.

## The tools page

`src/pages/tools.astro` — timer, group maker, cold call picker. This is deliberately the only page with JavaScript. Nothing typed there is stored anywhere (by design — no student data). Edit button presets or labels directly in the file.

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

`src/pages/about.astro` — placeholders are marked with `TODO(Grant)` comments. It currently says "Mr. Mauch" — fix if that's not right.

## Using Claude Code for any of this

Once you have Claude Code set up (see CLAUDE.md), you can skip all of the above and just say things like:

- "post an announcement that the stock market game starts monday"
- "move economics to the personal finance unit"
- "add a resources link to us history for the unit 5 study guide: [paste url]"
- "change the accent color to a darker blue"

Then: `git add . && git commit -m "..." && git push` (or ask Claude Code to do that too).
