# Update the existing Turn In service

This is an update to the existing service, not a new setup. Do not recreate the
workbook, change Hall Pass properties, or replace the stable web app URL.

1. Open the existing **the desk · Turn In** project in Google Apps Script.
2. Replace only `Code.gs` with `apps-script/turn-in/Code.gs` from this release.
3. Save and run setup to append the How header and install automatic submission. Then use **Deploy → Manage deployments → Edit → New version → Deploy**.
4. Open the existing `/exec` URL. It should report
   `version: 2026-10-08-turn-in-v6` and `ready: true`.
5. Run the synthetic load test described in `SETUP.md`. Count actual unique
   rows in **Load Test**, not just success responses. Turn the test off afterward.

This version refuses a busy draft save until it has reached the sheet, rejects
oversized answers instead of truncating them, authenticates retries, and finds
previous submissions in the sheet after the short-lived cache expires. It keeps
all student work and the existing existing columns, plus an appended How column.

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

Deployment evidence must be recorded separately from repository tests. The
live service was observed as v3 on October 8, 2026; v6 deployment is pending.
