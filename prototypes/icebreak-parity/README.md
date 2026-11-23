# ICEBREAK — headless physics parity bridge

Grant's eight-player online requirement means **one authoritative server must decide every skater, puck and goal**, even when eight people connect from separate machines. The browser's existing skating and collision feel should be carried over accurately rather than replaced by arbitrary new acceleration formulas.

This folder is a narrowly scoped **headless extraction and regression contract** from `public/hubs/icebreak.html` as tested in the integrated ICEBREAK branch (source blob `b83e673bad60ee22f58703355077ef8ea53696f1`). It deliberately does not edit the server implementation owned by Codex (#159), the website clients owned by ChatGPT (#160), or production Caddy/TLS owned by Claude (#161).

## What is extracted

`headless.mjs` is importable by Node 22 without a DOM, GPU, Web Audio or browser input:

- Exact `SKATE`, `CHECK`, `CONTACT` and `ROLE_MASS` constants from the integrated game.
- Verbatim `skate`, `steer` and `limitPlayer` functions and a wrapper that integrates one skater in the same order as the game.
- Verbatim `segmentCircleTime` (the swept puck/body collision, rather than endpoint-only overlap) and `goalCrossing` (continuous goal-line event interpolation).
- Passive/non-checking skater collision resolution using the same body radii, role masses, positional separation, restitution and board constraints.

The extraction is **real gameplay math**, not a substitute simplified set of hockey constants. A pass here proves mathematical parity for these extracted functions, not full eight-player online gameplay.

## Verification

`verification.test.mjs` loads the *actual* integrated browser game through `tests/icebreak/fixture.cjs` and exercises both implementations against each other. It checks:

- The extracted function bodies and constants match the integrated HTML source exactly (flags unreviewed drift).
- All eight on-ice roles including goalies have the correct relative masses, speed caps, rink bounds and constants.
- 720 fixed 90 Hz ticks per role across acceleration, burst, coast, hard braking, carving, stamina states and power boosts; velocities, facing, edge balance, skating pose variables and coordinates match each frame.
- Velocity-aware AI target steering for goalie and skater arrival.
- One-frame order of skate → integrate position → rink/crease clamping.
- Mass-weighted passive collisions for multiple skater/goalie role combinations.
- Swept-circle intersections across a puck travelling farther than several player diameters in one tick.
- Goal-line crossing for both teams, high-speed crossing and near-post misses.

Run from repo root with Node 22:

```sh
node --test prototypes/icebreak-parity/verification.test.mjs
```

The standalone GitHub Actions workflow runs on changes to these files or the game physics. No Playwright install is needed for this domain-level regression.

## Scope boundary and next integration

This is a **subset** of the full hockey simulation. It deliberately does not implement the browser's active `checkOutcome`, puck possession/one-timers, goalie save/rebound resolution, tactical AI/give-and-go, powerups, goal replay, injury freeze, or Shift Book. The server owner must port those too and preserve authoritative state and snapshots. The [eight-browser room QA](../icebreak-browser-qa/README.md) tests WebSocket room behavior, not hockey parity.

The online server should consume these exact domain functions or an equivalent independently validated module. Do not re-introduce the prototype's simplistic `accel=20` skating or endpoint-only puck collision as production behavior.

**Public sites remain local-only. No public online mode or production server is deployed by this PR.**
