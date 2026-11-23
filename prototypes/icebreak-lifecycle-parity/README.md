# ICEBREAK — Authoritative match lifecycle reference

**Purpose:** preserve the mature ICEBREAK game clock, stoppages, goal celebrations, and faceoff behavior when eight real people connect to one online match. This is an isolated Node-only parity module; it is **not** a complete online server.

## What is included

- Fixed 90 Hz clock contract with validation: the clock advances during gameplay only, not during the 1.35-second opening faceoff delay, pauses, goal replay, or injury timeout.
- Scoring at either end transitions to a 3.25-second goal phase. A duplicate goal callback during replay cannot add another point; play returns to a faceoff afterward.
- Severe checks can trigger a five-second injury stoppage. The server owns skip authorization, freezes player simulation and the clock, then restores the same eight assigned roles and resets their positions.
- The faceoff clears velocity, knockdowns, check windows, combo targets, puck ownership, current one-timer buffers and temporary pose effects **without** restoring expended stamina, check cooldown, controller assignments, player powerups or remaining game time.
- If the game clock is already zero when a goal replay or injury stoppage finishes, the final horn takes priority over another draw.
- A fresh game begins at 2:00 with exactly eight skater objects and a centered puck. The Node module does not read the DOM, access browser storage or use timers.

## Verification

```sh
node --test prototypes/icebreak-lifecycle-parity/verification.test.mjs
```

The tests instrument a **test-only** copy of `public/hubs/icebreak.html` using the existing ICEBREAK VM fixture. They compare the exact 90 Hz phase transitions, goal timers, injury timer, score, final clock and all eight players' faceoff reset fields against the headless implementation. Both goal directions, full five-second timeouts, skip, a near-zero clock, eight role preservation, pause, and invalid tick inputs are covered.

The dedicated GitHub Actions workflow executes the test under Node.js 22 on every change to this module and related game/fixture source.

## Out of scope and integration gates

The browser's visual instant replay history, celebratory animations, sound, Shift Book statistics, room selection and input permission checks are **not** part of this headless lifecycle. Nor does the module implement world simulation, goal-line physics, AI, network serialization, disconnections or anti-cheat; those live in the separate headless skating/checking parity and the server owner's full game loop.

For production, the authoritative ICEBREAK server must integrate the actual world step, route goal and injury events to `beginGoal` and `beginInjury`, and use `advanceLifecycle` exactly once per 90 Hz physics tick. All connected clients must receive the same phase, clock, score and faceoff state. A client's proposed goal, time or score must never be authoritative.

This branch intentionally does not edit `apps/icebreak-server`, `packages/icebreak-core`, the public game, either website, or TLS. Those remain assigned to #159, #160, and #161. Further 8-browser and real-device tests, protected full-site CI, and server deployment approval are needed before any online release claim.
