# GrantDesk Hall Pass — steady-state operations

Issue #14 is closed. Version 24 is deployed. The tracked source, in-place deployment and synthetic runtime suite are verified; the separate Version 24 protected post-deployment `?mode=releasecheck` result is not yet recorded here. This file is the current operating checklist; GitHub Issue #16 is a separate historical operations record. Classroom observation remains FIELD_PENDING.

Production fingerprint as of 2026-09-09 (Version 24):

| Fact | Value |
| --- | --- |
| Deployed application source | `afde2972782bcd1626efc1ee1de7bc5dede42c7c`, merged through PR #73; duplicate-action race guard included |
| Apps Script version | 24, existing deployment ID and stable URL preserved; `DOMAIN` access and `USER_DEPLOYING` execution verified |
| Workbook schema | `2026-09-05-session-a`; unchanged by Versions 23–24 |
| Release evidence | GitHub Actions run `34385311732`; canonical gate, five-file replacement/read-back and 314 runtime behavior checks passed |

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

The dependency-complete canonical gate, protected PR, in-place deploy bridge and five-file source read-back have passed for Version 24. Real-class observation and the Version 24 protected post-deployment releasecheck remain pending evidence. Do not create a new deployment or URL.

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
3. **Version 24 release evidence — partial until protected smoke is recorded.** GitHub Actions run `34385311732` deployed Version 24 in place after the canonical gate and 314 runtime checks passed, including the Issue #73 duplicate-action guard. The last protected post-deployment `?mode=releasecheck` result recorded in the prior operating state belongs to Version 23. Rerun and record the protected smoke for Version 24 before marking this item fully passed. No real student PIN or email should be used.
4. **`NEEDS_RESEND` credential records.** Ten PIN-card records were repointed to corrected addresses
   during the identity migration, and their delivery status was set to `NEEDS_RESEND` because a prior
   `SENT` marker could not prove delivery to the corrected address. All ten students had already used
   their PINs successfully, so this is not a reason for a roster-wide reset. Review each record, decide
   whether that student actually needs another delivery, and keep any real send a separate,
   teacher-confirmed action.
5. **Netlify deploy fingerprint.** Read the successful Netlify deployment record and tie its deploy ID,
   timestamp and production URL to the relevant release commit, so the public-release proof is as
   recoverable as the Apps Script and workbook fingerprints.
6. **Recovery rehearsal.** Use preserved Version 18 source and its additive schema on a synthetic copy. Never roll bathroom service back to Versions 14, 15 or 16: all carry the AUTO_PASS defect. Version 17 remains a historical safe authorization baseline, not an automatic rollback for the newer session policy.

## Release gate

Run before any production change:

```sh
npm.cmd run verify
```

Then follow the gates in `DEPLOY.md`: verify the Apps Script editor against the tracked source,
update the existing deployment rather than creating a new URL, and smoke student, kiosk, check-in
and teacher modes without using a real student PIN.

Once the one-time Google OAuth environment is configured, `AUTOMATED-DEPLOY.md` is the preferred source/deployment path. Its GitHub Actions bridge performs the same five-file draft/read-back/deployment-identity checks, runs the canonical release gate itself, and can be invoked through the owner-only release-control commands on GitHub issue #28. It does **not** replace the required post-deployment `?mode=releasecheck` synthetic protected-action smoke.
