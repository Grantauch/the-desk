# ICEBREAK — Online checking and injury parity

This is a **headless, DOM-free checking reference**, not a deployed multiplayer server. Its purpose is to stop the upcoming eight-human online match engine from silently replacing ICEBREAK's actual physics-driven checking and knockdown rules with simplified prototype behavior.

**Source of truth:** the integrated ICEBREAK game under `public/hubs/icebreak.html` on the source branch for PR #557 (browser blob `b83e673bad60ee22f58703355077ef8ea53696f1`).

## What this adds

The Node-importable `contact.mjs` builds on `../icebreak-parity/headless.mjs` and mirrors the browser's:

- Check eligibility, arm window, energy cost and balance-dependent leverage.
- Missed-check recovery, edge-balance penalty and active contact recovery.
- Directional check gating, relative closing velocity, role masses and equal-and-opposite contact impulse.
- Impact thresholds for glancing/wobble, possession loss, knockdown/slide, and injury-timeout trigger.
- Puck release from the stick blade with existing recatch lock, defensive bracing and off-balance vulnerability.
- 5-second skippable **injury trigger state** (the larger game loop must still own clock-freeze, counting down the timeout, faceoff, and restoring roles).

No screen rendering, audio, player-stat tracking, UI callbacks or server WebSockets are invoked. The reducer only modifies provided skater and puck state. This is a **reference for the future server owner**, not a complete authoritative match loop.

## Run

```sh
node --test prototypes/icebreak-contact-parity/verification.test.mjs
```

The differential test loads the integrated browser game through its existing VM fixture and compares simulated server contact with genuine browser results across glancing, loose puck, injury, back-angle, braced, exhausted, off-balance, mass/role, simultaneous-check and no-contact cases. It also compares check-window expiration and whiff recovery at 90 Hz. The existing standalone headless parity suite still covers skating, puck sweeps and goal-line scoring.

The isolated GitHub Actions workflow runs this test without modifying the production ICEBREAK game or production service. The contract deliberately fails if `SKATE`, `CHECK`, `CONTACT`, role masses or stick-release constants drift away from the integrated source.

## Still required for eight-player online

This patch **does not** make ICEBREAK online. Codex's owned server task #159 must connect full headless gameplay to authoritative rooms and collision tick order; the online clients #160 must consume those shared snapshots on both domains; TLS/server #161 still needs approval and deployment. The server must own puck possession, goals, both goalies, injury timer/facesoffs, powerups, all eight human seat assignments and safe reconnect.

Before any live multiplayer claim, execute real multi-origin/browser tests against the actual server, confirm rollback and reconnect, and test on physical phones/computers on a real network. Local eight-controller tests are not an online substitute.

This branch is review-only and must not be merged on the strength of the domain-level parity tests alone.
