# ICEBREAK — Batch 07: Checking Collision Feedback

**Status:** Draft implementation stacked on Batch 06, PR #490. Collision presentation only; this batch does not retune impact thresholds, force, momentum, or injury probability.

## Goal

Give a glancing check, a clean puck-disconnecting hit, and a major knockdown clearly different audiovisual weight. The motion must come from the collision normal and impact energy computed by the existing physics solver—not a teleport, target-seeking dash, animation-driven velocity, or arbitrary jitter.

## Implemented

- **Impulse-derived contact recoil:** `checkOutcome` registers transient reactions on both players, using the actual contact normal and the same impact energy that decides wobble, loose puck, knockdown and injury. The receiving skater gets the larger jolt; the checker also visibly absorbs contact. The reaction is render-only; no velocities, coordinates, puck ownership, collision masses, or check costs are modified by animation.
- **Four readable presentation levels:** tiny glancing reaction, solid red-tinted response, heavy golden response, and maximum-severity injury contact. A short expanding ring is consistent in Canvas 2D and WebGL, with a torso/head lean along the contact impulse and bounded 0.18–0.32-second response. The impact sound adds a low layer for substantial contact; weak contacts have a quieter tap. The new sound honors the existing mute setting.
- **Injury visibility:** the affected skater stays visibly down during the frozen five-second injury timeout and becomes upright again on the skippable faceoff. Stamina and checking cooldown remain unchanged.
- **Accessibility:** `prefers-reduced-motion: reduce` removes new animated impact rings and reduces body-recoil amplitude, while leaving gameplay logic and the essential down pose intact.
- **Cleanup:** transient reaction fields decay at the fixed simulation timestep and reset at faceoff. Unarmed ordinary body contact does not fabricate a check animation.

## Regressions and test evidence

Added `tests/icebreak/contact-feel.cjs` with five tests covering increasing contact tiers and direction, no repeated reactions on the same check, finite recoil envelope/decay, visible injury downtime and clean faceoff, momentum preservation for unarmed contact, and render-only state safety.

**53 of 53 source test functions passed** against the candidate HTML JavaScript in a mocked-DOM JavaScript harness (existing skating, balance, checks, puck sweeps, goalie anticipation, one-timers, goal replay, all rinks/modes and deterministic stress plus five new tests). This is a useful static and simulation gate but **not** native Node, Chromium, or GPU validation.

## Acceptance before merge

- Run repository-native `npm run icebreak:test` and `npm run icebreak:browser` on the exact Batch 07 head.
- Inspect desktop and mobile screenshots for both WebGL and Canvas, including glancing, solid, heavy and injury states, and reduced-motion mode.
- Play with real gamepads, touch and two people to tune reaction intensity, audio fatigue, timing and injury frequency from actual gameplay.
- Keep the stacked pull request as draft until upstream #473 → #477 → #478 → #482 → #486 → #490 is integrated. Do not independently merge or publish the draft.
- A separate Blender skater art/animation task exists and should merge its assets carefully without discarding this impulse-derived state.
