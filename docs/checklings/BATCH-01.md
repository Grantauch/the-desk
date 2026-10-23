# Checklings Batch 01: production reconciliation and technical foundation

Date: October 23, 2026. Owner: Codex. Branch: `checklings/batch-01-foundation`.

## Result

The expansion can attach to the existing system while preserving its four founders and class-specific pets. The existing pet preferences and official streak-derived unlocks have a tested import path. The architecture separates the future game service from classroom operations. Batch 01 adds offline foundation code and an implementation plan; it does not launch the expanded game or migrate student records.

The canonical repository gate passed locally. The separate offline browser suite could not start because Chromium was unavailable and its official download returned an invalid archive. Protected CI and actual Chromebook use remain separate.

The current verified Apps Script release is **Version 42**, not the Version 39/41 described in some repository notes. The current observed Netlify production commit is **82deafce4e1e6fedcd4adab49ae2527774920aea**. PR #223 remains an open draft and is not the production game.

## Production reconciliation

| Surface | Verified state | Evidence and limit |
|---|---|---|
| Public website | Netlify production `6adb6ab62f3d769755b5d68e`, ready/published; main `82deafce4e1e6fedcd4adab49ae2527774920aea` | Netlify project and site-scoped deploy reads. Published October 23, 10:19 AM EDT. Live `/check-in/` links to the existing Apps Script check-in mode. |
| Hall Pass / Daily Check-In | Version 42 on existing deployment; DOMAIN access; deploying-owner execution | Independently opened Apps Script Manage deployments and read active version, stable URL and access settings. Version created October 22, 10:28 PM EDT. |
| Version 42 source | `dec34deab68f1899ea6ac33be7f2b1277a7bdbb7`, merged PR #224 | [Release run 39888673590](https://github.com/Grantauch/the-desk/actions/runs/39888673590), successful bridge job, artifact 12474446310. All five normalized local source hashes match the artifact's remote readback. Current main has no further changes to these five files. This audit did not independently export the current editor's complete source. |
| Companion-only entry | Live Check-In PIN form includes **visit Checkling only** | Actual authenticated production UI observed. No real student PIN entered. |
| Protected live smoke | **Passed** during Batch 01 | Actual deployed release-check UI: `ok=true`, `syntheticOnly=true`, `companionVisit=PIN_VERIFIED_NO_ATTENDANCE`, `request=STARTED`, `return=RETURNED_COUNTABLE`, `evidenceUsed=1`, test pass voided, test membership deactivated, `productionFactsUnchanged=true`. Workbook identifier omitted. |
| Existing pet persistence | Server-owned per-membership v1 preference; cross-device behavior covered by source/harness | Reads/writes in `Code.gs`, existing 20 synthetic companion tests and the new import rehearsal. A real student's pet was neither read nor migrated. A production save/reload of an existing synthetic pet was not separately exercised in this audit. |
| Expanded game service | Not provisioned/deployed | No new database, authentication bridge, persistent battle service or student pilot exists from this batch. |
| PR #223 | Open draft, head `f5ce7bbc82b7376be5518e728c80744791399b2f`, not merged | [PR #223](https://github.com/Grantauch/the-desk/pull/223), current metadata and source fetched. Its preview is not student-account gameplay. |

### Version 42 source fingerprint comparison

The bridge hashes normalize carriage returns and the final newline. These fingerprints match the local five-file source and its recorded remote readback:

| File | SHA-256 |
|---|---|
| Code.gs | `84b6980bcfe5feb2140327a09b7db2e64d219432022db89f98a3580ee6c600e1` |
| Index.html | `b413aa4c4062e77f00883ce43192f38abccb6842f28c3ba0406161d4265ee03f` |
| appsscript.json | `ee69229d802b71f25111ca1c9556dc6d3d9759f2b8973350fd91324d6ac6ef3c` |
| ReleaseChecks.gs | `3422c8424bd9f1db40d38650a6088c44bba5f104230c69fceedc7fd1112a1185` |
| ReleaseCheck.html | `1a3ee0f2825721a571567e6d0095900f50e5d32eb28adce86e5c391da7e5d5ff` |

The live smoke proves the companion identity endpoint and protected pass actions work in the deployed backend against its separate synthetic workbook. It does not demonstrate the future game, all real-student paths, a pet migration, classroom load or school Chromebook performance.

## What can be reused from #223

All three original suites were run from the exact PR head: **29/29 passed**. This is local synthetic engine evidence, not a production service test. Source was extracted separately for review and was not merged into this branch.

| Module | Reuse | Required changes before student use |
|---|---|---|
| living-world.cjs | Personality lines, habitat scene descriptions, deterministic weather/visitors, mood suggestions, bounded elapsed-day concept | Adapt `cloud` to production `sky`; expand 4-species/5-home constants to catalog-driven content; centralize duplicate care rules; separate safe offline accrual from active illness/death; event keys are presentation IDs, not economic claim IDs |
| progression.cjs | Dependency-injected authorization/store boundary, item catalog shape, equipment ownership checks, quest claims and daily reward ideas | Durable atomic store; strict persisted schema; idempotent command receipts; server attendance adapter; membership scoping; catalog-driven species; all-day essential care; rescue independent of XP caps; new health, development and death models |
| rooms.cjs | Hashed random invites, participant-safe aliases, class scoping, teacher enable gate, expected revisions | Validate species/creatures against owned living instances; real transaction adapter; limits/cleanup; reconnect and settlement; fix knocked-out turn handling; enforce active-creature locks and session revocation |
| preview.html | Visual reference for day/night, habitat and care layout | No saving or account authority. Retain as a clearly labeled local visual sandbox; create original approved species art and accessible production UI separately |

### Concrete problems found

1. **Raid deadlock reproduced.** Two synthetic participants alternate guard/strike for ten rounds. Boss HP is 20; participant HP is `[70,0]`. After the surviving participant guards again, the active seat points to the knocked-out participant, and `move` rejects with “Not your turn.” The encounter cannot progress. Skip ineligible seats and handle final alive-unit settlement.
2. **Owned-creature authority is missing.** Room create/join accepts one of four species strings. It never proves that the participant owns an eligible living individual of that species. The future service must use owned creature IDs and lock eligibility.
3. **Current care caps conflict with safe rescue.** Prototype care is limited to four actions on school days. That may be suitable for reward limits; it cannot gate lifesaving food, treatment or rest, particularly during after-hours visits. The new design caps rewards separately from essential care.
4. **The prototype's no-death/nonregression rules are superseded.** Keep absence protections, but implement the charter's warned active neglect and dangerous-choice consequences. Do not copy prototype assurances that all losses are impossible into the new game.
5. **Attendance reward assumptions need an adapter.** Prototype `attendance` is synchronous inside its transaction callback. Do not put slow Apps Script reads inside a database transaction or trust client streaks. Use verified bridge assertions/receipts, with freshness and once-only claim constraints.
6. **Synthetic stores prove no durable concurrency guarantees.** Expected revisions work only when the backing transaction is atomic. The new service needs real concurrent-write, rollback, crash and restore tests.

Earlier prototype documentation warns about Gemini gift codes and reward exploits. The Gemini source itself was not available in this Batch 01 repository review, so those older findings were not independently reverified here. No gift-code implementation is approved for reuse. Any later transferable code requires server issuance, ownership checks and an atomic redemption ledger.

## Compatibility and data structures delivered

`apps/checklings-foundation/migration.cjs` demonstrates safe import without writing production. It preserves founders, exact saved names, current earned home and official best-streak unlocks; treats each class membership separately; retains source provenance; blocks damaged/conflicting inputs; and never overwrites a progressed or deceased imported individual on retry. Missing adoption dates remain unknown. Details: [Migration contract](MIGRATION.md).

`contracts.ts` defines versioned species and individual creatures, care/health, injuries/illness, friendship and development, ancestry/mutations, authoritative battles, progression, sessions, command envelopes, event ledger, death/memorial records and Encyclopedia views. These are design contracts, not a running backend or SQL migration.

The architectural decision is a separate Node game service and dedicated PostgreSQL database, with a narrowly scoped verified identity bridge from the existing Apps Script app. No game code runs in attendance/pass commit paths. No PIN, Hall Pass token, roster, points ledger or private workbook identifier belongs in the game client. Provider/account/cost provisioning remains a concrete next-step gate. Details: [Architecture](ARCHITECTURE.md).

The first 12 candidates include Ember, Bolt, Mochi and Zee plus eight original designs, each with different body, personality, tactical and nurturing hooks. Their names and descriptions are not evidence of implemented species. The playable slice covers care, discovery, combat, consequences, memorials, real classroom interaction and a small lineage system before roster expansion. Details: [First 12 plan](FIRST-12.md).

## Verification record

| Check | Result |
|---|---|
| New foundation tests | 16/16 passed: migration preservation, source conflicts, original Apps Script synthetic preference round trip, scope separation and death-policy admission |
| PR #223 tests at exact head | 29/29 passed; additional dead-seat failure reproduced separately |
| TypeScript data contracts | Compile check passed using TypeScript with `--ignoreConfig --noEmit` |
| Existing companion + foundation | 36/36 passed via `npm run checkling:test` in the canonical run |
| Canonical repository verification | Passed all 18 stages; 440 classroom behaviors; Astro 0 errors/0 warnings; 53 routes, 136 HTML files, 4,618 local references; 13 sealed releases/117 files |
| Offline companion browser journeys | Blocked locally: no installed Chromium; official Playwright browser download returned an invalid archive. No new browser-pass claim. Protected CI remains required |
| Version 42 live protected smoke | Passed as described above |
| Actual student migration / new game deployment | Not performed |
| School Chromebook field use / new database load tests | Not performed; later pilot gates |

The new death helper is an admission policy reference: offline, absence, disconnect and ordinary PvP triggers are rejected. Active-neglect death requires critical state, teacher enablement, a delivered warning, authoritative evidence and exhausted accessible rescue opportunities. Lethal PvE additionally needs bound explicit consent. It does not simulate care, prove a warning was read, or implement irreversible death settlement.

## Next implementation work

Begin slice 02A on a separate branch: dedicated synthetic game service, SQL constraints, transaction adapter, command idempotency, event ledger, backup/restore and concurrent-write tests. Then build the school-PIN launch bridge in staging and release its small Apps Script integration separately. Keep imports and lethal actions disabled until their own gates pass.

Batch 01's completion is the reconciled baseline, executable compatibility rehearsal, exact service boundaries and tested foundation plan. Infrastructure implementation, actual student migration and a playable 12-species release remain later deliverables. No 300-species feature or Version 1.0 claim is made.
