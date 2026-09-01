# GrantDesk Classroom Log — one-time Google setup

## Release safety

The deployable `Code.gs`, `Index.html`, and `appsscript.json` in this folder are the merged 2026-09-01 recovery source. They preserve the public Version 9 protections while adding the supplied teacher roster-management controls. The exact live and supplied inputs are retained under `apps-script/snapshots/hall-pass/`.

Before any deployment:

1. Run `npm.cmd run hall-pass:test` from the site repository.
2. Compare the Apps Script editor against these tracked files. Do not deploy a stale snapshot.
3. Preserve the existing public deployment ID and domain-only manifest settings. Create a new version of the existing deployment; do not create a replacement public URL.
4. Verify student, kiosk, check-in, and teacher modes after deployment without using or reproducing a real student PIN.

The Drive-supplied Version 10 snapshot must not be deployed by itself: it removes the unmatched-sign-in ledger and regresses student-payload privacy, cleanup authorization/locking, atomic PIN-email claiming, and teacher-dashboard refresh behavior.

### 2026-09-01 release record

After source recovery, additive snapshotting, comparison, and local regression testing, the merged source was saved and released as Apps Script **Version 11** by updating the existing public deployment. The deployment URL did not change. The deployed configuration was read back as executing as the deploying teacher with access limited to Mt. Morris Consolidated Schools.

Post-deployment verification passed for student, kiosk, check-in, and teacher entry paths without using a real student PIN. The public `/pass/` and `/check-in/` pages both still target the same deployment, and the check-in page retains `mode=checkin`.

1. Open the **GrantDesk Hall Pass — Private Log** Google Sheet using `gauch@mtmorrisschools.org`.
2. Paste the active roster into the **Roster** tab. Required columns are school email, student name, and class/period. A student may appear once per enrolled class. Repeated email addresses remain class-specific memberships, but every membership for the same student uses one shared PIN. Leave PIN Hash blank; Active may be blank or TRUE.
3. Open **Extensions → Apps Script**.
4. Replace `Code.gs` with the local `Code.gs` file, add an HTML file named `Index`, paste `Index.html`, and replace the manifest with `appsscript.json`.
5. Run `setupProject` once and approve the requested school-Google permissions.
6. Return to the Sheet and use **GrantDesk Pass → Generate missing student PINs**. Print/distribute the PIN Cards tab, or use the private teacher dashboard’s preview-and-confirm email control. Clear the PIN Cards tab only after distribution is complete.
7. In Apps Script choose **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone in mtmorrisschools.org**
8. Copy the `/exec` URL. Hall-pass student mode is that URL; kiosk mode adds `?mode=kiosk`; daily check-in adds `?mode=checkin`; teacher mode adds `?mode=teacher`.
9. Put the student `/exec` URL into `src/data/pass-config.json`, then publish GrantDesk.

The first request after this version is installed creates a **Daily Check-ins** tab automatically. Each active roster student can receive only one `CHECKED_IN` row and one point per school date, even if the button is pressed repeatedly. The teacher view combines today’s roster counts, check-in log, backup check-in control, and hall-pass controls.

The app also creates a private **Pass Queue** tab. When all concurrent pass slots are occupied, students can join the line and see only their own numbered position. The teacher sees the ordered line, can remove an entry, can set both the number allowed out at once and the number of passes allowed per student during a marking period, and can reset every student’s count to zero with a confirmation button. Counts never reset on hardcoded dates. A reset starts a new counting window while preserving private pass history, active passes, timers, and the waiting line.

The private teacher dashboard can also add, reactivate, and deactivate individual class memberships. Re-adding an existing student preserves that student’s shared PIN and unlimited-pass setting. Deactivating a membership keeps private pass and check-in history and is refused while that class membership has an active pass or waiting-line entry.

Daily check-in confirmations show each student’s current and best school-day streak. Saturday and Sunday are skipped when determining consecutive days, so a Friday-to-Monday check-in remains consecutive.

PIN email distribution sends one shared student PIN in one private message per school email. Students enrolled in multiple classes choose the relevant class after their PIN identifies them. Preview first, then use the exact `EMAIL PINS` confirmation phrase. Already-sent PIN rows are skipped on later runs, delivery status is recorded on the private PIN Cards tab, and the server refuses to begin if the remaining daily recipient quota is below the ready recipient count.

For later code updates, replace `Code.gs` and `Index.html`, save, then choose **Deploy → Manage deployments → Edit → New version → Deploy**. Keep the existing web-app URL so GrantDesk links do not change.

Do not share the Google Sheet with students. The web app reads and writes it under the teacher account while limiting app access to the school Workspace domain. Student screens show only the active student’s own pass or check-in confirmation.
