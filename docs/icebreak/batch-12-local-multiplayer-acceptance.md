# ICEBREAK — Batch 12: local multiplayer input acceptance

**Source branch:** `icebreak/batch-11-unified-body-language` (PR #509). This batch adds automated local-input acceptance, **not** network multiplayer. It does not change the skating/contact solver, the north–south camera, goal-line behavior or scoring.

## Why

The earlier ICEBREAK acceptance suite assigned two keyboard users and tested basic directional movement, but the fully integrated skating/passing/hitting build still needed stronger, explicitly simultaneous multi-device checks. Multiple local controllers must not duplicate an assignment, corrupt another human's direction, leave held inputs stuck when unplugged, or skip physics and injury rules.

## Automated acceptance

### Native source tests — `tests/icebreak/local-multiplayer.cjs`

Eight deterministic checks cover:

1. Concurrent keyboard 1 WASD and keyboard 2 arrow movement with independent position changes, no sideways key bleed, both key states released.
2. Independent shoot keys K/M and checking keys L/comma; no remote shooting of another human's puck.
3. Moving a keyboard to a new seat removes the old assignment and restores an AI to its place.
4. All eight roles assigned to eight distinct simulated gamepad indexes with separate analog axes.
5. Dead zones, diagonal normalization, RT burst, and gamepad disconnect clearing persistent input state and shot charge.
6. Controller A clearing a loose puck as an away goalie (rather than passing), preserving the other human's seat.
7. An actual keyboard-initiated impact causing the five-second injury stoppage, frozen clock, keyboard skip, and resumed seat assignments.
8. Multiple local humans forcing the full-rink camera rather than the solo follow mode.

### Chromium acceptance — `tests/icebreak/local-multiplayer-browser.cjs`

Playwright tests real keyboard events, emulator touch events and virtual Gamepad API samples on **both WebGL and Canvas**, at **desktop 1440×900 and emulated mobile 390×844**. It uses the real lobby selector to add a second keyboard player; moves both simultaneously; holds the two shoot buttons; checks touch continuity; assigns eight simulated controllers; simulates a disconnect; uses a goalie controller to clear the puck; and forces/skips an injury using the real keyboard event. All scenarios write numbered screenshots and JSON into `browser-results/icebreak/` and fail on uncaught browser errors or horizontal page overflow.

Virtual gamepads exercise the game's real `navigator.getGamepads` polling logic. These are **not actual Bluetooth/USB controllers**, so device latency, pairing, analog calibration differences, vibration, and physical button mapping cannot be certified from this run. Browser mobile emulation also does not replace an actual phone's touch experience.

The scripts are explicitly included in `npm run icebreak:test` and `npm run icebreak:browser`. The Batch 09 manifest self-check will prevent either file from being omitted later.

## Still required before publication

- A real two-human shared-rink session with USB/Bluetooth controllers: mixed keyboard/gamepad, goalie and skater, skating/checking timing, puck pickup, aiming, and simultaneous stress.
- Real mobile touch session including UI size, accidental scrolling, device rotation and browser audio restrictions.
- Independent visual judgement of the new body-language assets; do not mistake all-green automated assertions for polished skater art.
- Full-site release verification and responsible review of stacked draft branches. No merge or publication from this batch alone.

The three rink choices and two game modes continue to use identical base skating and collision physics. Local multiplayer is **up to eight seats**, not networked multiplayer.
