# ICEBREAK Batch 11 — Control the Whole Shift

## Problem and outcome

ICEBREAK previously contained a dormant `switchPlayer()` function, but nothing called it. In solo play, the player was effectively bound to one fixed skater even when another teammate intercepted the puck or received a pass. This removed a crucial arcade-hockey interaction: selecting the right skater at the right moment.

**Batch 11 activates deliberate solo teammate switching and optional pass-follow on an actual completed pass**. It does not introduce new teams, physics multipliers, game modes, persistent identifiers, player names, cloud saves or additional asset dependencies.

## What the player can do

| Input | In solo play |
| --- | --- |
| Keyboard 1 | Press **Q** to control another eligible skater |
| Keyboard 2 | Press **.** (period) to switch |
| Gamepad | Press **Y**; release before pressing again |
| Phone/touch | Tap **SWITCH SKATER** beneath the existing PASS / SHOOT / CHECK / BURST cluster |
| Pass follow | Enabled by default; after **your pass is received by its intended teammate**, control transfers to that teammate |
| Pass-follow setting | Expand **HOW TO PLAY** in the pregame menu to disable or re-enable automatic pass following |

The current skater may not switch while carrying the puck; pass or shoot first. Manual switching chooses a same-team, non-goalie, available AI skater, prioritizing an existing puck carrier and otherwise the nearest eligible teammate to the puck. A staggered, fallen or otherwise player-controlled teammate cannot be taken over. Switching neither teleports a skater nor imparts force to the puck.

**Faceoffs:** The selected skater stays selected across goals and faceoffs. **New match:** Original user-assigned positions from the setup roster are restored. **Paused, finished and injury-stopped play:** Switching is disallowed.

**Two or more human seats:** Switching is disabled; all eight role assignments stay fixed and there is never a silent reassignment of a second person's input. **Human goalie:** Remains a goalie; no skater switch. All-AI exhibition has no switch input.

## Control and physics invariants

- The same human device input is transferred; no new input device or second human is created.
- Existing body coordinates, heading, momentum, puck position, stamina, checking cooldowns and actual scoring collisions remain unchanged. AI-controlled teammates continue under the shared fixed-step engine.
- Held directional input and burst survive transfer, so the newly selected skater responds immediately. Pending shoot, pass and check presses are cleared so switching mid-input never shoots or checks unintentionally. Gamepad Y is rising-edge debounced; a held button cannot cycle repeatedly.
- The mobile and desktop HUD and possession banner update immediately. Compact switch/pass captions fit within a 390-pixel viewport, verified in screenshot review.
- Pass following occurs **only** when an actual intended teammate catches the puck. Interceptions, saves, missed passes and loose-puck pickups never trigger a switch. A manual switch made before reception prevents follow from unexpectedly overriding the user's choice.
- The optional auto-follow setting is session-local to this game tab; it is not a new persistent profile or tracking preference.

## Scorekeeping and privacy

Shift Book's existing solo record is based on the single **input device** and team, not a fixed player number. A human's actual completed pass is counted **before** control transfers. A human's subsequent shots or checks are attributed to the same input after switching. Uncredited AI actions never become human achievements merely because an earlier skater was switched away. The match remains solo when it started with one human and does not become an eight-human roster.

No external network service, account, student identifier, event telemetry, added `localStorage` key or extra persistent record was introduced.

## Tests and evidence — TheAtlas, Nov 22, 2026

- **11 new source regressions** in `tests/icebreak/switching.cjs`: position/velocity preservation, repeated keyboard presses, no switching while holding possession, goalie/multiplayer and other-team protection, stale input cleanup, pass completion attribution, opt-out, interception isolation, keyboard 2 selection, gamepad Y rising-edge and new-match/faceoff behavior.
- One existing `tests/icebreak/physics.cjs` regression was explicitly configured with pass-follow **off** to keep its longstanding original-skater shot-charge measurement meaningful. This is a test fixture configuration, not a physics alteration.
- **106 / 106 source tests PASS** on the Batch 11 game code, including all previous ten batches.
- **4 / 4 dedicated Chromium browser scenarios PASS** on desktop 1440×900 and mobile 390×844 in **both WebGL and Canvas**: actual Q keyboard and touch button, pass-follow completion, settings toggle, correct immediate mobile possession label, unobstructed start button, unclipped feedback, isolated local multiplayer controls and no page JS errors.
- **33 / 33 full Chromium browser scenarios PASS** on the final candidate, all eight runners in sequence, process exit 0 after compact HUD and immediate-possession-label fixes. Included the 29 pre-existing acceptance scenarios and 4 Batch 11 switch/pass-follow cases; WebGL/Canvas × desktop/mobile emulation with zero recorded page JavaScript errors.
- Screenshots inspected: `switch-canvas-2d-390.png`, `pass-follow-canvas-2d-390.png`, and desktop WebGL equivalent in local `browser-results/icebreak/`. These are QA evidence, not published player telemetry.

## Staging / deployment rules

**Stacked on draft ICEBREAK integration PR #526** (`integration/icebreak-10-batches-main-20261122`), which is not merged or deployed. This batch must **not** merge straight to `main` around the integration. Keep both PRs reviewable and production unchanged. Real controller/gamepad hardware, human two-player play sessions, school-network verification, final protected CI, and independently verified Netlify production deployment remain required.

Blender assets are not needed for input selection or puck possession; preserve the existing WebGL and Canvas fallback across devices. Further rig/asset work is tracked separately.
