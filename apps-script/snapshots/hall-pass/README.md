# GrantDesk Apps Script source snapshots

These folders preserve the two inputs used for the 2026-09-01 recovery release.

- `version-9-live-2026-08-29/` is the exact source and manifest recovered from the public deployment that GrantDesk linked to before this release. It contains schema `2026-08-28-a`, unmatched-sign-in recovery, student-payload privacy, locked cleanup, atomic PIN-email claiming, and the teacher-refresh repairs.
- `version-10-drive-supplied-2026-08-31/` is the exact `Code.gs` and `Index.html` supplied in Google Drive. It adds teacher roster management, but by itself rolls back several Version 9 protections and therefore must not be deployed directly.

The deployable source remains in `apps-script/hall-pass/`. It merges the supplied roster-management work onto the recovered Version 9 baseline and was released as Apps Script Version 11 on 2026-09-01 using the existing public deployment. These snapshots are evidence and rollback references only; do not copy an entire snapshot over the active source without repeating the comparison and tests.
