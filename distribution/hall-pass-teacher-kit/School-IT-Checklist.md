# Hall Pass — school IT review checklist

This document is for a **development preview**. Do not authorize real-student schoolwide deployment without a separate security review.

- [ ] Google Apps Script is permitted for the school-owned template and each teacher's account.
- [ ] Google Workspace administrators have approved the required OAuth scopes and Google Apps Script web-app deployment.
- [ ] Production web apps are restricted to the school domain, with teacher access enforced by the server.
- [ ] Dedicated Chromebook can open the `?mode=kiosk` web-app link and has a managed kiosk profile that does not expose a teacher's authenticated browser.
- [ ] Idle/screen-lock/auto-relaunch behavior, Wi-Fi disconnections, and device recovery have been tested.
- [ ] The device does not display or retain a student's entered lunch PIN after each action.
- [ ] School has approved reuse of cafeteria-payment credentials for Hall Pass; the security review includes strong server-derived rate limits and detection of guessing.
- [ ] Student directory source and verified email-to-ID mapping are approved by the school.
- [ ] Unassigned students have zero pass/check-in rights; teachers see only their own classes.
- [ ] Existing production deployment has a private backup, a tested cutover procedure, and a rollback plan.
- [ ] Exact installed ZIP and both kiosk/teacher URLs pass end-to-end tests with synthetic students before first real use.

**Never put a real roster, lunch number, student PIN, credential token, or exported activity log inside the ZIP or GitHub.**
