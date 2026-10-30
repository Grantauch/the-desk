# Sprite Book intake

Read `DESIGN.md` first. This workflow only prepares presentation assets; it does not add species rules, buildings, encounters, items or other gameplay.

Run from `apps/checkaverse` with Pillow, NumPy and SciPy installed:

```sh
python3 tools/admit-sprite-book.py RAW_DIR
python3 tools/admit-sprite-book.py RAW_DIR --apply
python3 tools/test-sprite-book.py
npm test
```

The first command checks without publishing artwork. `--apply` publishes only accepted entries. The report is `content/sprite-admission.json`.

`content/sprite-book.json` supplies source filenames, Sprite Book entry numbers, layouts and frame dimensions. `content/sprites.json` registers the actual town asset files and their display dimensions. The intake tool compiles that registry into a non-executable template in the plaza HTML; the served-page test checks it against the source data. No server route or protocol change is required. Town prop placement stays in map content. The camp reads a generated `assets/sprite-book.json` data file for founder front/back stills and two-frame PNG idles.

The tool checks actual PNG format, at least 98% exactly FF00FF border pixels and no more than 1% interior near-magenta pixels. Tiles, interiors and scenes are exempt from the border check and are not keyed; the near-magenta check still applies. For isolated sprites, border-connected exact-magenta background is outside the sprite. Enclosed magenta pockets are conservatively counted as interior so a magenta belly cannot disappear silently. A fence enclosing background may need corrected art or an explicit mask review.

Accepted isolated sprites lose only exact FF00FF. Alpha is binary, with no feathering or edge recoloring. Source empty space is trimmed, sheet gutters are found in reading order and every resize uses NEAREST. Frames share a scale and foot baseline. Trainers use 3×4 grids, NPCs two poses, starters/items four, and effects their declared two or three frames; other book layouts are declared in data. Missing layouts or ambiguous gutters fail admission.

New derivatives use 32 pixels per tile. Existing Wave 1 derivatives retain their legacy frame metadata; accepted v2 replacements point at their new files, and replaced Wave 1 files are archived byte-for-byte under `public/art/archive/wave1/`. Original URLs also remain available for cached clients. The original fallback list contains only legacy filenames; new artwork is registered in content data and compiled into the page. The old `tools/cut-sprites.py` is historical tooling with filtering and recoloring and must not be used for new artwork.

The book does not give numeric dimensions for the unavailable full-screen meadow battle image. Its entry remains deferred until the source and actual battle canvas are available; this tool does not invent a resolution.

For the real browser check, run `node scripts/test-sprite-book-browser.mjs` from the repository root with Playwright Chromium installed. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an existing Chromium. This exercises the current plaza, a house, camp care and practice at 1366×768. It explicitly reports the absent tile-walkable Kettle Creek gate. See [release notes](releases/2026-10-30-sprite-book.md) for current source and release blockers.
