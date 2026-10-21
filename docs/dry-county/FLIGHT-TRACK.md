# Dry County — Flight Track (parallel to 0.6)

Owner: Chat-mode flight implementation. **Do not modify or merge Work's 0.6 resident/traffic branches here.**

## Decision: Prohibition-era air fleet

- **Curtiss JN-4-style biplane:** period-appropriate conventional airplane; requires airspeed to climb.
- **Observation balloon:** period-compatible aerial lookout, with wind-dominated travel.
- **County Air Patrol experimental rotorcraft:** deliberately **alternate history**. Helicopter police fleets are not presented as normal historical 1926 law enforcement.
- **Drones:** not included in the historical default. Consider a fictional technology branch only if the game's setting permits it.

All types use one world coordinate system but carry an independent altitude value. They do not replace the road vehicle tire physics.

## Batch ledger

| Batch | Scope | Acceptance gate | Status |
| --- | --- | --- | --- |
| 1 — Flight laboratory | Flight physics, three silhouettes, pilot controls, fuel, AI police pursuit, mobile controls and test hangar | Fly, hover and land in isolated page; police hold last known spot after sight is lost; nine automated tests; no changes to core game.js | Implemented in this PR; CI / browser checks pending |
| 2 — Ground-world bridge | Flight vehicle spawn pads, on-foot boarding/exiting, controls and save rules, flight-aware collisions and roofs, indoor suspension | Walk to launch pad, enter craft, take off, return, land safely and save/reload without duplicating aircraft | Not started |
| 3 — Air police and missions | Patrol routes, altitude-aware vision, searchlights, callout rules, evasion, NPC awareness, optional smuggling missions | Lose line of sight behind buildings; police search last known area rather than home in; jobs stay completable by ground vehicle | Not started |
| 4 — Visual and audio polish | Rotor blur/downwash, exhaust, searchlight cone, scale verification, propellor sound, Doppler, weather turbulence, performance LOD | Clear silhouettes at phone and desktop; no long-frame spikes on target Chromebook profile; reduced-motion fallback | Not started |
| 5 — Production integration | Rebase on stable 0.6, regression checks and release | Full dry-county tests, npm run verify, preview walkthrough and explicit merge/deploy check | Not started |

## Flight lab

Preview route after Netlify builds the PR: `/hubs/dry-county/flight-lab.html`.

Keyboard: W and S thrust, A/D yaw, Shift climb, C descend, P toggle the pursuing patrol. On touch screens use the six labeled control buttons. Each aircraft has its own flight envelope and top-down rendering. The police craft remembers the last *visible* player location instead of cheating through hidden locations.

The page is a research range: it **does not implement terrain/building collisions, boarding, damage, actual gameplay missions or persistent hangar inventory.** None of those are being claimed complete. The ground is lightweight reference geography for flight physics testing, not a replacement for the evolving detailed 0.6 world.

## Files owned by this branch

- `public/hubs/dry-county/flight.js`: browser global `DryFlight` with CommonJS testing adapter
- `public/hubs/dry-county/flight-lab.html`: isolated playable range with touch controls
- `scripts/test-dry-county-flight.cjs`: deterministic physics, pursuit and rendering checks
- `package.json`: adds the flight tests to `npm run dry-county:test`

## Integration boundaries

Use an additive <script> to load flight.js only when ground-world code is ready. Future merges must read current `game.js`, `world.js`, and tests from the destination branch first. Avoid wholesale replacement of the 250 KB game file; make narrow changes to update, render, enter/exit, map, and persistence seams. Never combine another agent's unreviewed world-simulation edits into this branch.

Before promoting to main: confirm CI, human browser input, visual scale, and Netlify deploy status independently. A branch push or a drafted PR alone does not make aircraft live.
