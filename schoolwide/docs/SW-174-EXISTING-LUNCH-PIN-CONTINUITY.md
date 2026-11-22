# SW-174 — Existing Hall Pass lunch-number PIN continuity

**Decision supplied by Grant (2026-11-22):** Lunch-number PINs are **already established** in the working Hall Pass. A Schoolwide rollout must preserve their value and existing student workflow, not reset the entire roster or ask students to learn another PIN.

## Source code findings — no real student records accessed

The tracked `apps-script/hall-pass/Code.gs` authenticates the existing roster by looking up the hashed PIN stored in `Roster` (`PIN Hash`). Its `hashPin_` computes **Base64URL(SHA-256(`PIN_SALT` + ':' + PIN-as-text))**, where `PIN_SALT` belongs to Apps Script script properties. The `PIN Cards` sheet has a separate `PIN` column used in issuance/recovery. The current tracked `verifyStudentPin_` expects **exactly six digits**. Do not presume that five-digit lunch numbers work on the existing kiosk without verifying its deployed version or whether those entries already have leading zeros.

The new Schoolwide server stores separate `student_credentials` verifiers (normally scrypt plus a separate pepper). Its current `LEGACY_SHA256_SALT_V1` code can verify the tracked Apps Script digest *with the correct salt and exact text PIN*, including WebSafe Base64's optional padding. The **synthetic** `legacy-pin-hash.unit.test.ts` proves the algorithms match for fictional five- and six-digit values. This is a compatibility proof, **not a secure cross-system credential transfer**.

The credential-continuity planner currently receives **redacted coverage** (whether a source credential exists), not the PIN, full PIN hash or original script salt. Source coverage alone cannot authenticate a user in Schoolwide. A source record with `hasCredential: true` but no *active usable* Schoolwide verifier must be `PROVISION_REQUIRED`, and the overall plan must be **REVIEW**, never PASS. Even a PASS from the current continuity planner verifies only that *some* Schoolwide credential record exists; it does **not** independently prove the secret is the same as the existing Hall Pass PIN. Final cutover therefore requires an additional approved same-PIN functional acceptance gate.

## Non-negotiable migration invariants

1. Existing Apps Script Hall Pass/Check-In remains authoritative during rehearsal; its workbook, script properties, PIN hash values, PIN Cards, student history and existing deployment URL are never rewritten by a dry run.
2. Never export, commit, log, email or put in Team Desk the real student PINs, PIN Cards, raw source hashes or `PIN_SALT`.
3. Preserve exact five- or six-digit *text* including leading zeros. Never silently coerce to number or infer an extra leading zero. The source's six-digit-only check is a known compatibility issue to reconcile before transition.
4. Reconcile student identity, school and each teacher's active class **independently**; a matching display name or a PIN hash alone does not establish a person or authorization.
5. An approved verifier migration/legacy authentication bridge must be reviewed, school-restricted, rate-limited, auditable, rollback-safe and proven with fictional data before connecting to real student information. If the source verifier cannot be safely reused, do not invent an automatic migration or secretly issue new PINs.
6. A final proof must show the **existing PIN**, after authorized identity selection, allows Check-In and Hall Pass in every approved class without reissuance, and still denies unknown/inactive students and unauthorized teacher sections. Run that test using approved real clients only after district and privacy authorization.
7. A completed read-only shadow/continuity report is not permission to enable student-facing authentication, import data, activate pending enrollments or cut over any public service.

## Verified synthetic acceptance

- `T-PIN-013` to `T-PIN-016`: exact 5/6-digit strings and leading zeros.
- `T-PIN-017` to `T-PIN-019`: pending/inactive enrollment gating and two-teacher isolation.
- `SW-174` crypto unit test: independent reproduction of the Apps Script source digest without real salts/PINs.
- `SW-174` continuity integration: source `hasCredential=true` with no Schoolwide verifier reports **REVIEW**, even when identity matches; all mapped students already having active Schoolwide verifier records may report PASS without altering hashes or versions. Neither result substitutes for same-PIN live functional proof.

## Remaining deployment decision

Select, design and security-review a permitted way to authenticate the same PIN across old and new systems. **No specific bridge is authorized or implemented here.** Require district/privacy sign-off and controlled real-client testing. Do not claim the new Schoolwide database already has the legacy credential just because the live Hall Pass does.
