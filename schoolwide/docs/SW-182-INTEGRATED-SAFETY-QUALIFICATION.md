# SW-182 — Combined nonproduction safety qualification

**Release boundary:** integration-only branch, NOT authorized for merge/deployment or student-facing use. Existing Hall Pass/Check-In, student lunch PINs, original Apps Script, private Schoolwide runtime and live student data remain unchanged.

## Why this was required

Four individually passing PRs were based on the same synthetic staging candidate, but their *combined* source and workflow had not been tested:

- SW-178 PR #484: disconnected legacy PIN handoff + disabled identity provider static CI guard.
- SW-179 PR #487: offline fictional-only teacher preview, diagnostics and safe privacy rehearsal.
- SW-180 PR #491: GitHub-only encrypted synthetic PostgreSQL backup, fresh-container restore, tamper/wrong-key rejection and teardown proof.
- SW-181 PR #495: verified signed issuer/school nonce scope must match PostgreSQL replay consumer's trusted scope.

SW-182 cherry-picked the seven source commits in those four PRs onto a new integration-only branch, preserving individual PRs and their review state. **The combination exposed defects individual PRs could not reveal.**

## Integration defects resolved

### 1. SW-178 guard versus SW-181 type import

The SW-181 replay adapter imported a type directly from the experimental signed-attestation module. The SW-178 CI protection correctly rejected imports from protected experimental modules in non-test source. Turning off or weakening the guard would hide an unsafe future runtime dependency.

**Fix:** move the nonce-consumption definition to a new compile-time-only neutral `synthetic-nonce-contract.ts`, imported with `import type` by both experimental modules. The attestation module re-exports the type for existing tests. No executable dependency or runtime import was introduced; the original guard and all six adversarial tests remain in force.

### 2. Teacher-kit ZIP byte reproducibility across Windows and Linux

The v0.2.0 builder read the two allowlisted text assets as raw checkout bytes. Windows CRLF versus Linux LF checkouts could yield different hashes and ZIP bytes for the same advertised package version, although repeat builds on one platform passed. The local integrated bundle demonstrated divergent byte hashes between different checkouts.

**Fix:** canonicalize both allowlisted UTF-8 text asset line endings to LF before computing SHA-256 and packaging; reject unsupported bare CR. Add a regression producing independent LF and CRLF input trees and requiring identical byte-for-byte ZIP output. This changes package bytes, so the corrected package is versioned **v0.2.1-prelaunch** with a distinct ZIP filename and manifest, rather than silently replacing v0.2.0. The previously delivered v0.2.0 package in TheAtlas Downloads is not overwritten.

## Acceptance and limits

- `npm run handoff:guard`: all six SW-178 adversarial tests.
- `npm run check`, `npm run build`, `npm run firewall`.
- `python3 scripts/test-teacher-kit.py`: 4 tests, including cross-platform ZIP equivalence, reproducibility, integrity and tamper rejection.
- `node scripts/test-teacher-kit-browser.mjs`: mobile/desktop layout, keyboard/print, fictional reset and denied real-network access.
- `bash -n scripts/ci-synthetic-encrypted-recovery.sh`.
- **Required GitHub Linux CI**: full synthetic database test suite including SW-181 wrong-school/issuer nonce denial and 35 concurrent attempts; full SW-180 GPG encryption/wrong-key/tamper/clean-restore/cleanup; v0.2.1 teacher preview; staging qualification; site check. All checks must pass at the exact SW-182 integration SHA.

Source and integration testing still cannot establish secure live source-PIN transfer, student identity proof, real Chromebook acceptance, district authorization, encrypted off-host *real* backup/key escrow, separate-machine recovery, or rollback. Do not activate a PIN endpoint, merge PR #433, or deploy to any public route based on SW-182 evidence alone. Claude must review the constituent PRs and composite before deciding merge order.
