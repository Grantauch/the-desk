# Student discovery audit — November 12, 2026

Owner: Codex, Student Content Discovery and Navigation Lead. Baseline: `dda9945033e04df136f8602e1395b7eab44cf104` (`main`).

## Scope and interpretation

All **109 root-level HTML files** were reconciled against exact `/hubs/` links in `src/data/storyhubs.ts` and `src/pages/games.astro`: **96 referenced, 13 absent**. Slugs and cover-image paths were not treated as activity links. The 13 missing links were inspected as source and in Chromium at 320, 390 and 1440 pixels. This is a discovery audit of all 109 and a detailed content/functionality audit of the 13 exceptions; it does not claim a fresh end-to-end test of the other 96.

Every exception returned HTTP 200 on production on November 12. Being absent from these two catalogs did not mean a file was private or unreachable. Netlify rewrites many `.html` links to extensionless links; both forms were considered. A hidden link or `noindex` is not access control.

## Disposition of the 13 exceptions

| File | Classification | Content and acceptance evidence | Existing access / navigation action |
| --- | --- | --- | --- |
| `boss_fight_review.html` | REPAIR FIRST | Working mixed-course concept-boss prototype; a successful run reaches the ending. Explanations disappear after 1.5–2.6 seconds and focus is lost when answer buttons are replaced. Needs learner-paced feedback and a source/content review. | Previously reached through LessonHub Lab. Do not add a standalone card; remove the lab from normal games discovery. |
| `bs-high-system-behind-the-score.html` | REPAIR FIRST | Substantial nine-screen student investigation, not a teacher key. Separate browser-wide state includes identity, answers and completion state alongside the shared save runtime. The shared runtime clears initial fields, but the older full-state store and dynamic-page recovery need an integration review. WCAG checks also find contrast and desktop progress-indicator ARIA issues. | Already linked from Beyond the Scoreboard, opening unit. Hold broader catalog publication pending save-system and accessibility repairs; existing course link preserved. |
| `bts-americas-most-hated.html` | ARCHIVE | Complete earlier reading/project brief. It is the sealed predecessor of the expanded research assignment, not a missing current activity. | Current StoryHub and course entries already target `bts-americas-most-hated-research.html`; extensionless original URL redirects there. Preserve the sealed original and avoid a duplicate card. |
| `bts-l03-baseball-becomes-a-business.html` | ARCHIVE | Older 17-scene student/class presentation, assembled by fetching four text parts, plus embedded/base64 artwork. Assembly and toolkit work. Current BTS-L03 manifest and catalog point to **Not In The Room**, covering the same business architecture. | No normal catalog entry. Keep the original and parts for old links; direct new students to `bts-l03-not-in-the-room.html`. |
| `constitution-day-2026-09-18.html` | PUBLISH TO CATALOG | Complete three-course source investigation. Before publication, remove the separate browser-wide identity/answer persistence, retain the shared save runtime and original `q:` answer keys, associate every response with its label, and include first period. | Already reachable from the September 18 announcement. Add a clearly named all-classes case-file card to games. |
| `evidence_locker.html` | REPAIR FIRST | Working eight-card evidence-sort prototype and case report. Cards and claim targets are clickable `div` elements outside keyboard focus. Described sources need actual document links and clear illustrative-example labels. | Previously through LessonHub Lab. Keep out of the main catalog until keyboard and source repairs pass. |
| `jeopardy-buzz.html` | PUBLISH TO CATALOG | Student join/buzzer client for V3, not a standalone board or answer key. Student entry requires a teacher room code and first name. Invalid-code and service-unavailable states remain on the join form. Teacher remote uses a separate query mode and host-approved Firebase permissions. | Already reachable at `/buzz` and from V3. Add a student-specific join card with a teacher-hosted-game requirement; no teacher-remote parameters. |
| `market_shock_arena.html` | REPAIRED NOVEMBER 13 (#371) | Eight-round food-truck simulation. Shortage quotes now match the $6 charge and competition uses the advertised $7 cutoff. The page explains the invented model and retains each result until the learner advances. | Standalone games card added after focused browser acceptance. Protected CI, merge and production readback are separate release stages. |
| `reconstruction-case-file.html` | REPAIR FIRST | Complete cover, six-part student activity and downloadable report. Browser-wide `rcf1865` retains identity and writing across student tabs; no shared `desk-save.js` integration. Some feedback is practice, not a confidential teacher key. | Already in the U.S. History Reconstruction unit. Hold broader catalog publication until shared-device/save-system repair; existing course link preserved. |
| `roswell-signal.html` | REPAIR FIRST | Substantial student investigation with archival images, source trail, interactions and final report. Its separate browser-wide state stores identity and work alongside the shared save system, requiring a dedicated migration/reset review before wider publication. | Already in Hidden History unit 1. The newer first-week Roswell StoryHub is separately cataloged. Preserve the course link while holding a second catalog card. |
| `situation_room.html` | REPAIR FIRST | Six-decision Cuban Missile Crisis prototype explicitly calls itself a prototype. Historical path and debrief work. Risk/support scores are invented model values without a clear distinction from historical evidence or source links. | Previously through LessonHub Lab and the Cold War course unit. Remove these normal navigation entries; retain the original for review and old links. |
| `substitute-day-2026-09-08.html` | KEEP | Finished, date-specific three-course launcher. All three destination activities exist and return 200. It is a routing page, not a fourth independent lesson. | Already in the September 8 announcement. Keep that dated context and the individual cataloged lessons; no duplicate all-purpose catalog card. |
| `ush9-progressive-era-jeopardy-v2.html` | ARCHIVE | Functioning teacher-run predecessor. V3 is the current board and supports student buzzers. V2 is intentionally retained for legacy links. | Replace the stale U.S. History unit link with V3 and remove V2 from the sitemap. Keep the old file intact. |

No exception warrants a new TEACHER ONLY catalog entry. Teacher-only controls/answer material are not added to student discovery. ARCHIVE here means retain the original URL for compatibility while excluding the superseded edition from normal discovery; no source file is deleted or moved.

## Release changes

- Games: add Constitution Day and the student buzzer; remove the unfinished LessonHub Lab collection.
- U.S. History: use V3 for Progressive Era Jeopardy; remove the prototype Situation Room link.
- Sitemap: stop advertising legacy Jeopardy V2.
- Constitution Day: use the existing shared answer/save contract, maintain existing `q:` keys and response content, correct labels and first-period selection. Existing browser-wide work is not automatically imported into a different student's session; original storage is not deleted.
- Add a synthetic browser regression covering old browser-wide work isolation, same-tab recovery, new-tab blanks, clearing, all three course panels, WCAG A/AA, viewport fit, navigation and buzzer failure handling.

## Checks and limitations

Completed focused evidence:

- Production direct-URL readback: 13/13 HTTP 200; `/buzz` reaches the same student join page; all four baseball assembly parts return 200. An additional 44 local dependency URLs (scripts, images and baseball artwork) return 200.
- Chromium initial-screen audit: 39/39 route/viewport combinations load without uncaught errors, failed local requests or page-width overflow. Full-content checks distinguish the page from the PIN-gate overlay. BS High has existing contrast/ARIA failures; Constitution Day's original unlabeled responses were repaired.
- Nine BS High and twelve Roswell generated screens render at 390 pixels with no page-width overflow. Roswell's twelve screens have no automated WCAG A/AA violations; BS High retains contrast failures. These rendering checks do not claim every answer path or account migration works.
- Local game journeys reach the Boss Fight win, Evidence Locker case report, Market Shock season result, Situation Room historical debrief, Reconstruction download, the 17-scene baseball assembly and toolkit, original heel-project mission, three substitute-launcher destinations and V2 game board.
- New acceptance suite: 3/3 viewport journeys pass, with nine course-panel WCAG audits, original answer-key compatibility, old browser-wide work isolation, same-tab refresh, fresh-tab blanks, persistent clear, catalog navigation, invalid code and offline buzzer handling.

Broader browser verification passed: 72/72 main UI cases and 78/78 extended cases. Astro diagnostics report zero errors and zero warnings; the production build and static validator pass (171 HTML files, 5,602 local references, 35 releases / 264 sealed assets). Full canonical `npm run verify` passed. Protected build, merge and production readback remain separate. Source browser evidence is generated under ignored `browser-results/discovery/` and `browser-results/student-discovery/` by the audit and acceptance runs. Browser tests block external classroom services; no real student account, PIN, live room, roster, or submission is used. Automated WCAG checks are not a complete accessibility certification. School-network access to third-party sources, a real teacher-hosted Firebase classroom session and physical Chromebook acceptance remain field checks.

## Root HTML reconciliation

The catalog column below records the baseline `main`, before this release. Directory apps are outside the requested root-level HTML scope.

| Root file | In either baseline catalog |
| --- | --- |
| `blacktop-kings.html` | yes |
| `boss_fight_review.html` | no |
| `bs-high-system-behind-the-score.html` | no |
| `bts-23-months.html` | yes |
| `bts-americas-most-hated-exemplar.html` | yes |
| `bts-americas-most-hated-research.html` | yes |
| `bts-americas-most-hated.html` | no |
| `bts-bytesize-number-81.html` | yes |
| `bts-bytesize-the-girlfriend.html` | yes |
| `bts-bytesize-weights-in-the-fish.html` | yes |
| `bts-bytesize-who-let-him-back.html` | yes |
| `bts-bytesize-zero-points.html` | yes |
| `bts-golf-special-edition.html` | yes |
| `bts-l03-baseball-becomes-a-business.html` | no |
| `bts-l03-not-in-the-room.html` | yes |
| `bts-robinson-review.html` | yes |
| `bts-s01-the-death-harvest.html` | yes |
| `bts-s02-the-entry-list.html` | yes |
| `bts-the-bargain.html` | yes |
| `bts-the-fighter.html` | yes |
| `bts-the-scouting-report.html` | yes |
| `bts-two-minutes-four-seconds.html` | yes |
| `bts-whats-my-name.html` | yes |
| `bts-who-lost-when-robinson-won.html` | yes |
| `classroom-jeopardy.html` | yes |
| `constitution-day-2026-09-18.html` | no |
| `empire-exchange.html` | yes |
| `evidence_locker.html` | no |
| `hh-burn-the-files.html` | yes |
| `hh-bytesize-acoustic-kitty.html` | yes |
| `hh-bytesize-bat-bombs.html` | yes |
| `hh-bytesize-ghost-army.html` | yes |
| `hh-bytesize-glomar.html` | yes |
| `hh-bytesize-habbakuk.html` | yes |
| `hh-bytesize-iceworm.html` | yes |
| `hh-bytesize-mincemeat.html` | yes |
| `hh-bytesize-moon-hoax.html` | yes |
| `hh-bytesize-nuremberg.html` | yes |
| `hh-bytesize-philadelphia-experiment.html` | yes |
| `hh-bytesize-project-pigeon.html` | yes |
| `hh-bytesize-sea-spray.html` | yes |
| `hh-bytesize-stargate.html` | yes |
| `hh-bytesize-the-thing.html` | yes |
| `hh-dont-worry-about-it.html` | yes |
| `hh-down-the-rabbit-hole.html` | yes |
| `hh-follow-the-money.html` | yes |
| `hh-l03-week-roswell-became-roswell.html` | yes |
| `hh-l06-two-sources.html` | yes |
| `hh-living-history-01-before-the-web.html` | yes |
| `hh-living-history-02-device-in-your-pocket.html` | yes |
| `hh-living-history-03-hallways-went-quiet.html` | yes |
| `hh-mkultra-review.html` | yes |
| `hh-never-use-the-word.html` | yes |
| `hh-nothing-but-black-sea.html` | yes |
| `hh-room-1018a.html` | yes |
| `hh-s01-the-desk-it-stopped-at.html` | yes |
| `hh-s02-the-first-englishman.html` | yes |
| `hh-sheer-poppycock.html` | yes |
| `hh-shines-in-the-dark.html` | yes |
| `hh-they-couldnt-stop.html` | yes |
| `hh-too-successful.html` | yes |
| `hh-who-pressed-record.html` | yes |
| `hh-who-took-the-files.html` | yes |
| `hidden-history-unit1.html` | yes |
| `jeopardy-buzz.html` | no |
| `jeopardy-hidden-history-unit1.html` | yes |
| `jeopardy-scoreboard-unit1.html` | yes |
| `lessonhub-lab.html` | yes |
| `market_shock_arena.html` | no |
| `paycheck-taxes.html` | yes |
| `reconstruction-case-file.html` | no |
| `robber-barons.html` | yes |
| `roswell-signal.html` | no |
| `scoreboard-unit1.html` | yes |
| `situation_room.html` | no |
| `substitute-day-2026-09-08.html` | no |
| `tale-of-the-tape.html` | yes |
| `the-league.html` | yes |
| `ush9-bytesize-garfield-arthur.html` | yes |
| `ush9-bytesize-grant-hayes.html` | yes |
| `ush9-bytesize-marne.html` | yes |
| `ush9-bytesize-the-line-that-wouldnt-move.html` | yes |
| `ush9-bytesize-thirty-seven-days.html` | yes |
| `ush9-bytesize-why-they-fought.html` | yes |
| `ush9-i-seen-my-opportunities.html` | yes |
| `ush9-l014-unions.html` | yes |
| `ush9-l015-who-showed-up.html` | yes |
| `ush9-l016-the-one-that-passed.html` | yes |
| `ush9-l016b-they-said-no.html` | yes |
| `ush9-l018-the-debt-didnt-move.html` | yes |
| `ush9-muckrakers-review.html` | yes |
| `ush9-over-the-somme.html` | yes |
| `ush9-over-the-top.html` | yes |
| `ush9-over-there.html` | yes |
| `ush9-progressive-era-jeopardy-v2.html` | no |
| `ush9-progressive-era-jeopardy-v3.html` | yes |
| `ush9-s01-the-margin.html` | yes |
| `ush9-s03-the-last-morning.html` | yes |
| `ush9-splendid-little-war.html` | yes |
| `ush9-square-deal.html` | yes |
| `ush9-stop-the-presses.html` | yes |
| `ush9-the-arsenal.html` | yes |
| `ush9-the-jungle.html` | yes |
| `ush9-the-line.html` | yes |
| `ush9-the-other-half.html` | yes |
| `ush9-the-paper-trail.html` | yes |
| `ush9-theodore-roosevelt.html` | yes |
| `ush9-who-paid-for-it-part-two.html` | yes |
| `ush9-who-paid-for-it.html` | yes |
