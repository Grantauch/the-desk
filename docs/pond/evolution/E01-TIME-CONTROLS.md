# Pond Evolution E01: biological time controls

Stacks on E00 (draft PR #571). Linked to RFC #537. Task #165.

## Rule

Pause/Resume and the 1x, 4x, 16x and 64x speeds change biological time only.
They never multiply, skip, pause or replace `PondSim.step`. Placed sand, water,
powder, snow and other materials keep falling and flowing in real time.

## What this adds

- `apps/pond/src/lib/pond/evolution/time-controls.ts`: `EvolutionTimeControls`.
  `frame(sim, realMillis, region)` calls `sim.step(region)` exactly once, then
  advances the E00 `EvolutionClock` by the real frame time times the speed, then
  runs the ecology callback once per biological day. Frame times are clamped to
  0 to 250 ms.
- Each ecology day is its own transaction (E00 contract). The clock publishes
  day N only after the callback for day N returns. If day N throws, earlier
  days stay committed exactly once, day N and later days stay queued, and the
  next frame retries day N. Nothing is ever replayed. Day N is checked
  against the clock's day limit before its callback runs, so ecology never
  commits a day the clock cannot publish. If the callback changes the clock
  and then throws, the clock is still put back to that day's snapshot.
- `saturated` is true only when real time was clipped by the clock's backlog
  cap or whole days are still queued after the frame. A frame that drains
  every whole day (for example 64x at 16 ms) is not saturated.
- The ecology callback is required; there is no running biology clock without
  real ecology behind it. While the callback runs, `frame`, `setSpeed`,
  `pause`, `resume`, `toggle` and `restore` throw, and a direct change to the
  clock is rolled back and rejected.
- The ecology callback must be synchronous, because a day commits when the
  callback returns. The constructor type rejects callbacks whose return type
  can be a promise, including async functions. At runtime, a callback that
  returns a promise or any other thenable is handled like one that throws.
  The clock goes back to that day's snapshot, the day is not published and it
  stays queued. The returned thenable is never awaited or called.
- The biology pause is separate from `PondSim.paused`, which stays the player's
  world pause. The controls never read or write it.
- `apps/pond/src/lib/pond/evolution/e01.test.ts`, imported from
  `evolution-contract.test.ts` so `pond:test` runs it.

## QA in e01.test.ts

For every world size (192, 256, 320, 448, 576, 768) and every speed, with and
without a biology Pause/Resume in the middle, 72 frames are run through the
controls and compared cell for cell with 72 plain `PondSim.step` calls on the
same scene and the same seeded random stream. The scene has sand, powder, snow,
water over a stone shelf and a static stone block. The tests also check that
there is exactly one physics step per frame, that each material falls, that
stone stays, and that biological days match the speed and stop while paused.
Contract tests cover a first-day failure, a second-day failure followed by a
retry (days 1 to 6 each commit once, in order), callback reentry through every
control, direct clock mutation from the callback, a callback that mutates the clock
and then throws, the clock's day limit, saturation reporting, a missing
callback, and clamped frame times. Synchronous tests cover async and
promise-returning callbacks being rejected by the type, as well as promises,
plain thenables and callable thenables being refused at runtime with the day
still queued. They also cover a thenable on day 2 after day 1 commits, a clock
change followed by a returned thenable, a throwing `then` getter, and
non-thenable return values that still commit.

## Not in this PR

No UI wiring. `pond-app.tsx`, `styles.css` and the C02/C03 release files are
untouched. The UI button wiring comes in a later step once this is reviewed.
