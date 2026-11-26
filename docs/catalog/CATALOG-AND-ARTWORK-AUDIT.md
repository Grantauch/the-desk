# GrantDesk catalog and artwork audit

**Started 2026-11-20.** This is a quality-gated catalog and media recovery project. The original `/hubs/` student assignment URL, saved work, school PIN and Turn In must never be changed merely to move a listing.

## Inventory and placement rules

At the beginning of this audit, the typed interactive catalog had 38 entries: 17 games, 9 simulations, 7 investigations and 5 practice/review activities. The separate Story Hub catalog had 64 entries. These are catalog counts, **not** the count of every HTML experience under `public/hubs/`.

- **Games:** primary activity is competition, game mechanics, or an open-ended playable sandbox.
- **Simulations:** test a historical system or model, manipulate variables, witness constraints/consequences, or explore reconstructed environments.
- **Investigations:** inspect authentic documents and defend a claim with evidence. These belong on Simulations alongside models, clearly labeled as investigations.
- **Story Hubs:** a historical narrative is the main path. If it includes a substantial model, cross-list its **existing** URL under Simulations; don't duplicate the assignment or its save ID.
- **Practice & review:** drills, study modes, quizzes and revision. They need a separate destination, not a section that makes the Games cabinet feel crowded.

### Current catalog changes in this PR

1. Dedicated `/practice/` route for five existing `practice` entries; keep all `href` values unchanged and add desktop/mobile Explore navigation.
2. Games now emphasizes the 17 actual games and links visibly to Simulations and Practice rather than mixing learning drills with games.
3. Simulations cross-lists 10 narrative-linked models instead of 3. New discovery entries are Glomar, feed-ranking/rumor spread, weather seeding, radium dial work, trench scenarios, refinery/industry, and railroad/farm debt. The added Story Hubs remain in Story Hubs until individual in-class evaluation suggests an exclusive move.
4. Do **not** move classroom capstones, debates or Socratic seminars into Games; these are pedagogical activities and may merit a future separate classroom-projects route.

## Art quality triage

An SVG file is **not inherently bad**: icons, scalable maps and data graphics can be excellent. The problem is low-quality flat scene art presented as historical documentary imagery, or unlabeled synthetic imagery that could be mistaken for evidence. There are three current SVG **Story Hub covers** in the registered catalog:

| Priority | Story Hub | Current cover | Recommended direction |
| --- | --- | --- | --- |
| P0 | `ush9-l015-who-showed-up` | `/storyhub/ush9/l015/assets/a01-rail-yard.svg` | Replace the cover and 14 SVG scene illustrations with verified 1877 strike photographs/period wood engravings; retain explanatory diagrams only when purposeful |
| P0 | `bts-l03-not-in-the-room` | `/storyhub/bts/l03/assets/cover-ledger.svg` | Replace hero with documented 1876–1880 National League team photograph or contemporary baseball newspaper/club portrait |
| P1 | `hh-bytesize-nuremberg` | `/storyhub/hh/nuremberg/cover.svg` | Replace cover with documented Nuremberg courtroom or original-era John C. Woods photograph, keeping specific identification honest |

These covers must not be simply recolored or replaced with new generative scenes. The next artwork batch should commit self-hosted, optimized `.webp`/JPEG assets, exact source credit/license records and honest alt text, then visually verify subject/crop on 320px mobile and desktop.

### Historical sources to retrieve and license-check

- **Railroad Strike 1877:** [Library of Congress, Frank Leslie's July 1877 strike engraving](https://www.loc.gov/item/2007675388/) (item lists **no known publication restrictions**), and [Pittsburgh 1877 railroad photography](https://www.loc.gov/item/2024722927/). Verify scene and original publication date; do not substitute an unrelated strike.
- **1876 baseball:** [1876 Chicago White Stockings photo, Wikimedia Commons](https://commons.wikimedia.org/wiki/File:1876_Chicago_White_Stockings.jpg), listed as U.S. public domain, or [original 1876 composite](https://commons.wikimedia.org/wiki/File:1876_Chicago_White_Stockings.webp). Cite that these are Chicago players, not a generic portrait of all the National League's founders.
- **Nuremberg:** [U.S. Army/NARA photograph of defendants in the dock](https://commons.wikimedia.org/wiki/File:Nuremberg_trials_28-1431M_original.jpg), listed as U.S. federal government public domain. Do not label a general trial image as a verified portrait of John C. Woods.

### Synthetic/reconstruction-image candidates requiring inspection

These are identified from `coverAlt`/author descriptions, not a claim to have visually inspected every asset:

| Story Hub | Cover metadata / reason to review |
| --- | --- |
| `ush9-l016-the-one-that-passed` | AI-authored Sierra railroad cut reconstruction |
| `ush9-l016b-they-said-no` | AI-authored 1880s steamship reconstruction |
| `ush9-l018-the-debt-didnt-move` | Generated interpretive image of farm debt |
| `ush9-s01-the-margin` | Generated cyanotype-style South Fork Dam road reconstruction |
| `ush9-l014-unions` | Illustrated reconstruction of 1869 meeting |
| `hh-living-history-02-device-in-your-pocket` | Original digital art of portal/teenager; assess as evocative illustration, not evidence |
| `bts-route-tree-a` | Stylized youthful Unitas reconstruction, while authentic player photographs are available elsewhere |
| `bts-route-tree-b` | **Source-derived** ink interpretation of a documented 1953 photograph; retain only with nearby unaltered original and clear label |

These require asset-by-asset provenance and visual inspection. Ordinary colorization and clearly marked archival illustration are not automatically failures. Never replace real records with speculative faces, uniforms, artifacts or geography.

## Successive quality-gated batches

| Batch | Deliverable | Required gate |
| --- | --- | --- |
| C01 — catalog clarity | Practice has its own route; Games contains real games; simulation-heavy stories cross-listed without URL changes | Type checks, site build, route QA, browser/mobile layout; no broken links |
| C02 — artwork inventory | Search all published Story Hubs and 109+ hub HTML experiences for embedded images, SVG scenes, synthetic art, missing attributions and broken loads | Inventory includes path, owner, original/altered/synthetic flag, rights/source, screenshot, severity |
| C03 — high-priority authentic covers | Replace the three SVG covers and obvious low-quality scenes with self-hosted archival images, text legible over image crops | Source/license record + 320/390/1365px screenshots and image load validation |
| C04 — StoryHub interior images | Replace low-quality SVG scenes or synthetic documentary pretenders in priority lessons; retain real diagrams as diagrams | Chapter order/lesson content/persistence unchanged; accessible captions and source links |
| C05 — game art direction | Audit splash screens, backgrounds, characters and thumbnails in all real games; preserve game mechanics, make visual language distinct by title | Screenshots, mobile performance, safe image licensing, no regression to controls |
| C06 — full catalog reconciliation | Review all root-level HTML experiences against all three discovery sections, including obsolete prototypes | Student-safe route/metadata and functional checks; missing routes restored or intentionally retired |
| C07 — launch certification | Independent review, full-site checks, production deployment and live public audit | No preview-only or build-only “live” claims |

## Release safeguards

- No changes to `/hubs/` URLs, per-class authentication, student work storage, rubric IDs or Turn In.
- On production the website may be deployed to a separately owned server. Never treat Vercel or Netlify preview statuses as proof of production.
- Record only *verified* media provenance; files described as “AI-generated” need replacement or unmistakable interpretive labels, not unsupported “real photo” alt text.
- Do not hotlink third-party image servers as a permanent asset solution. Commit approved binaries locally alongside source/license metadata.
- Establish before/after screenshots and tests for each batch before approving changes.
