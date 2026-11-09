# School Pixel Camp

Owner: Codex. Student entry: `/checklings/`, then the existing Daily Check-In
deployment. Enter a fresh school PIN, choose the class, and open Pixel Camp below
the existing Checkling. Pet-only visits do not record attendance. First-time
students hatch their companion using the existing form.

The published game is based on Pixel Camp 4.3.1 from commit
`8a949b2634d4755072559bfb44e4ed90b9ed289b`, path
`experiments/checklings-pixel-camp-online-v4/revisions/4.3.1`. Its engine, camp
goals, original founder art and font/license are preserved. School transport and
save-status behavior are in `public/hubs/checkling/camp/school.js` and `game.js`.
The earlier dedicated site remains a portable browser demo. Students can export
its save and explicitly import it into their school camp, with an in-tab undo.

The school host embeds inert game markup from `#ck-camp-template` into a
sandboxed srcdoc frame. Public assets are loaded from the desk; fonts allow
cross-origin loading. A fresh MessageChannel binds each game to its current
host PIN session. PINs, identity tokens, emails and membership keys never cross
the channel. The public game has no school API credential or standalone student
endpoint. Student switching and the existing two-minute shared-device inactivity
reset remove the frame and close its port. The child uses an in-memory store;
it writes no school camp or import backup to localStorage.

The original companion's name/species and official streak/habitat summary come
from the existing private school source. Camp imports cannot change official
attendance, points, calendar, earned homes or the original companion. After a
camp is saved, the legacy form permits original-name/home edits but refuses a
species replacement. Both preference and camp writes share the existing lock.

`getPixelCamp` and `savePixelCamp` require the existing PIN-verified identity.
They derive the membership from that identity. The private workbook lazily adds
one `Checkling Camps` tab on first save, without a roster/PIN/schema migration.
Columns hold the membership key, server revision, original founder species,
bounded v1 game JSON, one previous camp JSON, last mutation ID and update time.
Only membership keys are scanned; other students' camp payloads are not loaded.
The current row is written atomically as one range under the shared lock.

Revision conflicts refuse overwrite. A retried mutation ID acknowledges the
existing commit. The client serializes/coalesces saves, says Saved to school
only after acknowledgment, and keeps a failed snapshot for retry. File export
remains available after errors. The previous private sheet snapshot is retained
for teacher recovery; in-tab import undo is distinct from that record.

Checks: `npm run checkling:test`, `npm run hall-pass:verify`,
`npm run companion:browser`, and canonical `npm run verify`. Browser journeys
use the actual Apps Script source with isolated synthetic students and blocked
external services. The required deployed `?mode=releasecheck` also verifies
school camp save/reload/idempotency in its isolated synthetic workbook.

Release the public assets through protected main/Netlify first, verify their
hashes, then use the guarded existing Apps Script deployment. Preserve its
URL, DOMAIN access and USER_DEPLOYING identity. The original five-file source
set is unchanged. The authenticated deployed smoke and classroom use remain
separate evidence. A rollback retains the private camp tab and its records.

## Pixel Camp 5.0 (October 28, 2026)

Owner: Claude. Version 5.0 adds four things on top of 4.3.1, all game-only.
Nothing here records attendance or points.

- **Daily forage and the curio shelf.** Each trail stop offers one curio per
  calendar day, picked from that stop's pool by a hash of the date, so every
  camp sees the same curio that day. Foraging costs 12 energy and works once
  per stop per day for the whole camp. Sixteen curios (common, uncommon, rare)
  live on a new journal page. Art: `assets/curio-atlas.png` (4x4).
- **Stump ladder.** Sapling (125 HP), Old Oak (165 HP, root snare drains
  stamina) and Elder (185 HP, bark armor, double swipe, crushing blow). Each
  founder unlocks tiers in order and each badge is one trail stamp, so stamps
  now reach 24. `scripts/test-pixel-camp-five.cjs` checks that a player who
  reads NEXT wins every tier with every lead, and that mashing loses to the
  Elder.
- **Friendship levels.** Bond 25/50/75/100 reaches Pal, Good friend, Best
  friend and Forever friend, each with one founder-specific journal note.
- **Three more decorations.** Curio shelf (12), campfire ring (16) and wind
  chimes (20). Art: `assets/decor-atlas.png`, which also holds the heart.

Saves are now version 2: `pets.*.battles` 0 to 3, `curios`, and
`forage {day, taken}`. Version 1 saves still open and upgrade in memory.
`sanitizePixelCamp_` accepts both and keeps the version it was given, so a
4.x page never receives a camp it cannot open. `getPixelCamp` now returns
`formats: [1, 2]`.

The game only saves version 2 to school when the school says `formats`
includes 2. Against the older Apps Script it saves `toV1(state)` and hides
foraging, the ladder past the sapling, the shelf and the new decorations.
That makes the release order safe either way: the website can go first and
the school update can follow. The new controls are built by `game.js`, so the
`#ck-camp-template` copy inside Index.html needs no new markup.

Checks: `npm run checkling:test` (engine plus school rules, 44 tests),
`npm run hall-pass:verify` (the release smoke now also saves and reloads a
version 2 camp), and `node scripts/test-pixel-camp-five-browser.mjs` (open
sample page at 320/390/1366, school camp on version 2, and the version 1
fallback), now part of `npm run companion:browser`.
