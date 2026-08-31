# GrantDesk Classroom Log — Google setup and updates

## One-time setup

1. Open the **GrantDesk Hall Pass — Private Log** Google Sheet using `gauch@mtmorrisschools.org`.
2. Paste the active roster into the **Roster** tab. Required columns are school email, student name, and class/period. A student may appear once per enrolled class. Repeated email addresses stay class-specific memberships, but every membership for one student shares a single PIN. Leave PIN Hash blank; Active may be blank or TRUE.
3. Open **Extensions → Apps Script**.
4. Replace `Code.gs` with the local `Code.gs`, add an HTML file named `Index` and paste `Index.html`, and replace the manifest with `appsscript.json`.
5. Run `setupProject` once and approve the requested school-Google permissions.
6. Return to the Sheet and use **GrantDesk Pass → Generate missing student PINs**. Print the PIN Cards tab or use the teacher dashboard's preview-and-confirm email control. Clear the PIN Cards tab only after distribution is complete.
7. In Apps Script choose **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone in mtmorrisschools.org** (this must cover the `students.mtmorrisschools.org` secondary domain; check it with one student account before a class depends on it)
8. Copy the `/exec` URL. Student hall pass is that URL; kiosk mode adds `?mode=kiosk`; daily check-in adds `?mode=checkin`; teacher mode adds `?mode=teacher`.
9. Put the student `/exec` URL into `src/data/pass-config.json`, then publish GrantDesk.

## Updating to a new version

Replace `Code.gs` and `Index.html`, save, then choose **Deploy → Manage deployments → Edit → New version → Deploy**. Keep the existing web-app URL so GrantDesk links do not change.

**Open the teacher dashboard once immediately after deploying.** The first request after a schema change repairs the workbook: it adds any missing tabs, columns, and settings, installs the Roster checkboxes, and re-checks that every student has one PIN. That repair takes several seconds on a full roster and runs only once per schema version, so it is better absorbed by you than by a student at the bell.

## How the pieces behave

**Cost per page load.** Workbook repair is gated behind `GD_SCHEMA_VERSION` in a script property, and every sheet read inside a request is memoized. A student opening the check-in page costs about eight spreadsheet round-trips rather than rebuilding the workbook each time. Bump `GD_SCHEMA_VERSION` whenever the tab or column layout changes; nothing else triggers a repair.

**Identity.** Every student has one six-digit PIN that works in all of their Mr. Grant classes. A student enrolled in more than one class chooses the class after being identified, whether they arrived by school Google account or by PIN. When Google does not expose a signed-in address to the script, the app falls back to the PIN screen instead of failing.

**Class rosters.** Teacher mode can add a student to a class, reactivate a previously removed class membership, and remove a dropped student from one class. A new student receives one PIN automatically; adding an existing student to another class reuses that same PIN. Removal deactivates only the selected class membership, so private check-in/pass history and the student’s PIN remain available if the student is re-added later. An active pass must be marked returned, and a waiting-line entry removed, before that class membership can be deactivated.

**Daily check-in.** Each active roster membership can receive one `CHECKED_IN` row and one point per school date, no matter how often the button is pressed. Confirmations show a current and best school-day streak; Saturday and Sunday are skipped, so Friday into Monday stays consecutive, and a weekend press never counts as a streak day.

**Hall pass.** When every concurrent slot is occupied, students join a line and see only their own numbered position. The student at the front has `QUEUE_CLAIM_MINUTES` (default 3) to press start before the line moves on, and any entry older than `QUEUE_MAX_WAIT_MINUTES` (default 20) is dropped so one hour's line cannot carry into the next. Passes record start time, return time, and minutes out. The teacher view shows the ordered line, flags a pass past `LATE_AFTER_MINUTES`, and can remove a waiting student or end an active pass.

**Allowances.** `MAX_ACTIVE_PASSES` controls how many students may be out at once. `STUDENT_PASS_LIMIT` is the per-student allowance for the marking period, counted per student across every class, with 0 meaning unlimited. Nothing resets on a date; the teacher presses **reset every student to zero**, confirms, and a new counting window begins while the private history, active passes, running timers, and the waiting line are all left alone.

**Unlimited students.** The Roster tab's **Unlimited Passes** column is a checkbox, mirrored by a checkbox in the teacher dashboard's per-student table. A checked student is exempt from `STUDENT_PASS_LIMIT` in every class. The setting is teacher-only: no student screen shows it, no reason for it is stored, and the exemption never appears in a student payload.

**PIN delivery.** One private message per school email, carrying that student's single PIN. Preview first, then confirm twice with the exact phrase `EMAIL PINS`. Already-sent rows are skipped on later runs, delivery status lands on the private PIN Cards tab, and the server refuses to start when the remaining daily mail quota is below the ready recipient count. The batch guards itself with a script property rather than the script lock, so a long send never blocks a student pressing a button in class.

**Shared devices.** A PIN session lasts one hour and clears itself after two idle minutes, a few seconds after a pass starts or ends, and shortly after a check-in confirmation. The next student sees the PIN screen rather than the previous student's name.

**Privacy.** Do not share the Google Sheet with students. The web app reads and writes it under the teacher account while limiting app access to the school Workspace domain. Student payloads carry only that student's own data; roster PIN hashes and other students' names and addresses never reach a student browser.
