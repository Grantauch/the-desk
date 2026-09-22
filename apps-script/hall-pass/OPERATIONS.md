# GrantDesk Hall Pass — steady-state operations

Issue #14 is closed. **Version 29 is deployed.** The tracked source, protected `main`, canonical release gate, production preflight, in-place Apps Script deployment, and Netlify production deploy are aligned to the same release commit. This file is the current operating checklist; older version sections below are historical records. Classroom observation and the authenticated `?mode=releasecheck` synthetic protected-action smoke remain FIELD_PENDING.

Production fingerprint as of 2026-09-22 (Version 29):

| Fact | Value |
| --- | --- |
| Deployed application source | `d64bec5fd0ed8f3ddae2f9eb141979ce03d7926f` |
| Apps Script version | 29, existing deployment ID and stable URL preserved; `DOMAIN` access and `USER_DEPLOYING` execution verified |
| Workbook schema | `2026-09-21-backend-b` (unchanged) |
| Teacher client contract | `2026-09-22-all-teacher-rpcs` in server, teacher browser and private release-check client |
| GoClassroom roster bridge contract | `2026-09-22-roster-sync-v1`; teacher-authorized read-only active membership snapshot only |
| Release evidence | preflight run `35772765535`; deploy run `35772904099`; canonical gate, bridge self-test and in-place deployment passed |
| Netlify production | deploy `6ab2d417f8e303000839704b`, status `ready`, commit `d64bec5fd0ed8f3ddae2f9eb141979ce03d7926f`; enhanced secret scan reported no matches |
| Data/schema impact | no workbook schema migration; Version 29 adds no roster mutation path and exposes no PIN, pass-history or Check-In-history fields through the GoClassroom bridge |

## September 22 Version 29 GoClassroom read-only roster bridge

Version 29 is the current single-classroom production release. It preserves all Version 28 Hall Pass/Check-In behavior and adds one narrowly scoped integration surface for GoClassroom.

- `getRosterSyncSnapshot` requires an authorized teacher and the exact roster bridge contract `2026-09-22-roster-sync-v1`.
- The bridge returns only active membership identity fields: student email, student name, class/period and active status.
- The bridge does not return PIN material, pass history, Check-In history, pass-access overrides or workbook row numbers.
- The bridge does not run workbook setup/repair, background-trigger maintenance or a transaction lock and contains no roster write path.
- PR #122 passed the protected full release gate before merge.
- Production preflight run `35772765535` passed against Version 28, then deploy run `35772904099` updated the existing deployment in place to Version 29.
- Netlify production deploy `6ab2d417f8e303000839704b` is `ready` on the matching source commit and reported no secret-scan matches.

The authenticated `?mode=releasecheck` synthetic protected-action smoke remains separate FIELD_PENDING evidence; Version 29 does not claim that smoke complete.

## September 22 Version 28 production catch-up release

Version 28 is the current single-classroom production release. It preserves the stable Apps Script URL, private workbook, school-domain access and deploying-teacher execution identity while bringing production fully up to the current Hall Pass/Check-In source on protected `main`.

- The teacher browser contract now exactly matches the server contract, fixing the Version 27 stale-client mismatch that blocked teacher bootstrap/RPCs.
- The private `?mode=releasecheck` client now uses that same contract, so the required synthetic protected-action smoke can execute instead of being rejected before the test begins.
- Regression coverage now compares the server, teacher browser and release-check contract values so a future contract bump cannot silently ship only one side.
- Teacher bootstrap audits and repairs both background trigger classes. Routine dashboard polling throttles that trigger audit to once per hour.
- Owned background trigger IDs are cached in Script Properties, avoiding repeated project-trigger enumeration during normal trigger execution.
- Empty Check-In refreshes and idle minute-trigger ticks avoid the shared transaction lock.
- The one-minute durability trigger can resume waiting-line settlement if a return committed before normal queue advancement completed.
- The deployed source also includes the post-Version-27 safeguards that serialize workbook setup against live classroom/PIN-email writes and fall back to the authoritative attendance ledger when tail rows are out of chronological order.
- PR #118 passed the full release gate and browser acceptance after being brought to zero commits behind `main`.
- Production preflight run `35754508635` passed against Version 27, then deploy run `35754589935` updated the existing deployment in place to Version 28.
- Netlify production is `ready` on deploy `6ab2acfb9d374c000715447c` from the same source commit `f366947cc36b98ec5e82d9e7d26dcdd84c69b55e`; its enhanced secret scan reported no matches.

The authenticated `?mode=releasecheck` synthetic smoke is still required and has not been claimed complete. It must be run as the teacher; do not substitute a real student PIN or record.

## September 22 Version 27 commercial-hardening release

Version 27 was the prior single-classroom production release. It preserves the existing Apps Script deployment URL and private workbook while closing the backend/recovery issues found during the September 21–22 commercial-readiness audit.

- Daily Check-ins grows automatically beyond the former 1,000-row grid ceiling.
- Check-In partial-commit recovery repairs secondary streak/late-review state before durable inbox evidence is cleared.
- Live Check-In summaries are limited to active memberships and rebuild when roster/calendar inputs change.
- Student self-check-in closes at class end; unresolved late reviews persist until teacher action.
- Late self-check-in clears a prior active absence while preserving the original attendance fact as a CLEARED audit row.
- Prior-period unresolved passes remain visible but do not consume current-period capacity.
- PIN rotation revokes outstanding signed student sessions/proofs; obsolete cache-only sessions are rejected.
- Independent submissions converge on a canonical logical Check-In ID.
- Workbook header drift and duplicate Settings/calendar/active-roster keys fail closed.
- Polling is jittered and stale live-state failures are visible to teacher/student screens.
- Teacher browser RPCs require the current client contract, preventing stale open dashboard tabs from mutating a newer server.
- The live workbook no longer carries the inert `SCHOOL_CALENDAR_FILE_ID` or `SCHOOL_CALENDAR_FALLBACK_URL` settings.

Release run `35730498425` verified Version 27 deployment on the existing deployment ID with `DOMAIN` access and `USER_DEPLOYING` execution. No new Apps Script deployment URL was created.

## September 9 Version 24 duplicate-action release

Version 24 closes the rapid duplicate-action race discovered after the Version 23 inbox release without changing the stable Hall Pass URL, workbook schema or classroom policy.

- Student and teacher action controls reject overlapping submissions while an action is already in flight.
- Generic pass intent is stabilized so two rapid START submissions cannot be reinterpreted as an immediate RETURN.
- Repeated late-check-in review actions are idempotent rather than applying the same decision twice.
- The structural and runtime suites pass 314 behavioral checks across 21 areas, including the dedicated Issue #73 duplicate-action guard.
- The in-place deploy bridge completed successfully as Apps Script Version 24 and preserved the existing deployment ID, URL, access mode and execute-as setting.
- The separate protected post-deployment `?mode=releasecheck` smoke is still required by this operating record and is not yet recorded for Version 24. Do not call that evidence current until it is rerun and recorded.

## September 9 Version 23 Daily Check-In inbox release

Version 23 removed Daily Check-In from the shared workbook lock without changing Hall Pass capacity behavior or the workbook schema.

- A student check-in is first stored under one private, student/date-specific Script Properties key. The one-use PIN proof is deleted only after that durable write succeeds.
- Repeated submissions resolve to the same logical student/date event. The workbook flusher also deduplicates against rows already present before deleting inbox entries.
- Student and teacher responses merge unflushed inbox entries with the workbook, so a busy Sheet cannot make a recorded arrival disappear from either screen.
- An idle request flushes immediately without waiting. A one-minute owner trigger and the existing daily cleanup provide background recovery, using one `setValues` batch followed by `SpreadsheetApp.flush()`.
- Pass requests and returns retain the shared lock because `MAX_ACTIVE_PASSES`, queue order, and return settlement require a serialized room decision.
- Version 23 local evidence reached 311 behavioral checks, including a refused workbook lock, a thirty-student burst visible before flush, an interrupted-response replay, duplicate flush recovery, trigger authorization, late review, absences and Hall Pass regressions.

The dependency-complete canonical gate, protected merge, production preflight and in-place deploy bridge have passed for Version 29. Real-class observation and the authenticated synthetic release smoke remain pending evidence. Do not create a new deployment or URL.

## Session and teacher policy

- Student check-in counts as on time from the selected class start through the teacher-configured on-time window. Students are not blocked afterward: a late sign-in is recorded immediately at 0 points until the teacher reviews whether to award the daily point. Teacher-entered late attendance requires a private reason.
- New bathroom requests close during the selected class's first and last ten minutes. Active passes remain returnable after the bell. Waiting rows expire at class end and promotion rechecks eligibility.
- Bell Schedule holds NORMAL, REDUCED and HALF profiles for all six periods. Period 4 uses B Lunch; reduced-day Period 5 comes before Period 4. School Calendar chooses the profile for explicit dates. Invalid or missing schedules require teacher review.
- Marking-period allowance and its evidence are per class membership. Daily limits and cooldown remain student-wide.
- Private pass-access controls offer Standard, No pass limit and Teacher escort only across retained memberships. No pass limit bypasses numeric limits and cooldown, while class timing still applies. Escort status and reasons stay private; student responses use a generic ask-the-teacher message.
- Teacher Actions preserves actor, time, class, reason, restrictions bypassed and associated record. Changed teacher controls reject stale clients with a refresh message.

## Daily and weekly checks

- Watch the private teacher dashboard's Hall Pass retry card during pass traffic. Daily Check-In no longer uses that shared workbook lock. A separate inbox warning appears only when a recorded check-in has waited more than two minutes for workbook synchronization; the dashboard totals already include it, and students must not submit again.
- Confirm `/pass/`, `/check-in/` and the Hall Pass card in `/tools/` still load and still point at the current `/exec` deployment.
- Watch Pass Log growth against the 180-day retention window, and confirm rows are moving into Pass Audit rather than being dropped.
- Add official school-calendar amendments to the School Calendar tab as the district publishes them.

## Open verification work

1. **Classroom field cycle — FIELD_PENDING.** Observe the on-time-to-late check-in transition, a late-sign-in point review, a waiting-line handoff, a bell boundary and an active return after the bell during real classes. Version 17's teacher cold-start recheck passed; investigate only a reproduced new delay. Do not claim field verification from synthetic results.
2. **Roster change versus PIN-email batch.** Version 15 added `assertPinEmailBatchIdle_` to the roster,
   PIN-generation, PIN-card and identity-repair paths. The acceptance test still needs to run on
   controlled fixtures or a private test copy: prove that a roster addition, deactivation, reactivation
   or email correction made after a delivery batch assembled its recipients cannot send a credential to
   a stale address, and that the recorded delivery status matches the address actually used. Never
   exercise this against the live roster or by sending real mail.
3. **Version 29 protected release smoke.** Preflight run `35772765535` passed and deploy run `35772904099` deployed Version 29 in place from source `d64bec5fd0ed8f3ddae2f9eb141979ce03d7926f`. The bridge verified the existing deployment ID, stable URL, `DOMAIN` access and `USER_DEPLOYING` execution. The separate authenticated `?mode=releasecheck` synthetic smoke is still pending; run it as the teacher with only the isolated synthetic credential and record the result separately.
4. **`NEEDS_RESEND` credential records.** Ten PIN-card records were repointed to corrected addresses
   during the identity migration, and their delivery status was set to `NEEDS_RESEND` because a prior
   `SENT` marker could not prove delivery to the corrected address. All ten students had already used
   their PINs successfully, so this is not a reason for a roster-wide reset. Review each record, decide
   whether that student actually needs another delivery, and keep any real send a separate,
   teacher-confirmed action.
5. **Recovery rehearsal.** Use preserved Version 18 source and its additive schema on a synthetic copy. Never roll bathroom service back to Versions 14, 15 or 16: all carry the AUTO_PASS defect. Version 17 remains a historical safe authorization baseline, not an automatic rollback for the newer session policy.

## Release gate

Run before any production change:

```sh
npm.cmd run verify
```

Then follow the gates in `DEPLOY.md`: verify the Apps Script editor against the tracked source,
update the existing deployment rather than creating a new URL, and smoke student, kiosk, check-in
and teacher modes without using a real student PIN.

Once the one-time Google OAuth environment is configured, `AUTOMATED-DEPLOY.md` is the preferred source/deployment path. Its GitHub Actions bridge performs the same five-file draft/read-back/deployment-identity checks, runs the canonical release gate itself, and can be invoked through the owner-only release-control commands on GitHub issue #28. It does **not** replace the required post-deployment `?mode=releasecheck` synthetic protected-action smoke.
