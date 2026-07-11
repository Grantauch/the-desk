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

## Add a resource link to a class

Same files — add a line to the `resources` array:

```js
{ label: 'Unit 4 study guide', href: 'https://docs.google.com/...' },
```

## Add or edit a simulation

`src/pages/simulations.astro` — edit the `sims` array.

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
