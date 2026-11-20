# Update the existing Turn In service

## v18 current PIN sign-in

Every PIN sign-in reads the current credential roster instead of accepting a
ten-minute cached copy. A corrected PIN works on the next sign-in, and an old
PIN or inactive membership is refused immediately. Membership and token checks
reuse that fresh read within the same request; autosave caching and write locks
retain their existing behavior. Existing account sessions keep their current
revocation and expiry behavior; this change applies to new PIN sign-ins.

The shared website prompt tells students to use the PIN that currently works
for Daily Check-In or Hall Pass, and warns that an older PIN email can be out of
date. This prompt is compatible with the existing deployed service.

Deploy v18 through the existing production release workflow after its current
approval and draft-preservation checks pass. Verify the stable `/exec` reports
`2026-11-20-turn-in-v18`. No setup, workbook migration, PIN reset, or directory
switch is required. A website release does not deploy this server change.

For a directory connection, use the Hall Pass teacher preview, which refuses a
connection with unmatched active memberships. Do not insert a directory setting
directly to work around a student's rejection; that bypasses the coverage check
and can remove other students' current sign-in credentials.

## v15 classroom traffic recovery

Sign-in, save and Turn In reuse the roster within a single request. The existing roster cache, PIN rules and write lock stay in place across requests. Slow requests (10 seconds or longer) write a `turn_in_slow_request` event in private execution logs with the action, total time, roster time, draft lookup time and lock wait. The event contains no student data. Use it to distinguish roster reads and write-lock contention from delay elsewhere in a request.

The website update works with the existing Apps Script deployment. It staggers automatic saves, preserves the retry delay while students continue typing, and lets a slow sign-in finish within one 30-second request before the student retries.

Release v15 through the guarded Turn In workflow, using the existing deployment. No sheet migration or setup is required. Confirm `2026-11-19-turn-in-v15` and `checkedWritesRequired: true` on the existing `/exec`. Run the private dependency check and verify the synthetic classroom write count before claiming server rollout.

## v14 assignment sign-in diagnostics

This release pairs the shared `desk-save.js` client with Turn In v14 on the existing deployment. The student keeps the existing sign-in message and can report a support code. In the private Apps Script Executions dashboard, open the `doPost` execution near the reported time and match its `turn_in_signin_failed` log entry by support code. The log supplies the assignment, version, stage, and reason without logging PINs, names, emails, answers, or raw exception text. Browser-only codes identify a timeout, network failure, unexpected response, or local loading failure. With an earlier Turn In deployment, the new website shows category codes such as `TI-PIN` and `TI-SETUP`. Request-level log correlation requires v14.

From the Apps Script editor, run `checkTurnInSignInHealth` after deployment to verify that the roster, configured directory, and assignment workbook can be read. This check bypasses the roster cache and makes no spreadsheet changes. Check the existing `/exec` reports `2026-11-19-turn-in-v14` and `checkedWritesRequired: true`, then send one known unassigned synthetic PIN through a live assignment. Verify the student sees a support code and match it to the private log. Use synthetic fixtures for positive sign-in regression. No workbook migration or setup is required.

The v12 release (Oct 29 2026) stores a bounded cursor bookmark separately from answers and permits Turn In using the existing signed account session after refresh. Cursor-only updates preserve finished status, checked revisions and retry idempotency. No sheet migration or setup is needed. Deploy through the existing guarded workflow, preserving the workbook, stable endpoint and access settings.

The v11 release (Oct 29 2026) makes draft lookups read only the email and hub columns, so a save no longer holds the lock while reading every saved answer; lets a tab keep saving after its own save landed late; and always records a Turn In press, keeping a newer account version as current progress. Deploy with the Deploy Turn In Apps Script workflow.

The v10 release adds the private Writing Timeline sheet: each Turn In from the v3 website client carries the tab's writing timeline, summarized into counts and plain flags with replay data for `public/teacher/writing-replay.html`. A missing or malformed timeline never blocks a Turn In. Updating v9 to v10 needs no setup; the tab is created on the first Turn In, or run `addWritingTimelineSheet` once to see it now. Work protection stays on.

The v9 release adds revision-checked writes, receipt validation and account-token/PIN matching. The v8 companion added private review membership and optional per-class Classroom
assignment links. See [REVIEW.md](REVIEW.md). The existing private workbook and
web-app endpoint stay in place; v8 setup preserves existing work and link rows.

This is an update to the existing service, not a new setup. Do not recreate the
workbook, change Hall Pass properties, or replace the stable web app URL.

1. Open the existing **the desk · Turn In** project in Google Apps Script.
2. Replace only `Code.gs` with `apps-script/turn-in/Code.gs` from this release.
3. Save. Updating an already configured v8 project to v9 needs no setup or sheet migration. Use **Deploy → Manage deployments → Edit → New version → Deploy**.
4. Open the existing `/exec` URL. It should report
   `version: 2026-10-29-turn-in-v12`, `writeProtocol: 1`, and `ready: true`.
5. After the v2 website client is live, run `activateWorkProtection` in this existing project. The health response must then show `checkedWritesRequired: true`. Older open pages must copy/download their pending work and reload. Until activation, legacy writes remain compatible and unprotected by revisions.
6. Run the synthetic load test described in `SETUP.md`. Count actual unique
   rows in **Load Test**, not just success responses. Turn the test off afterward.

See [the October 26 audit](../../docs/storyhub/SAVE-LOAD-AUDIT-2026-10-26.md) for evidence limits and the coordinated release sequence.

This version refuses a busy draft save until it has reached the sheet, rejects
oversized answers instead of truncating them, authenticates retries, and finds
previous submissions in the sheet after the short-lived cache expires. It keeps
all student work and the existing existing columns, plus a separate current Progress view. Account saves update progress; only the Turn In button declares work finished.

The original attached `turn-in-autosave.patch` predates the production concurrency
fix. Do not reapply it over the current repository.

# Connect the grading workflow

GoClassroom v0.9.33 adds **Student work → StoryHub turn ins** under Draft grading.
Paste the private Turn In workbook link into the app and press **Read hub turn
ins**. Choose the Classroom class, assignment, and matching hub/period. Start with
a preview. The app verifies Classroom student emails, uses the newest submitted
answers, and leaves ambiguous evidence for teacher review. It does not change
sheet sharing or use a student PIN to read the teacher's workbook.

Classroom draft writing keeps its separate opt-in and native confirmation.
Returning grades to students remains the teacher's action in Google Classroom.

Deployment evidence is recorded separately from repository tests in the repair ledgers. The October 8 v6 release is the source baseline for v7; this release preserves the workbook and stable endpoint.
