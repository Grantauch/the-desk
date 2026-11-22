# ICEBREAK Batch 06 — goalie anticipation, saves, and rebound reads

## Goal
Turn goalie stops from automatic contacts into understandable hockey moments, preserving 90 Hz physics and ensuring every save produces a readable, physically bounded outcome. This batch stacks on Batch 05 (PR #486).

## Implementation
- Goalies predict the lateral arrival of a *genuinely incoming* loose puck using time to their goal line, capped at 0.75 seconds. Shots moving away from goal and held pucks do not trigger speculative pursuit.
- Prediction changes the skating target, **not the goalie position**; all movement continues through the shared steer/skate simulation with the existing speed and acceleration limits.
- Swept puck/goalie contacts still decide saves. Rebounds now point back toward center ice, with lateral angle taken from the real collision offset.
- Outgoing rebound speed is 76% of incident puck speed, never adding speed to a slow puck. Save geometry stays inside existing puck/goal contact rules.
- Keepers record pad/glove reactions, brief body/hand motion in WebGL and Canvas, SAVE status and a large-save prompt/arcade sound. Visual pose resets at faceoff; match save totals survive faceoffs.
- No new modes, powerups, controls, altered arena physics or persistent data.

## Automated evidence
- New `tests/icebreak/goalie.cjs`: prediction without teleportation, no slow-puck speed gain, directional glove/pad rebound plus pose reset, no false anticipation of outgoing pucks.
- Existing physics, checking, dribbling, goal, one-timer, and equal-rink trajectories remain in the same release suite.
- Initial TheAtlas isolated checkout: **41/41 source tests pass**, 0 failed. TheAtlas Chromium 143 / Playwright 1.57: dedicated `tests/icebreak/goalie-browser.cjs` **4/4 PASS** — WebGL 1440×900 and 390×844; Canvas fallback 1440×900 and 390×844; 0 JavaScript page errors. Screenshots written to `browser-results/icebreak`. The combined existing browser suite is a separate required gate.

## Art pipeline / Blender
Skater and goalie rig work is independently tracked as Team Desk #97. ICEBREAK currently draws skaters using procedural WebGL primitives plus a Canvas fallback. Do not import Blender GLBs to production until there is an appropriate runtime loader, animation rig validation, reasonable browser performance and Canvas parity. Small pose-state polish in this batch provides immediate visible feedback without adding a fragile loader.

## Remaining release gates
- Full Chromium browser suite and screenshot inspection; hardware controller/touch and actual two-player testing.
- Protected CI and complete site build/check after integration.
- Upstream stack order: PR #473 → #477 → #478 → #482 → #486 → this batch.
- Public beta remains unchanged until release is tested and explicitly merged.
