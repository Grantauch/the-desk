# the desk — grant-desk.com

Personal classroom website for a social studies teacher (US History, Economics, Law). Owner is a beginner — explain briefly what you changed and why, keep diffs small, never refactor without being asked.

## Stack

- Astro 5 (static output), Tailwind CSS 4 via `@tailwindcss/vite`
- Deployed on Netlify from GitHub (`Grantauch/the-desk`) — every push to `main` auto-deploys
- Commands: `npm run dev` (localhost:4321), `npm run build`, `npm run preview`

## Where things live

- `src/pages/` — one file per page; class pages (`us-history`, `economics`, `law`) are thin data wrappers around `src/components/CoursePage.astro`
- `src/content/announcements/*.md` — announcements; frontmatter: `title`, `date`, optional `course`
- `src/components/Nav.astro` — nav links array (update when adding pages)
- `src/styles/global.css` — all design tokens in the `@theme` block
- `src/layouts/Base.astro` — page shell (head, nav, footer)

## Conventions

- Brand is lowercase: "the desk" — never capitalize it. Headings on pages are lowercase with an accent-colored period (`<span class="text-accent">.</span>`).
- Accent color is deep electric blue (`--color-accent`); use the token, never hardcode hex in components.
- Voice: playful but not pretentious; confident, dry, concise.
- No student data, no grading, no assignment submission — Google Classroom handles those. Do not add features that collect student information.
- Keep the site zero-JS unless a feature truly needs it.

## Common tasks

- **Post announcement**: add `src/content/announcements/YYYY-MM-DD-slug.md`
- **Change current unit**: move `current: true` within the `units` array in the class page
- **Verify before pushing**: `npm run build` must pass

## Deploy

`git add . && git commit -m "..." && git push` — Netlify does the rest (~1 min).
