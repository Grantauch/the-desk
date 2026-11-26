# Pond C02 — focused mobile workbench
Date: 2026-11-22
Base: Pond C01 PR #508, stacked until C01 is approved and merged.
Status: draft; **not deployed**.

## Problem
The C01 route connected five existing Pond activities, but the narrow-screen Field Station still placed every tool collection and the long Discovery Lab in a single vertical document. A child could jump between them, yet the interface did not feel like one workspace. The pond should remain the hero, while the player actively selects the tool station needed.

## Behavior
- Preserve the mobile dish and the C01 route.
- On widths up to 800 px, present **only the selected workbench section** immediately after the pond: Field Kit, Discovery Lab, World Controls, Atlas, or Archive.
- Route buttons select the appropriate section; Populate selects the Discovery Lab or focuses the living dish if a specimen is already armed.
- Explore chooses World Controls on the starter 192-cell world and the Atlas when territory expands.
- Within the Explore system, World Controls and Atlas have reciprocal buttons so growth, camera panning and map navigation remain accessible without visiting another page.
- The existing fixed quick-material dock stays usable; its All Tools action selects and focuses the Field Kit even if the Archive was open.
- Show a legible active-workbench header; all sections stay mounted, so the user's in-progress mix, search, world, residents and history are not discarded.
- Desktop retains the present three-column observatory, both side rails and all its controls. The game engine and save formats are unchanged.

## Accessibility and device contracts
- Real HTML buttons, proper accessible labels, actual focus targets, and no inert/doubled controls.
- Opening a station moves focus to its actual panel after React has rendered the selected state; never scroll to a hidden panel.
- Hidden mobile panels are excluded from keyboard and accessibility traversal using CSS display:none. Desktop panels remain visible.
- Reduced-motion preferences control auto-scroll and transition behavior.
- 320 x 568 and 390 x 844 phone flows plus 1365 x 900 desktop flow exercised in Playwright.
- Touch painting, mixing, placement, undo, Rich/Classic graphics, six-stage world growth, Atlas, camera pan/zoom, autosave and export must remain functional.
- Existing local save keys and V1/V2 world decoders must remain compatible.

## Release gates
1. Pond 39+ unit tests.
2. Strict TypeScript, Vite production build, published output SHA validation.
3. New and existing Pond browser interaction cases on three viewports.
4. Remove temporary isolated author-build workflow after compiled assets are committed.
5. Wait for Pond C01 PR #508: independent approval, protected CI and merge.
6. Rebase C02 onto current main after C01 merge and require protected full-site verification.
7. Public `https://grant-desk.com/hubs/pond/` interactive verification after the actual published bundle is released. Production status cannot be inferred from PR tests.

## Next product priorities after C02
- Join discovery identity, specimen placement and live creature inspection without duplicating the same data in separate places.
- Contextual ecological observation details drawn from actual simulation signals.
- Clarify save/backup semantics and performance on low-powered Chromebooks.
