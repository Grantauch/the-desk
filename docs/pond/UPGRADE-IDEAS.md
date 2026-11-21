# Pond upgrade opportunities — discovery backlog

Created November 20, 2026 during the live release audit. **Backlog only: no gameplay upgrades approved or implemented here.** Order is provisional until interactive production QA and student feedback are complete.

## Observations anchored in current implementation

- The field app currently exposes a huge deterministic discovery *identity space* (10,485,760 possibilities), with a much smaller curated recipe set and a maximum of 6,000 locally recorded discoveries. More meaningful discovery progression could matter more than increasing the identity count.
- Creature ecology exists (pollination, pursuit, schooling, grazing and related effects) but has a bounded 80-resident population. Future work should deepen behavior and emergent play without destroying frame rate.
- The Atlas stores a compact 32×32 exploration mask, uses a map mosaic, supports visited places and up to six landmarks. It could become a durable exploratory narrative rather than only a navigation aid.
- Autosave runs periodically and stores worlds in browser localStorage (`grantdesk-pond-world-v1`); discoveries use `pond-discoveries-v2`. Student use across multiple devices and cleared browsers suggests a future opt-in backup/restore experience, but no school PIN or server sync exists in the currently audited release.
- The current world grows to 768×768 and uses a camera viewport at larger sizes. Long-duration large-world performance requires specific profiling before expanding world scale.
- The student Games card was using old 1.x copy; the student-facing catalog refresh belongs to the release-readiness PR, not gameplay feature development.
- Field Kit presents an “18 MATERIALS” label while Wind and Erase are additional tool buttons. This may be correct (18 substances plus tools), but the labeling and affordance should be tested with students for clarity.
- The launch page highlights a very high number of possible discoveries, but the player still needs an intuitive early-game objective and examples for meaningful orientation.

## Ranked candidates (do not start until release sign-off)

| Priority | Opportunity | Actionable candidate scope | Milestones | Verification |
| --- | --- | --- | --- | --- |
| **U01 — likely highest** | **Field expeditions / meaningful discovery progression** | Optional non-graded field objectives tied to observable behaviors: make steam, grow plants, witness a pollination or create a functioning wetland; contextual hints, field notes and discovery categories; never force a linear campaign | Design 12 evidence-based micro-expeditions → implement optional journal and objective detection → add reward-free narrative milestones and accessibility → playtest and iterate | Missions reflect actual simulation events, never incorrectly unlock progress, and preserve existing saves |
| U02 | **Ecology depth** | Food webs, reproduction or lifecycle, habitat preferences, seasonal shifts, visually legible creature behavior. Retain 80-resident performance budget until profiling supports change | Simulation design → deterministic event and balance tests → performance budget → browser QA | Stable 768-world frame rate, no runaway populations, backward-compatible resident saves |
| U03 | **World Atlas as an explorer's record** | Region history, habitat labels, self-placed map markers, discovered-specimen layers and a compact printable/exportable field journal | Design mapping model → add optional V2 metadata → map UI → navigation + save QA | Fog/locations correctly persist on growth, undo and reload |
| U04 | **Visual world fidelity** | Richer water depth/reflection, terrain transitions, subtle weather/lighting, creature idle/locomotion animations. Keep Classic fallback | Screenshot baseline → implement one effect at a time → performance profiles → accessibility/reduced-motion QA | Rich/Classic parity for gameplay, no simulation physics changes |
| U05 | **Student-friendly cross-device save** | Clear local-save explanation, prominent manual backup, clean restore; evaluate opt-in school PIN sync only after privacy/security review | UX copy → export/import friction testing → optional sync architecture review → isolated rollout | No data loss, transparent privacy and classroom account boundaries |
| U06 | **Advanced world generation** | Region presets including wetlands, rivers, volcanic terrain and frozen habitats; map generation seeded and undoable | Seeded generator → terrain template tests → UI previews → Atlas coherence tests | Deterministic maps and no broken initial habitats |
| U07 | **Creature inspection** | Tap any visible organism for a specimen card, observed behaviors, habitat and discovery history | Selection hit-testing → side-panel details → mobile touch QA → accessibility | Works across pan/zoom and does not interfere with painting |
| U08 | **Teacher-mode observation prompts** | Optional non-graded inquiry cards with cause/effect experiments and printable reflections; keep the default Pond accessible as free play | Curriculum mapping → 8 prompts → classroom pilot → iteration | No forced grades/login, scientifically accurate claims |

## Watch list / possible defects (not verified yet)

1. **Copy consistency:** confirm exactly how 18 material count excludes Wind/Erase and whether a clearer “18 substances + tools” label is needed.
2. **Long-term save durability:** test storage quota, private browsing, refreshed devices and world export at 768; avoid assuming localStorage is portable.
3. **Mobile tool reachability:** ensure the six-button dock is always reachable without covering important world controls.
4. **Discovery scale vs meaning:** count curated recipe diversity and real ecological consequences; do not market identity-space count as authored species.
5. **Atlas landmarks:** test six-location limit and behavior near newly exposed edges, particularly with zoom changes.
6. **Performance profile:** benchmark 768×768 simulation with 80 residents, Rich graphics and repeated camera movement on low-power Chromebooks.

## Promotion criteria

An idea can enter a development batch only after P01–P06 release sign-off, a confirmed user problem or improvement objective, a bounded feature scope, relevant tests, save migration review, performance acceptance criteria, and rollback instructions. Do not merge speculative features during production verification.
