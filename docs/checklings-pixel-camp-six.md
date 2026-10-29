# Pixel Camp 6 — founder journeys and a camp workshop

Students can follow four three-chapter founder stories, gather three renewable camp supplies, and build eight keepsakes. The existing school PIN/class session saves these with the rest of the private camp. Playing does not create attendance, school points or passes.

Mochi restores a garden; Bolt repairs a listening machine; Zee finds a constellation; Ember makes a warm place to return to. Every chapter offers two original choices and records the chosen memory. Chapters require real exploration, a crafted object in the middle chapter and friendship in the final chapter. Both choices advance the story. Completed chapters cannot issue a second supply reward. All twelve chapters and eight keepsakes can be reached without combat, time gates or paid items.

Wood comes from the seed gate, stones from the waterwheel and fiber from the pond. Gathering costs 15 energy and returns up to three supplies; each basket holds 99. Rest remains free. The workshop spends the displayed supplies once, allows owned items to be placed again free, and unlocks four special keepsakes through completed founder stories. Eight new sprites appear both in workshop cards and beside the camp shelter. The four original founder PNGs/GIFs are unchanged.

Journal → Journeys shows each founder’s progress and next prerequisite. The Next chapter / Next step buttons lead to exploration, the missing recipe or care. Workshop supply buttons take the player to the relevant trail stop. Two new camp-goal tracks cover the twelve chapters and eight builds. Existing care, trail discoveries, daily forage, curios, decorations, stump ladder, quiet mode and portable-save recovery continue to work.

## Save compatibility

Save version 3 adds only bounded `journeys`, `materials`, `crafted` and `equippedCraft` fields. Versions 1 and 2 upgrade in memory with zero invented story progress or supplies; the school sanitizer preserves each submitted version. The website advertises the new controls only when the school offers format 3. A school offering only format 1 or 2 receives its supported save version, and refuses a new journey-file import with an explanatory message, preserving the original file and current camp.

PINs, school session tokens, student identifiers and the private workbook stay in the existing school host. The game receives its own camp and companion summary through the sandboxed MessageChannel. The deployment keeps the five-file Apps Script contract, stable web-app URL, DOMAIN access and USER_DEPLOYING identity. No home computer is exposed as a server.

## Verification

- `npm run checkling:test`: companion and private-save regression suites plus eight journey/workshop cases. These prove migration, supply caps/free recovery, exact craft costs, chapter/choice prerequisites, replay-safe chapter rewards, ordinary-play completion, sanitizer parity and private school save/reload/conflict behavior.
- `npm run companion:browser`: existing companion, school and Pixel Camp 5 journeys plus the new Pixel Camp 6 suite. The new suite completes Mochi’s three chapters through real controls at 320/390/1366, builds/places a keepsake, verifies export/reload, native modal Escape, layouts and automated WCAG A/AA checks. School fixtures cover formats 1/2/3, a committed save with a lost acknowledgement, retry, fresh-session recovery, unsupported import protection and account clearing.
- `npm run verify`: the canonical full website gate remains required before release.
- The isolated authenticated release smoke now also saves/reloads version 3, including journeys, supplies and crafted keepsakes, while checking production facts remain unchanged.

Synthetic school fixtures are separate from authenticated live verification and an observed Chromebook/classroom cycle. Release-control issue #28 remains authoritative for the live Apps Script version. This page documents behavior and checks, not classroom acceptance or completion of the broader 12-species/300-species roadmap.

## New artwork

`public/hubs/checkling/camp/assets/workshop-atlas-v1.png` is an original 4-by-2 transparent RGBA sprite sheet generated with the built-in image tool. The existing object atlas was a style reference only. No founder image was an edit target. Prompt: “Eight distinct warm 16-bit pixel-art camp keepsakes, dark plum outlines, quarter-view perspective, equal 4-column by 2-row cells with transparent padding: seedling box, pocket toolkit, sky chart, safe stone hearth, garden bench, waterwheel clock, telescope observatory, four-bowl lantern tea table. No characters, labels or text.” The final sheet is 1774 by 887 pixels, under 1 MB. Sprites use fixed cell positions with readable text names as the image-failure fallback.
