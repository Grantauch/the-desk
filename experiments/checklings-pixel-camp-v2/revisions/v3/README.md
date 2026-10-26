# Checklings — Pixel Camp v3

This is the visual rebuild requested after First Trail v1: the four founders define the art direction. Their original eight PNG/GIF files are preserved byte-for-byte. The surrounding game uses newly generated raster sprite art rather than the editorial landing page, vector habitat and CSS dummy of the prior version.

## Play

The delivered package has a complete **START-CHECKLINGS.html** beside its START-HERE guide. Open that file in Edge or Chrome. All art, founder animations and the pixel font are embedded; no installation or network connection is required. This source folder's index.html is the editable equivalent with neighboring assets.

Camp opens immediately. Select a party member, then Feed, Play, Brush, Rest or Hang out. Trail has three stops, each with a real landmark sprite; each founder's discovery action differs. Camp decorations live in the inventory-style Decorate menu. Practice uses a four-pose wooden stump opponent, visible next moves and the existing nonlethal rules. Short command labels map to the established signatures: Cozy/Comfort blanket, Scrap/Salvage charge, Orbit, Burst/Banked heat.

## Saves

The sample format and `checklings.first-trail.v1` namespace remain compatible with v1. If a different file location/browser exposes a separate local save area, export from v1 and import through Menu. Load previews before confirmation and keeps a safety copy. A later file selection invalidates any earlier pending read. Quiet/system reduced motion uses original founder stills and skips transient pose animation. No care drains with time.

This remains an isolated local sample. It does not connect real school companions, official rewards, login or shared server saves. The practice stump is a prop, not a new collectible species.

## Art

- Original founders: Mochi, Bolt, Zee, Ember; original source records Grant's supplied Grok export. No original prompts were found, and no claim is made that the new pipeline is the original one.
- New art: built-in image generation using all four original PNGs as style references. Five production assets: pixel camp, four-pose stump sheet, twelve-item atlas, three-landmark sheet, and window skin. The three sheets were regenerated with wider gutters after visible silhouettes crossed initial cell boundaries.
- Final atlas grids: objects4x3 at362px cells; landmarks3x1 at724px cells; stump4x1 at543x724px cells. Numeric visible-alpha bounds verify that no visible silhouette touches a cell edge. CSS selects cells; the original raster files are not painted over with code.
- VT323 font: official Google Fonts source; full license included in assets/FONT-LICENSE.txt.

See ART-DIRECTION-AND-PROMPTS.md for reusable prompt briefs and the final file mapping.

## Checks

The final source passed21 native gameplay tests,16 DOM-emulated interface tests,2 save-read ordering regressions and1 offline-bundle boot test:40 total. DOM checks exercise actual authored handlers and can finish practice with all four founders; they do not render the screen or verify real browser layout, font painting, actual downloads, device performance or accessibility. Fresh rendered desktop/mobile checks remain pending. Prior v1 browser results must not be reported as v2 results.

The embedded-browser local-file URL was rejected during prior preview work. That boundary was respected; this pass used source, image inspection and DOM emulation, rather than a different browser/server/renderer to evade the block. Grant can manually open the delivered file and judge the actual new screen.

## Development

Native gameplay tests have no dependencies:

```
node --test engine.test.cjs
```

The interface tests use test-only jsdom30.1.3. Install this folder's dev dependency, then:

```
npm test
node build.cjs NEW-OFFLINE.html
```

Set `PIXEL_STANDALONE` to that output file and run `npm run test:bundle` for the compiled DOM boot check. The builder refuses to overwrite an output. The game runtime itself has no npm dependencies. New art file validation and package integrity results are supplied with the release.

No merge, production deployment, real school record, Chromebook acceptance or independent source review is implied by this local playtest.

## v3 refinement

Only the selected-button fill changes from #b67d36 to #785020. Selected navigation, party and route labels retain the pixel palette with stronger text contrast. The original v2 folder is preserved. All gameplay, original founder files, five new sprite/environment assets and font remain byte-identical to v2. Static color calculations are not a rendered accessibility audit.
