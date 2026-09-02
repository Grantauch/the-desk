# GrantDesk Classroom Log — one-time Google setup

## Release safety

The deployable `Code.gs`, `Index.html`, and `appsscript.json` in this folder build additively on the 2026-09-01 recovery source. They preserve the public Version 9 protections and Version 11 roster-management controls while implementing the September 2 Issue #14 transaction, queue, countability, calendar, permanent-audit, and identity-reconciliation contract. The exact live and supplied inputs are retained under `apps-script/snapshots/hall-pass/`.

Before any deployment:

1. Run `npm.cmd run hall-pass:test` from the site repository.
2. Compare the Apps Script editor against these tracked files. Do not deploy a stale snapshot.
3. Preserve the existing public deployment ID and domain-only manifest settings. Create a new version of the existing deployment; do not create a replacement public URL.
4. Verify student, kiosk, check-in, and teacher modes after deployment without using or reproducing a real student PIN.

The Drive-supplied Version 10 snapshot must not be deployed by itself: it removes the unmatched-sign-in ledger and regresses student-payload privacy, cleanup authorization/locking, atomic PIN-email claiming, and teacher-dashboard refresh behavior.

### 2026-09-02 Issue #14 release candidate

This source is ready for local verification before a production version is created. It has not been declared live merely because the repository copy exists.

- Every daily check-in, bathroom request, and return consumes its own short-lived, signed, server-tracked, one-use PIN proof. A prior identity session cannot authorize a later transaction.
- One verified bathroom request either starts immediately or enters the ordered line. The same request advances automatically when capacity opens; the student does not enter a second PIN or press a later start button.
- Future completed trips under 3.0 seconds are explicitly `NON_COUNTABLE`; trips at or above 3.0 seconds are `COUNTABLE`. Existing completed rows with blank classification remain legacy-countable and are never threshold-reclassified automatically.
- A teacher may mark a completed, currently countable trip not countable only through the private evidence dialog with a required reason. Original IDs, times, duration, method, authorization facts, and correction metadata remain intact.
- The operational **Pass Log** retains the configured 180-day window. Older completed rows are copied into **Pass Audit** before the hot row is removed, so no completed pass loses its sole record and normal polling never scans lifetime history.
- **School Calendar** is seeded from the official Drive PDF `26|27 - Student Calendar` (file `1Gd3ZENe41b1AWRLdbpQ2kdsZj0mEsgoz`, revised 08/14/26). Official no-school weekdays protect streaks; listed reduced and half days remain school days. The sheet can hold later official amendments.
- Setup performs only credential-backed identity repairs: a stale PIN-card address moves when its preserved PIN hash identifies exactly one active roster identity. PINs, class memberships, statuses, times, and history are preserved across Roster, PIN Cards, Daily Check-ins, Pass Log, Pass Queue, and Pass Audit. Delivery is reset to `NEEDS_RESEND` because a prior `SENT` marker does not prove delivery to the corrected address.
- The teacher dashboard keeps urgent active-pass and queue state open. Attendance lists, logs, rosters, rules, per-student counts, and PIN delivery are collapsible; open state, drafts, focus, and scrolling survive polling. Countable history is loaded only when the teacher asks to review a student.

### 2026-09-01 release record

After source recovery, additive snapshotting, comparison, and local regression testing, the merged source was saved and released as Apps Script **Version 11** by updating the existing public deployment. The deployment URL did not change. The deployed configuration was read back as executing as the deploying teacher with access limited to Mt. Morris Consolidated Schools.

Post-deployment verification passed for student, kiosk, check-in, and teacher entry paths without using a real student PIN. The public `/pass/` and `/check-in/` pages both still target the same deployment, and the check-in page retains `mode=checkin`.

1. Open the **GrantDesk Hall Pass — Private Log** Google Sheet using `gauch@mtmorrisschools.org`.
2. Paste the active roster into the **Roster** tab. Required columns are school email, student name, and class/period. A student may appear once per enrolled class. Repeated email addresses remain class-specific memberships, but every membership for the same student uses one shared PIN. Leave PIN Hash blank; Active may be blank or TRUE.
3. Open **Extensions → Apps Script**.
4. Replace `Code.gs` with the local `Code.gs` file, add an HTML file named `Index`, paste `Index.html`, and replace the manifest with `appsscript.json`.
5. Run `setupProject` once and approve the requested school-Google permissions.
6. Return to the Sheet and use **GrantDesk Pass → Generate missing student PINs**. Print/distribute the PIN Cards tab, or use the private teacher dashboard’s preview-and-confirm email control. Clear the PIN Cards tab only after distribution is complete.
7. For a first-ever installation only, choose **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone in mtmorrisschools.org**
8. Copy the `/exec` URL. Hall-pass student mode is that URL; kiosk mode adds `?mode=kiosk`; daily check-in adds `?mode=checkin`; teacher mode adds `?mode=teacher`.
9. Put the student `/exec` URL into `src/data/pass-config.json`, then publish GrantDesk. For this existing production app, update the current deployment through **Deploy → Manage deployments → Edit → New version** and retain the current `/exec` URL.

The first request after this version is installed creates or repairs **Daily Check-ins**, **Pass Audit**, and **School Calendar** automatically. Each active class membership can receive only one `CHECKED_IN` row and one point per school date, even if a fresh PIN is submitted repeatedly. The teacher view combines today’s roster counts, check-in log, backup check-in control, reversible absent marks, a searchable list of students who remain unmarked, and hall-pass controls. A student cannot erase a teacher absent mark from a student or PIN screen; the teacher can clear it or convert it to a late-arrival check-in while preserving the audit row.

The app also creates a private **Pass Queue** tab. When all concurrent pass slots are occupied, a fresh-PIN bathroom request joins the line automatically and the student sees only their own numbered position. The original verified request starts automatically when a slot opens. The teacher sees the ordered line, can remove an entry, and can set concurrent passes, marking-period and daily limits, a cooldown after return, and late/forgotten-pass warning times. The dashboard also identifies repeat trips and lets the teacher deliberately override a student cap for a backup pass. Marking-period counts reset only through the confirmed teacher control; the reset preserves private pass history, active passes, timers, and the waiting line.

A pass left `OUT` overnight is retained as an explicitly classified `ROLLED_OVER` audit event but cannot occupy the next school day’s live slot. The next teacher dashboard shows the rollover for review. Within the same day, late and forgotten-pass cards stay visible until the student enters a fresh PIN to return or the teacher records the return.

The teacher can choose chime, bell, tap, beep, or off for new sign-outs. The choice is stored only in that dashboard browser. Use **test sound** once after opening the page if the browser requires a user gesture before audio. The event detector compares both active passes and today’s log, so a short sign-out that begins and ends between dashboard refreshes still produces one alert.

The **sign-in problems** cards can be cleared from the teacher dashboard. Clearing changes the private ledger status to `CLEARED`; it does not delete the evidence. If that same unmatched school account tries again later, the card reopens so an unresolved roster problem cannot be hidden permanently.

The private teacher dashboard can also add, reactivate, and deactivate individual class memberships. Re-adding an existing student preserves that student’s shared PIN and unlimited-pass setting. Deactivating a membership keeps private pass and check-in history and is refused while that class membership has an active pass or waiting-line entry.

Daily check-in confirmations show each student’s current and best school-day streak. The official 2026–27 calendar, not a weekday-only guess, determines consecutive school days. Weekends and official no-school dates are skipped; reduced and half days count.

PIN email distribution sends one shared student PIN in one private message per school email. Students enrolled in multiple classes choose the relevant class after their PIN identifies them. Preview first, then use the exact `EMAIL PINS` confirmation phrase. Already-sent PIN rows are skipped on later runs, delivery status is recorded on the private PIN Cards tab, and the server refuses to begin if the remaining daily recipient quota is below the ready recipient count.

PIN identity sessions are signed and expire after one hour, but they cannot authorize a check-in, request, or return. Each protected action has a separate one-use proof that expires after three minutes and is consumed under the shared script lock. Anonymous kiosk failures are throttled per browser/device nonce with a separate high global circuit breaker, so mistakes on one kiosk do not lock every anonymous device.

For later code updates, replace `Code.gs` and `Index.html`, save, then choose **Deploy → Manage deployments → Edit → New version → Deploy**. Keep the existing web-app URL so GrantDesk links do not change.

Do not share the Google Sheet with students. The web app reads and writes it under the teacher account while limiting app access to the school Workspace domain. Student screens show only the active student’s own pass or check-in confirmation and, only when a policy block needs explanation, that same student’s currently counted trip evidence.
