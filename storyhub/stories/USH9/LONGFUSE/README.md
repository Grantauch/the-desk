# THE LONG FUSE — Story Hub 2.0 / First integrated edition

**Three connected episodes** at `/storyhubs/the-long-fuse/`.

1. Part I — The Spark Was Not a Switch, 5 chapters, June–August 1914.
2. Part II — The War and the Settlement, 5 chapters, 1914–1919.
3. Part III — The Republic and the Appointment, 6 chapters, 1919–1933.

## Pedagogical design

This is a responsive historical documentary rather than an exported slide deck. Students investigate consequences without being taught inevitability. Each episode uses the production Story Hub 2.0 shell, a historical briefing, source-linked chapters, contextual cast/map/timeline/archive, reading settings, chapter navigation and an episode-specific visual rhythm.

Special teaching controls: July Crisis diplomatic file disclosures, an expressly schematic political map, dated historical chronology, Article 231 source read, 1923 inflation measure, 1928–1932 election comparison with majority threshold, and a four-field evidence verdict with session-only persistence. The verdict is **self-checking, not auto-graded and not submitted**; no PINs or student account data are requested.

## Art and provenance

Visual system: charcoal, off-white archival paper, oxidized gold, restrained signal red and documentary serif typography. Photos and originals are dated, captioned and attributed. The Sarajevo opening is an **illustration**, not a historical photograph or a truthful reconstruction of exactly what the camera saw. The original political geography illustration is schematic. No forged period scans or AI-generated photographs are masquerading as history.

The IWM non-commercial-source images and 1922 Getty/Topical Press portrait disputed in Batch 24 were **not used**. Image rights and documentary source URLs are recorded in `sources.md`, `assets.json` and the typed edition source register; this is not legal certification for commercial distribution.

## Development

```sh
npm ci
npm run storyhub:validate
npm run check
npm run build
npm run preview -- --host 127.0.0.1 --port 4350
node scripts/long-fuse/test-browser.mjs
node scripts/long-fuse/test-accessibility.mjs
```

The focused browser checks cover landing and all three episode routes at 1440, 390 and 320px; graphical chart and evidence verdict events; missing eager images and horizontal overflow. Axe WCAG 2 A/AA and 2.1 A/AA is checked at desktop and mobile widths. A manual screen-reader and Chromebook/Promethean acceptance still must be completed.

**Status:** Safe feature-branch review candidate. No public site deployment/teacher assignment change. Source history: the original 40-slide *The Long Fuse* Batch 18–24 production and source/rights ledger.

## Cinematic middle-chapter upgrade

Three interactive **source stages** have been added without changing the original 16 chapter count:
- Part I, **Six Weeks: No Automatic Switch** (four stages): illustration, German assurance, July diplomatic exchange, movement into Belgium.
- Part II, **Four Views: One Enormous War** (four stages): Aisne trench, soldiers resting, Gare du Nord civilians, 1919 peace conference.
- Part III, **Not One Uninterrupted Collapse** (five stages): 1923 hyperinflation, subsequent recovery and 1928 vote, Depression, two 1932 elections, January 1933 appointment.

Each step includes contemporary/period evidence or an explicitly labeled typographic/schematic panel, source link, historical explanation, and **what the evidence does not prove**. Controls are native buttons with aria-pressed and live feedback, one visible stage when enhanced, all panels in reading order without JS. Optional animations respect reduced motion.

Three new period photographs reuse the already sourced Library of Congress Bain WebP derivatives from the Marne Story Hub (Aisne German trench, Sep. 14, 1914 resting French soldiers, 1914 Gare du Nord fugitives). They are not newly generated, colorized, or represented as evidence of exact personal motives. See `sources.md` and `assets.json`. Existing rights metadata: LOC lists **no known restrictions on publication**, not a legal guarantee of worldwide commercial clearance.

QA scripts: `node scripts/long-fuse/test-scenes.mjs` for each part at desktop, phone and narrow-phone widths, including no-JavaScript fallback, in addition to `test-browser.mjs` and `test-accessibility.mjs`.
