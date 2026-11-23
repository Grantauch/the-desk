# Visual source and in-game environment pass — November 19, 2026

## Student-facing Story Hubs changed in this branch

### The One That Passed (USH9-L016)
- Previous synthetic opening: generated mountain railroad-cut illustration.
- Replacement: **original first page of the Chinese Exclusion Act (May 6, 1882)**, already present as a local source image at `/storyhub/ush9/l016/assets/act.webp`.
- Source: [National Archives, Milestone Documents](https://www.archives.gov/milestone-documents/chinese-exclusion-act), Record Group 11.
- Hero displays the document, not a made-up scene, with an accessible evidence label and source link. Mobile layout dims the **background document only**, not the native text.
- Story Hub catalog `cover` updated to the same genuine source. The lesson's original railroad narrative and internal source evidence are retained.

### They Said No (USH9-L016B)
- Previous synthetic opening: generic steamship approaching California illustration.
- Replacement: **Wong Kim Ark's 1894 departure statement and identification photo** already stored locally at `/storyhub/ush9/l016/assets/wong.webp`.
- Source: [National Archives, Documented Rights](https://www.archives.gov/exhibits/documented-rights/exhibit/section2/detail/departure-statement.html), record ID 2641490.
- The hero/source-caption truthfully identifies the record as an 1894 identity/departure document—not a photograph of the 1885 Tacoma expulsions.
- Existing Story Hub URLs, response fields, sign-in and Turn In unchanged.
- Updated signed Story Hub release inventories `storyhub/releases/USH9-L016.json` and `USH9-L016B.json` with current UTF-8 byte counts and SHA-256 hashes; these are integrity-preserving reseals of reviewed visual HTML edits, not security bypasses.

## Playable, internal game graphics changed

### Dry County
- Updated `public/hubs/dry-county/game.js` **inside the actual playable map**, not its landing card.
- Flat, repeated field strips become irregular crop furrows and stubble; woodland receives layered canopy silhouettes and contact shadows; meadow/park regions gain more natural ground detail.
- **No gameplay RNG consumed:** the new `parcelRandom(id)` uses an independent stable seed, so house placement, traffic, ramps, hidden jugs, missions, and collision geometry are unchanged.
- Textures are baked in `makeCity()` only; no animation or per-frame shader cost.

### Blitzkrieg
- Updated `public/hubs/blitzkrieg/js/terrain.js` inside the 1939 Poland battlefield.
- Adds cropped soil furrows, crushed stalks and field-specific fine detail. Each is clipped to its proper polygon and painted once into the static terrain canvas.
- Uses seeded art variations only. No tower balance, wave paths, hitboxes, saves, input handling, or per-frame renderer changes.
- Both changes need image-level QA at school Chromebook performance settings; passing CI is necessary but not proof of a high-quality visual result.

## Next art backlog — requires actual scene-by-scene assessment
- L015 *Who Showed Up*: period photos/engravings replacing s1, s2, s4, s11 are in PR #429. The other 10 scenes currently use authored SVGs. Source-derived visuals should prioritize s5 armory, s6 eight-hour movement, s7 Haymarket, s9 defendants, s10 Homestead fortifications, s12 Pullman company homes. Some editorial/legal/motion diagrams (s3, s8, s13, s14) may merit redesign rather than a literal photograph.
- `hh-l06-two-sources`: vector radio-dial cover; source independence diagram is educationally meaningful but should not function as a cheap poster.
- `hh-bytesize-nuremberg` original SVG now has authentic-photo alternative in PR #429.
- Generated-art series to assess: `ush9-s01-the-margin`, `hh-s01-the-desk-it-stopped-at`, `bts-s01-the-death-harvest`, `ush9-l018-the-debt-didnt-move`, plus actual interior visuals and enemy/vehicle artwork in other games.
- Do not replace a historical source with a generic image that merely looks old. Record the actual identity, date, object, license and meaning of each replacement.

## Acceptance gates
- `npm run verify` must pass, including Story Hub seal validation and game suites.
- Browser visual QA at mobile, Chromebook and classroom display; record actual screenshots of first-view and at least one interior interaction.
- Touch/keyboard, reduced-motion, image load, high contrast and historical attribution verified.
- Preserve stable `/hubs/` deep links and existing student work; never use real student credentials in automated testing.
