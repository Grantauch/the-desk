# Update the existing Turn In service

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
