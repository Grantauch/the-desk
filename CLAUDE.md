# the desk — grant-desk.com

Personal classroom website for a social studies teacher (US History, Hidden History, Beyond the Scoreboard). Owner is a beginner — explain briefly what you changed and why, keep diffs small, never refactor without being asked.

## Stack

- Astro 5 (static output), Tailwind CSS 4 via `@tailwindcss/vite`
- Deployed on Netlify from GitHub (`Grantauch/the-desk`) — every push to `main` auto-deploys
- Commands: `npm run dev` (localhost:4321), `npm run build`, `npm run preview`

## Where things live

- `src/pages/` — one file per page; class pages (`us-history`, `hidden-history`, `beyond-the-scoreboard`) are thin data wrappers around `src/components/CoursePage.astro` (units with optional `topics`, resources, optional `glossary`)
- `src/content/announcements/*.md` — announcements; frontmatter: `title`, `date`, optional `course`
- `src/pages/tools.astro` — classroom tools (timer, group maker, cold call). The ONE page allowed JavaScript; nothing typed there may ever be persisted or transmitted.
- `src/pages/simulations.astro` — sims array; each entry can have `details` sections (mock trial objection cheat sheet lives there)
- `src/pages/sitemap.xml.ts` — manual path list; add new pages here too
- `src/pages/rss.xml.ts` — announcements feed, builds itself
- `src/components/Nav.astro` — nav links array (update when adding pages)
- `src/styles/global.css` — design tokens in `@theme`, plus signature classes: `.pop` (offset-shadow card), `.pop-ink`, `.dot-grid` (hero dots)
- `src/layouts/Base.astro` — page shell (head with OG/social meta, nav, footer)
- `public/og.png` — social sharing card (1200×630)

## Conventions

- Brand is lowercase: "the desk" — never capitalize it. Headings on pages are lowercase with an accent-colored period (`<span class="text-accent">.</span>`).
- Accent color is deep electric blue (`--color-accent`); use the token, never hardcode hex in components.
- Voice: playful but not pretentious; confident, dry, concise.
- No student data, no grading, no assignment submission — Google Classroom handles those. Do not add features that collect student information.
- Keep the site zero-JS unless a feature truly needs it. Current exceptions: `tools.astro` (timers must tick) and the "daily desk" cards on course pages (`DailyCard.astro`, `TodayCard.astro` — a few lines that pick today's entry from a local list; no network, no storage). Prefer `<details>/<summary>` for show-hide content.
- Headings use `font-display` (Space Grotesk, loaded in Base.astro).

## Common tasks

- **Post announcement**: add `src/content/announcements/YYYY-MM-DD-slug.md`
- **Change current unit**: move `current: true` within the `units` array in the class page
- **Attach slides/packets to a unit**: add a `materials: [{ label, href }]` array to that unit in the class page (Drive links must be shared as "anyone with the link — viewer")
- **Add a lessonhub/game**: drop the HTML file in `public/hubs/` and add an entry to the `hubs` array in `src/pages/games.astro`
- **Verify before pushing**: `npm run build` must pass

## Deploy

`git add . && git commit -m "..." && git push` — Netlify does the rest (~1 min).
