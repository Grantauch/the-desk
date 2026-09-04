# GrantDesk Classroom Log — one-time Google setup

## Release safety

Ongoing production care, the open verification list, and the standing release gate live in
`OPERATIONS.md` beside this file. Issue #14 is closed; do not reuse it as a task list.

The deployable `Code.gs`, `Index.html`, and `appsscript.json` in this folder build additively on the verified 2026-09-02 Version 14 source. They preserve the public Version 9 protections, Version 11 roster-management controls, and Version 14 Issue #14 transaction, queue, countability, calendar, permanent-audit, and identity-reconciliation contract while adding the Version 15 classroom-contention recovery and the Version 16 shared-lock reduction. The exact live and supplied inputs are retained under `apps-script/snapshots/hall-pass/`.

Before any deployment:

1. Run `npm.cmd run hall-pass:test` from the site repository.
2. Compare the Apps Script editor against these tracked files. Do not deploy a stale snapshot.
3. Preserve the existing public deployment ID and domain-only manifest settings. Create a new version of the existing deployment; do not create a replacement public URL.
4. Verify student, kiosk, check-in, and teacher modes after deployment.
5. Submit one PIN through a synthetic test roster entry and complete a full pass request and return.
   Never a real student's PIN, and never a real student's record. Add a throwaway roster membership,
   read its plaintext PIN from the PIN Cards tab, run the round trip, then void the test pass and
   deactivate the membership.

Step 5 is not optional. Every release through Version 16 was smoked without submitting any PIN at
all, on the reasoning that no real student credential should be reproduced. That reasoning is sound
and stays, but it left the entire protected-action path unverified, because nothing past
`authorizeStudentAction` executes until a PIN is accepted. Version 16 consequently shipped a fault
that rejected every bathroom request in production with "Refresh this page before trying that
student action" while daily check-in kept working, and it survived a full release smoke plus a
public-site verification. A synthetic credential satisfies both requirements at once.

The Drive-supplied Version 10 snapshot must not be deployed by itself: it removes the unmatched-sign-in ledger and regresses student-payload privacy, cleanup authorization/locking, atomic PIN-email claiming, and teacher-dashboard refresh behavior.

### 2026-09-03 Version 17 student pass authorization fix

Apps Script **Version 17** was created on the existing deployment at 9:33 PM on September 3, 2026.
Deployment ID `AKfycby2cAUsc1T0tTQkIWTrGwdOrfD2p5cX3EKBG3obW-QY2Ndd8T-cpjoT8bXU__on-qWa`, the `/exec`
URL, execute-as `gauch@mtmorrisschools.org` and the Mt. Morris Consolidated Schools-only access
setting were read back in the deployment dialog before deploying and are unchanged. No workbook
schema change or migration was required; the schema remains `2026-09-02-a`.

**What was wrong.** `authorizeStudentAction` called `normalizeStudentAction_(requestedAction)` before
the line that translated the client's `AUTO_PASS` sentinel. `AUTO_PASS` is deliberately not a member
of `GD_STUDENT_ACTIONS`, so validation threw *"Refresh this page before trying that student action"*
and the translating line below it was unreachable. Every student bathroom request and every student
return failed for the life of Version 14 through Version 16. Daily check-in was unaffected, because
the client sends the literal `CHECKIN`, which is a real enum member. The teacher dashboard for
September 3 recorded 98 check-ins and zero student passes, which is the fault's exact signature.

**Why the gate missed it.** The path is reachable only after a real student PIN is accepted, and
every release smoke through Version 16 was deliberately run without submitting one. The structural
regression suite asserted that `authorizeStudentAction` appeared in the source; it never called it.

**The fix.** Resolve the sentinel first, then validate anything else. Git commit `5fe9670`.

**Verification before deploying.** The live editor's `Code.gs` was read back and matched the tracked
source byte for byte at 145,587 characters, SHA-256 prefix `b7af0b1c1a7afc00`, after accounting for
Apps Script's stripped final newline. `Index.html` was unchanged at 104,686 characters. Local gates
were 64 handoff validations, the structural suite, 89 behavioral checks across 15 areas, astro check
with 0 errors and 0 warnings across 68 files, a 51-page build, and static validation of 66 HTML
files and 2,709 local references.

**Verification after deploying.** Student, kiosk, check-in and teacher modes were each loaded against
the live deployment. Teacher mode returned in roughly fifteen seconds with no cold-start timeout,
which closes the September 3 recheck carried over from Version 16. The shared-log retry card read two
signals for the whole day against 98 check-ins, so the Version 15 and 16 contention work is holding.

### 2026-09-02 Version 16 shared-lock reduction release record

The source at Git commit `005ac93` was saved and released as Apps Script **Version 16** by updating the existing
deployment in place. Deployment ID `AKfycby2cAUsc1T0tTQkIWTrGwdOrfD2p5cX3EKBG3obW-QY2Ndd8T-cpjoT8bXU__on-qWa`,
the `/exec` URL, the execute-as-teacher identity and the Mt. Morris Consolidated Schools-only access setting were all
preserved. No workbook schema change or migration was required; the schema remains `2026-09-02-a`.

Before the update, the live editor's `Code.gs` was read back and matched the Version 14 through Version 15 baseline
character for character, proving there were no untracked live edits to overwrite. After saving, the project was
reloaded from the server and all three files were read back again and matched the tested source exactly.

Version 15 made the busy message recover by itself. Version 16 reduces how often it can happen at all, by cutting the
work each student write does while holding the one shared script lock:

- Daily Check-ins is append-only and is never purged, so every check-in used to scan the whole sheet inside the lock and
  got slower as the school year grew. `readCheckInsForDate_` now reads only the day being written. Rows arrive in
  chronological order, so the day is always at the tail; the window widens until it has actually passed an earlier day,
  and falls back to the full scan whenever that proof is unavailable, so the answer is never narrower than before.
- Prior-day pass rollover has work to do at most once per school day, but it rescanned the entire Pass Log inside every
  bathroom request and every return. `expirePreviousDayPassesIfDue_` records a rollover marker so the first student
  action of the day still does the scan and everyone after it skips it.
- The browser now has a forty-second recovery budget with a longer staggered retry schedule, so a whole class checking in
  at the bell is absorbed rather than surfacing as the busy message to whoever is last in line.

Local release checks passed: 60 handoff validations with zero failures, the full Hall Pass runtime suite including new
windowed-read and rollover-guard behavior tests, Astro and TypeScript checks with zero errors, the 51-page production
build, and 63-page static-route validation. Post-deployment checks passed for student, kiosk, daily check-in and private
teacher entry paths without using a real student PIN; the teacher dashboard returned inside ten seconds with no error
banner.

### 2026-09-02 Version 15 classroom-contention release record

The source at Git commit `0cb1a4a` was saved and released as Apps Script **Version 15** by updating the existing deployment in place. The deployment URL, deploying-teacher execution identity, and Mt. Morris Consolidated Schools-only access setting were preserved. No workbook schema change or migration was required.

Drive's saved `Code.gs`, `Index.html`, and `appsscript.json` were read back independently and matched the tested Version 15 source before deployment. Post-deployment checks passed for student, kiosk, daily check-in, and private teacher entry paths without using a real student PIN. Each path loaded its expected controls with no visible error banner.

This release reduces the student-facing “classroom system is handling other students” interruption in four ways:

- Student check-ins, pass requests, and returns now wait up to five seconds for the one shared workbook lock instead of failing immediately during a brief collision.
- The browser automatically retries only the exact, known-safe busy-lock response, with four short staggered delays after the first attempt. Unknown timeouts and generic errors are not retried because their outcomes may be uncertain.
- A student's one-use action proof remains available while the request waits and is consumed only after the server actually acquires the lock.
- The private teacher view records an approximate, identity-free daily count of busy-lock retry signals plus the latest operation type and time. It never stores a student name, email, PIN, token, pass ID, or check-in ID in that diagnostic.

Roster and PIN-address repair paths now refuse to overlap an active PIN-email batch, closing a separate shared-workbook race that could lengthen student waits. Local release checks passed the Hall Pass runtime suite, all 58 handoff validations, Astro/TypeScript checks, the 51-page production build, 63-page static-route validation, live-data validation, and the public-content shelf checks.

If a student still reaches the final busy message, it means several devices reached the private workbook at nearly the same time. The protected change did not begin, and the message does not mean the PIN is wrong. Wait five seconds and press once more, briefly stagger that group, or use the private teacher backup control.

### 2026-09-02 Version 14 Issue #14 release record

After local validation and workbook migration, the Issue #14 source at Git commit `b628bc0` was released as Apps Script **Version 14** by updating the existing deployment. The deployment URL did not change, and the configuration was verified as executing as the deploying teacher with access limited to Mt. Morris Consolidated Schools. This Version 14 source was read back immediately before the Version 15 contention release and preserved as its exact rollback baseline.

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
