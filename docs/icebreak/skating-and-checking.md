# ICEBREAK skating and checking

Draft PR [#455](https://github.com/Grantauch/the-desk/pull/455). Play by opening the standalone HTML in a browser. Skate with WASD and use Shift to burst. Press L just before contact. The second keyboard uses arrows, Enter and comma. Touch uses the D-pad, Burst and Check. Gamepads use the left stick, RT and B.

## How it works

The 90 Hz simulation carries velocity independently of facing. Acceleration is 34 world units per second squared, max skating speed is 10.2 units per second, and burst speed is 13. Turning slows as speed builds. Edges remove sideways velocity at a rate of 5.2 per second at full input. Releasing movement glides with a drag rate of 0.55 per second. Opposing input applies a brake of 42 units per second squared and braces the skater. In the controlled tests a fresh skater reached 10.16 units per second after one second, retained 76% speed over half a second of coasting and crossed zero in about 0.26 seconds when reversing from that glide.

Check arms a 0.29-second contact window. The skater commits to their glide during that window. A valid impact requires an opposing skater within body contact, a forward angle, and actual closing movement. Contact exchanges equal and opposite normal impulses with a restitution of 0.12 and relative role masses of 1.00 / 0.90 / 1.16 / 1.35. Impact severity comes from reduced mass and squared closing speed, scaled by angle, attacker effort, and defender bracing. The severity cutoffs of 1.4, 9, 25 and 37 distinguish puck wobble, dislodging, stagger and injury. These are arcade tuning values, not a physical injury model. Goalie and friendly contact remain ordinary collisions.

Each attempt spends 17% to 38% of full stamina depending on approach speed. The cooldown is 0.76 seconds and regeneration waits 0.72 seconds after an attempt. Below 62% stamina, acceleration and top speed begin to fall. Under 12%, Check is unavailable. Recovery is 15 percentage points per second while neither bursting nor inside the recovery delay. AI uses the same system to check an opposing carrier when closing from in front.

Heavy checks now also cause a physics-driven knockdown rather than only a stagger: impact severity controls a 0.52–0.82-second fall and recovery, additional 5–16 percentage points of energy loss, and a sliding state with drag of 1.9 per second instead of the upright coast drag of 0.55. The equal-and-opposite impact impulse remains authoritative; visual fall direction is calculated from impact direction. Both WebGL and Canvas show the skater topple and recover, and faceoffs clear the down state. Knockdown severity is an arcade tuning parameter, not a medical injury estimate.

The largest hit freezes the game clock and stops play for five seconds. The timeout can be skipped using the button, Enter, Space or an assigned controller’s A button. The injured skater returns in the same seat for the next faceoff. Stamina and check cooldown carry across the stoppage.

## Verification

- Run node tests with `node --test tests/icebreak/*.cjs`.
- Run Chromium playtests with `node tests/icebreak/browser.cjs` after installing the repository's Playwright browser. Screenshots and a renderer report go to `browser-results/icebreak` by default.
- The focused suite additionally checks knockdown momentum, increased pad friction, defender fatigue, and recovery (18 checks total). It checks impulse and momentum, missed and repeated check costs, natural burst-to-check reach in all three rinks, hit outcomes, injury countdown and skip paths, skating, puck attachment and release, both goal directions, the mode/rink matrix, and eight unique assignments. Chromium checks cover 1440×900 desktop and 390×844 emulated touch in WebGL 2 via SwiftShader and forced Canvas 2D.
- Physical phones, gamepads, hardware GPU performance and long-session hit balance still need playtesting. Online multiplayer is unimplemented.

## November 22 refinement

The knockdown and recovery implementation is committed to the unmerged feature branch (commits `73e30549` and `8c443840`). All 18 focused tests were executed successfully against the current browser script in an isolated JavaScript harness with mocked DOM and Canvas. This is not a substitute for running the repository's Node test runner, Chromium/WebGL screenshot QA, physical controllers, or real playtesting against another person; those remain release gates for this refinement.
