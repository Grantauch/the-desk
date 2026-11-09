# Private student-work review and Classroom handoff

The **Review** tab lives in the existing private Turn In workbook. Its sharing
stays private. Choose a class, a hub, and optionally a status in the controls at
the top. The view joins active roster memberships to current Progress by email,
class, and hub. It shows every active student in that class, including **No saved
work received**. This label means no progress record has arrived; it is not a
grade or a Google Classroom missing status.

Current answers and save times update from Progress without a new student
request or another write per autosave. **Last finished** remains visible when
later edits change the current status to **In progress**. **Open finished copies**
leads to the unchanged, append-only Turn Ins tab.

**Review Roster** is derived private membership data. v8 setup refreshes it from
the read-only Hall Pass roster and installs one daily owner refresh. The owner
can run `refreshTeacherReview` after roster changes. No PINs or PIN hashes enter
the review tab. Existing Turn Ins, Drafts, Progress, and teacher link settings are
preserved.

## Assignment links

In **Classroom Links**, paste the student-facing Classroom assignment URL on the
row for the exact class and hub. A normal assignment URL looks like
`https://classroom.google.com/c/COURSE/a/ASSIGNMENT/details`. The class and hub
columns have dropdowns; links remain in the private workbook. Leave the URL blank
until it is known. Do not infer assignment IDs or put private mappings in GitHub.
Duplicate nonblank mappings are ambiguous and are ignored. Only HTTPS links on
`classroom.google.com` with an assignment path are accepted. Changes can take up
to one minute to reach a new sign-in or submission.

After a successful Turn In, the student sees **Open Classroom assignment** when
an exact link is available, or **Open Google Classroom** otherwise. The message
explains that the finished work is saved on the desk and the student must choose
**Turn In** or **Mark as done** in Classroom. The button opens a new tab and does
not claim to change Classroom status. New edits, class changes, failed turn-ins,
and sign-out hide the previous completion handoff. It requires no extension.

The site update also works with the existing v7 backend: confirmed finishing
still shows the safe Classroom home link. Exact private assignment links and
daily membership refresh require the v8 Apps Script deployment.

## Installation and verification

`scripts/lib/turn-in-review-sheet.mjs` generates native Sheets requests without
school identifiers. `scripts/build-turn-in-review.mjs` discovers the 33 currently
wired hubs and accepts installation-specific review, roster, links, and finished
sheet IDs as four arguments. The default IDs are synthetic examples. Use the
connected Google Sheets account to add the view to the existing workbook; never
make a public copy. Test the formula with invented students in separate hidden
QA tabs before adding the real view.

Deploy v8 to the existing stable Apps Script endpoint, run setup, and verify the
health response. This does not require a new deployment URL, workbook, or scope.
Use the existing synthetic release proof; never test with a real student's PIN.
Verify the public saving script against the protected merged release separately.
