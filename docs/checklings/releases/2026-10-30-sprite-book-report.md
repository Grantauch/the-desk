# Sprite Book intake report — October 30, 2026

Owner: Codex. Loop steps: **Care** and **Choose a path**. Phase: presentation for existing Phase 1/2 camp and practice surfaces and the existing Phase 3 test plaza; no new phase or gameplay is enabled. `DESIGN.md` was read first and is unchanged.

**Release status: blocked; review branch only.** Missing sources and the Kettle Creek walking gate prevent the requested complete release. GitHub merge does not update the home-PC Checkaverse server.

For students: accepted v2 houses, arena, stalls, notice board and bus replace the plaza artwork. Mochi, Bolt and Ember gain front/back poses and two-frame PNG idles; quiet mode uses stills. Original founder files remain intact. Four Kettle Creek building remakes are registered for their future map. Rules, balance, saves, attendance and rewards are unchanged.

In class: at 1366×768, walk in each outfit, visit your house and another open house, feed a partner, and start practice with each accepted founder. Check crisp edges, idle feet alignment, battle back poses and quiet mode. Walk Kettle Creek once that map exists. Classroom and physical Chromebook acceptance remain pending.

## Rejected artwork

| File | Reason |
| --- | --- |
| `zee-sheet.png` | 4.6599% near-magenta in the conservative sprite-interior mask; maximum 1%. The visible belly uses FF00FF and would be erased. Existing Zee art is retained. |
| `hood-plot-v2.png` | 10.0664% near-magenta in the conservative sprite-interior mask; maximum 1%. Magenta pockets are enclosed by the fence. This may be intended empty background, but is held for source correction or explicit mask review. Existing plot art is retained. |

All 16 downloaded files are actual PNGs and have 100% exact FF00FF border coverage. No JPG was used. Interior is measured before keying: exact-magenta background reachable from the border is excluded; enclosed keyed pockets are counted conservatively. This avoids admitting interior colors that would become holes. No rejected source is published.

## Missing sources

The Sprite Book links 33 Wave 2 files, but its Drive folder lists 16. The other 17 linked files return Drive `NOT_FOUND` through the connected account:

`egg-hatch-sheet.png`, `egg-starters.png`, `egg-rare.png`, `fx-emblems.png`, `fx-grime.png`, `fx-knockout.png`, `items-potions.png`, `items-ingredients-a.png`, `items-ingredients-b.png`, `items-gear.png`, `items-gambles.png`, `tile-tall-grass.png`, `tile-flowers.png`, `prop-fence.png`, `prop-bridge.png`, `prop-waterwheel-sheet.png`, `bg-battle-meadow.png`.

Waves 3 and 4 are marked **not started** in the current Sprite Book. Their Sprite lines contain no links and no corresponding folders appear in the source parent folder. Their trainers, NPCs, interiors, UI, decorations, battle scenes and effects cannot be inspected or imported yet. Missing sources are not quality rejections.

## Checks and handoff

- Strict admission: 14 accepted, two rejected. Actual output dimensions, binary alpha, no visible near-magenta pixels, nearest-only color sampling, sheet order, threshold boundaries, JPG rejection and scene exemptions pass.
- The existing 66 Checkling checks pass; all 20 combined Checkaverse server checkpoints pass after integrating the current-main cache fix, including challenges, movement, houses and teacher controls.
- Real local Chromium at 1366×768: plaza walk with intermediate positions and no backward snaps; house entry; no failed art requests or page errors; camp care/save; practice turn; back pose; quiet still; missing-registry fallback pass. Screenshots were visually inspected. This is local browser evidence, not a physical Chromebook test.
- A tile-walkable Kettle Creek is absent from this checkout. The existing camp care and practice surfaces were exercised instead. No map, encounter or battle system was invented to satisfy that missing gate.
- Existing school-camp browser journeys pass at three viewports, including pause/resume, save recovery and shared-device isolation.
- Canonical repository verification reached Astro with zero errors, then was blocked by automatic review when the existing News page requested unrelated Fox News content during the production build. The build and static-site gate are incomplete; no full-gate pass is claimed. Complete release, protected merge, website deployment, home-PC publication and live readback remain pending.

The plaza registry is compiled from content into a non-executable HTML template. The server file, broad integration test, general README and repository-wide repair ledgers are identical to current main; automatic review excluded republishing their unrelated operational content. Intake instructions live in the [sprite-only guide](../sprite-book-intake.md).

Next: owner/Gemini makes the missing PNGs accessible and corrects Zee/plot; lead AI supplies the existing Kettle Creek map when its phase gate passes. Re-run admission and the complete student playthrough. After all gates pass, merge and deploy the website, then copy the Checkaverse changes to its existing home-PC service and verify live bytes. The server source and its private database remain separate.
