# GrantDesk Apps Script source snapshots

These folders preserve the inputs and live baselines used for additive GrantDesk releases.

- `version-9-live-2026-08-29/` is the exact source and manifest recovered from the public deployment that GrantDesk linked to before this release. It contains schema `2026-08-28-a`, unmatched-sign-in recovery, student-payload privacy, locked cleanup, atomic PIN-email claiming, and the teacher-refresh repairs.
- `version-10-drive-supplied-2026-08-31/` is the exact `Code.gs` and `Index.html` supplied in Google Drive. It adds teacher roster management, but by itself rolls back several Version 9 protections and therefore must not be deployed directly.
- `version-11-live-2026-09-01/` is the exact source and manifest read back from the live Version 11 project immediately before the next classroom-hardening release. Its `Code.gs` and `Index.html` hashes match the tracked deployable source at commit `383baf1`; the manifest remains domain-only and executes as the deploying teacher.
- `version-14-live-2026-09-02/` is the exact tracked source and manifest from commit `b628bc0`, independently matched to the Apps Script project immediately before the Version 15 update. It is the verified Issue #14 rollback baseline after the workbook migration and in-place Version 14 deployment.
- `version-15-live-2026-09-02/` is the exact tracked source and manifest from commit `0cb1a4a`, independently matched to Drive's saved Apps Script source before the in-place Version 15 deployment. It adds bounded student lock waits, safe automatic retries, privacy-safe contention diagnostics, and PIN-email batch guards without changing the workbook schema or public URL.

- `version-16-live-2026-09-02/` is the exact tracked source and manifest from commit `005ac93`, read back from the live
  Apps Script project after the in-place Version 16 update and matched character for character. It bounds the work each
  student write holds the shared script lock: a day-scoped Daily Check-ins read, a once-per-school-day prior-day pass
  rollover, and a forty-second client recovery budget. No workbook schema change was required.

The deployable source remains in `apps-script/hall-pass/`. These snapshots are evidence and rollback references only; do not copy an entire snapshot over the active source without repeating the comparison and tests.
