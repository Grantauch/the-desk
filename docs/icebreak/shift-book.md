# ICEBREAK — Batch 09: Shift Book

## Purpose

Make ICEBREAK a better daily game through earned mastery and another-shift motivation, **not** more arenas or cosmetic purchases. Shift Book adds honest match statistics, one locally rotating daily objective, persistent personal bests, earned milestones and a compact end-of-match report.

## Player-facing flow

1. On the setup screen, **SHIFT BOOK** shows today's skill objective, completed match record, bests, achievement count and daily streak. The game modes remain Regular and Powerups; rink physics stays identical.
2. During an eligible solo-versus-AI game, a small HUD ticker displays that challenge's progress. A challenge is not completed by merely reaching its raw threshold mid-game. It requires a **completed match**.
3. At the final horn, a compact **FINAL SHIFT REPORT** gives each side's goals, actual shot attempts, completed intended passes, solid checks and goalie saves. Solo play also shows the controlling human's contribution, newly earned milestones and daily progress.
4. **PLAY AGAIN** is immediately visible, including on mobile. **CHANGE TEAMS, RINK OR MODE** opens the full setup without erasing previous saved records. Detailed control directions are expandable rather than dominating the setup.

## What counts

All event attribution is derived from existing game events, not inferred from appearance or FPS:

| Stat | Source event | Exclusion |
| --- | --- | --- |
| Shots | Actual `shot(p)` release while the game is playing | Unfired windups |
| Goals by human | Team goal after the same human's recent, eligible shot | AI goals and uncredited carries |
| Completed passes | Swept puck contact by the intended teammate | Interceptions and unintended receptions |
| Clean checks | Actual aligned contact above the existing `CHECK.loose` threshold | Misses, non-check bumps, glancing body contact |
| Goalie saves | Existing swept save event awarded to that team's keeper | Mere proximity to the puck |
| Team goals/wins | Existing official scoreboard and final outcome | Changes to collision or goal-line logic |

These are **attempted shots**, not invented “shots on goal”; only the real save or goal contacts are confirmed on target.

## Daily skill challenges

A deterministic challenge rotates by the browser's **local date**:

- **Three Shot Shift:** three actual shot attempts by the human skater in one completed solo match
- **Tape-to-Tape:** three completed intended passes by the human skater in one completed solo match
- **Clean Contact:** two solid aligned checks by the human skater in one completed solo match
- **Take the Ice:** win a completed solo match **and** contribute at least one shot, completed pass, clean check or goalie save

Daily completion is awarded at most once per local date. A streak grows only when the preceding completed date was the immediately previous calendar day. Calendar-day arithmetic uses UTC day ordinals on local **date labels**, so DST clock changes do not accidentally break streaks.

Daily objectives are local-browser challenges; device-clock changes can affect their dates. This is a recreational feature, not a trusted online ranking or anticheat system.

## Personal bests and milestones

Solo-versus-AI completed games maintain separate Regular and Powerups record sets: games, team wins, personal-best goals, completed passes, clean checks and goalie saves. Milestones are First Victory, Goal Scorer, Playmaker, Clean Checker, One-Timer Ace, Hat Trick, Last Line, Shutout and Comeback.

The victory, shutout and comeback achievements require a recorded human contribution; AI teammates winning without participation does not unlock a “skill” badge. AI teammate goals still count accurately toward the team result. A human-controlled goalie can earn save-based progression.

Multiple local human seats are **not** treated as a single player. Multiplayer matches show team statistics but never modify solo records or achievements.

## Persistence and privacy

- No account, network service, server, database, analytics, tracking ID, student name or email.
- `localStorage['icebreak:shift-book:v1']`: a versioned, bounded JSON summary containing mode totals, known badge IDs and a date/streak. **No personal identity, per-keyboard identity or full match log is persisted.**
- No save on a paused, abandoned or reset match; only one commit at the final horn. A second `finish()` is idempotent.
- Unknown schema versions, corrupt JSON, out-of-range values and unavailable browser storage do not block gameplay. The UI explicitly says when records were **not saved**.
- Storage is browser/device-local; players sharing a device can see its generic progress and clearing site data erases it. There is no cloud sync.

## Physics and graphics constraints

This batch changes presentation and counters only. It does not alter the 90 Hz fixed simulation, scoring collisions, skating controls, AI, knockdowns, three-rink physics parity, two gameplay modes or eight input-seat options. It does not add Blender/GLB assets; those remain separately tracked in Team Desk #97 pending a reliable importer and Canvas fallback.

## Verification — TheAtlas, November 22, 2026

- New `tests/icebreak/progression.cjs`: **16 focused source tests** cover provenance, non-participating AI wins, goal and save credit, intended-pass interceptions, real checking, daily streak calendar boundaries, idempotent finish, incomplete games, separate mode records, hostile/corrupt/blocked storage, and multiplayer isolation.
- Existing source suites + new Shift Book suite: **73/73 source tests PASS**, on the game-code candidate ending with `7b28330`.
- `tests/icebreak/progression-browser.cjs`: desktop 1440×900 and mobile-emulated 390×844 on both WebGL and Canvas; real Play Again/Change Setup navigation; final score, daily challenge, saved records after reload, multiplayer isolation; and blocked-storage fallback. New browser runner: **5/5 PASS** on the candidate.
- Entire Chromium browser chain (original game, first-touch, goalie, combinations, body-contact, progression) is an integration gate; verify its final process exit before promotion.
- Desktop WebGL and mobile Canvas screenshots of the final report were manually inspected. A UI defect was discovered and fixed: Play Again had been buried below the full settings list. The final report now displays immediately with Play Again and the optional Change Setup action accessible without scrolling.

## Release blockers and follow-on

**Draft stacked on Batch 08 PR #504**. The preceding chain includes #494, #490, #486, #482, #478, #477 and #473. Do not promote or merge out of order. Protected build checks, independent visual/performance verification of the integrated branch, physical phone/controller playtesting and two-human match feel tests are not completed. Vercel has previously failed with `build-rate-limit`, which does not establish an ICEBREAK code failure. Public ICEBREAK remains unchanged.

Potential next work: aggregate retention telemetry would require clear consent, privacy review and product design (not included here). For now, prioritize actual human enjoyment and difficulty tuning using anonymous/manual test sessions rather than collecting student data.
