# Breakaway development instructions for AI agents

Read `LATEST.md` before editing: it identifies the canonical newest dated build.
Read `ROADMAP_TO_V5_0_0.md` before beginning the next version: respect staged priorities, minimum test evidence, and the separate production release gate.

**Editing scope:** `development/breakaway/`. Public release files such as `public/hubs/breakaway/`, Gridiron Blitz, student login, and classroom data are outside scope unless Grant explicitly requests a separate production release.

**Protected gameplay rules**
- Progressive blockers start at five and decrease by one after each touchdown, to a one-blocker floor. Counts do not drop mid-possession.
- Fallen defenders stay down until the end of their possession; stalled runs release the existing end-zone pursuit.
- Instant replays do not advance clock, score, physics, or defender state.
- On close tackles, a small flashing E/A/TAP prompt sits **over the grapple**, without modal darkening, screen jumps, or focus stealing.
- Controls must work with keyboard, touchscreen, and gamepad; honor Reduced Effects.
- Favor original visuals, no external/CDN dependency, no school integrations.

**Development workflow**
- Do not edit a dated release in place after it has been marked frozen. Branch from the latest, create a new dated build folder, preserve previous versions for rollback.
- Keep HTML usable offline and preserve a clear readable source/build plan.
- Verify gameplay balance, keyboard/touch/controller, four viewports, replay clock invariance, and performance before a PR.
- Explain which changes are **render-only** versus physics/gameplay. Never claim physics parity after intentionally changing mechanics.
- Update `LATEST.md`, manifest and test report only after tests pass.
- A GitHub-source update is **not** permission to deploy to grant-desk.com or freegameplace.com.

No secrets or student data belong here.
