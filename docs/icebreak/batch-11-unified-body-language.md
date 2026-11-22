# ICEBREAK — Batch 11: unified physical contact and animation

## Scope and ancestry

This branch is based on **Batch 10 / PR #507**, which is stacked on successful gameplay QA PR #501 and integration PR #497. It selectively incorporates and reconciles the **procedural body language from sibling PR #504** rather than merging that branch's older game file over the newer contact/AI/puck code. Older PR #492 is also a sibling; its impulse-aligned contact feedback already lives in #497 and is not applied again here.

**Do not merge PRs #492 and #504 independently after this integration without resolving their overlap.** Keep the final branch draft until required checks and human approval. No files in this batch update the production site.

## Single-source physical collision and layered presentation

A player's momentum, mass-weighted collision impulse, edge balance, check commitment, stamina, knockdown slide, puck ownership and frozen five-second injury stoppage stay driven by the preexisting physics solver. None of the new poses changes a velocity, collision normal, score or puck result.

- **Contact recoil** remains sourced from `registerImpact` / `impactPose`, already scaled by actual impact energy and normal. It is used **once** for the WebGL torso/head and the Canvas body transform. The existing hit-tier ring and synthesized sound are preserved, not duplicated.
- **Gesture layer** is a pure `bodyPose` read. An armed check has a brief windup and stick/leading-shoulder follow-through; a whiff gets a separate backward-leaning recovery; a braced stop bends the knees; a physically fallen skater stays down until the simulation says recovery begins. A short planted get-up runs only after `fallTime` reaches zero.
- `impactDir` and `impactLevel` derive from the real contact normal and energy. They add only small limb gestures and a side indicator to the existing directional torso recoil; they do not add a second torso impulse.
- The game HUD and on-ice markers distinguish DOWN, GETTING UP, STAGGERED, and checking commitment. AI players get the same contact/recovery markers so skaters don't seem to vanish while down.
- Both WebGL and the Canvas fallback use the same pose fields and 90 Hz decay timers. The impact-derived falling direction is shared.
- **Reduced-motion support:** the fallen state and important status labels remain readable; new decorative rings are removed and nonessential swing/whiff/hit/stand/brace gesture amplitudes are reduced to one-quarter, in addition to the existing collision recoil reduction.

## Tests and evidence

- Source suites from Batch 09 **plus the nine tests from PR #504** are registered under `npm run icebreak:test`. The test-manifest guard automatically verifies that no source regression is omitted. The same nine new tests passed in an isolated JavaScript harness along with the 66 previously inherited tests (**75/75 source cases before counting the two manifest checks**).
- The existing `contact-browser.cjs` test now also asserts reduced-motion scaling of body gestures across its 8 renderer / viewport / preference combinations.
- The sibling `contact-visual-browser.cjs` is registered under `npm run icebreak:browser` and tests genuine check, fall, planted rise, markers and GPU framebuffer contrast for WebGL/Canvas × desktop/mobile. It produces machine-readable Chromium evidence and PNGs.
- The native Node suite is expected to contain **77 cases** (75 gameplay + 2 manifest checks) once the host runs it. Do not report it as passing until the GitHub Actions workflow returns success. Real hardware, two-player feel and visual QA are separate gates.

## Release / integration gate

1. Run and review the dedicated ICEBREAK GitHub Actions Node + Chromium workflow on the exact PR head; inspect key PNGs from the uploaded artifact.
2. Run the full-site release verification after PR #507's one-line test-inventory repair. The full-site verification is unrelated to physics and must independently be green before a release.
3. Preserve the stacked dependency order from PR #473 through #507; resolve siblings #492 and #504 as superseded or surgically reconciled, not merged blindly.
4. Test physical keyboard + real gamepads, touch on an actual phone, and two-player checks, passes, injured stoppages and goalie play before public release.

**Status:** implementation in draft. Not merged or published.
