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
| 2 — Ground-world bridge | Three open-ground pads, on-foot E boarding/exiting, mobile/keyboard controls, existing save integration, altitude-aware rooftop collision sweeps, indoor suspension | Find pad, enter craft, lift, land, exit and resume car; midair reload parks at last safe location; no duplicates | Implemented in draft PR #208; checks in progress |
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

## Batch 2 implementation (stacked PR #208)

Aircraft are present in **the game world**, not just in the separate lab. Airfields sit in cleared western lots. On foot approach a craft and press **E** to board. **W/S** throttle, **A/D** turn, **Shift** climbs and **C** descends. Touch controls expose CLIMB and DESCEND when seated. **E** only exits a grounded, slow aircraft with free space beside it. Open **M** for airfield markers.

`air-bridge.js` provides three stable craft IDs and pads, terrain/roof swept collision, restoration and save sanitization. Flight is separate from the car tire model. A plane saved midair is returned to its last safe ground position when reopening the game rather than respawning airborne inside buildings. Reaching a pad while grounded and stopped refuels and repairs slowly during this prototype stage.

This batch deliberately does **not** grant wanted-system helicopter pursuit, aerial missions, destruction/crash cutscenes or aircraft purchases. The rotorcraft remains alternate-history technology; historical aircraft labels are maintained. Integration remains **draft/preview-only**, not a release claim. Work 0.6 code is excluded until rebase and conflict review.
