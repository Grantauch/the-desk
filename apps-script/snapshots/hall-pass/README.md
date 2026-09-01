# GrantDesk Apps Script source snapshots

These folders preserve the inputs and live baselines used for additive GrantDesk releases.

- `version-9-live-2026-08-29/` is the exact source and manifest recovered from the public deployment that GrantDesk linked to before this release. It contains schema `2026-08-28-a`, unmatched-sign-in recovery, student-payload privacy, locked cleanup, atomic PIN-email claiming, and the teacher-refresh repairs.
- `version-10-drive-supplied-2026-08-31/` is the exact `Code.gs` and `Index.html` supplied in Google Drive. It adds teacher roster management, but by itself rolls back several Version 9 protections and therefore must not be deployed directly.
- `version-11-live-2026-09-01/` is the exact source and manifest read back from the live Version 11 project immediately before the next classroom-hardening release. Its `Code.gs` and `Index.html` hashes match the tracked deployable source at commit `383baf1`; the manifest remains domain-only and executes as the deploying teacher.

The deployable source remains in `apps-script/hall-pass/`. These snapshots are evidence and rollback references only; do not copy an entire snapshot over the active source without repeating the comparison and tests.
