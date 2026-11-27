# Pond C03 — Ink & Water: authored UI identity

**Date:** 2026-11-22
**Base:** `feat/pond-mobile-workbench-c02-20261122` / PR #510 (depends on C01 PR #508)
**Status:** Visual/design batch in a draft branch, not released.

## Intent

Grant wants Pond to feel less AI-made and more like a deliberately designed interactive HTML experience. The current 3-column Field Station already has unusually strong mechanics and live pixel simulation, but its UI has too many identical dark gradient cards, artificial scientific labels (`EST. ∞`, `N · 00`, `SPECIMEN / 01`), and bright, illustrated animal silhouettes misrepresenting abstract procedural results (e.g., a fox-like icon for a non-animal discovery).

**Direction:** *Ink & Water* — a naturalist's worktable. Plain glass-dark Pond canvas at center; warm uncoated paper, restrained clay/brass ink, physical specimen marks, tactile index tabs, and typographic hierarchy around it. Pure HTML/CSS and deliberate small SVG engravings in place of generic/cartoonish assets; no remote images or generated illustration dependencies.

## Changes

- Updated the first-run invitation to a genuine written concept instead of artificial pseudo-scientific branding. Preserve the `Make a mess` entry action and all keyboard interactions.
- Real measurements replace fake gauges: current world/camera sizes, discovery count, inhabitants and paused/running state. The field brand uses a custom `P` lettermark.
- Workbench panels are now distinct warm paper plates against the deep-water simulation, with consistent ink labels, controlled ruled-paper texture, and a physical index/navigation strip. Desktop retains 3 columns, C02 mobile retains 1 active section.
- Material swatches become matte pigment buttons, not glowing glass orbs.
- Replaced rainbow, glowing, cute animal silhouette discovery icons with a small original monochrome specimen-mark system. Six abstract hand-drawn motif families and a 24-bit punched index register represent every procedural identity. **These marks are catalog symbols, not false depictions of the generated discovery.** The stable identity index remains unchanged.
- Kept actual physics, scene presets, crafting logic, creature systems, Atlas, saves, backups, and HTML accessibility controls unchanged.

## Visual quality requirements

- The actual pixel pond remains the visual hero on all viewports; the interface must not bury it under ornaments.
- A new player should be able to identify the water/sand palette and the Discover action without instructions.
- Mobile at 320px/390px must not overflow, hide gameplay, or make the quick-tool tray unusable.
- No faux scientific metrics or impossible claims about 10 million authored species; label the procedural outcome space correctly.
- Accessible focus and 44px interactive targets wherever practical; reduced motion respected; text and meaningful state readable under both Rich and Classic rendering.

## Release quality gates

1. Pond unit suite.
2. TypeScript and Vite build, generated-source and static bundle checksum.
3. Existing C02 browser flow and C03 visual semantic checks at 320x568, 390x844, 1365x900.
4. Screenshot review on every viewport, especially welcome screen, after entry, discovery ledger, palette, and mobile drawer.
5. Remove temporary builder workflow after generated static assets commit on this branch.
6. Independent design/code review and protected full-site CI after dependencies C01/C02 merge.
7. Verify deployed student experience at `https://grant-desk.com/hubs/pond/` against exact approved revision; no status inflation.

## Next decision

Once this identity is reviewed, only **then** tackle larger visual changes like landscape/environment tiles, creature silhouettes in the live world, or real hand-drawn botanical art. Those require their own quality and provenance checks, not arbitrary generated illustrations.
