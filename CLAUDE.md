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
- `public/hubs/blacktop-kings/` — Blacktop Kings, a just-for-fun 3-on-3 streetball game (no classroom content). Careers save in the browser or in a JSON file the player keeps; nothing is sent anywhere
- `apps/pond/` — editable React source for the Pond sandbox. `npm run pond:build` intentionally publishes the static app to `public/hubs/pond/`; `npm run pond:test` checks physics, saves and source/bundle fingerprints. Site verification does not rebuild app bundles
- `public/hubs/checkling/pets/` — original Checkling species art. The companion itself lives inside Daily Check-In in `apps-script/hall-pass/Code.gs` and `Index.html`, with private per-class preferences and growth derived from the official school-day streak. It never writes its own attendance or point tally. See `docs/checkling-pond/README.md`. Read `docs/checklings/DESIGN.md` before any Checklings work; it is the single source of truth and outranks older Checklings docs
- `apps/checkaverse/` — the Checkaverse live multiplayer server (Node, WebSockets, SQLite). Not part of the Netlify build. It runs on Grant's PC from `C:\Checklings\checkaverse` behind a Cloudflare Tunnel at game.grant-desk.com. `npm test` inside that folder runs a two-player end to end check. See its README
- `public/hubs/robber-barons-firebase.js` — Firebase settings for Robber Barons join-with-a-code play. Setup and database rules are in `docs/robber-barons-online/`
- `public/hubs/ush9-stop-the-presses.html` — Stop the Presses, the live Progressive Era class game (teacher hosts on the projector, students join at grant-desk.com/press). Questions live in `ush9-stop-the-presses-bank.js`, desk photos in `public/hubs/stop-the-presses/`. Shares the Robber Barons Firebase project and rules file. Host guide in `docs/stop-the-presses/README.md`
- `public/hubs/ush9-progressive-era-jeopardy-v3.html` — Progressive Era Jeopardy V3, the teacher-run board with a projector window, four looks, Pick a Number and a full editor. Live play sends students to `public/hubs/jeopardy-buzz.html` (grant-desk.com/buzz) for buzzers, locked guesses and Final Jeopardy, and doubles as the teacher's phone remote. Shares the Robber Barons Firebase project and rules file under `jep/`, and saves teacher boards to the cloud under `jepBoards/` (board content only, no student information). Host guide in `docs/jeopardy-live/README.md`. V2 stays in place for old links
- `public/hubs/ush9-square-deal.html` — The Square Deal, a Progressive Era card duel (vs the computer or two players on one Chromebook). Cards and rules in `ush9-square-deal-engine.js`, art in `public/hubs/square-deal/`, notes in `docs/square-deal/README.md`. `npm run square-deal:test` checks the cards and balance after edits. Nothing is sent anywhere
- `storyhub/` — StoryHub production manifests, templates, and agent skills. Start at `docs/storyhub/README.md`; L014 is Reference Implementation 001, not a visual template.
- `public/hubs/desk-save.js` — the one save system for every hub with answer boxes: saves while students type (this tab only, so a shared Chromebook is blank for the next student), saves changed work to the student's account after a 15-second pause or at most 30 seconds of continuous editing with their hall pass PIN, updates the private Progress view, and records finished snapshots only when the student presses Turn In. Every answer page opens behind a PIN gate: the page is covered and inert until the student enters their PIN and confirms their name (and picks a class if they are in two), so account saving runs from the first answer and Turn In uses the verified account session without asking for the PIN again, including after refresh. Saved drafts carry a bounded writing cursor bookmark, restored across Chromebooks and native details/tab sections. The normal view has a small status strip, collapsed Work options and one large Turn In button; recovery tools remain available on demand. Signing out, Not me, and the 20 minute idle sign out bring the gate back. A wrong PIN never unlocks it; if the save service cannot be reached the gate stays closed until PIN verification succeeds. Reading pages have no gate. A teacher device skips the gate after visiting any hub once with `?deskteacher=on` (`?deskteacher=off` undoes it). Browser tests turn the gate off with the `gate: false` test hook except in the PIN gate tests. Load it with `<script src="/hubs/desk-save.js" defer></script>` before `</body>`; never write per-hub save code
- `public/teacher/writing-replay.html` — teacher replay for a Writing Timeline row. Paste the Replay Data cell; it runs in the browser and sends nothing. Guide in `docs/storyhub/WRITING-TIMELINE.md`
- `apps-script/turn-in/` — the Turn In web app that receives hub answers into the teacher's private sheet. Separate from Hall Pass, reads the Hall Pass roster only. Setup in `apps-script/turn-in/SETUP.md`
- `apps-script/hall-pass/` — the Hall Pass and Daily Check-In app. This is Google Apps Script, not part of the Astro build
- `apps-script/snapshots/hall-pass/` — exact source of released versions, with fingerprints
- `public/og.png` — social sharing card (1200x630)

## Conventions

- Brand is lowercase: "the desk". Never capitalize it. Page headings are lowercase with an accent colored period (`<span class="text-accent">.</span>`).
- Accent color is deep electric blue (`--color-accent`). Use the token, never a hardcoded hex in a component.
- Voice: playful but not pretentious. Confident, dry, concise.
- Keep pages light on JavaScript. Where a page needs it, keep the state in the browser. Nothing on the static site transmits student information anywhere, with four exceptions. Robber Barons online play sends a typed first name and the game moves to the teacher's Firebase project, where games are deleted after a day. Stop the Presses live play sends a typed first name, a newspaper name picked from a fixed list, and each answer to that same Firebase project under `stp/`. Rules make a game unreadable after a day, and the page deletes it when the teacher closes the newsroom or hosts the next game. Nobody can list game codes. Progressive Era Jeopardy live play sends a typed first name, a team choice, buzzes, room calls, Pick a Number guesses and Final Jeopardy wagers and answers to that same Firebase project under `jep/`; rooms are unreadable after a day and the page deletes a room when the teacher ends live play or opens the next one. `desk-save.js` sends a hub's answers, with the student's hall pass PIN, only to the teacher's own Turn In Apps Script. With Turn In it also sends that tab's writing timeline (typing batches, pastes, text that appeared without typing, loads and time away), which lands in the private Writing Timeline sheet. Its Read aloud control uses the Chromebook's own speech engine and sends nothing.
- The site does not host grades or rosters. Hub answers turned in go to the teacher's private Turn In sheet in Google, never to this repository or Netlify. `/pass/` and `/check-in/` only link out to the Apps Script app, which is where student check-ins actually live.
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
- **Change current unit**: set `currentUnit` in `src/data/classroom-state.ts` to an existing course unit; current calendar titles derive from that same value
- **Rename a unit**: change `name` on the class page and the matching key in `src/data/unit-materials.json` together, and leave `hubSlug` alone. `npm run site:validate` checks the pairs that have already been renamed
- **Attach slides or packets to a unit**: add a `materials: [{ label, href }]` array to that unit in the class page. Drive links must be shared as anyone with the link, viewer
- **Add a lessonhub or game**: drop the HTML file in `public/hubs/` and add an entry to the `hubs` array in `src/pages/games.astro`. If it has any answer boxes, add `<script src="/hubs/desk-save.js" defer></script>` before `</body>`; `npm run turn-in:test` fails without it. Put `data-desk-skip` on inputs that are not answers, and `<div data-desk-turnin></div>` where the Turn In panel should sit if the end of the page is wrong
- **Start a StoryHub**: run `npm run storyhub:new -- COURSE LESSON "Title"`, author Story DNA and narrative manifests, then build only after the manifests describe a distinct identity and asset plan.

## Verification

Install dependencies with `npm install --include=dev` (`npm.cmd` in PowerShell), then run `npm run verify` before pushing. GitHub Actions runs this command once. It runs, in order:

- `hall-pass:verify` — handoff map, structural suite, and runtime harness
- `square-deal:test` — The Square Deal card data, game completion, amendment protection and balance
- `turn-in:test` — Turn In web app in the fake Apps Script runtime with Hall Pass generated PINs, plus the check that every answer hub loads `desk-save.js`
- `tools:test` — group maker, cold call, and timer fixtures
- `classroom:test` — current course/calendar parity, invalid unit and month checks
- `resources:validate` — public-resource fixtures, synthetic local publishing/editor integration tests, then read-only catalog and assignment validation; no private inventory required and no external test uploads
- `storyhub:validate` — read-only StoryHub manifest, identity, provenance, visual-anchor, interaction-value, and local-path checks
- `check` — dependency preflight, then Astro and TypeScript diagnostics with 0 errors required; missing development dependencies fail without an install prompt
- `build` — production site generation
- `site:validate` — link and content assertions against the new `dist`

Verification must not change tracked source or data. Netlify, GitHub Actions, and local publishing use this same gate. `live-data:check` remains a separate network health check. Current release-path adoption and remaining repairs are recorded in `docs/grantdesk/REPAIR-STATUS.md`.

`npm run resources:sync` is an authoring step and not part of verification. It rewrites the public catalog from the ignored private inventory, so it must never run as part of a routine publish.

## Deploy

Stage only the paths you actually changed and read `git diff --cached` before committing. Upload a review branch and open a pull request; protected main requires the GitHub `build` check, which also runs `browser:test`. Never bypass protection. Local publishing shortcuts upload the verified commit to a review branch and preserve local work, including edits made during upload. Merge with a merge commit so the authoring checkout can later fast-forward; never reset it to discard pending work. Confirm the exact Netlify production commit separately.

`npm run browser:test` uses the built site: nine routes at 320, 390, and 1440 pixels; full-page WCAG A/AA and contrast; search focus/Enter/Escape; course/calendar agreement; timer pause/reset/fullscreen; first-screen daily actions with ordinary and reduced motion. External services are stubbed offline, so no student service is contacted. Screenshots and accessibility reports are in `browser-results/`, with traces on failure; GitHub retains these artifacts for seven days.

`npm run turn-in:browser` (part of `browser:test`) opens every answer hub in Chromium and drives typing, refreshing, shared Chromebooks, lost WiFi and 35 simultaneous turn ins against the real Turn In code. `npm run turn-in:load -- <exec URL> <key>` load tests the deployed web app with synthetic PINs; see `apps-script/turn-in/SETUP.md`.

A push to GitHub is not an Apps Script deployment. Changes under `apps-script/turn-in/` reach students only after pasting into the Turn In project and editing the existing deployment to a new version. Changes under `apps-script/hall-pass/` reach students only when a new version is created on the existing Apps Script deployment. `apps-script/hall-pass/DEPLOY.md` carries that procedure and the release records.

## Dry County prototype

`public/hubs/dry-county/` is a just-for-fun Prohibition game on a simplified modern Mt. Morris road layout. Its people, businesses and story are fictional. Build 0.3 adds car collisions, ramming police with roadblocks and federal agents, Pinched and the Bell & Sons respray, six job types, breakable props and ramps, style cash, two hot runs, the rival rampage and sixteen hidden jugs whose clippings carry the real history (the `FACTS` list in `game.js`). Cars run on a tire model in `drive()`, and night lighting, weather and the train live in the atmosphere section of `game.js`. Quality steps itself down on slow Chromebooks. Police hunt from a last known position and search circle (`LAW`), and rival crews, officers and agents on foot share one brain (`CREW`, `crewTick`); see Chases and gunfights in the README. Cars, people, trees and effects are cached sprites (`CAR_ART`, `TREE_ART`, `FX` in `game.js`); see the Graphics pass section of the README. Run `npm run dry-county:test` after edits; it plays every job type, both activities, collisions, ramps, busting, the respray, jugs, saves and the feedback lifecycle. Source notes are in `docs/dry-county/README.md`.

Dry County adds one explicit exception to the no-transmission convention above: only when a player chooses Send after a life ends, it submits optional ratings, an optional note and the displayed game-run summary to the site's Netlify Forms collection (`dry-county-feedback`). It requests no name, email, account, roster or PIN. Its inputs carry `data-desk-skip`; they are play-test feedback, not student assignment answers. Failed or unconfirmed submissions remain local and are described as unsent, with retry/download. Never claim a local save is a received submission.

## Shared assistant handoffs

Read AI_TEAM.md for task ownership, shared project context, and evidence-based handoffs. Keep private daily task records outside this public repository.
