# SW-140 Legacy Read-Only Importer

## Scope

SW-140 implements the first migration bridge as a read-only structured-snapshot validator and dry-run planner. It does not connect to, mutate, deploy, or reconfigure the legacy Apps Script Hall Pass or its production workbook.

Allowed runtime modes in SW-140:

- `VALIDATE` — parse, bound, fingerprint, and report data-quality/reconciliation findings.
- `DRY_RUN` — produce deterministic proposed legacy-ID mappings and reconciliation evidence.

Not implemented in SW-140:

- `IMPORT_SHADOW`
- `IMPORT_PROD_PREP`
- `FINAL_DELTA`
- any legacy workbook write or Apps Script call
- any Schoolwide operational entity commit
- credential-secret transfer

The database migration introduces migration-run/mapping/finding tables for later approved commit modes. SW-140 validate/dry-run code does not write those tables.

## Snapshot contract

Every snapshot contains metadata (`sourceAlias`, `schemaVersion`, `exportedAt`, optional `highWaterMark`) and all named surfaces, using an empty array when a surface has no rows:

`roster`, `bellSchedule`, `schoolCalendar`, `settings`, `checkins`, `passLog`, `passAudit`, `passQueue`, `teacherActions`, `credentialCoverage`, `unmatchedSignIns`.

`sourceAlias` is a controlled alias, not a production workbook URL/ID. The importer computes a canonical SHA-256 fingerprint over the complete structured snapshot and reports per-surface row counts.

The general snapshot rejects PINs, PIN salts, credential hashes, action proofs, OAuth tokens/secrets, passwords, and related secret fields. `credentialCoverage` is count-oriented metadata only (`studentKey`, `hasCredential`, optional algorithm/version). Credential-secret transfer belongs to a later explicitly authorized bridge.

## Identity and evidence rules

- Display name is never a canonical identity key.
- A roster row without a stable student key fails reconciliation rather than being guessed.
- One student may appear in multiple sections; those are distinct memberships, not duplicate people.
- Pass Audit and Pass Log sharing the same Pass ID produce one proposed pass mapping.
- Unknown pass/countability/queue state is review-safe and never silently promoted to countable evidence.
- Unmatched sign-ins remain review evidence and never auto-create a student.
- Exported Settings are mandatory for a passing dry run; Code.gs defaults are never substituted.

## Internal API

- `POST /api/v1/internal/migration/legacy/validate`
- `POST /api/v1/internal/migration/legacy/dry-run`

Both require a current explicit Admin migration capability. Dry-run additionally requires the exact fingerprint returned for the same validated snapshot. There is intentionally no commit route in SW-140.

## Production firewall

SW-140 must keep all legacy production surfaces unchanged: Apps Script Version 18, private production workbook, stable `/exec`, grant-desk.com production routing, and `main`. Synthetic data only. Production impact must remain `NONE`.
