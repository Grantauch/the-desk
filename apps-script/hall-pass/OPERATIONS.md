# GrantDesk Hall Pass — steady-state operations

Issue #14 is closed. Version 23 is deployed and synthetically verified. This file is the current operating checklist; GitHub Issue #16 is a separate historical operations record. Classroom observation remains FIELD_PENDING.

Production fingerprint as of 2026-09-09 (Version 23):

| Fact | Value |
| --- | --- |
| Deployed application source | `47ce8b0ae085528ba7c6cef36a1d2c4c7ccfaa42`, merged through PR #71; full GitHub and browser gates passed |
| Apps Script version | 23, existing deployment ID and stable URL preserved; `DOMAIN` access and `USER_DEPLOYING` execution verified |
| Workbook schema | `2026-09-05-session-a`; unchanged by the inbox release |
| Release evidence | GitHub Actions run `34375381483`; five-file replacement/read-back and protected synthetic smoke passed |

## September 9 Daily Check-In inbox release

Version 23 removes Daily Check-In from the shared workbook lock without changing Hall Pass capacity behavior or the workbook schema.

- A student check-in is first stored under one private, student/date-specific Script Properties key. The one-use PIN proof is deleted only after that durable write succeeds.
- Repeated submissions resolve to the same logical student/date event. The workbook flusher also deduplicates against rows already present before deleting inbox entries.
- Student and teacher responses merge unflushed inbox entries with the workbook, so a busy Sheet cannot make a recorded arrival disappear from either screen.
- An idle request flushes immediately without waiting. A one-minute owner trigger and the existing daily cleanup provide background recovery, using one `setValues` batch followed by `SpreadsheetApp.flush()`.
- Pass requests and returns retain the shared lock because `MAX_ACTIVE_PASSES`, queue order, and return settlement require a serialized room decision.
- Local evidence: 73 handoff mappings, structural suite, and 311 behavioral checks pass, including a refused workbook lock, a thirty-student burst visible before flush, an interrupted-response replay, duplicate flush recovery, trigger authorization, late review, absences, and Hall Pass regressions.

The dependency-complete canonical gate, protected PR, in-place deploy bridge, five-file source read-back, protected synthetic smoke, and four-mode live initialization all passed. Real-class observation remains the only release-specific field evidence still pending. Do not create a new deployment or URL.

## Session and teacher policy

- Student check-in opens at the selected class start and closes five minutes later. Teacher late attendance requires a private reason.
- New bathroom requests close during the selected class's first and last ten minutes. Active passes remain returnable after the bell. Waiting rows expire at class end and promotion rechecks eligibility.
- Bell Schedule holds NORMAL, REDUCED and HALF profiles for all six periods. Period 4 uses B Lunch; reduced-day Period 5 comes before Period 4. School Calendar chooses the profile for explicit dates. Invalid or missing schedules require teacher review.
- Marking-period allowance and its evidence are per class membership. Daily limits and cooldown remain student-wide.
- Private pass-access controls offer Standard, No pass limit and Teacher escort only across retained memberships. No pass limit bypasses numeric limits and cooldown, while class timing still applies. Escort status and reasons stay private; student responses use a generic ask-the-teacher message.
- Teacher Actions preserves actor, time, class, reason, restrictions bypassed and associated record. Changed teacher controls reject stale clients with a refresh message.

## Daily and weekly checks

- Watch the private teacher dashboard's Hall Pass retry card during pass traffic. Daily Check-In
  does not use that lock in Version 23. A separate inbox warning appears only when
  a recorded check-in has waited more than two minutes for workbook synchronization; the dashboard
  totals already include it, and students must not submit again.
- Confirm `/pass/`, `/check-in/` and the Hall Pass card in `/tools/` still load and still point at
  the current `/exec` deployment.
- Watch Pass Log growth against the 180-day retention window, and confirm rows are moving into
  Pass Audit rather than being dropped.
- Add official school-calendar amendments to the School Calendar tab as the district publishes them.

## Open verification work

1. **Classroom field cycle — FIELD_PENDING.** Observe check-in closure, a waiting-line handoff, a bell boundary and an active return after the bell during real classes. Version 17's teacher cold-start recheck passed; investigate only a reproduced new delay. Do not claim field verification from synthetic results.
2. **Roster change versus PIN-email batch.** Version 15 added `assertPinEmailBatchIdle_` to the roster,
   PIN-generation, PIN-card and identity-repair paths. The acceptance test still needs to run on
   controlled fixtures or a private test copy: prove that a roster addition, deactivation, reactivation
   or email correction made after a delivery batch assembled its recipients cannot send a credential to
   a stale address, and that the recorded delivery status matches the address actually used. Never
   exercise this against the live roster or by sending real mail.
3. **Synthetic release evidence — passed.** Version 23's deployed protected check completed with fresh-PIN STARTED, fresh-PIN RETURNED_COUNTABLE, membership evidenceUsed 1, test pass voided, test membership deactivated, production facts unchanged and `ok: true`. The 311 behavioral checks cover the thirty-student check-in burst, refused-lock recording, interrupted-response replay, duplicate flush recovery, schedule boundaries, queue promotion/expiry, stale clients, countability, privacy and teacher overrides. No real student PIN or email was used.
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
