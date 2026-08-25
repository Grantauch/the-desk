# GrantDesk Classroom Log — one-time Google setup

1. Open the **GrantDesk Hall Pass — Private Log** Google Sheet using `gauch@mtmorrisschools.org`.
2. Paste the active roster into the **Roster** tab. Required columns are school email, student name, and class/period. A student may appear once per enrolled class; repeated email addresses are class-specific memberships and receive separate PINs. Leave PIN Hash blank; Active may be blank or TRUE.
3. Open **Extensions → Apps Script**.
4. Replace `Code.gs` with the local `Code.gs` file, add an HTML file named `Index`, paste `Index.html`, and replace the manifest with `appsscript.json`.
5. Run `setupProject` once and approve the requested school-Google permissions.
6. Return to the Sheet and use **GrantDesk Pass → Generate missing student PINs**. Print/distribute the PIN Cards tab, then clear it from the same menu.
7. In Apps Script choose **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone in mtmorrisschools.org**
8. Copy the `/exec` URL. Hall-pass student mode is that URL; kiosk mode adds `?mode=kiosk`; daily check-in adds `?mode=checkin`; teacher mode adds `?mode=teacher`.
9. Put the student `/exec` URL into `src/data/pass-config.json`, then publish GrantDesk.

The first request after this version is installed creates a **Daily Check-ins** tab automatically. Each active roster student can receive only one `CHECKED_IN` row and one point per school date, even if the button is pressed repeatedly. The teacher view combines today’s roster counts, check-in log, backup check-in control, and hall-pass controls.

For later code updates, replace `Code.gs` and `Index.html`, save, then choose **Deploy → Manage deployments → Edit → New version → Deploy**. Keep the existing web-app URL so GrantDesk links do not change.

Do not share the Google Sheet with students. The web app reads and writes it under the teacher account while limiting app access to the school Workspace domain. Student screens show only the active student’s own pass or check-in confirmation.
