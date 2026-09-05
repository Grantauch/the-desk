# the desk — grant-desk.com

Personal classroom website for a social studies teacher (US History 9, Hidden History, Beyond the Scoreboard). Owner is a beginner. Explain briefly what you changed and why, keep diffs small, never refactor without being asked.

## Stack

- Astro 7 (static output), Tailwind CSS 4 via `@tailwindcss/vite`
- Deployed on Netlify from GitHub (`Grantauch/the-desk`). Every push to `main` rebuilds the site.
- Local commands: `npm run dev` (localhost:4321), `npm run build`, `npm run preview`

## Where things live

- `src/pages/` — one file per page. The class pages (`us-history`, `hidden-history`, `beyond-the-scoreboard`) are thin data wrappers around `src/components/CoursePage.astro` (units with optional `topics`, resources, optional `glossary`)
- `src/content/announcements/*.md` — announcements. Frontmatter: `title`, `date`, optional `course`
- `src/data/learningHubs.ts` — the interactive units behind `/learn/<course>/<unit>/`. Each unit carries a stable `slug` and a display `period`
- `src/data/unit-materials.json` — which catalog resources are attached to which unit. Keyed by the unit's display name, so renaming a unit on a course page means renaming its key here in the same commit
- `src/data/resources.json` — the public resource catalog, generated from an ignored private inventory
- `src/pages/simulations.astro` — sims array. Each entry can have `details` sections
- `src/pages/sitemap.xml.ts` — manual path list. Add new pages here too
- `src/pages/rss.xml.ts` — announcements feed, builds itself
- `src/components/Nav.astro` — nav links array (update when adding pages)
- `src/styles/global.css` — design tokens in `@theme`, plus signature classes: `.pop` (offset shadow card), `.pop-ink`, `.dot-grid` (hero dots)
- `src/layouts/Base.astro` — page shell (head with OG and social meta, nav, footer)
- `public/hubs/` — standalone HTML games and lessonhubs, served as written
- `storyhub/` — StoryHub production manifests, templates, and agent skills. Start at `docs/storyhub/README.md`; L014 is Reference Implementation 001, not a visual template.
- `apps-script/hall-pass/` — the Hall Pass and Daily Check-In app. This is Google Apps Script, not part of the Astro build
- `apps-script/snapshots/hall-pass/` — exact source of released versions, with fingerprints
- `public/og.png` — social sharing card (1200x630)

## Conventions

- Brand is lowercase: "the desk". Never capitalize it. Page headings are lowercase with an accent colored period (`<span class="text-accent">.</span>`).
- Accent color is deep electric blue (`--color-accent`). Use the token, never a hardcoded hex in a component.
- Voice: playful but not pretentious. Confident, dry, concise.
- Keep pages light on JavaScript. Where a page needs it, keep the state in the browser. Nothing on the static site transmits student information anywhere.
- The site does not host grades, submissions, or rosters. Google Classroom handles those. `/pass/` and `/check-in/` only link out to the Apps Script app, which is where student check-ins actually live.
- Headings use `font-display` (Space Grotesk, loaded in Base.astro).

## StoryHub workflow

StoryHub is a quality standard and production system, not a visible template. Each StoryHub defines Story DNA before asset generation or interface design: tone, palette, typography, texture, shape language, motion grammar, interaction signature, density rhythm, archival behavior, and ending language. The approved assets then drive an asset-to-interface translation pass so the HTML feels born from the artwork.

- Create a new scaffold: `npm run storyhub:new -- <COURSE> <LESSON> "Title"`
- Validate all StoryHub manifests: `npm run storyhub:validate`
- Read `docs/storyhub/GOLD_STANDARD.md` before changing visible StoryHub design.
- Prefer source-first stylization where strong real historical visual evidence exists.
- Named people introduced materially in a main section should have an explicit visual-anchor decision in `story.json`.
- Every interaction must declare what it teaches, what changes, what feedback appears, and its static/reduced-motion fallback.
- Keep master/reference imagery and private source registers outside the public repo. Commit only student-safe optimized public derivatives and public provenance notes.

## Common tasks

- **Post announcement**: add `src/content/announcements/YYYY-MM-DD-slug.md`
- **Change current unit**: move `current: true` within the `units` array in the class page
- **Rename a unit**: change `name` on the class page and the matching key in `src/data/unit-materials.json` together, and leave `hubSlug` alone. `npm run site:validate` checks the pairs that have already been renamed
- **Attach slides or packets to a unit**: add a `materials: [{ label, href }]` array to that unit in the class page. Drive links must be shared as anyone with the link, viewer
- **Add a lessonhub or game**: drop the HTML file in `public/hubs/` and add an entry to the `hubs` array in `src/pages/games.astro`
- **Start a StoryHub**: run `npm run storyhub:new -- COURSE LESSON "Title"`, author Story DNA and narrative manifests, then build only after the manifests describe a distinct identity and asset plan.

## Verification

Install dependencies with `npm install --include=dev` (`npm.cmd` in PowerShell), then run `npm run verify` before pushing. GitHub Actions runs this command once. It runs, in order:

- `hall-pass:verify` — handoff map, structural suite, and runtime harness
- `tools:test` — group maker, cold call, and timer fixtures
- `resources:validate` — public-resource validator fixtures, then read-only catalog and assignment validation; no private inventory required
- `storyhub:validate` — read-only StoryHub manifest, identity, provenance, visual-anchor, interaction-value, and local-path checks
- `check` — dependency preflight, then Astro and TypeScript diagnostics with 0 errors required; missing development dependencies fail without an install prompt
- `build` — production site generation
- `site:validate` — link and content assertions against the new `dist`

Verification must not change tracked source or data. `live-data:check` remains a separate network health check. Current release-path adoption and remaining repairs are recorded in `docs/grantdesk/REPAIR-STATUS.md`.

`npm run resources:sync` is an authoring step and not part of verification. It rewrites the public catalog from the ignored private inventory, so it must never run as part of a routine publish.

## Deploy

Stage only the paths you actually changed, read `git diff --cached` before committing, then push. Do not use `git add .` while unrelated files are dirty. Netlify rebuilds from `main` in about a minute.

A push to GitHub is not an Apps Script deployment. Changes under `apps-script/hall-pass/` reach students only when a new version is created on the existing Apps Script deployment. `apps-script/hall-pass/DEPLOY.md` carries that procedure and the release records.
