# GrantDesk Classroom Log — one-time Google setup

1. Open the **GrantDesk Hall Pass — Private Log** Google Sheet using `gauch@mtmorrisschools.org`.
2. Paste the active roster into the **Roster** tab. Required columns are school email, student name, and class/period. A student may appear once per enrolled class; repeated email addresses are class-specific memberships and receive separate PINs. Leave PIN Hash blank; Active may be blank or TRUE.
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

The app also creates a private **Pass Queue** tab. When all concurrent pass slots are occupied, students can join the line and see only their own numbered position. The teacher sees the ordered line, can remove an entry, can set both the number allowed out at once and a total session pass limit, and can reset the session counter. A reset clears the waiting line but deliberately leaves active passes open and timing.

Daily check-in confirmations show each student’s current and best school-day streak. Saturday and Sunday are skipped when determining consecutive days, so a Friday-to-Monday check-in remains consecutive.

PIN email distribution groups multiple class PINs into one private message per school email. Preview first, then use the exact `EMAIL PINS` confirmation phrase. Already-sent PIN rows are skipped on later runs, delivery status is recorded on the private PIN Cards tab, and the server refuses to begin if the remaining daily recipient quota is below the ready recipient count.

For later code updates, replace `Code.gs` and `Index.html`, save, then choose **Deploy → Manage deployments → Edit → New version → Deploy**. Keep the existing web-app URL so GrantDesk links do not change.

Do not share the Google Sheet with students. The web app reads and writes it under the teacher account while limiting app access to the school Workspace domain. Student screens show only the active student’s own pass or check-in confirmation.
