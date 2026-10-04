# Blacktop Kings players and ball physics

How the players move and how the ball behaves. Read this before changing `art-baller.js` poses, `updatePose` in `game-core.js`, or `ball-physics.js`. `npm run blacktop:test` checks the rules below.

## Player rig

Players are drawn from canvas shapes, not sprites, so every customization (height, build, skin, hair, gear, jersey colors, numbers) works in every animation. A pose is a set of joint targets; two-bone IK places the knees and elbows.

The proportions and poses follow an approved character model sheet (a front, three-quarter, side and back turnaround plus six key poses). The sheet itself is reference art and stays outside the public repo. Measured as a share of standing height: shoulders at 79%, chin at 88%, hips at 51%, knees at 26%, fingertips at 43% with the arm hanging, and high-top sneakers about 19% long. `A.dims` keeps those numbers. The head is drawn a little larger than the sheet's so faces still read at game size.

- **True three-quarter shoulders.** The near arm (`F`, drawn in front, the one that handles the ball) hangs from the back edge of the chest; the far arm (`B`, drawn behind) hangs from the front edge. Raising the near arm rolls its shoulder forward (`P.roll`, 0 to 1), so shots, blocks and dunks reach past the face instead of across it.
- **Hands are written relative to their own shoulder.** Use the `rel(shoulder, x, y)` and `polar(shoulder, degrees, reach)` helpers inside `A.pose`. A hand placed relative to the body's center ends up reaching backward across the chest, which was the original "crazy arms" bug.
- **Elbows fold forward (`armF`/`armB` = -1).** That is the natural bend for any arm in front of, beside, or above the body. Use +1 only for an elbow thrown out behind the body (the near arm of a double-biceps flex). Knees are always +1.
- **Stances match the sheet.** Defense, the defensive slide and dribble moves are low and wide with the chest out over the knees. The sprint leans in with the front fist up near the chin. The jump-shot guide hand drops on the follow-through, and airborne players point their toes (`P.toe`).
- **Poses blend.** `updatePose` cross-fades between animations over a few hundredths of a second (`BLEND` in `game-core.js`), so new poses never need their own transition frames.
- **Facing turns take a beat.** `p.facing` is the logical direction and changes after a short cooldown. `p.faceVis` eases toward it and is what the drawing and the ball use. Shots, passes and catches pass `force` to turn immediately.
- **Running feet stay planted.** `A.pose('run')` takes `stride`, half the distance a planted foot slides back. `runGait` computes it from speed and cadence. Defenders who are not running straight ahead use the `slide` shuffle instead.
- **The ball sits in the palm.** While dribbling, the hand rides on top of the ball and reaches as far toward it as the arm allows. A standing dribble stays about knee high; a running one is hip high and out in front. When the ball crosses behind the body, the far hand takes it. During tricks that toss the ball (off the head, juggles), a hand only follows a ball that is within reach.
- **Dunks reach the rim.** Jump heights come from `A.handReach`, the drawn arm's real reach, and the slamming hand targets the rim's actual position.

## Ball physics

`ball-physics.js` simulates the ball in 1/240 second steps against a ring-shaped rim, the backboard face, the net and the court. Loose balls (rebounds, blocks, steals) run on it live.

Shots keep the game's existing make/miss roll (ratings, contest, release timing). At release, `planShot` tries up to 72 slightly different releases through the same simulation and keeps one whose real bounce ends the way the roll decided. It prefers a style for that result: makes are mostly clean, some kiss the rim, a few rattle around before they drop; misses come off the iron and some rattle in and out. The chosen flight is replayed exactly, with rim and glass sounds and hoop shake at each contact. Rebound length now follows the shot: long misses come off long.

Planning takes about 1.5 ms per shot. If no release fits (not seen in testing), the old scripted flight is used.

## Checks

- `scripts/test-blacktop-physics.cjs`: clean drops, rim and glass contacts, shattered glass, floor bounces and rolling, 224 planned shots that must match their roll and finish in or out of the hoop, elbows never bending backward overhead, planted running feet, pose blending, and reach limits.
- In 200 simulated AI games against the previous version, points per game, shot attempts and game length matched. The shot mix moved by about one and a half dunks per game, mostly putbacks from shorter rebounds.
