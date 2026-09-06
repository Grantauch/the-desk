# GrantDesk Hall Pass — steady-state operations

Issue #14 is closed. Version 18 is deployed and synthetically verified. This file is the current operating checklist; GitHub Issue #16 is a separate historical operations record. Classroom observation remains FIELD_PENDING.

Production fingerprint as of 2026-09-06 (Version 18):

| Fact | Value |
| --- | --- |
| Deployed application source | `a7ea2b25358ba9dc686a299730b32b492e4da339`, pushed to main; GitHub Actions passed |
| Apps Script version | 18, existing deployment and stable URL preserved |
| Workbook schema | `2026-09-05-session-a`; native rehearsal and focused live migration passed |
| Recovery source | `apps-script/snapshots/hall-pass/version-18-live-2026-09-06`; preserve the additive schema |

## Session and teacher policy

- Student check-in opens at the selected class start and closes five minutes later. Teacher late attendance requires a private reason.
- New bathroom requests close during the selected class's first and last ten minutes. Active passes remain returnable after the bell. Waiting rows expire at class end and promotion rechecks eligibility.
- Bell Schedule holds NORMAL, REDUCED and HALF profiles for all six periods. Period 4 uses B Lunch; reduced-day Period 5 comes before Period 4. School Calendar chooses the profile for explicit dates. Invalid or missing schedules require teacher review.
- Marking-period allowance and its evidence are per class membership. Daily limits and cooldown remain student-wide.
- Private pass-access controls offer Standard, No pass limit and Teacher escort only across retained memberships. No pass limit bypasses numeric limits and cooldown, while class timing still applies. Escort status and reasons stay private; student responses use a generic ask-the-teacher message.
- Teacher Actions preserves actor, time, class, reason, restrictions bypassed and associated record. Changed teacher controls reject stale clients with a refresh message.

## Daily and weekly checks

- Watch the private teacher dashboard's retry-signal card during first-hour traffic. A small
  non-zero count means automatic recovery absorbed a collision. A large or climbing count on a
  normal day is worth investigating; it is never evidence of a PIN or roster problem.
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
3. **Synthetic release evidence — passed.** Version 18's deployed protected check completed with fresh-PIN STARTED, fresh-PIN RETURNED_COUNTABLE, membership evidenceUsed 1, test pass voided, test membership deactivated and production facts unchanged. Native migration on a synthetic copy also passed, including repeatability. The 298 local behavior checks cover schedule boundaries, queue promotion/expiry, replay, stale clients, countability, privacy and teacher overrides. No real student PIN or email was used.
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
