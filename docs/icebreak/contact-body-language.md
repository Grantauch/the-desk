# ICEBREAK Batch 08 — checks, falls and planted recovery

## Goal
Address the repeated 2-star review concern that hitting an opponent or falling doesn't *look* physical. ICEBREAK uses custom WebGL primitives and a Canvas fallback, so this revision upgrades runtime body language **without replacing the mass-weighted collision solver with baked animation**.

## Gameplay appearance
- **Actual armed check:** the stick and leading shoulder drive through a brief contact swing. A check that fails to touch anyone instead enters an exhausted, backward-leaning whiff recovery. No scripted dash, collision or reach is added.
- **Directional collision reactions:** after genuine check contact, the defender recoils on their facing-local impact side; intensity is proportional to the same physical impact calculation that governs loose pucks, heavy falls and injury stoppages. Unarmed body bumps remain ordinary.
- **Heavy collision:** skater drops and sprawls sideways along the existing impulse-driven slide. The head lowers while the torso and legs rotate; the on-ice downed athlete is marked visibly in WebGL and Canvas.
- **Getting up:** a short planted-rising pose begins *only after the physics-driven fall timer actually expires*, then decays automatically. Facing, velocity, stamina, movement, collision and puck rules remain unchanged.
- **Bracing:** braking naturally produces a brief grounded stance. A faceoff clears transient visual reactions without erasing earned player energy.
- **Readability:** DOWN, GETTING UP, STAGGERED and relevant HUD hints can appear on human and AI players during active contact.

## Safety of physics / performance
- The shared `bodyPose(p)` helper returns bounded presentational values from existing contact and skate states. It does not write to the player object, change RNG, use an animation player, add impulses or modify catch/goal rules.
- Three small visual timers `hitDuration=.32`, `standDuration=.33`, `braceDuration=.20` are render controls, not stun or locomotion timers.
- Minor additional body transforms, gestures and one optional rising ring reuse existing WebGL meshes. The Canvas fallback performs corresponding flat-body transforms and gestures. No external assets or network dependency.
- Existing 90 Hz fixed-step simulation, skate feel, eight input seats, two modes and School/Park/Mars physical parity preserved.

## Verification (TheAtlas, November 22, 2026)
- **9 new Node source tests** in `tests/icebreak/contact-visual.cjs`: pure pose, windup/whiff, impact severity, direction-relative contact, unarmed bumps, falling/rising, bracing, faceoff cleanup, render-state immutability.
- Existing source test suite, inclusive: **57/57 passed** on the current gameplay candidate.
- Chromium `tests/icebreak/contact-visual-browser.cjs` tests a real heavy contact through falling and rising. It checks markers, physical pose state and zero page errors in **four configurations**: desktop/mobile × WebGL/Canvas. It now also verifies that the GPU actually paints sufficiently contrasting ice and boards (blank or context-lost WebGL frames fail rather than silently pass).
- Screenshots are generated locally under `browser-results/icebreak/body-check-*.png` for visual review. A nearly white WebGL screenshot was observed in an initial run; direct follow-up render diagnostics showed no lost context/GL error and repeat screenshots rendered correctly. The added framebuffer-contrast gate protects against silent blank output. Do not claim this explains the transient capture definitively.
- Full browser release sequence (original smoke, one-timer/first-touch, goalie, give-and-go and contact-visual) **20/20 Chromium scenarios PASS**, process exit code 0, on final gameplay candidate commit `75e646f` (Nov 22, 2026). Includes desktop 1440×900 and emulated mobile 390×844, WebGL and Canvas, zero page errors.
- Browser captures were manually inspected after this final geometry pass: the rink, impacted players and rising markers rendered in WebGL desktop and Canvas mobile. The initial blank image was not reproduced after diagnostic review; the new WebGL framebuffer contrast gate passed.

## Blender decision
Blender animation is still separately tracked under Team Desk #97. ICEBREAK is currently rendered as procedural WebGL geometry with a Canvas fallback, not a glTF runtime. A Blender skate/check/fall/get-up rig is valuable **after** an animation importer, pose mapping, frame budgets and fallback strategy are established. Importing models immediately would increase risk without fixing the mass-based gameplay or first-contact animation by itself.

## Release constraints
- This is a **draft stacked on Batch 07 PR #494**, which follows #490 → #486 → #482 → #478 → #477 → #473.
- Do not merge or publish ahead of the dependency stack. Need hosted checks, integrated site build, human two-player gameplay, real controllers and real touch devices before a classroom/live-ready claim. Vercel may report build-rate-limit failures that are not code-test results.
- The public ICEBREAK beta remains unchanged.
