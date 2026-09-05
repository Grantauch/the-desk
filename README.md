# the desk.

Classroom home base for U.S. History 9, Hidden History, and Beyond the Scoreboard, live at [grant-desk.com](https://grant-desk.com).

Built with [Astro](https://astro.build) and [Tailwind CSS](https://tailwindcss.com), deployed on Netlify. The Hall Pass and Daily Check-In app lives separately in `apps-script/hall-pass/` and runs on Google Apps Script.

- **New here?** Read `START-HERE.md`.
- **Making an edit?** Read `EDITING.md`.
- **Curriculum and publishing rules:** `CURRICULUM-PUBLISHING.md`.
- **AI maintenance conventions:** `CLAUDE.md`.

```sh
npm install            # once
npm run dev            # local site at localhost:4321
npm run check          # Astro and TypeScript diagnostics
npm run build          # production build
npm run site:validate  # link and content assertions against dist
npm run hall-pass:verify   # required when anything under apps-script/ changes
```
