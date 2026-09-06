# GrantDesk Apps Script source snapshots

These folders preserve the inputs and live baselines used for additive GrantDesk releases.

## Do not roll bathroom service back to Version 14, 15 or 16

Versions 14, 15 and 16 all carry the AUTO_PASS defect: `authorizeStudentAction` validated the client's
`AUTO_PASS` sentinel before translating it, so every student pass request and every student return failed
with "Refresh this page before trying that student action" for the life of those three versions. Daily
check-in was unaffected, which is why the fault survived three releases. Deploying any of the three
restores that failure in front of a class.

The recovery baseline for protected student actions is the Version 17 architecture, which keeps the
Version 14 through Version 16 teacher and manual continuity and adds the tested forward fix. Use
`version-17-live-2026-09-03/`. The three snapshots below remain useful as evidence and for reading
teacher-side behavior, and for nothing else.

- `version-9-live-2026-08-29/` is the exact source and manifest recovered from the public deployment that GrantDesk linked to before this release. It contains schema `2026-08-28-a`, unmatched-sign-in recovery, student-payload privacy, locked cleanup, atomic PIN-email claiming, and the teacher-refresh repairs.
- `version-10-drive-supplied-2026-08-31/` is the exact `Code.gs` and `Index.html` supplied in Google Drive. It adds teacher roster management, but by itself rolls back several Version 9 protections and therefore must not be deployed directly.
- `version-11-live-2026-09-01/` is the exact source and manifest read back from the live Version 11 project immediately before the next classroom-hardening release. Its `Code.gs` and `Index.html` hashes match the tracked deployable source at commit `383baf1`; the manifest remains domain-only and executes as the deploying teacher.
- `version-14-live-2026-09-02/` is the exact tracked source and manifest from commit `b628bc0`, independently matched to the Apps Script project immediately before the Version 15 update. It was the Issue #14 rollback baseline after the workbook migration and in-place Version 14 deployment, and it is **not safe to redeploy**: it carries the AUTO_PASS defect described above.
- `version-15-live-2026-09-02/` is the exact tracked source and manifest from commit `0cb1a4a`, independently matched to Drive's saved Apps Script source before the in-place Version 15 deployment. It adds bounded student lock waits, safe automatic retries, privacy-safe contention diagnostics, and PIN-email batch guards without changing the workbook schema or public URL. It is **not safe to redeploy**: it carries the AUTO_PASS defect described above.

- `version-16-live-2026-09-02/` is the exact tracked source and manifest from commit `005ac93`, read back from the live
  Apps Script project after the in-place Version 16 update and matched character for character. It bounds the work each
  student write holds the shared script lock: a day-scoped Daily Check-ins read, a once-per-school-day prior-day pass
  rollover, and a forty-second client recovery budget. No workbook schema change was required. It is **not safe to
  redeploy**: it carries the AUTO_PASS defect described above.

- `version-17-live-2026-09-03/` is the exact tracked source and manifest from commit `5fe9670`, the commit
  DEPLOY.md records as the source released to Apps Script Version 17 on September 3, 2026. `Code.gs`, `Index.html`
  and `appsscript.json` are unchanged between that commit and current `main`. `FINGERPRINT.md` in the folder
  carries the character counts and SHA-256 digests, and its `Code.gs` digest begins `b7af0b1c1a7afc00`, matching
  the read-back recorded in DEPLOY.md. Version 17 resolves the AUTO_PASS sentinel before validating the student
  action and is the only safe baseline for protected student actions.

Line endings are normalized by Git on checkout, so compare a snapshot to the deployable source or to the live
Apps Script editor after stripping carriage returns. Apps Script also omits the final newline. A hash mismatch that
disappears under that normalization is not a source difference.

The deployable source remains in `apps-script/hall-pass/`. These snapshots are evidence and rollback references only; do not copy an entire snapshot over the active source without repeating the comparison and tests.

- `version-18-live-2026-09-06/` preserves the five files matched before the September 6 in-place release. It adds class sessions, membership allowances, private access policy, teacher action audit and synthetic release checks. See FINGERPRINT.md for hashes and migration/protected-action evidence. Preserve the additive workbook schema during recovery.
