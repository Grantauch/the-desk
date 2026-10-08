# Update the existing Turn In service

This is an update to the existing service, not a new setup. Do not recreate the
workbook, change Hall Pass properties, or replace the stable web app URL.

1. Open the existing **the desk · Turn In** project in Google Apps Script.
2. Replace only `Code.gs` with `apps-script/turn-in/Code.gs` from this release.
3. Save and run setup to create the Progress view, migrate existing work, and remove the old automatic finishing trigger. Then use **Deploy → Manage deployments → Edit → New version → Deploy**.
4. Open the existing `/exec` URL. It should report
   `version: 2026-10-08-turn-in-v7` and `ready: true`.
5. Run the synthetic load test described in `SETUP.md`. Count actual unique
   rows in **Load Test**, not just success responses. Turn the test off afterward.

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
