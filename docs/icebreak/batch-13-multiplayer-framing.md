# ICEBREAK — Batch 13: whole-rink framing for local multiplayer

## Verified defect

Batch 12 local-input acceptance passed **85 native tests** and **4/4 Chromium renderer/viewport contexts**, but the archived 8-pad screenshots exposed a real presentation defect: the six outfield skaters had markers while the two goalies (P4, P8) were cropped outside the desktop camera; mobile goalie markers were crowded near the possession bar and touch controls.

The earlier renderer intentionally used a zoomed-in north–south view for landscape readability. That behavior is appropriate for solo play, **not** for up to eight independent humans sharing one screen.

## Narrow fix

- When two or more local human seats are assigned, both WebGL and Canvas now use a fixed, central full-rink camera and bounded zoom that fits both ends of the playing surface. The camera no longer follows the puck off-center for multiplayer, which previously could remove a goalie from view mid-shift.
- Desktop full-rink view reserves space above the top goalie for the scoreboard/possession banner and below the bottom goalie for the footer. Portrait multiplayer zoom reserves room for mobile controls and the upper HUD.
- Mobile camera detection now follows the `760px` CSS breakpoint as well as tall portrait ratios, avoiding a mismatched camera at a tablet-like width.
- Solo desktop action zoom and solo mobile follow-camera behavior are unchanged.
- On touch-size screens, when **no Keyboard 1 seat is assigned**, the on-screen touch D-pad and action cluster are hidden. Those controls only send keyboard-1 actions and cannot control a gamepad seat; showing them during eight-gamepad play obscured the rink. Reassigning Keyboard 1 restores the controls.

All changes are presentation/input-UI only. Player coordinates, body radii, collision impulses, goalie crease, puck physics, energy, timed injuries and match modes are unchanged.

## Regression

The Batch 12 Chromium multiplayer test now explicitly renders the exact eight-gamepad setup and asserts:

- All **eight human position markers (P1–P8)** are visible, not merely that all eight skaters exist in simulation state.
- Both goalie marker bounding boxes are inside the viewport and do **not overlap** the scoreboard, possession readout, touch D-pad, or action buttons.
- Virtual eight-gamepad play has hidden touch controls because keyboard-1 is unassigned; returning keyboard-1 makes the mobile controls visible again.
- The inherited keyboard/gampad movement, independent shots, goalie clear, injury skip and basic browser-error tests remain in force.

Review screenshots in the hosted `icebreak-browser-evidence` artifact from the exact PR commit before treating this visual assertion as complete. Chromium/WebGL GPU snapshots should also be inspected manually for camera scale/readability, not just marker position.

## Remaining manual release gates

Two real players with physical controllers must still verify perceived skater size, orientation, pass/check aiming and gamepad ergonomics, including eight-pad full-rink readability. An actual phone touch test is required. This stacked draft is **unmerged and unpublished**.
