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
| 3 — Air police and missions | One alternate-history air-police unit at serious heat, route patrols, 3D roof-occluded sightlines, rain/night cone, honest search memory, air courier, map/beam/UI | Hide behind roofs to break air detection; get two ordered high-altitude drops and return to an airfield without disrupting ground jobs | Implemented in draft PR #209; CI/browser checks pending |
| 4 — Visual and audio polish | Scaled 1926 silhouettes, animated rotor/propeller and downwash, police beam, synthesized audio with Doppler, bounded gusts, reduced-motion fallback and adaptive draw detail | Scale and quality regression tests; desktop/phone Playwright; independent Chromebook runtime profiling before release | Implemented in stacked draft PR #210; CI / manual device QA pending |
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

## Batch 3 implementation (stacked PR #209)

A county experimental air-patrol rotorcraft joins serious wanted chases at heat 56 or above. It uses limited visual range and a forward search cone, weakened by rain and darkness. A 3D ray checks rooftop and wall geometry along the sightline before the pilot reports the player's current position to existing police dispatch. If the player disappears beneath a roof or leaves the cone, air police search the last *confirmed* location for a bounded period. They do not receive live player coordinates through the target object when sight is lost, and the existing road-police behavior is preserved. Air operations are suspended while inside a business; only one active law aircraft is allowed.

**Optional air courier run:** Board your own aircraft at the airfield, press **G** or tap **AIR RUN** on mobile. Fly two highlighted drops **in order** at 60–220 game altitude units. Return to any aircraft pad, land, and stop before the timer runs out. Completion pays **$42** and **65 reputation**. Leaving your aircraft, exhausting the timer, or running out of fuel fails the run. This is a standalone, optional air activity that does not replace the existing road-game contract board or take away its rewards.

Air police only activate at higher wanted levels. This is explicitly alternate-history policing for a 1926-themed game, not an assertion that 1926 county police used helicopter fleets. B3's scope intentionally excludes aerial firefights, damage/destruction of law aircraft, and synchronizing jobs with the future 0.6 resident AI.

The code is **draft-only**: B1 #206 → B2 #208 → B3 #209 is the intended merge order following a rebase on the stabilized 0.6 map. No branch state alone is evidence of an accessible production deployment.

## Batch 4 — visual/audio and scale (stacked PR #210)

### Grounded world-scale audit

The existing ground-car art defines cars as approximately 48–61 world units long. Aircraft use the SAME world coordinate system: rotorcraft 96 units (1.92 standard sedans), Jenny biplane 110 (2.20 sedans), balloon envelope 98 (1.96 sedans). Shadows respond to altitude but the entire airframe no longer keeps growing with height. The collision and spawn logic uses the updated span values.

These are **internal gameplay proportions**, not accurate historical engineering dimensions. Building sizes and the 0.6 resident/car variety need a whole-world proportionality review at integration. Batch 4 does not resize other agents' buildings or road vehicles.

**Confirmed integration blocker:** Existing procedural house footprints in game.js are only 26–38 world units across (the house generator uses widths/heights 24, 26, 30, 32, 38), while a sedan is 50 world units long. Thus a car can appear longer than a whole house, and even the adjusted airframes may look too large near residential blocks. The 0.6 town-simulation branch must address house/building scale, road width, occupant size, and both ground and air collision footprints TOGETHER before merging this flight chain. No unreviewed resizing here.

### Render detail and Chromebook budget

- Full quality 2: dual-blur rotor, four small downwash arcs when low, biplane weather streaks, balloon envelope, air police search beam and ground sighting ring.
- Adaptive quality 0–1: low-draw-call proportional silhouettes, no animated downwash or complex beam.
- Reduced-motion preference: static rotor/prop, no downwash or blinking lights; the visual preference does not alter collision, pilot physics or police visibility logic.
- The existing off-screen culling, FPS averaging and lighting quality system also control aircraft effects. A dedicated real school Chromebook frame-time profile is STILL REQUIRED before declaring smooth 60 fps on that hardware.

### Audio and weather

The separate air-audio.js component uses only two persistent synthesized Web Audio voices. It uses existing game sound unlock, mute and pause behavior, distance attenuation for law aircraft, and limited Doppler-like pitch changes. No samples or per-frame oscillator allocation.

Bounded gust turbulence changes in-air handling during rainy, windy weather, without unbounded acceleration or random position teleports. Flight collision and speed caps still apply.

### Regression found and repaired

B3's Playwright test detected a hidden AIR RUN control on phones. B4 changes the HUD visibility selector to reveal the courier launch alongside ascend/descend after boarding. The B3 browser test remains in the suite.

### Acceptance limits

B4 tests check proportional scale, low-detail operation reduction, reduced-motion effect suppression, deterministic weather, audio allocation/mute/distance behavior, full Dry County regression, and real-browser desktop/phone/landscape flows. Audio listening and frame timing on an actual Chromebook remain human-device QA gates. Keep PR #210 draft until Batch 5 reconciles Work's 0.6 world branch and confirms the live deployment.
